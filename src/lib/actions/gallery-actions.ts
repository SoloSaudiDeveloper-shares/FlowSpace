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
  /** NULL | 'pending' (AI captioning) | 'done' | 'failed'. */
  captionStatus: string | null
  mime: string | null
  albumId: string | null
  width: number | null
  height: number | null
  source: string
  createdAt: string
  commentCount: number
  /** Lowercased caption + comments + album name, for instant client search. */
  search: string
}

export interface GalleryComment {
  id: string
  body: string
  createdAt: string
}

export interface GalleryAlbum {
  id: string
  name: string
  imageCount: number
}

export async function getMyGalleryImages(): Promise<GalleryImage[]> {
  const uid = await currentUserId()
  if (!uid) return []
  return sqlite
    .prepare(
      `SELECT g.id, g.caption, g.caption_status AS captionStatus, g.mime, g.album_id AS albumId,
              g.width, g.height, g.source, g.created_at AS createdAt,
              (SELECT COUNT(*) FROM gallery_comments c WHERE c.image_id = g.id) AS commentCount,
              LOWER(
                COALESCE(g.caption, '') || ' ' ||
                COALESCE((SELECT GROUP_CONCAT(c2.body, ' ') FROM gallery_comments c2 WHERE c2.image_id = g.id), '') || ' ' ||
                COALESCE(a.name, '')
              ) AS search
       FROM gallery_images g
       LEFT JOIN gallery_albums a ON a.id = g.album_id
       WHERE g.user_id = ?
       ORDER BY g.created_at DESC`,
    )
    .all(uid) as GalleryImage[]
}

/** Poll caption status/text for a set of images (used by the gallery to live
 *  update "captioning…" cards without a refresh). Scoped to the owner. */
export async function pollGalleryCaptions(
  ids: string[],
): Promise<{ id: string; caption: string | null; captionStatus: string | null }[]> {
  const uid = await currentUserId()
  if (!uid || ids.length === 0) return []
  const safe = ids.slice(0, 100).filter((s) => typeof s === "string")
  if (safe.length === 0) return []
  const placeholders = safe.map(() => "?").join(",")
  return sqlite
    .prepare(
      `SELECT id, caption, caption_status AS captionStatus
       FROM gallery_images
       WHERE user_id = ? AND id IN (${placeholders})`,
    )
    .all(uid, ...safe) as { id: string; caption: string | null; captionStatus: string | null }[]
}

export async function getMyAlbums(): Promise<GalleryAlbum[]> {
  const uid = await currentUserId()
  if (!uid) return []
  return sqlite
    .prepare(
      `SELECT a.id, a.name,
              (SELECT COUNT(*) FROM gallery_images g WHERE g.album_id = a.id) AS imageCount
       FROM gallery_albums a
       WHERE a.user_id = ?
       ORDER BY a.name COLLATE NOCASE ASC`,
    )
    .all(uid) as GalleryAlbum[]
}

export async function createAlbum(name: string): Promise<GalleryAlbum | null> {
  const uid = await currentUserId()
  if (!uid) return null
  const n = name.trim().slice(0, 80)
  if (!n) return null
  const id = createId()
  sqlite.prepare(`INSERT INTO gallery_albums (id, user_id, name) VALUES (?, ?, ?)`).run(id, uid, n)
  revalidatePath("/gallery")
  return { id, name: n, imageCount: 0 }
}

export async function renameAlbum(id: string, name: string): Promise<boolean> {
  const uid = await currentUserId()
  if (!uid) return false
  const n = name.trim().slice(0, 80)
  if (!n) return false
  const r = sqlite.prepare(`UPDATE gallery_albums SET name = ? WHERE id = ? AND user_id = ?`).run(n, id, uid)
  if (r.changes > 0) revalidatePath("/gallery")
  return r.changes > 0
}

export async function deleteAlbum(id: string): Promise<boolean> {
  const uid = await currentUserId()
  if (!uid) return false
  const owns = sqlite.prepare(`SELECT 1 FROM gallery_albums WHERE id = ? AND user_id = ?`).get(id, uid)
  if (!owns) return false
  // Images move back to Unsorted rather than being deleted.
  sqlite.prepare(`UPDATE gallery_images SET album_id = NULL WHERE album_id = ? AND user_id = ?`).run(id, uid)
  sqlite.prepare(`DELETE FROM gallery_albums WHERE id = ?`).run(id)
  revalidatePath("/gallery")
  return true
}

export async function moveImageToAlbum(imageId: string, albumId: string | null): Promise<boolean> {
  const uid = await currentUserId()
  if (!uid) return false
  // If moving INTO an album, verify the album belongs to the caller.
  if (albumId) {
    const ok = sqlite.prepare(`SELECT 1 FROM gallery_albums WHERE id = ? AND user_id = ?`).get(albumId, uid)
    if (!ok) return false
  }
  const r = sqlite
    .prepare(`UPDATE gallery_images SET album_id = ? WHERE id = ? AND user_id = ?`)
    .run(albumId, imageId, uid)
  if (r.changes > 0) revalidatePath("/gallery")
  return r.changes > 0
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
