"use server"

import { db } from "@/lib/db"
import { notifications, reminders, elements, tasks, taskStatuses } from "@/lib/db/schema"
import { createId } from "@/lib/utils/ids"
import { eq, and, desc, lte, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getNotifications(limit = 50) {
  return db
    .select({
      notification: notifications,
      element: elements,
    })
    .from(notifications)
    .leftJoin(elements, eq(notifications.elementId, elements.id))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
}

export async function getUnreadCount() {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(eq(notifications.isRead, false))
  return result[0]?.count ?? 0
}

export async function markAsRead(id: string) {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.id, id))
  revalidatePath("/notifications")
}

export async function markAllAsRead() {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.isRead, false))
  revalidatePath("/notifications")
}

export async function deleteNotification(id: string) {
  await db.delete(notifications).where(eq(notifications.id, id))
  revalidatePath("/notifications")
}

export async function clearAllNotifications() {
  await db.delete(notifications).where(eq(notifications.isRead, true))
  revalidatePath("/notifications")
}

export async function createNotification(data: {
  type: "reminder_due" | "task_overdue" | "task_due_soon" | "project_milestone" | "system"
  title: string
  message?: string
  elementId?: string
}) {
  const id = createId()
  await db.insert(notifications).values({
    id,
    type: data.type,
    title: data.title,
    message: data.message ?? null,
    elementId: data.elementId ?? null,
  })
  revalidatePath("/notifications")
  return id
}

// Check for due reminders and overdue tasks, create notifications
// Note: This is called during page render, so no revalidatePath calls
export async function generateNotifications() {
  const now = new Date().toISOString()

  // Check due reminders
  const dueReminders = await db
    .select({
      reminder: reminders,
      element: elements,
    })
    .from(reminders)
    .innerJoin(elements, eq(reminders.id, elements.id))
    .where(
      and(
        lte(reminders.remindAt, now),
        eq(reminders.isDismissed, false),
        eq(elements.isDeleted, false)
      )
    )

  for (const { reminder, element } of dueReminders) {
    // Check if notification already exists
    const existing = await db
      .select()
      .from(notifications)
      .where(
        and(
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
      })
    }
  }

  // Check overdue tasks
  const overdueTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        lte(tasks.dueDate, now),
        eq(tasks.isCompleted, false)
      )
    )

  for (const task of overdueTasks) {
    if (!task.dueDate) continue
    const existing = await db
      .select()
      .from(notifications)
      .where(
        and(
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
      })
    }
  }
}
