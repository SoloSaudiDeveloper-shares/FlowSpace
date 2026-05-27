"use server"

import { db } from "@/lib/db"
import { elements, tasks, taskStatuses, taskLabels, taskToLabels, todoItems, processSteps } from "@/lib/db/schema"
import { eq, and, desc } from "drizzle-orm"

type ExportFormat = "json" | "csv"

export async function exportElements(format: ExportFormat) {
  const allElements = await db
    .select()
    .from(elements)
    .where(eq(elements.isDeleted, false))
    .orderBy(desc(elements.updatedAt))

  if (format === "json") {
    return JSON.stringify(allElements, null, 2)
  }

  // CSV
  const headers = ["id", "type", "title", "description", "is_favorite", "is_archived", "parent_id", "created_at", "updated_at"]
  const rows = allElements.map((el) =>
    [
      el.id,
      el.type,
      csvEscape(el.title),
      csvEscape(el.description ?? ""),
      el.isFavorite ? "true" : "false",
      el.isArchived ? "true" : "false",
      el.parentId ?? "",
      el.createdAt,
      el.updatedAt,
    ].join(",")
  )
  return [headers.join(","), ...rows].join("\n")
}

export async function exportTasks(projectId: string, format: ExportFormat) {
  const projectTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .orderBy(desc(tasks.updatedAt))

  const statuses = await db
    .select()
    .from(taskStatuses)
    .where(eq(taskStatuses.projectId, projectId))
  const statusMap = new Map(statuses.map((s) => [s.id, s.name]))

  const enriched = projectTasks.map((t) => ({
    ...t,
    statusName: statusMap.get(t.statusId) ?? "Unknown",
  }))

  if (format === "json") {
    return JSON.stringify(enriched, null, 2)
  }

  const headers = [
    "id", "title", "description", "status", "priority",
    "start_date", "due_date", "is_completed", "time_estimate",
    "time_tracked", "created_at", "updated_at",
  ]
  const rows = enriched.map((t) =>
    [
      t.id,
      csvEscape(t.title),
      csvEscape(t.description ?? ""),
      csvEscape(t.statusName),
      t.priority,
      t.startDate ?? "",
      t.dueDate ?? "",
      t.isCompleted ? "true" : "false",
      t.timeEstimate ?? "",
      t.timeTracked,
      t.createdAt,
      t.updatedAt,
    ].join(",")
  )
  return [headers.join(","), ...rows].join("\n")
}

export async function exportAllData() {
  const allElements = await db
    .select()
    .from(elements)
    .where(eq(elements.isDeleted, false))

  const allTasks = await db.select().from(tasks)
  const allStatuses = await db.select().from(taskStatuses)
  const allLabels = await db.select().from(taskLabels)
  const allTodoItems = await db.select().from(todoItems)
  const allProcessSteps = await db.select().from(processSteps)

  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      version: "1.0",
      elements: allElements,
      tasks: allTasks,
      taskStatuses: allStatuses,
      taskLabels: allLabels,
      todoItems: allTodoItems,
      processSteps: allProcessSteps,
    },
    null,
    2
  )
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
