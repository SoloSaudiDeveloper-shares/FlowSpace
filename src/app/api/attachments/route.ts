import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { taskAttachments } from "@/lib/db/schema"
import { createId } from "@/lib/utils/ids"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import fs from "fs"
import path from "path"

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads")

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

export async function POST(request: NextRequest) {
  try {
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

    // Limit file size to 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      )
    }

    const id = createId()
    const ext = path.extname(file.name)
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
    const { id, projectId } = await request.json()

    if (!id) {
      return NextResponse.json(
        { error: "Attachment ID is required" },
        { status: 400 }
      )
    }

    // Get attachment info
    const attachment = await db
      .select()
      .from(taskAttachments)
      .where(eq(taskAttachments.id, id))
      .limit(1)

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
