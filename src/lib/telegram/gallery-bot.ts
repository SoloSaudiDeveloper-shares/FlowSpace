/**
 * In-bot gallery browser.
 *
 * Lets the user flip through their Gallery one photo at a time, right inside
 * Telegram. Each view is a single photo message showing a *short* caption
 * (≈3 lines — full captions are long now), the album, and a comment count.
 * ⬅️/➡️ navigate by editing the same message in place (editMessageMedia) so
 * browsing doesn't spam the chat; 💬 sends the full comment list as a reply.
 *
 * Photo captions are sent as PLAIN text (no parse_mode) so arbitrary Arabic /
 * AI caption content can never break Telegram's Markdown parser.
 */

import "server-only"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { sqlite } from "@/lib/db"
import { getDataDir } from "@/lib/utils/data-dir"
import {
  sendPhoto,
  editMessageMedia,
  sendMessage,
  inlineKeyboard,
} from "@/lib/telegram/client"

interface BotConn {
  token: string
  chatId: string
}

function botFor(userId: string): BotConn | null {
  const bot = sqlite
    .prepare(`SELECT bot_token, chat_id FROM telegram_bots WHERE user_id = ?`)
    .get(userId) as { bot_token: string; chat_id: string | null } | undefined
  if (!bot?.bot_token || !bot.chat_id) return null
  return { token: bot.bot_token, chatId: bot.chat_id }
}

interface ViewRow {
  id: string
  file_path: string
  caption: string | null
  caption_status: string | null
  album: string | null
  comments: number
}

function imageAt(
  userId: string,
  index: number,
): { row: ViewRow | null; total: number; index: number } {
  const total =
    (
      sqlite
        .prepare(`SELECT COUNT(*) AS n FROM gallery_images WHERE user_id = ?`)
        .get(userId) as { n: number }
    ).n ?? 0
  if (total === 0) return { row: null, total: 0, index: 0 }
  const i = Math.max(0, Math.min(total - 1, index))
  const row = sqlite
    .prepare(
      `SELECT g.id, g.file_path, g.caption, g.caption_status,
              a.name AS album,
              (SELECT COUNT(*) FROM gallery_comments c WHERE c.image_id = g.id) AS comments
       FROM gallery_images g
       LEFT JOIN gallery_albums a ON a.id = g.album_id
       WHERE g.user_id = ?
       ORDER BY g.created_at DESC
       LIMIT 1 OFFSET ?`,
    )
    .get(userId, i) as ViewRow | undefined
  return { row: row ?? null, total, index: i }
}

/** Trim a (potentially very long) caption to ≈3 lines for the photo card. */
function shortCaption(caption: string | null, status: string | null): string {
  const text = (caption ?? "").trim()
  if (!text) {
    return status === "pending"
      ? "✨ Captioning…"
      : status === "failed"
        ? "⚠️ Caption failed"
        : "No caption yet."
  }
  // Keep at most 3 lines, then cap the overall length.
  let s = text.split(/\r?\n/).slice(0, 3).join("\n")
  const MAX = 220
  if (s.length > MAX) s = s.slice(0, MAX).trimEnd() + "…"
  else if (s.length < text.length) s = s.trimEnd() + " …"
  return s
}

function viewCaption(row: ViewRow, index: number, total: number): string {
  return [
    shortCaption(row.caption, row.caption_status),
    "",
    `📁 ${row.album ?? "Unsorted"}  ·  💬 ${row.comments}  ·  ${index + 1}/${total}`,
  ].join("\n")
}

function viewKeyboard(row: ViewRow, index: number, total: number) {
  return inlineKeyboard([
    [
      { text: "⬅️", callback_data: `gv:i:${Math.max(0, index - 1)}` },
      { text: `💬 ${row.comments}`, callback_data: `gv:c:${row.id}` },
      { text: "➡️", callback_data: `gv:i:${Math.min(total - 1, index + 1)}` },
    ],
    [{ text: "🏠 Menu", callback_data: "menu:main" }],
  ])
}

async function readImageBytes(filePath: string): Promise<Buffer | null> {
  try {
    return await readFile(
      path.join(getDataDir(), "uploads", path.basename(filePath)),
    )
  } catch {
    return null
  }
}

/**
 * Open the gallery viewer (called from the main-menu 🖼 Gallery button).
 * Always sends a NEW photo message — you can't edit a text message into a
 * photo. Navigation afterwards edits this message in place.
 */
export async function openGalleryInBot(userId: string): Promise<void> {
  const bot = botFor(userId)
  if (!bot) return
  const { row, total, index } = imageAt(userId, 0)
  if (!row || total === 0) {
    await sendMessage(
      bot.token,
      bot.chatId,
      "🖼 Your gallery is empty. Send me a photo and I'll add it (and auto-caption it).",
      {
        replyMarkup: inlineKeyboard([
          [{ text: "🏠 Menu", callback_data: "menu:main" }],
        ]),
      },
    ).catch(() => undefined)
    return
  }
  const bytes = await readImageBytes(row.file_path)
  if (!bytes) {
    await sendMessage(bot.token, bot.chatId, "Couldn't load that image file.").catch(
      () => undefined,
    )
    return
  }
  await sendPhoto(bot.token, bot.chatId, bytes, {
    caption: viewCaption(row, index, total),
    replyMarkup: viewKeyboard(row, index, total),
  }).catch(() => undefined)
}

/**
 * Navigate to the image at `index`, editing the existing photo message in
 * place. No-op (silently) if the edit fails — e.g. tapping ⬅️ at the first
 * image edits to identical content and Telegram returns "not modified".
 */
export async function navigateGalleryInBot(
  userId: string,
  messageId: number,
  index: number,
): Promise<void> {
  const bot = botFor(userId)
  if (!bot) return
  const { row, total, index: i } = imageAt(userId, index)
  if (!row || total === 0) return
  const bytes = await readImageBytes(row.file_path)
  if (!bytes) return
  await editMessageMedia(bot.token, bot.chatId, messageId, bytes, {
    caption: viewCaption(row, i, total),
    replyMarkup: viewKeyboard(row, i, total),
  }).catch(() => undefined)
}

/** Send the full comment list for an image as a reply message. */
export async function sendGalleryComments(
  userId: string,
  imageId: string,
): Promise<void> {
  const bot = botFor(userId)
  if (!bot) return
  const owns = sqlite
    .prepare(`SELECT id FROM gallery_images WHERE id = ? AND user_id = ?`)
    .get(imageId, userId) as { id: string } | undefined
  if (!owns) return
  const comments = sqlite
    .prepare(
      `SELECT body FROM gallery_comments WHERE image_id = ? ORDER BY created_at ASC`,
    )
    .all(imageId) as { body: string }[]
  const text =
    comments.length === 0
      ? "💬 No comments on this image yet."
      : ["💬 Comments", "", ...comments.map((c) => `• ${c.body}`)].join("\n")
  await sendMessage(bot.token, bot.chatId, text.slice(0, 4000)).catch(
    () => undefined,
  )
}
