"use server"

import { db } from "@/lib/db"
import { dashboardWidgets, elements, tasks, todoItems, reminders } from "@/lib/db/schema"
import { createId } from "@/lib/utils/ids"
import { eq, desc, and, asc } from "drizzle-orm"
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
