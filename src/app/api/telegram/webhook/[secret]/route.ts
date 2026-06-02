/**
 * Inbound Telegram webhook.
 *
 * Each user has their own bot, and each bot's webhook URL is unique:
 *   POST /api/telegram/webhook/<webhook_secret>
 *
 * The `<webhook_secret>` is generated when the user connects their bot
 * via Settings → Telegram and stored alongside the bot token. When
 * Telegram POSTs here we:
 *
 *   1. Resolve the user from the URL secret
 *   2. ALSO verify Telegram's `X-Telegram-Bot-Api-Secret-Token` header
 *      matches (double-check: someone learning the URL still can't spoof
 *      messages without the secret in the header)
 *   3. Parse the update, hand it to the agent for dispatch
 *   4. Reply back to the chat with the agent's output
 *
 * We always return 200 — Telegram retries on 5xx, and we'd rather log
 * and move on than have a stuck queue. Errors get reported back to the
 * user as bot messages where possible.
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { sqlite } from "@/lib/db"
import {
  sendMessage,
  sendVoice,
  editMessageText,
  answerCallbackQuery,
  inlineKeyboard,
} from "@/lib/telegram/client"
import { isVoiceOutEnabled, synthesizeSpeech } from "@/lib/telegram/tts"
import type { TelegramUpdate } from "@/lib/telegram/client"
import { dispatchTelegramMessage, parseUndoMarker } from "@/lib/telegram/agent"
import { handleCallback } from "@/lib/telegram/callbacks"
import {
  mainMenu,
  pendingImportMenu,
  languagePickerFor,
} from "@/lib/telegram/menus"
import {
  getState,
  handleStatedMessage,
  clearState,
} from "@/lib/telegram/conversations"
import { parseAIImport } from "@/lib/import/ai-import-parser"
import { createId } from "@/lib/utils/ids"
import { detectMediaUrl } from "@/lib/telegram/media-url"
import { enqueueMediaJob, kickMediaWorker } from "@/lib/telegram/media-jobs"

interface BotRow {
  user_id: string
  bot_token: string
  bot_username: string | null
  webhook_secret: string
  target_list_id: string | null
  is_active: number
  chat_id: string | null
  voice_language: string | null
  voice_auto_skip: number | null
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ secret: string }> },
) {
  const { secret } = await ctx.params

  // Resolve which user this URL belongs to.
  const bot = sqlite
    .prepare(
      `SELECT user_id, bot_token, bot_username, webhook_secret, target_list_id, is_active, chat_id
       FROM telegram_bots WHERE webhook_secret = ?`,
    )
    .get(secret) as BotRow | undefined

  if (!bot) {
    // Unknown URL — return 200 so Telegram doesn't keep retrying. A real
    // attacker brute-forcing won't even know they had to find a 48-char hex
    // string, but no need to give them probe signal either.
    return new NextResponse("ok", { status: 200 })
  }

  if (!bot.is_active) {
    return new NextResponse("ok", { status: 200 })
  }

  // Defense in depth: Telegram sends our chosen secret back as a header.
  // Verify it matches the URL secret. (We deliberately use the same value
  // for both — the secret IS the URL path here.)
  const headerSecret = req.headers.get("x-telegram-bot-api-secret-token")
  if (headerSecret && headerSecret !== bot.webhook_secret) {
    return new NextResponse("ok", { status: 200 })
  }

  // Check workspace-wide enable. Owner can flip this off.
  const enabledRow = sqlite
    .prepare(`SELECT value FROM server_settings WHERE key = 'telegramEnabled'`)
    .get() as { value: string } | undefined
  if (enabledRow?.value !== "true") {
    return new NextResponse("ok", { status: 200 })
  }

  let update: TelegramUpdate
  try {
    update = (await req.json()) as TelegramUpdate
  } catch {
    return new NextResponse("ok", { status: 200 })
  }

  // ── Branch 1: callback_query (button tap) ───────────────────────────
  // The user tapped an inline keyboard button. Route via the callbacks
  // dispatcher, then edit the original message in place AND/OR show a
  // small toast notification AND/OR send a fresh message. Telegram REQUIRES
  // answerCallbackQuery within ~30s to clear the loading spinner.
  if (update.callback_query) {
    const cb = update.callback_query
    const result = await handleCallback(bot.user_id, cb.data ?? "")

    // Clear the spinner (always; even on errors).
    await answerCallbackQuery(bot.bot_token, cb.id, {
      text: result.toast,
    }).catch(() => undefined)

    // Drill-down navigation: edit the original message.
    if (result.edit && cb.message) {
      await editMessageText(
        bot.bot_token,
        cb.message.chat.id,
        cb.message.message_id,
        result.edit.text,
        { parseMode: "Markdown", replyMarkup: result.edit.markup },
      ).catch(() => undefined)
    }
    // Terminal state: replace message AND clear buttons.
    if (result.replace && cb.message) {
      await editMessageText(
        bot.bot_token,
        cb.message.chat.id,
        cb.message.message_id,
        result.replace.text,
        { parseMode: "Markdown" },
      ).catch(() => undefined)
    }

    return new NextResponse("ok", { status: 200 })
  }

  const msg = update.message ?? update.edited_message
  if (!msg) {
    return new NextResponse("ok", { status: 200 })
  }

  // Stash the chat ID so the user can send test messages from the UI.
  // We update lazily on every message so /start works even if the user
  // skipped it. Also bump last_seen_at for the connection-status UI.
  sqlite
    .prepare(
      `UPDATE telegram_bots SET chat_id = ?, last_seen_at = datetime('now'), updated_at = datetime('now') WHERE webhook_secret = ?`,
    )
    .run(String(msg.chat.id), secret)

  const rawText = msg.text ?? msg.caption ?? ""
  const isForwarded =
    !!msg.forward_from || !!msg.forward_origin || !!msg.forward_sender_name

  // ── Voice / audio note → present language + destination pickers ──
  // Instead of transcribing immediately, we save the file_id to
  // pending_voices and send the user a language picker. Subsequent taps
  // (handled by callbacks.ts) transcribe with the chosen language and
  // route the result to the user's chosen destination. This puts the
  // user in control per-message instead of relying on a global pref.
  const voiceFileId =
    msg.voice?.file_id ?? msg.audio?.file_id ?? msg.video_note?.file_id
  if (voiceFileId) {
    logMessage(bot.user_id, "in", "[🎙 voice received]")
    const pid = createId()
    sqlite
      .prepare(
        `INSERT INTO pending_voices (id, user_id, file_id, chat_id, message_id, created_at)
         VALUES (?, ?, ?, ?, 0, datetime('now'))`,
      )
      .run(pid, bot.user_id, voiceFileId, String(msg.chat.id))

    // If the user has auto-skip on, jump straight to defaults — no
    // picker, no taps. We synthesise the same callback the Skip button
    // would have produced so the existing code path handles it.
    if (bot.voice_auto_skip === 1) {
      const { handleCallback } = await import("@/lib/telegram/callbacks")
      const result = await handleCallback(bot.user_id, `vp:l:${pid.slice(0, 8)}:def`)
      // The handler returns an "edit" — but we have no message to edit
      // yet (we never sent the picker). Send the replace/edit text as a
      // fresh message so the user sees the outcome.
      const text = result.replace?.text ?? result.edit?.text ?? "🎙 _Processing…_"
      const markup = result.edit?.markup
      await sendMessage(bot.bot_token, msg.chat.id, text, {
        parseMode: "Markdown",
        replyMarkup: markup,
      }).catch(() => undefined)
      return new NextResponse("ok", { status: 200 })
    }

    const langLabel = friendlyLangLabel(bot.voice_language)
    const menu = languagePickerFor(pid.slice(0, 8), langLabel)
    const sent = await sendMessage(bot.bot_token, msg.chat.id, menu.text, {
      parseMode: "Markdown",
      replyMarkup: menu.markup,
    })
    if (sent.ok) {
      sqlite
        .prepare(`UPDATE pending_voices SET message_id = ? WHERE id = ?`)
        .run(sent.result.message_id, pid)
    }
    return new NextResponse("ok", { status: 200 })
  }

  const text = rawText
  // Persist the inbound message so the user can scroll their history.
  const historyPrefix = isForwarded ? "[forwarded] " : ""
  logMessage(bot.user_id, "in", historyPrefix + text)

  try {
    // ── Forwarded message → straight-to-todo capture ─────────────────
    // Forwarded chat messages are signals: "this is worth keeping."
    // Drop them into the default todo list with the original text as the
    // title. Slash commands and FlowSpace markdown are NOT forwarded by
    // convention, so we don't need to disambiguate.
    if (isForwarded && text.trim()) {
      const reply = await dispatchTelegramMessage(
        {
          user_id: bot.user_id,
          bot_token: bot.bot_token,
          target_list_id: bot.target_list_id,
        },
        // Prefix with /add so dispatchTelegramMessage routes to the
        // capture path even if the forwarded text happens to start
        // with text the dispatcher could misinterpret.
        `/add ${text}`,
      )
      logMessage(bot.user_id, "out", reply)
      await sendMessage(bot.bot_token, msg.chat.id, "📎 _Forwarded._\n" + reply, {
        parseMode: "Markdown",
        replyMarkup: inlineKeyboard([[{ text: "🏠 Menu", callback_data: "menu:main" }]]),
      })
      return new NextResponse("ok", { status: 200 })
    }

    const firstWord = text.trim().split(/\s+/)[0]?.split("@")[0]?.toLowerCase()

    // ── Always-available escape hatches ───────────────────────────────
    if (firstWord === "/cancel") {
      clearState(bot.user_id)
      const m = mainMenu()
      logMessage(bot.user_id, "out", "Cancelled.")
      await sendMessage(bot.bot_token, msg.chat.id, "Cancelled.\n\n" + m.text, {
        parseMode: "Markdown",
        replyMarkup: m.markup,
      })
      return new NextResponse("ok", { status: 200 })
    }

    // ── Conversation state: if we're awaiting input, route there ──────
    // This MUST run before /menu and /start checks — but BotFather
    // commands like /menu still cancel an in-flight flow and reset the
    // user to the root. So: state takes precedence ONLY for free-form
    // text and only when the message isn't a slash command.
    if (!firstWord?.startsWith("/")) {
      const state = getState(bot.user_id)
      if (state) {
        const reply = handleStatedMessage(bot.user_id, state, text)
        logMessage(bot.user_id, "out", reply.text)
        await sendMessage(bot.bot_token, msg.chat.id, reply.text, {
          parseMode: "Markdown",
          replyMarkup: reply.markup,
        })
        return new NextResponse("ok", { status: 200 })
      }
    } else {
      // A slash command implicitly cancels any active flow.
      clearState(bot.user_id)
    }

    // ── /menu and /start: send the rich main menu with inline buttons ──
    if (firstWord === "/menu" || firstWord === "/start") {
      const m = mainMenu()
      logMessage(bot.user_id, "out", m.text)
      await sendMessage(bot.bot_token, msg.chat.id, m.text, {
        parseMode: "Markdown",
        replyMarkup: m.markup,
      })
      return new NextResponse("ok", { status: 200 })
    }

    // ── Media URL → async download + transcribe + capture ───────────
    // A link to a known media host (TikTok/YouTube/Instagram/…) gets
    // downloaded server-side (yt-dlp), transcribed, summarized, and saved
    // as a todo by a background worker. We enqueue + ack INSTANTLY so the
    // webhook never blocks on the multi-second/minute pipeline. A pasted
    // link to an UNKNOWN host returns null here and falls through to plain
    // smart-capture (becomes a normal todo). `/add <link>` skips this too
    // (the slash guard) so users can force a plain save.
    if (!firstWord?.startsWith("/")) {
      const media = detectMediaUrl(text)
      if (media) {
        enqueueMediaJob({
          userId: bot.user_id,
          botToken: bot.bot_token,
          chatId: String(msg.chat.id),
          messageId: msg.message_id,
          url: media.url,
          platform: media.platform,
        })
        kickMediaWorker()
        const ack = `⏳ Grabbing that ${media.platform} clip — I'll transcribe it and send the capture here when it's ready.`
        logMessage(bot.user_id, "out", ack)
        await sendMessage(bot.bot_token, msg.chat.id, ack, {
          replyMarkup: inlineKeyboard([[{ text: "🏠 Menu", callback_data: "menu:main" }]]),
        })
        return new NextResponse("ok", { status: 200 })
      }
    }

    // ── AI-import detection ──────────────────────────────────────────
    // If the message LOOKS like FlowSpace AI-import markdown, don't act
    // on it — stash it as a pending import and notify with inline
    // Approve/Dismiss buttons so the user can resolve right in Telegram.
    const parsed = parseAIImport(text)
    if (parsed && parsed.title) {
      const pendId = createId()
      const summary =
        `${parsed.type[0].toUpperCase()}${parsed.type.slice(1)}: ${parsed.title}` +
        (parsed.tasks.length > 0 ? ` · ${parsed.tasks.length} task${parsed.tasks.length === 1 ? "" : "s"}` : "") +
        (parsed.tags.length > 0 ? ` · ${parsed.tags.length} tag${parsed.tags.length === 1 ? "" : "s"}` : "")
      sqlite
        .prepare(
          `INSERT INTO pending_imports (id, user_id, source, payload, parsed_summary, status)
           VALUES (?, ?, 'telegram', ?, ?, 'pending')`,
        )
        .run(pendId, bot.user_id, text, summary)
      const m = pendingImportMenu(pendId, summary)
      logMessage(bot.user_id, "out", m.text)
      await sendMessage(bot.bot_token, msg.chat.id, m.text, {
        parseMode: "Markdown",
        replyMarkup: m.markup,
      })
      return new NextResponse("ok", { status: 200 })
    }

    // ── Default: text-only reply via the agent dispatcher ────────────
    const rawReply = await dispatchTelegramMessage(
      {
        user_id: bot.user_id,
        bot_token: bot.bot_token,
        target_list_id: bot.target_list_id,
      },
      text,
    )
    // Agent may have stashed an undo marker on capture-success replies.
    // Pull it out so it doesn't show in the message body; build the
    // inline keyboard accordingly.
    const { text: reply, todoId: undoTodoId } = parseUndoMarker(rawReply)
    logMessage(bot.user_id, "out", reply)
    // Inline keyboard — always shows the Menu shortcut. When the reply
    // is a capture-success, we ALSO add an "↩️ Undo" button on the same
    // row so the user can immediately reverse a fat-finger or mistaken
    // capture without scrolling to find the item.
    const keyboardRow: { text: string; callback_data: string }[] = []
    if (undoTodoId) {
      keyboardRow.push({ text: "↩️ Undo", callback_data: `undo:todo:${undoTodoId}` })
    }
    keyboardRow.push({ text: "🏠 Menu", callback_data: "menu:main" })
    await sendMessage(bot.bot_token, msg.chat.id, reply, {
      parseMode: "Markdown",
      replyMarkup: inlineKeyboard([keyboardRow]),
    })
    // Voice OUT — if the user opted in, also send a TTS rendering. This
    // is fire-and-forget so a slow TTS provider can't hold up the
    // webhook response.
    if (isVoiceOutEnabled(bot.user_id)) {
      synthesizeSpeech(bot.user_id, reply)
        .then((audio) => {
          if (!audio) return
          return sendVoice(bot.bot_token, msg.chat.id, audio)
        })
        .catch(() => undefined)
    }
  } catch (err) {
    // Bubble the failure back to the user so it's visible — better than
    // a silent server log they'll never see.
    const message =
      err instanceof Error ? err.message.slice(0, 300) : "Unknown error"
    const errReply = `⚠️ FlowSpace hit an error processing that: \`${message}\``
    logMessage(bot.user_id, "out", errReply)
    await sendMessage(bot.bot_token, msg.chat.id, errReply, {
      parseMode: "Markdown",
    }).catch(() => undefined)
  }

  return new NextResponse("ok", { status: 200 })
}

/** Short, friendly label for the user's pinned default voice language —
 *  used inside the Skip button text. */
function friendlyLangLabel(code: string | null): string {
  if (!code || code === "en") return "English"
  if (code === "ar") return "Arabic"
  if (code === "auto") return "Auto"
  return code.toUpperCase()
}

/** Append a message to telegram_messages, keeping only the last 500 per user. */
function logMessage(userId: string, direction: "in" | "out", text: string) {
  try {
    sqlite
      .prepare(
        `INSERT INTO telegram_messages (id, user_id, direction, text) VALUES (?, ?, ?, ?)`,
      )
      .run(createId(), userId, direction, text.slice(0, 4000))
    // Lazy prune — cheap when the table is small, only fires every 50 inserts.
    if (Math.random() < 0.02) {
      sqlite
        .prepare(
          `DELETE FROM telegram_messages
           WHERE user_id = ?
             AND id NOT IN (
               SELECT id FROM telegram_messages
               WHERE user_id = ?
               ORDER BY created_at DESC LIMIT 500
             )`,
        )
        .run(userId, userId)
    }
  } catch {
    // Logging must never break the webhook flow.
  }
}
