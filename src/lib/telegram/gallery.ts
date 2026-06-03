/**
 * Save a photo pushed through the Telegram bot into the user's Gallery.
 *
 * Downloads the file from Telegram's CDN (bound by the 20 MB getFile cap —
 * fine for photos), writes it under <DATA_DIR>/uploads, and inserts a
 * gallery_images row. The image is later served (owner-scoped) via
 * /api/gallery/[id].
 */

import "server-only"
import { writeFile, mkdir } from "node:fs/promises"
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
    sqlite
      .prepare(
        `INSERT INTO gallery_images (id, user_id, file_path, mime, caption, width, height, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        opts.userId,
        fileName,
        mime,
        opts.caption?.trim() || null,
        opts.width ?? null,
        opts.height ?? null,
        opts.source || "telegram",
      )
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "db insert failed" }
  }

  return { ok: true, id }
}
