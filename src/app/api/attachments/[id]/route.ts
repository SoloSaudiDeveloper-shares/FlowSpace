import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { taskAttachments, tasks, elements } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import fs from "fs"
import path from "path"
import { getDataDir } from "@/lib/utils/data-dir"
import { currentUserId } from "@/lib/auth/scope"

const UPLOAD_DIR = path.join(getDataDir(), "uploads")

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const uid = await currentUserId()
  if (!uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Resolve the attachment and verify the caller owns its task's project.
  const rows = await db
    .select({ attachment: taskAttachments })
    .from(taskAttachments)
    .innerJoin(tasks, eq(tasks.id, taskAttachments.taskId))
    .innerJoin(elements, eq(elements.id, tasks.projectId))
    .where(and(eq(taskAttachments.id, id), eq(elements.createdBy, uid)))
    .limit(1)

  const attachment = rows.map((r) => r.attachment)

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
