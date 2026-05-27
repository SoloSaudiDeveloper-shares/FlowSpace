import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { taskAttachments } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import fs from "fs"
import path from "path"
import { getDataDir } from "@/lib/utils/data-dir"

const UPLOAD_DIR = path.join(getDataDir(), "uploads")

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const attachment = await db
    .select()
    .from(taskAttachments)
    .where(eq(taskAttachments.id, id))
    .limit(1)

  if (!attachment[0]) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const filePath = path.join(UPLOAD_DIR, attachment[0].filePath)

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }

  const fileBuffer = fs.readFileSync(filePath)

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": attachment[0].mimeType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${attachment[0].fileName}"`,
      "Content-Length": String(attachment[0].fileSize),
    },
  })
}
