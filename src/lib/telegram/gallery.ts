/**
 * Save a photo pushed through the Telegram bot into the user's Gallery.
 *
 * Downloads the file from Telegram's CDN (bound by the 20 MB getFile cap —
 * fine for photos), writes it under <DATA_DIR>/uploads, and inserts a
 * gallery_images row. The image is later served (owner-scoped) via
 * /api/gallery/[id].
 */

import "server-only"
import { writeFile, mkdir, readFile } from "node:fs/promises"
import path from "node:path"
import { sqlite } from "@/lib/db"
import { createId } from "@/lib/utils/ids"
import { getDataDir } from "@/lib/utils/data-dir"
import { getFile, fileDownloadUrl } from "@/lib/telegram/client"

function extForMime(mime: string | null | undefined): string {
  switch ((mime || "").toLowerCase()) {
    case "image/png": return ".png"
    case "image/webp": return ".webp"
    case "image/gif": return ".gif"
    case "image/heic": return ".heic"
    case "image/jpeg":
    case "image/jpg":
    default: return ".jpg"
  }
}

export async function saveGalleryImage(opts: {
  userId: string
  botToken: string
  fileId: string
  caption?: string | null
  mime?: string | null
  width?: number | null
  height?: number | null
  source?: string
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  // 1. resolve the file on Telegram's CDN
  const f = await getFile(opts.botToken, opts.fileId)
  if (!f.ok) {
    const tooBig = /too big/i.test(f.description || "")
    return { ok: false, error: tooBig ? "image over Telegram's 20 MB bot limit" : f.description }
  }
  const p = f.result.file_path
  if (!p) return { ok: false, error: "Telegram returned no file path." }

  // 2. download the bytes
  let bytes: ArrayBuffer
  try {
    const res = await fetch(fileDownloadUrl(opts.botToken, p), { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) return { ok: false, error: `download failed: ${res.status}` }
    bytes = await res.arrayBuffer()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "download error" }
  }

  // 3. write to disk + insert the row
  const id = createId()
  const mime = opts.mime || "image/jpeg"
  const fileName = `gallery-${id}${extForMime(mime)}`
  try {
    const uploadsDir = path.join(getDataDir(), "uploads")
    await mkdir(uploadsDir, { recursive: true })
    await writeFile(path.join(uploadsDir, fileName), Buffer.from(bytes))
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "could not save file" }
  }

  try {
    // If no caption was provided we'll auto-describe — mark 'pending' up front
    // so the Gallery shows a "captioning…" spinner immediately.
    const initialStatus = opts.caption?.trim() ? null : "pending"
    sqlite
      .prepare(
        `INSERT INTO gallery_images (id, user_id, file_path, mime, caption, caption_status, width, height, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        opts.userId,
        fileName,
        mime,
        opts.caption?.trim() || null,
        initialStatus,
        opts.width ?? null,
        opts.height ?? null,
        opts.source || "telegram",
      )
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "db insert failed" }
  }

  return { ok: true, id }
}

/**
 * "Identify" an image with the user's vision-capable AI model and store a
 * short caption. Safe to fire-and-forget from the webhook — it takes a
 * userId (no request context) and never throws. By default only fills an
 * EMPTY caption (so it won't clobber a user-written one); pass overwrite to
 * force a re-describe.
 */
function setCaptionStatus(imageId: string, userId: string, status: string | null): void {
  try {
    sqlite.prepare(`UPDATE gallery_images SET caption_status = ? WHERE id = ? AND user_id = ?`).run(status, imageId, userId)
  } catch { /* ignore */ }
}

/** Build the language instruction for the caption prompt from the user's
 *  caption_lang preference (set via /caption). */
function captionLanguageClause(userId: string): string {
  const row = sqlite
    .prepare(`SELECT caption_lang FROM telegram_bots WHERE user_id = ?`)
    .get(userId) as { caption_lang: string | null } | undefined
  const lang = (row?.caption_lang || "auto").trim().toLowerCase()
  if (!lang || lang === "auto") return ""
  if (lang === "en") return " Write the caption in English."
  if (lang === "ar") return " Write the caption in Arabic (العربية)."
  return ` Write the caption in ${lang}.`
}

export async function describeGalleryImage(
  userId: string,
  imageId: string,
  opts: { overwrite?: boolean; notify?: boolean } = {},
): Promise<{ ok: true; caption: string } | { ok: false; error: string }> {
  const row = sqlite
    .prepare(`SELECT file_path, mime, caption FROM gallery_images WHERE id = ? AND user_id = ?`)
    .get(imageId, userId) as { file_path: string; mime: string | null; caption: string | null } | undefined
  if (!row) return { ok: false, error: "image not found" }
  if (!opts.overwrite && row.caption?.trim()) return { ok: false, error: "already captioned" }

  // Local-first vision (self-hosted Ollama/moondream) → cloud fallback.
  const { resolveVisionConfig } = await import("@/lib/ai/vision-config")
  const cfg = resolveVisionConfig(userId)
  if (!cfg) {
    setCaptionStatus(imageId, userId, null) // no provider — clear any spinner
    return { ok: false, error: "no vision provider" }
  }
  setCaptionStatus(imageId, userId, "pending")

  // Build a data URL from the stored file.
  let dataUrl: string
  try {
    const bytes = await readFile(path.join(getDataDir(), "uploads", path.basename(row.file_path)))
    dataUrl = `data:${row.mime || "image/jpeg"};base64,${bytes.toString("base64")}`
  } catch {
    setCaptionStatus(imageId, userId, "failed")
    return { ok: false, error: "could not read file" }
  }

  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Describe this image in ONE short caption (max ~20 words). If it contains readable text, capture the key text instead. Reply with just the caption — no preamble." +
                  captionLanguageClause(userId),
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        max_tokens: 160,
      }),
      // Local CPU vision (moondream) is slower than a cloud call — give it room.
      signal: AbortSignal.timeout(cfg.isLocal ? 120_000 : 45_000),
    })
    if (!res.ok) {
      setCaptionStatus(imageId, userId, "failed")
      return { ok: false, error: `provider ${res.status}` }
    }
    const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] }
    const c = data.choices?.[0]?.message?.content
    const caption = (typeof c === "string" ? c : Array.isArray(c) ? c.map((x: { text?: string }) => x.text ?? "").join("") : "")
      .trim()
      .replace(/^["']|["']$/g, "")
      .slice(0, 280)
    if (!caption) {
      setCaptionStatus(imageId, userId, "failed")
      return { ok: false, error: "empty response" }
    }
    sqlite
      .prepare(`UPDATE gallery_images SET caption = ?, caption_status = 'done' WHERE id = ? AND user_id = ?`)
      .run(caption, imageId, userId)

    // Notify the user in Telegram that the caption is ready, with quick actions.
    if (opts.notify) {
      try {
        const bot = sqlite
          .prepare(`SELECT bot_token, chat_id FROM telegram_bots WHERE user_id = ?`)
          .get(userId) as { bot_token: string; chat_id: string | null } | undefined
        if (bot?.bot_token && bot.chat_id) {
          const { sendMessage } = await import("@/lib/telegram/client")
          const { galleryCaptionReadyMenu } = await import("@/lib/telegram/menus")
          const m = galleryCaptionReadyMenu(imageId, caption)
          await sendMessage(bot.bot_token, bot.chat_id, m.text, { parseMode: "Markdown", replyMarkup: m.markup }).catch(() => undefined)
        }
      } catch { /* notify is best-effort */ }
    }
    return { ok: true, caption }
  } catch (err) {
    setCaptionStatus(imageId, userId, "failed")
    return { ok: false, error: err instanceof Error ? err.message : "vision error" }
  }
}

/** Set a caption directly (bot Edit flow), marking it done. */
export function setGalleryCaption(userId: string, imageId: string, caption: string): boolean {
  const r = sqlite
    .prepare(`UPDATE gallery_images SET caption = ?, caption_status = 'done' WHERE id = ? AND user_id = ?`)
    .run(caption.trim().slice(0, 280) || null, imageId, userId)
  return r.changes > 0
}

/** Add a comment to an image (bot flow), verifying ownership. */
export function addGalleryCommentForBot(userId: string, imageId: string, body: string): boolean {
  const owns = sqlite.prepare(`SELECT 1 FROM gallery_images WHERE id = ? AND user_id = ?`).get(imageId, userId)
  if (!owns) return false
  sqlite
    .prepare(`INSERT INTO gallery_comments (id, image_id, user_id, body) VALUES (?, ?, ?, ?)`)
    .run(createId(), imageId, userId, body.trim().slice(0, 4000))
  return true
}

/** List a user's albums for the bot picker. */
export function listAlbumsForBot(userId: string): { id: string; name: string }[] {
  return sqlite
    .prepare(`SELECT id, name FROM gallery_albums WHERE user_id = ? ORDER BY name COLLATE NOCASE ASC LIMIT 8`)
    .all(userId) as { id: string; name: string }[]
}

/** Move an image into an album (or NULL for Unsorted), verifying ownership. */
export function moveImageToAlbumForBot(userId: string, imageId: string, albumId: string | null): { ok: boolean; albumName: string } {
  if (albumId) {
    const a = sqlite.prepare(`SELECT name FROM gallery_albums WHERE id = ? AND user_id = ?`).get(albumId, userId) as { name: string } | undefined
    if (!a) return { ok: false, albumName: "" }
    const r = sqlite.prepare(`UPDATE gallery_images SET album_id = ? WHERE id = ? AND user_id = ?`).run(albumId, imageId, userId)
    return { ok: r.changes > 0, albumName: a.name }
  }
  const r = sqlite.prepare(`UPDATE gallery_images SET album_id = NULL WHERE id = ? AND user_id = ?`).run(imageId, userId)
  return { ok: r.changes > 0, albumName: "Unsorted" }
}
