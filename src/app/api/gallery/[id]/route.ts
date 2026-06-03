import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import fs from "node:fs"
import path from "node:path"
import { sqlite } from "@/lib/db"
import { getDataDir } from "@/lib/utils/data-dir"
import { currentUserId } from "@/lib/auth/scope"

const UPLOAD_DIR = path.join(getDataDir(), "uploads")

/** Serve a gallery image inline, only to its owner. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const uid = await currentUserId()
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const row = sqlite
    .prepare(`SELECT file_path, mime FROM gallery_images WHERE id = ? AND user_id = ?`)
    .get(id, uid) as { file_path: string; mime: string | null } | undefined
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // file_path is a bare filename we generated; guard against traversal anyway.
  const safe = path.basename(row.file_path)
  const filePath = path.join(UPLOAD_DIR, safe)
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File missing" }, { status: 404 })
  }

  const buf = fs.readFileSync(filePath)
  return new NextResponse(buf, {
    headers: {
      "Content-Type": row.mime || "image/jpeg",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=86400",
    },
  })
}
