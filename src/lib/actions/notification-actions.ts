"use server"

import { db } from "@/lib/db"
import { notifications, reminders, elements, tasks, taskStatuses } from "@/lib/db/schema"
import { createId } from "@/lib/utils/ids"
import { eq, and, desc, lte, sql, isNull } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { currentUserId } from "@/lib/auth/scope"

/**
 * Per-user notifications. Anyone not signed in sees nothing. Reads/writes
 * scope by notifications.user_id (added in a later migration). Notifications
 * with user_id=NULL are legacy from before the per-user split and are
 * invisible until the migration backfills them.
 */

export async function getNotifications(limit = 50) {
  const uid = await currentUserId()
  if (!uid) return []
  return db
    .select({
      notification: notifications,
      element: elements,
    })
    .from(notifications)
    .leftJoin(elements, eq(notifications.elementId, elements.id))
    .where(eq(notifications.userId, uid))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
}

export async function getUnreadCount() {
  const uid = await currentUserId()
  if (!uid) return 0
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, uid), eq(notifications.isRead, false)))
  return result[0]?.count ?? 0
}

export async function markAsRead(id: string) {
  const uid = await currentUserId()
  if (!uid) return
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, uid)))
  revalidatePath("/notifications")
}

export async function markAllAsRead() {
  const uid = await currentUserId()
  if (!uid) return
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, uid), eq(notifications.isRead, false)))
  revalidatePath("/notifications")
}

export async function deleteNotification(id: string) {
  const uid = await currentUserId()
  if (!uid) return
  await db
    .delete(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.userId, uid)))
  revalidatePath("/notifications")
}

export async function clearAllNotifications() {
  const uid = await currentUserId()
  if (!uid) return
  await db
    .delete(notifications)
    .where(and(eq(notifications.userId, uid), eq(notifications.isRead, true)))
  revalidatePath("/notifications")
}

export async function createNotification(data: {
  type: "reminder_due" | "task_overdue" | "task_due_soon" | "project_milestone" | "system"
  title: string
  message?: string
  elementId?: string
  /** Target user. Defaults to the current authenticated user. */
  userId?: string
}) {
  const uid = data.userId ?? (await currentUserId())
  if (!uid) return null
  const id = createId()
  await db.insert(notifications).values({
    id,
    type: data.type,
    title: data.title,
    message: data.message ?? null,
    elementId: data.elementId ?? null,
    userId: uid,
  })
  revalidatePath("/notifications")
  return id
}

// Check for due reminders and overdue tasks, create notifications for the
// element's owner. Called during page render — no revalidatePath calls.
// Scoped: only generates notifications for elements/tasks owned by the
// CURRENT user, so a page load by user A doesn't spam user B's inbox.
export async function generateNotifications() {
  const uid = await currentUserId()
  if (!uid) return

  const now = new Date().toISOString()

  // Due reminders that the current user owns
  const dueReminders = await db
    .select({ reminder: reminders, element: elements })
    .from(reminders)
    .innerJoin(elements, eq(reminders.id, elements.id))
    .where(
      and(
        eq(elements.createdBy, uid),
        lte(reminders.remindAt, now),
        eq(reminders.isDismissed, false),
        eq(elements.isDeleted, false)
      )
    )

  for (const { element } of dueReminders) {
    const existing = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, uid),
          eq(notifications.elementId, element.id),
          eq(notifications.type, "reminder_due")
        )
      )
      .limit(1)

    if (existing.length === 0) {
      await db.insert(notifications).values({
        id: createId(),
        type: "reminder_due",
        title: `Reminder: ${element.title}`,
        message: `Your reminder "${element.title}" is due`,
        elementId: element.id,
        userId: uid,
      })
    }
  }

  // Overdue tasks in projects owned by the current user
  const overdueTasks = await db
    .select({ task: tasks, project: elements })
    .from(tasks)
    .innerJoin(elements, eq(tasks.projectId, elements.id))
    .where(
      and(
        eq(elements.createdBy, uid),
        lte(tasks.dueDate, now),
        eq(tasks.isCompleted, false)
      )
    )

  for (const { task } of overdueTasks) {
    if (!task.dueDate) continue
    const existing = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, uid),
          eq(notifications.type, "task_overdue"),
          eq(notifications.title, `Overdue: ${task.title}`)
        )
      )
      .limit(1)

    if (existing.length === 0) {
      await db.insert(notifications).values({
        id: createId(),
        type: "task_overdue",
        title: `Overdue: ${task.title}`,
        message: `Task "${task.title}" was due ${task.dueDate}`,
        elementId: task.projectId,
        userId: uid,
      })
    }
  }
}
