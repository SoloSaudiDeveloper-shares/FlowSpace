"use server"

import { db } from "@/lib/db"
import {
  dashboardWidgets,
  elements,
  tasks,
  taskStatuses,
  todoItems,
  reminders,
  activityLog,
  feedEvents,
  projects,
} from "@/lib/db/schema"
import { createId } from "@/lib/utils/ids"
import { eq, desc, and, asc, lte, ne } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getDashboardWidgets() {
  return db
    .select()
    .from(dashboardWidgets)
    .orderBy(asc(dashboardWidgets.positionY), asc(dashboardWidgets.positionX))
}

export async function createDashboardWidget(
  data: {
    widgetType: typeof dashboardWidgets.$inferInsert["widgetType"]
    title?: string
    config?: string
    positionX: number
    positionY: number
    width?: number
    height?: number
    elementRefId?: string
  },
  shouldRevalidate = true
) {
  const id = createId()
  await db.insert(dashboardWidgets).values({
    id,
    ...data,
  })
  if (shouldRevalidate) revalidatePath("/")
  return id
}

export async function updateDashboardWidget(
  id: string,
  data: {
    positionX?: number
    positionY?: number
    width?: number
    height?: number
    title?: string
    config?: string
  }
) {
  await db.update(dashboardWidgets).set(data).where(eq(dashboardWidgets.id, id))
  revalidatePath("/")
}

export async function deleteDashboardWidget(id: string) {
  await db.delete(dashboardWidgets).where(eq(dashboardWidgets.id, id))
  revalidatePath("/")
}

// ─── Widget Data Fetchers ──────────────────────────────────────────────

export async function getMyTasks(limit = 10) {
  // Get all tasks that are not done, sorted by due date and priority
  const allStatuses = await db.select().from(taskStatuses)
  const doneStatusIds = allStatuses
    .filter((s) => s.isDoneState)
    .map((s) => s.id)

  const allTasks = await db
    .select({
      task: tasks,
      project: elements,
    })
    .from(tasks)
    .innerJoin(elements, eq(tasks.projectId, elements.id))
    .orderBy(desc(tasks.priority), asc(tasks.dueDate))
    .limit(limit * 2)

  // Filter out done tasks in JS since we need to check against variable status IDs
  return allTasks
    .filter((t) => !doneStatusIds.includes(t.task.statusId))
    .slice(0, limit)
}

export async function getUpcomingReminders(limit = 8) {
  const now = new Date().toISOString()
  return db
    .select({
      reminder: reminders,
      element: elements,
    })
    .from(reminders)
    .innerJoin(elements, eq(reminders.id, elements.id))
    .where(
      and(
        eq(reminders.isDismissed, false),
        eq(elements.isDeleted, false),
        eq(elements.isArchived, false)
      )
    )
    .orderBy(asc(reminders.remindAt))
    .limit(limit)
}

export async function getRecentActivity(limit = 10) {
  return db
    .select({
      activity: activityLog,
      element: elements,
    })
    .from(activityLog)
    .innerJoin(elements, eq(activityLog.elementId, elements.id))
    .orderBy(desc(activityLog.createdAt))
    .limit(limit)
}

export async function initializeDefaultDashboard() {
  const existing = await getDashboardWidgets()
  if (existing.length > 0) return

  await Promise.all([
    createDashboardWidget({
      widgetType: "quick_capture",
      title: "Quick Capture",
      positionX: 0,
      positionY: 0,
      width: 1,
      height: 1,
    }, false),
    createDashboardWidget({
      widgetType: "recent_elements",
      title: "Recent",
      positionX: 1,
      positionY: 0,
      width: 2,
      height: 2,
    }, false),
    createDashboardWidget({
      widgetType: "favorites",
      title: "Favorites",
      positionX: 3,
      positionY: 0,
      width: 1,
      height: 2,
    }, false),
  ])
}
