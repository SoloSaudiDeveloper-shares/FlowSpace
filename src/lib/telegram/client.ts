/**
 * Tiny Telegram Bot API client. Server-side only — bot tokens are
 * sensitive and must never reach the browser.
 *
 * Docs: https://core.telegram.org/bots/api
 */

import "server-only"

const API_BASE = "https://api.telegram.org"

export type TelegramApiResult<T> =
  | { ok: true; result: T }
  | { ok: false; error_code?: number; description: string }

async function call<T>(
  token: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<TelegramApiResult<T>> {
  try {
    const res = await fetch(`${API_BASE}/bot${token}/${method}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      // Telegram occasionally takes its time on getUpdates; keep a safety net.
      signal: AbortSignal.timeout(15_000),
    })
    const data = (await res.json()) as
      | { ok: true; result: T }
      | { ok: false; error_code?: number; description?: string }
    if (data.ok) return { ok: true, result: data.result }
    return {
      ok: false,
      error_code: data.error_code,
      description: data.description ?? "Telegram API error",
    }
  } catch (err) {
    return {
      ok: false,
      description: err instanceof Error ? err.message : "Network error",
    }
  }
}

export interface TelegramUser {
  id: number
  is_bot: boolean
  first_name: string
  username?: string
  language_code?: string
}

export interface TelegramBotInfo extends TelegramUser {
  can_join_groups: boolean
  can_read_all_group_messages: boolean
  supports_inline_queries: boolean
}

export interface TelegramChat {
  id: number
  type: "private" | "group" | "supergroup" | "channel"
  username?: string
  first_name?: string
  last_name?: string
}

export interface TelegramMessage {
  message_id: number
  from?: TelegramUser
  chat: TelegramChat
  date: number
  text?: string
  caption?: string
  entities?: { type: string; offset: number; length: number }[]
  /** Voice note (OGG/Opus). Present when the user holds the mic button. */
  voice?: TelegramVoice
  /** Audio attachment (music file). We treat it the same as voice for transcribe. */
  audio?: TelegramAudio
  /** Video note (round video). Has audio we can transcribe too. */
  video_note?: { file_id: string; duration: number; file_size?: number }
  /** Older API: set when the message was forwarded from a private user. */
  forward_from?: TelegramUser
  /** Older API: name of the channel/user the message was forwarded from. */
  forward_sender_name?: string
  /** Newer API: a richer origin object. We only care that it exists. */
  forward_origin?: Record<string, unknown>
}

export interface TelegramVoice {
  file_id: string
  file_unique_id: string
  duration: number
  mime_type?: string
  file_size?: number
}

export interface TelegramAudio {
  file_id: string
  file_unique_id: string
  duration: number
  performer?: string
  title?: string
  mime_type?: string
  file_size?: number
}

export interface TelegramFile {
  file_id: string
  file_unique_id: string
  file_size?: number
  /** Relative path inside Telegram's CDN — combine with the download URL. */
  file_path?: string
}

// ── File download (for voice/audio transcription) ──────────────────────

export function getFile(token: string, fileId: string) {
  return call<TelegramFile>(token, "getFile", { file_id: fileId })
}

/** Build the CDN URL for a file given its `file_path` from getFile. */
export function fileDownloadUrl(token: string, filePath: string): string {
  return `https://api.telegram.org/file/bot${token}/${filePath}`
}

export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  edited_message?: TelegramMessage
  callback_query?: TelegramCallbackQuery
}

export interface TelegramCallbackQuery {
  id: string
  from: TelegramUser
  message?: TelegramMessage
  data?: string
  chat_instance: string
}

// ── Inline keyboards ────────────────────────────────────────────────────

export type InlineKeyboardButton =
  | { text: string; callback_data: string }
  | { text: string; url: string }

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][]
}

/** Build an inline keyboard from a row-major 2D array. Helper to keep
 *  callback_data sizing on a single line — Telegram enforces ≤64 bytes
 *  on `callback_data` and ≤64 chars on `text`. We assert here so bugs
 *  surface in our logs instead of as confusing Telegram errors. */
export function inlineKeyboard(rows: InlineKeyboardButton[][]): InlineKeyboardMarkup {
  for (const row of rows) {
    for (const btn of row) {
      if (btn.text.length > 64) {
        throw new Error(`Telegram button text too long: "${btn.text}"`)
      }
      if ("callback_data" in btn) {
        const bytes = new TextEncoder().encode(btn.callback_data).length
        if (bytes > 64) {
          throw new Error(`callback_data too long (${bytes}B>64): "${btn.callback_data}"`)
        }
      }
    }
  }
  return { inline_keyboard: rows }
}

// ── Bot identity ────────────────────────────────────────────────────────

export function getMe(token: string) {
  return call<TelegramBotInfo>(token, "getMe")
}

// ── Webhook management ──────────────────────────────────────────────────

export function setWebhook(
  token: string,
  url: string,
  secretToken: string,
) {
  return call<true>(token, "setWebhook", {
    url,
    secret_token: secretToken,
    // Limit to messages + button callbacks — keeps the inbound chatter small.
    allowed_updates: ["message", "edited_message", "callback_query"],
    // Drop any updates queued before we started listening — they're stale
    // and would arrive with the wrong webhook secret if the user reconnected.
    drop_pending_updates: true,
  })
}

export function deleteWebhook(token: string) {
  return call<true>(token, "deleteWebhook", { drop_pending_updates: true })
}

// ── Slash command registration ──────────────────────────────────────────

/**
 * Tell Telegram which slash commands the bot accepts. Telegram surfaces
 * them in the "/" autocomplete picker — a tiny UX touch that means users
 * never have to remember commands. We register this on bot connect.
 */
export function setMyCommands(
  token: string,
  commands: { command: string; description: string }[],
) {
  return call<true>(token, "setMyCommands", {
    commands,
    scope: { type: "default" },
  })
}

// ── Outbound messaging ──────────────────────────────────────────────────

export function sendMessage(
  token: string,
  chatId: number | string,
  text: string,
  opts: {
    parseMode?: "Markdown" | "MarkdownV2" | "HTML"
    replyMarkup?: InlineKeyboardMarkup | Record<string, unknown>
    disableNotification?: boolean
  } = {},
) {
  return call<TelegramMessage>(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: opts.parseMode,
    reply_markup: opts.replyMarkup,
    disable_notification: opts.disableNotification,
  })
}

// MarkdownV2 needs aggressive escaping — Telegram treats these as syntax:
//   _*[]()~`>#+-=|{}.!
// Pre-escaped text is the safest path for user-generated content.
export function escapeMarkdownV2(s: string): string {
  return s.replace(/[_*\[\]()~`>#+\-=|{}.!\\]/g, "\\$&")
}

/**
 * Send an audio file as a voice note (round mic-button playback in
 * Telegram). The file must be OGG/Opus per Telegram's spec; other
 * formats end up as a generic audio attachment.
 *
 * We POST multipart/form-data directly here rather than going through
 * the JSON `call` helper because Telegram's bot API requires multipart
 * for binary uploads.
 */
export async function sendVoice(
  token: string,
  chatId: number | string,
  audio: ArrayBuffer | Uint8Array | Blob,
  opts: {
    caption?: string
    parseMode?: "Markdown" | "MarkdownV2" | "HTML"
    durationSec?: number
    replyToMessageId?: number
  } = {},
): Promise<TelegramApiResult<TelegramMessage>> {
  try {
    const form = new FormData()
    form.append("chat_id", String(chatId))
    const blob =
      audio instanceof Blob
        ? audio
        : new Blob([audio as ArrayBuffer], { type: "audio/ogg" })
    form.append("voice", blob, "reply.ogg")
    if (opts.caption) form.append("caption", opts.caption)
    if (opts.parseMode) form.append("parse_mode", opts.parseMode)
    if (opts.durationSec) form.append("duration", String(opts.durationSec))
    if (opts.replyToMessageId)
      form.append("reply_to_message_id", String(opts.replyToMessageId))

    const res = await fetch(`${API_BASE}/bot${token}/sendVoice`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(30_000),
    })
    const data = (await res.json()) as
      | { ok: true; result: TelegramMessage }
      | { ok: false; error_code?: number; description?: string }
    if (data.ok) return { ok: true, result: data.result }
    return {
      ok: false,
      error_code: data.error_code,
      description: data.description ?? "Telegram sendVoice error",
    }
  } catch (err) {
    return {
      ok: false,
      description: err instanceof Error ? err.message : "Network error",
    }
  }
}

/** Edit an existing message in place. The user just tapped a button —
 *  we want to swap the message contents and buttons without dumping a
 *  new line in the chat. */
export function editMessageText(
  token: string,
  chatId: number | string,
  messageId: number,
  text: string,
  opts: {
    parseMode?: "Markdown" | "MarkdownV2" | "HTML"
    replyMarkup?: InlineKeyboardMarkup
  } = {},
) {
  return call<TelegramMessage>(token, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: opts.parseMode,
    reply_markup: opts.replyMarkup,
  })
}

/** Acknowledge a callback_query so Telegram clears its loading spinner.
 *  Optional `text` shows a toast at the top of chat; `show_alert: true`
 *  shows it as a modal instead. Must be called within ~30 seconds or the
 *  user sees a perpetual "Loading…" indicator. */
export function answerCallbackQuery(
  token: string,
  callbackQueryId: string,
  opts: { text?: string; showAlert?: boolean; cacheTime?: number } = {},
) {
  return call<true>(token, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text: opts.text,
    show_alert: opts.showAlert,
    cache_time: opts.cacheTime,
  })
}
