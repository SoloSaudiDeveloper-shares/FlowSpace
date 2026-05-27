"use server"

import { db } from "@/lib/db"
import { taskComments, activityLog } from "@/lib/db/schema"
import { createId } from "@/lib/utils/ids"
import { eq, desc, asc } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { createMentionsFromText } from "@/lib/actions/mention-actions"
import { getCurrentUser } from "@/lib/actions/user-actions"

export async function getTaskComments(taskId: string) {
  return db
    .select()
    .from(taskComments)
    .where(eq(taskComments.taskId, taskId))
    .orderBy(asc(taskComments.createdAt))
}

export async function addTaskComment(
  taskId: string,
  content: string,
  projectId: string,
) {
  const id = createId()
  const now = new Date().toISOString()

  await db.insert(taskComments).values({
    id,
    taskId,
    content,
    createdAt: now,
    updatedAt: now,
  })

  // Log activity
  await db.insert(activityLog).values({
    id: createId(),
    elementId: projectId,
    action: "added_comment",
    details: JSON.stringify({ taskId, commentId: id }),
    createdAt: now,
  })

  // Parse and create mentions from @username patterns in the comment
  const currentUser = await getCurrentUser()
  if (currentUser) {
    await createMentionsFromText(content, currentUser.id, {
      elementId: projectId,
      taskId,
      commentId: id,
    })
  }

  revalidatePath(`/projects/${projectId}`)
  return id
}

export async function updateComment(
  id: string,
  content: string,
  projectId: string,
) {
  await db
    .update(taskComments)
    .set({ content, updatedAt: new Date().toISOString() })
    .where(eq(taskComments.id, id))

  revalidatePath(`/projects/${projectId}`)
}

export async function deleteComment(id: string, projectId: string) {
  await db.delete(taskComments).where(eq(taskComments.id, id))
  revalidatePath(`/projects/${projectId}`)
}

// ─── Activity Log ──────────────────────────────────────────────────────

export async function getActivityLog(elementId: string, limit = 50) {
  return db
    .select()
    .from(activityLog)
    .where(eq(activityLog.elementId, elementId))
    .orderBy(desc(activityLog.createdAt))
    .limit(limit)
}

export async function logActivity(
  elementId: string,
  action: string,
  details?: string,
) {
  await db.insert(activityLog).values({
    id: createId(),
    elementId,
    action: action as any,
    details,
    createdAt: new Date().toISOString(),
  })
}
