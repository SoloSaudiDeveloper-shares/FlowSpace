import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { taskAttachments, tasks, elements } from "@/lib/db/schema"
import { createId } from "@/lib/utils/ids"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import fs from "fs"
import path from "path"
import { getDataDir } from "@/lib/utils/data-dir"
import { currentUserId } from "@/lib/auth/scope"

const UPLOAD_DIR = path.join(getDataDir(), "uploads")

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

/** True if `uid` owns the project that owns `taskId`. */
async function ownsTask(taskId: string, uid: string): Promise<boolean> {
  const rows = await db
    .select({ id: tasks.id })
    .from(tasks)
    .innerJoin(elements, eq(elements.id, tasks.projectId))
    .where(and(eq(tasks.id, taskId), eq(elements.createdBy, uid)))
    .limit(1)
  return rows.length > 0
}

export async function POST(request: NextRequest) {
  try {
    const uid = await currentUserId()
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File
    const taskId = formData.get("taskId") as string
    const projectId = formData.get("projectId") as string

    if (!file || !taskId) {
      return NextResponse.json(
        { error: "File and taskId are required" },
        { status: 400 }
      )
    }

    if (!(await ownsTask(taskId, uid))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Limit file size to 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      )
    }

    const id = createId()
    // Sanitize the extension to plain alphanumerics + dot so the stored
    // filename (`<id><ext>`) can never contain path separators.
    const ext = path.extname(file.name).replace(/[^a-zA-Z0-9.]/g, "").slice(0, 12)
    const safeFileName = `${id}${ext}`
    const filePath = path.join(UPLOAD_DIR, safeFileName)

    // Write file to disk
    const bytes = await file.arrayBuffer()
    fs.writeFileSync(filePath, Buffer.from(bytes))

    // Save to database
    await db.insert(taskAttachments).values({
      id,
      taskId,
      fileName: file.name,
      filePath: safeFileName,
      fileSize: file.size,
      mimeType: file.type || null,
    })

    if (projectId) {
      revalidatePath(`/projects/${projectId}`)
    }

    return NextResponse.json({ id, fileName: file.name })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const uid = await currentUserId()
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, projectId } = await request.json()

    if (!id) {
      return NextResponse.json(
        { error: "Attachment ID is required" },
        { status: 400 }
      )
    }

    // Get attachment info — only if the caller owns its task's project.
    const rows = await db
      .select({ attachment: taskAttachments })
      .from(taskAttachments)
      .innerJoin(tasks, eq(tasks.id, taskAttachments.taskId))
      .innerJoin(elements, eq(elements.id, tasks.projectId))
      .where(and(eq(taskAttachments.id, id), eq(elements.createdBy, uid)))
      .limit(1)
    const attachment = rows.map((r) => r.attachment)

    if (attachment[0]) {
      // Delete file from disk
      const filePath = path.join(UPLOAD_DIR, attachment[0].filePath)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }

      // Delete from database
      await db.delete(taskAttachments).where(eq(taskAttachments.id, id))
    }

    if (projectId) {
      revalidatePath(`/projects/${projectId}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete attachment error:", error)
    return NextResponse.json(
      { error: "Delete failed" },
      { status: 500 }
    )
  }
}
