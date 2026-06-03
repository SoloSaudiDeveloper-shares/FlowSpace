"use server"

import fs from "node:fs"
import path from "node:path"
import { sqlite } from "@/lib/db"
import { createId } from "@/lib/utils/ids"
import { getDataDir } from "@/lib/utils/data-dir"
import { currentUserId } from "@/lib/auth/scope"
import { revalidatePath } from "next/cache"

export interface GalleryImage {
  id: string
  caption: string | null
  mime: string | null
  width: number | null
  height: number | null
  source: string
  createdAt: string
  commentCount: number
}

export interface GalleryComment {
  id: string
  body: string
  createdAt: string
}

export async function getMyGalleryImages(): Promise<GalleryImage[]> {
  const uid = await currentUserId()
  if (!uid) return []
  return sqlite
    .prepare(
      `SELECT g.id, g.caption, g.mime, g.width, g.height, g.source, g.created_at AS createdAt,
              (SELECT COUNT(*) FROM gallery_comments c WHERE c.image_id = g.id) AS commentCount
       FROM gallery_images g
       WHERE g.user_id = ?
       ORDER BY g.created_at DESC`,
    )
    .all(uid) as GalleryImage[]
}

export async function getGalleryComments(imageId: string): Promise<GalleryComment[]> {
  const uid = await currentUserId()
  if (!uid) return []
  // Ownership: the image must belong to the caller.
  const owns = sqlite
    .prepare(`SELECT 1 FROM gallery_images WHERE id = ? AND user_id = ?`)
    .get(imageId, uid)
  if (!owns) return []
  return sqlite
    .prepare(
      `SELECT id, body, created_at AS createdAt FROM gallery_comments
       WHERE image_id = ? ORDER BY created_at ASC`,
    )
    .all(imageId) as GalleryComment[]
}

export async function addGalleryComment(imageId: string, body: string): Promise<GalleryComment | null> {
  const uid = await currentUserId()
  if (!uid) return null
  const text = body.trim()
  if (!text) return null
  const owns = sqlite
    .prepare(`SELECT 1 FROM gallery_images WHERE id = ? AND user_id = ?`)
    .get(imageId, uid)
  if (!owns) return null
  const id = createId()
  sqlite
    .prepare(`INSERT INTO gallery_comments (id, image_id, user_id, body) VALUES (?, ?, ?, ?)`)
    .run(id, imageId, uid, text.slice(0, 4000))
  revalidatePath("/gallery")
  const row = sqlite
    .prepare(`SELECT id, body, created_at AS createdAt FROM gallery_comments WHERE id = ?`)
    .get(id) as GalleryComment
  return row
}

export async function deleteGalleryComment(commentId: string): Promise<boolean> {
  const uid = await currentUserId()
  if (!uid) return false
  const r = sqlite
    .prepare(
      `DELETE FROM gallery_comments WHERE id = ? AND image_id IN (
         SELECT id FROM gallery_images WHERE user_id = ?
       )`,
    )
    .run(commentId, uid)
  if (r.changes > 0) revalidatePath("/gallery")
  return r.changes > 0
}

export async function updateGalleryCaption(imageId: string, caption: string): Promise<boolean> {
  const uid = await currentUserId()
  if (!uid) return false
  const r = sqlite
    .prepare(`UPDATE gallery_images SET caption = ? WHERE id = ? AND user_id = ?`)
    .run(caption.trim().slice(0, 2000) || null, imageId, uid)
  if (r.changes > 0) revalidatePath("/gallery")
  return r.changes > 0
}

export async function deleteGalleryImage(imageId: string): Promise<boolean> {
  const uid = await currentUserId()
  if (!uid) return false
  const row = sqlite
    .prepare(`SELECT file_path FROM gallery_images WHERE id = ? AND user_id = ?`)
    .get(imageId, uid) as { file_path: string } | undefined
  if (!row) return false
  // Remove the row (cascade deletes comments) then the file on disk.
  sqlite.prepare(`DELETE FROM gallery_images WHERE id = ?`).run(imageId)
  try {
    const filePath = path.join(getDataDir(), "uploads", path.basename(row.file_path))
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch {
    /* file already gone — fine */
  }
  revalidatePath("/gallery")
  return true
}
