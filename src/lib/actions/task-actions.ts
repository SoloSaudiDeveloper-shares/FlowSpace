"use server"

import { db } from "@/lib/db"
import { tasks, taskStatuses, taskLabels, elements, projects } from "@/lib/db/schema"
import { createId } from "@/lib/utils/ids"
import { eq, and, asc, desc } from "drizzle-orm"
import { revalidatePath } from "next/cache"

// ─── Task Statuses ──────────────────────────────────────────────────────

export async function getTaskStatuses(projectId: string) {
  return db
    .select()
    .from(taskStatuses)
    .where(eq(taskStatuses.projectId, projectId))
    .orderBy(asc(taskStatuses.sortOrder))
}

export async function createTaskStatus(
  projectId: string,
  data: { name: string; color: string; isDoneState?: boolean }
) {
  const existing = await getTaskStatuses(projectId)
  const maxOrder = existing.length > 0
    ? Math.max(...existing.map((s) => s.sortOrder))
    : -1

  const id = createId()
  await db.insert(taskStatuses).values({
    id,
    projectId,
    name: data.name,
    color: data.color,
    sortOrder: maxOrder + 1,
    isDoneState: data.isDoneState ?? false,
  })

  revalidatePath(`/projects/${projectId}`)
  return id
}

export async function updateTaskStatus(
  id: string,
  projectId: string,
  data: { name?: string; color?: string; isDoneState?: boolean; sortOrder?: number }
) {
  await db.update(taskStatuses).set(data).where(eq(taskStatuses.id, id))
  revalidatePath(`/projects/${projectId}`)
}

export async function deleteTaskStatus(id: string, projectId: string) {
  await db.delete(tasks).where(eq(tasks.statusId, id))
  await db.delete(taskStatuses).where(eq(taskStatuses.id, id))
  revalidatePath(`/projects/${projectId}`)
}

// ─── Tasks ──────────────────────────────────────────────────────────────

export async function getTasksByProject(projectId: string) {
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .orderBy(asc(tasks.sortOrder))
}

export async function createTask(
  projectId: string,
  statusId: string,
  title: string
) {
  const existing = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), eq(tasks.statusId, statusId)))

  const maxOrder = existing.length > 0
    ? Math.max(...existing.map((t) => t.sortOrder))
    : -1

  const id = createId()
  const now = new Date().toISOString()

  await db.insert(tasks).values({
    id,
    projectId,
    statusId,
    title,
    sortOrder: maxOrder + 1,
    createdAt: now,
    updatedAt: now,
  })

  await db
    .update(elements)
    .set({ updatedAt: now })
    .where(eq(elements.id, projectId))

  revalidatePath(`/projects/${projectId}`)
  return id
}

export async function updateTask(
  id: string,
  projectId: string,
  data: {
    title?: string
    description?: string
    priority?: "urgent" | "high" | "medium" | "low" | "none"
    statusId?: string
    dueDate?: string | null
    sortOrder?: number
    isCompleted?: boolean
    parentTaskId?: string | null
  }
) {
  const now = new Date().toISOString()

  const updateData: Record<string, unknown> = { ...data, updatedAt: now }
  if (data.isCompleted !== undefined) {
    updateData.completedAt = data.isCompleted ? now : null
  }

  await db.update(tasks).set(updateData).where(eq(tasks.id, id))
  await db
    .update(elements)
    .set({ updatedAt: now })
    .where(eq(elements.id, projectId))

  revalidatePath(`/projects/${projectId}`)
}

export async function deleteTask(id: string, projectId: string) {
  await db.delete(tasks).where(eq(tasks.id, id))
  await db
    .update(elements)
    .set({ updatedAt: new Date().toISOString() })
    .where(eq(elements.id, projectId))

  revalidatePath(`/projects/${projectId}`)
}

export async function moveTask(
  taskId: string,
  projectId: string,
  newStatusId: string,
  newSortOrder: number
) {
  const now = new Date().toISOString()

  const status = await db
    .select()
    .from(taskStatuses)
    .where(eq(taskStatuses.id, newStatusId))
    .limit(1)

  await db
    .update(tasks)
    .set({
      statusId: newStatusId,
      sortOrder: newSortOrder,
      isCompleted: status[0]?.isDoneState ?? false,
      completedAt: status[0]?.isDoneState ? now : null,
      updatedAt: now,
    })
    .where(eq(tasks.id, taskId))

  // Update project progress
  const allTasks = await db.select().from(tasks).where(eq(tasks.projectId, projectId))
  const completedCount = allTasks.filter((t) => t.id === taskId ? status[0]?.isDoneState : t.isCompleted).length
  const progress = allTasks.length > 0 ? Math.round((completedCount / allTasks.length) * 100) : 0

  await db.update(projects).set({ progress }).where(eq(projects.id, projectId))
  await db.update(elements).set({ updatedAt: now }).where(eq(elements.id, projectId))

  revalidatePath(`/projects/${projectId}`)
}

export async function getProjectData(projectId: string) {
  const projectResult = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  return projectResult[0] ?? null
}
