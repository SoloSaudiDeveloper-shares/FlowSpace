"use server"

import { db } from "@/lib/db"
import {
  tasks,
  taskStatuses,
  taskLabels,
  taskToLabels,
  taskChecklists,
  taskChecklistItems,
  taskDependencies,
  taskAttachments,
  taskComments,
  elements,
  projects,
} from "@/lib/db/schema"
import { createId } from "@/lib/utils/ids"
import { eq, and, asc, desc, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { currentUserId } from "@/lib/auth/scope"
import { createFeedEvent } from "./feed-actions"
import { advanceDate, isRepeatRule } from "@/lib/recurrence"

/**
 * Returns true iff the current authenticated user owns the given project
 * (element). Used to gate task reads — a user navigating to /projects/X
 * can only see tasks for projects they created. Direct API calls with a
 * guessed project ID return empty rather than throwing.
 */
async function ownsProject(projectId: string): Promise<boolean> {
  const uid = await currentUserId()
  if (!uid) return false
  const rows = await db
    .select({ id: elements.id })
    .from(elements)
    .where(and(eq(elements.id, projectId), eq(elements.createdBy, uid)))
    .limit(1)
  return rows.length > 0
}

/**
 * Gate a mutating action: throws "Forbidden" unless the caller owns the
 * project. Combine with a `projectId` constraint on the row-level WHERE so a
 * caller can't touch another project's rows by passing a mismatched id.
 */
async function requireProjectAccess(projectId: string): Promise<void> {
  if (!(await ownsProject(projectId))) throw new Error("Forbidden")
}

/**
 * Return only the task ids that actually belong to `projectId` (used to scope
 * bulk operations so a caller can't smuggle in ids from another project).
 */
async function idsInProject(taskIds: string[], projectId: string): Promise<string[]> {
  if (!taskIds.length) return []
  const rows = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(inArray(tasks.id, taskIds), eq(tasks.projectId, projectId)))
  return rows.map((r) => r.id)
}

// ─── Delete + Undo (snapshot / restore) ─────────────────────────────────
//
// Deleting a task is a hard delete (so it disappears consistently from every
// surface — board, search, digests, calendar, exports). To support Undo we
// first snapshot the task and the child rows that a cascade would remove, then
// restore re-inserts them. Snapshots are returned to the client and handed
// back to restoreTasks() if the user clicks Undo.

export type TaskSnapshot = {
  task: typeof tasks.$inferSelect
  comments: (typeof taskComments.$inferSelect)[]
  checklists: (typeof taskChecklists.$inferSelect)[]
  checklistItems: (typeof taskChecklistItems.$inferSelect)[]
  attachments: (typeof taskAttachments.$inferSelect)[]
  dependencies: (typeof taskDependencies.$inferSelect)[]
  labels: (typeof taskToLabels.$inferSelect)[]
}

async function snapshotTask(id: string): Promise<TaskSnapshot | null> {
  const taskRow = (await db.select().from(tasks).where(eq(tasks.id, id)).limit(1))[0]
  if (!taskRow) return null
  const checklists = await db.select().from(taskChecklists).where(eq(taskChecklists.taskId, id))
  const clIds = checklists.map((c) => c.id)
  return {
    task: taskRow,
    comments: await db.select().from(taskComments).where(eq(taskComments.taskId, id)),
    checklists,
    checklistItems: clIds.length
      ? await db.select().from(taskChecklistItems).where(inArray(taskChecklistItems.checklistId, clIds))
      : [],
    attachments: await db.select().from(taskAttachments).where(eq(taskAttachments.taskId, id)),
    dependencies: await db.select().from(taskDependencies).where(eq(taskDependencies.taskId, id)),
    labels: await db.select().from(taskToLabels).where(eq(taskToLabels.taskId, id)),
  }
}

/** Re-insert previously-deleted tasks (+ their child rows) from snapshots. */
export async function restoreTasks(snapshots: TaskSnapshot[], projectId: string) {
  await requireProjectAccess(projectId)
  for (const s of snapshots) {
    if (!s?.task) continue
    await db.insert(tasks).values(s.task)
    for (const c of s.comments) await db.insert(taskComments).values(c)
    for (const cl of s.checklists) await db.insert(taskChecklists).values(cl)
    for (const it of s.checklistItems) await db.insert(taskChecklistItems).values(it)
    for (const a of s.attachments) await db.insert(taskAttachments).values(a)
    for (const d of s.dependencies) await db.insert(taskDependencies).values(d)
    for (const l of s.labels) await db.insert(taskToLabels).values(l)
  }
  await db.update(elements).set({ updatedAt: new Date().toISOString() }).where(eq(elements.id, projectId))
  revalidatePath(`/projects/${projectId}`)
}

// ─── Task Statuses ──────────────────────────────────────────────────────

export async function getTaskStatuses(projectId: string) {
  if (!(await ownsProject(projectId))) return []
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
  await requireProjectAccess(projectId)
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
  await requireProjectAccess(projectId)
  await db.update(taskStatuses).set(data).where(and(eq(taskStatuses.id, id), eq(taskStatuses.projectId, projectId)))
  revalidatePath(`/projects/${projectId}`)
}

export async function deleteTaskStatus(id: string, projectId: string) {
  await requireProjectAccess(projectId)
  // Only delete the column + its tasks if the column actually belongs here.
  const owned = await db
    .select({ id: taskStatuses.id })
    .from(taskStatuses)
    .where(and(eq(taskStatuses.id, id), eq(taskStatuses.projectId, projectId)))
    .limit(1)
  if (!owned.length) return
  await db.delete(tasks).where(and(eq(tasks.statusId, id), eq(tasks.projectId, projectId)))
  await db.delete(taskStatuses).where(eq(taskStatuses.id, id))
  revalidatePath(`/projects/${projectId}`)
}

// ─── Tasks ──────────────────────────────────────────────────────────────

export async function getTasksByProject(projectId: string) {
  if (!(await ownsProject(projectId))) return []
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .orderBy(asc(tasks.sortOrder))
}

export async function createTask(
  projectId: string,
  statusId: string,
  title: string,
  opts?: {
    priority?: "urgent" | "high" | "medium" | "low" | "none"
    dueDate?: string | null
    repeatRule?: string | null
  }
) {
  await requireProjectAccess(projectId)
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
    priority: opts?.priority ?? "none",
    dueDate: opts?.dueDate ?? null,
    repeatRule: opts?.repeatRule ?? null,
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
    startDate?: string | null
    dueDate?: string | null
    sortOrder?: number
    isCompleted?: boolean
    parentTaskId?: string | null
    timeEstimate?: number | null
    timeTracked?: number
    repeatRule?: string | null
  }
) {
  await requireProjectAccess(projectId)
  const now = new Date().toISOString()

  const updateData: Record<string, unknown> = { ...data, updatedAt: now }
  if (data.isCompleted !== undefined) {
    updateData.completedAt = data.isCompleted ? now : null
  }

  // Fetch the current row once when completing — used to bank the timer and
  // to spawn the next occurrence of a recurring task.
  let cur: typeof tasks.$inferSelect | undefined
  if (data.isCompleted === true) {
    const rows = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.projectId, projectId))).limit(1)
    cur = rows[0]
    const startedAt = cur?.timeTrackingStartedAt
    if (startedAt) {
      const elapsed = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
      updateData.timeTracked = (cur?.timeTracked ?? 0) + elapsed
      updateData.timeTrackingStartedAt = null
    }
  }

  await db.update(tasks).set(updateData).where(and(eq(tasks.id, id), eq(tasks.projectId, projectId)))

  // Recurrence: completing a repeating task spawns its next occurrence with
  // the date(s) rolled forward. The completed copy stays in Done.
  if (data.isCompleted === true && cur) {
    const rule = cur.repeatRule
    const curDue = data.dueDate !== undefined ? data.dueDate : cur.dueDate
    const curStart = data.startDate !== undefined ? data.startDate : cur.startDate
    if (isRepeatRule(rule) && (curDue || curStart)) {
      const statusRows = await db
        .select()
        .from(taskStatuses)
        .where(eq(taskStatuses.projectId, projectId))
        .orderBy(asc(taskStatuses.sortOrder))
      const target = statusRows.find((s) => !s.isDoneState) ?? statusRows[0]
      if (target) {
        const siblings = await db
          .select({ sortOrder: tasks.sortOrder })
          .from(tasks)
          .where(and(eq(tasks.projectId, projectId), eq(tasks.statusId, target.id)))
        const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((t) => t.sortOrder)) : -1
        await db.insert(tasks).values({
          id: createId(),
          projectId,
          statusId: target.id,
          title: cur.title,
          description: cur.description ?? null,
          priority: cur.priority,
          startDate: curStart ? advanceDate(curStart, rule) : null,
          dueDate: curDue ? advanceDate(curDue, rule) : null,
          repeatRule: rule,
          timeEstimate: cur.timeEstimate ?? null,
          parentTaskId: cur.parentTaskId ?? null,
          sortOrder: maxOrder + 1,
          createdAt: now,
          updatedAt: now,
        })
      }
    }
  }

  await db
    .update(elements)
    .set({ updatedAt: now })
    .where(eq(elements.id, projectId))

  revalidatePath(`/projects/${projectId}`)
}

export async function deleteTask(id: string, projectId: string): Promise<TaskSnapshot | null> {
  await requireProjectAccess(projectId)
  const snap = await snapshotTask(id)
  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.projectId, projectId)))
  await db
    .update(elements)
    .set({ updatedAt: new Date().toISOString() })
    .where(eq(elements.id, projectId))

  revalidatePath(`/projects/${projectId}`)
  return snap // returned so the client can offer Undo
}

/**
 * Start the persistent (server-side) timer for a task. It keeps accruing —
 * even while you're logged out or the tab is closed — until stopped, the task
 * is completed, or it's deleted. No-op if already running.
 */
export async function startTaskTimer(id: string, projectId: string) {
  await requireProjectAccess(projectId)
  const now = new Date().toISOString()
  const cur = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.projectId, projectId))).limit(1)
  if (!cur[0] || cur[0].timeTrackingStartedAt) return
  await db.update(tasks).set({ timeTrackingStartedAt: now, updatedAt: now }).where(eq(tasks.id, id))
  await db.update(elements).set({ updatedAt: now }).where(eq(elements.id, projectId))
  revalidatePath(`/projects/${projectId}`)
}

/** Stop the timer and bank the elapsed seconds into timeTracked. No-op if not running. */
export async function stopTaskTimer(id: string, projectId: string) {
  await requireProjectAccess(projectId)
  const now = new Date().toISOString()
  const cur = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.projectId, projectId))).limit(1)
  if (!cur[0] || !cur[0].timeTrackingStartedAt) return
  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(cur[0].timeTrackingStartedAt).getTime()) / 1000))
  await db
    .update(tasks)
    .set({ timeTracked: (cur[0].timeTracked ?? 0) + elapsed, timeTrackingStartedAt: null, updatedAt: now })
    .where(eq(tasks.id, id))
  await db.update(elements).set({ updatedAt: now }).where(eq(elements.id, projectId))
  revalidatePath(`/projects/${projectId}`)
}

// ─── Bulk actions (multi-select) ─────────────────────────────────────────

export async function bulkUpdateTasks(
  taskIds: string[],
  projectId: string,
  data: {
    priority?: "urgent" | "high" | "medium" | "low" | "none"
    statusId?: string
    dueDate?: string | null
    isCompleted?: boolean
  },
) {
  if (!taskIds.length) return
  await requireProjectAccess(projectId)
  const ids = await idsInProject(taskIds, projectId)
  const now = new Date().toISOString()
  for (const id of ids) {
    const updateData: Record<string, unknown> = { ...data, updatedAt: now }
    if (data.isCompleted !== undefined) {
      updateData.completedAt = data.isCompleted ? now : null
    }
    if (data.isCompleted === true) {
      const cur = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1)
      if (cur[0]?.timeTrackingStartedAt) {
        const elapsed = Math.max(0, Math.floor((Date.now() - new Date(cur[0].timeTrackingStartedAt).getTime()) / 1000))
        updateData.timeTracked = (cur[0].timeTracked ?? 0) + elapsed
        updateData.timeTrackingStartedAt = null
      }
    }
    await db.update(tasks).set(updateData).where(eq(tasks.id, id))
  }
  await db.update(elements).set({ updatedAt: now }).where(eq(elements.id, projectId))
  revalidatePath(`/projects/${projectId}`)
}

export async function bulkAddComment(taskIds: string[], projectId: string, content: string) {
  const text = content.trim()
  if (!taskIds.length || !text) return
  await requireProjectAccess(projectId)
  const ids = await idsInProject(taskIds, projectId)
  for (const id of ids) {
    await db.insert(taskComments).values({ id: createId(), taskId: id, content: text })
  }
  revalidatePath(`/projects/${projectId}`)
}

/** Start (running=true) or stop the timer on many tasks at once. */
export async function bulkSetTimer(taskIds: string[], projectId: string, running: boolean) {
  if (!taskIds.length) return
  await requireProjectAccess(projectId)
  const ids = await idsInProject(taskIds, projectId)
  const now = new Date().toISOString()
  for (const id of ids) {
    const cur = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1)
    if (!cur[0]) continue
    if (running && !cur[0].timeTrackingStartedAt) {
      await db.update(tasks).set({ timeTrackingStartedAt: now, updatedAt: now }).where(eq(tasks.id, id))
    } else if (!running && cur[0].timeTrackingStartedAt) {
      const elapsed = Math.max(0, Math.floor((Date.now() - new Date(cur[0].timeTrackingStartedAt).getTime()) / 1000))
      await db
        .update(tasks)
        .set({ timeTracked: (cur[0].timeTracked ?? 0) + elapsed, timeTrackingStartedAt: null, updatedAt: now })
        .where(eq(tasks.id, id))
    }
  }
  await db.update(elements).set({ updatedAt: now }).where(eq(elements.id, projectId))
  revalidatePath(`/projects/${projectId}`)
}

export async function bulkDeleteTasks(taskIds: string[], projectId: string): Promise<TaskSnapshot[]> {
  if (!taskIds.length) return []
  await requireProjectAccess(projectId)
  const ids = await idsInProject(taskIds, projectId)
  const snaps: TaskSnapshot[] = []
  for (const id of ids) {
    const snap = await snapshotTask(id)
    if (snap) snaps.push(snap)
    await db.delete(tasks).where(eq(tasks.id, id))
  }
  await db.update(elements).set({ updatedAt: new Date().toISOString() }).where(eq(elements.id, projectId))
  revalidatePath(`/projects/${projectId}`)
  return snaps // returned so the client can offer Undo
}

/** Attach a label to many tasks at once (skips ones that already have it). */
export async function bulkAddLabel(taskIds: string[], projectId: string, labelId: string) {
  if (!taskIds.length || !labelId) return
  await requireProjectAccess(projectId)
  const ids = await idsInProject(taskIds, projectId)
  for (const id of ids) {
    const existing = await db
      .select()
      .from(taskToLabels)
      .where(and(eq(taskToLabels.taskId, id), eq(taskToLabels.labelId, labelId)))
    if (existing.length === 0) {
      await db.insert(taskToLabels).values({ taskId: id, labelId })
    }
  }
  revalidatePath(`/projects/${projectId}`)
}

/** Post each selected task to the activity feed (one event per task). */
export async function bulkAddToFeed(taskIds: string[], projectId: string, note?: string) {
  if (!taskIds.length) return
  await requireProjectAccess(projectId)
  const uid = await currentUserId()
  const ids = await idsInProject(taskIds, projectId)
  const rows = ids.length ? await db.select().from(tasks).where(inArray(tasks.id, ids)) : []
  const summary = note?.trim()
  for (const t of rows) {
    await createFeedEvent({
      type: "task_updated",
      actorUserId: uid ?? undefined,
      subjectTaskId: t.id,
      parentElementId: projectId,
      projectId,
      title: t.title,
      summary: summary || "Task highlighted",
      priority: "normal",
      sourceType: "manual",
    })
  }
  revalidatePath(`/projects/${projectId}`)
}

export async function moveTask(
  taskId: string,
  projectId: string,
  newStatusId: string,
  newSortOrder: number
) {
  await requireProjectAccess(projectId)
  const now = new Date().toISOString()

  const status = await db
    .select()
    .from(taskStatuses)
    .where(and(eq(taskStatuses.id, newStatusId), eq(taskStatuses.projectId, projectId)))
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
    .where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)))

  // Update project progress
  const allTasks = await db.select().from(tasks).where(eq(tasks.projectId, projectId))
  const completedCount = allTasks.filter((t) => t.id === taskId ? status[0]?.isDoneState : t.isCompleted).length
  const progress = allTasks.length > 0 ? Math.round((completedCount / allTasks.length) * 100) : 0

  await db.update(projects).set({ progress }).where(eq(projects.id, projectId))
  await db.update(elements).set({ updatedAt: now }).where(eq(elements.id, projectId))

  revalidatePath(`/projects/${projectId}`)
}

export async function getProjectData(projectId: string) {
  if (!(await ownsProject(projectId))) return null
  const projectResult = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  return projectResult[0] ?? null
}

// ─── Subtasks ──────────────────────────────────────────────────────────

export async function getSubtasks(parentTaskId: string) {
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.parentTaskId, parentTaskId))
    .orderBy(asc(tasks.sortOrder))
}

export async function createSubtask(
  projectId: string,
  statusId: string,
  parentTaskId: string,
  title: string,
) {
  await requireProjectAccess(projectId)
  const existing = await getSubtasks(parentTaskId)
  const maxOrder =
    existing.length > 0
      ? Math.max(...existing.map((t) => t.sortOrder))
      : -1

  const id = createId()
  const now = new Date().toISOString()

  await db.insert(tasks).values({
    id,
    projectId,
    statusId,
    parentTaskId,
    title,
    sortOrder: maxOrder + 1,
    createdAt: now,
    updatedAt: now,
  })

  revalidatePath(`/projects/${projectId}`)
  return id
}

// ─── Task Labels ───────────────────────────────────────────────────────

export async function getAllLabels() {
  return db.select().from(taskLabels).orderBy(asc(taskLabels.name))
}

export async function createLabel(name: string, color: string) {
  const id = createId()
  await db.insert(taskLabels).values({ id, name, color })
  return id
}

export async function getTaskLabels(taskId: string) {
  return db
    .select({ label: taskLabels })
    .from(taskToLabels)
    .innerJoin(taskLabels, eq(taskToLabels.labelId, taskLabels.id))
    .where(eq(taskToLabels.taskId, taskId))
}

export async function addLabelToTask(taskId: string, labelId: string, projectId: string) {
  await requireProjectAccess(projectId)
  const existing = await db
    .select()
    .from(taskToLabels)
    .where(and(eq(taskToLabels.taskId, taskId), eq(taskToLabels.labelId, labelId)))

  if (existing.length === 0) {
    await db.insert(taskToLabels).values({ taskId, labelId })
  }
  revalidatePath(`/projects/${projectId}`)
}

export async function removeLabelFromTask(taskId: string, labelId: string, projectId: string) {
  await requireProjectAccess(projectId)
  await db
    .delete(taskToLabels)
    .where(and(eq(taskToLabels.taskId, taskId), eq(taskToLabels.labelId, labelId)))
  revalidatePath(`/projects/${projectId}`)
}

// ─── Checklists ────────────────────────────────────────────────────────

export async function getTaskChecklists(taskId: string) {
  const checklists = await db
    .select()
    .from(taskChecklists)
    .where(eq(taskChecklists.taskId, taskId))
    .orderBy(asc(taskChecklists.sortOrder))

  const result = []
  for (const cl of checklists) {
    const items = await db
      .select()
      .from(taskChecklistItems)
      .where(eq(taskChecklistItems.checklistId, cl.id))
      .orderBy(asc(taskChecklistItems.sortOrder))
    result.push({ ...cl, items })
  }
  return result
}

export async function createChecklist(taskId: string, title: string, projectId: string) {
  await requireProjectAccess(projectId)
  const existing = await db
    .select()
    .from(taskChecklists)
    .where(eq(taskChecklists.taskId, taskId))
  const maxOrder =
    existing.length > 0 ? Math.max(...existing.map((c) => c.sortOrder)) : -1

  const id = createId()
  await db.insert(taskChecklists).values({
    id,
    taskId,
    title,
    sortOrder: maxOrder + 1,
  })
  revalidatePath(`/projects/${projectId}`)
  return id
}

export async function deleteChecklist(id: string, projectId: string) {
  await requireProjectAccess(projectId)
  await db.delete(taskChecklistItems).where(eq(taskChecklistItems.checklistId, id))
  await db.delete(taskChecklists).where(eq(taskChecklists.id, id))
  revalidatePath(`/projects/${projectId}`)
}

export async function addChecklistItem(
  checklistId: string,
  title: string,
  projectId: string,
) {
  await requireProjectAccess(projectId)
  const existing = await db
    .select()
    .from(taskChecklistItems)
    .where(eq(taskChecklistItems.checklistId, checklistId))
  const maxOrder =
    existing.length > 0 ? Math.max(...existing.map((i) => i.sortOrder)) : -1

  const id = createId()
  await db.insert(taskChecklistItems).values({
    id,
    checklistId,
    title,
    sortOrder: maxOrder + 1,
  })
  revalidatePath(`/projects/${projectId}`)
  return id
}

export async function toggleChecklistItem(id: string, isCompleted: boolean, projectId: string) {
  await requireProjectAccess(projectId)
  await db
    .update(taskChecklistItems)
    .set({
      isCompleted,
      completedAt: isCompleted ? new Date().toISOString() : null,
    })
    .where(eq(taskChecklistItems.id, id))
  revalidatePath(`/projects/${projectId}`)
}

export async function deleteChecklistItem(id: string, projectId: string) {
  await requireProjectAccess(projectId)
  await db.delete(taskChecklistItems).where(eq(taskChecklistItems.id, id))
  revalidatePath(`/projects/${projectId}`)
}

// ─── Task Enrichment (batch metadata for cards) ──────────────────────

export async function getTaskCardMetadata(projectId: string) {
  if (!(await ownsProject(projectId))) {
    return {
      subtaskCounts: {} as Record<string, { total: number; done: number }>,
      labelsByTask: {} as Record<string, typeof taskLabels.$inferSelect[]>,
      checklistByTask: {} as Record<string, { total: number; done: number }>,
      attachmentCounts: {} as Record<string, number>,
      dependencyCounts: {} as Record<string, number>,
      commentCounts: {} as Record<string, number>,
    }
  }
  // Get all subtask counts grouped by parent
  const allTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
  const taskIds = allTasks.map((t) => t.id)
  // Empty project → nothing else to fetch.
  if (taskIds.length === 0) {
    return {
      subtaskCounts: {} as Record<string, { total: number; done: number }>,
      labelsByTask: {} as Record<string, typeof taskLabels.$inferSelect[]>,
      checklistByTask: {} as Record<string, { total: number; done: number }>,
      attachmentCounts: {} as Record<string, number>,
      dependencyCounts: {} as Record<string, number>,
      commentCounts: {} as Record<string, number>,
    }
  }

  const subtaskCounts: Record<string, { total: number; done: number }> = {}
  for (const t of allTasks) {
    if (t.parentTaskId) {
      if (!subtaskCounts[t.parentTaskId]) {
        subtaskCounts[t.parentTaskId] = { total: 0, done: 0 }
      }
      subtaskCounts[t.parentTaskId].total++
      if (t.isCompleted) subtaskCounts[t.parentTaskId].done++
    }
  }

  // Get the labels for this project's tasks, mapped by task
  const allTaskLabels = await db
    .select({ taskId: taskToLabels.taskId, label: taskLabels })
    .from(taskToLabels)
    .innerJoin(taskLabels, eq(taskToLabels.labelId, taskLabels.id))
    .where(inArray(taskToLabels.taskId, taskIds))

  const labelsByTask: Record<string, typeof taskLabels.$inferSelect[]> = {}
  for (const row of allTaskLabels) {
    if (!labelsByTask[row.taskId]) labelsByTask[row.taskId] = []
    labelsByTask[row.taskId].push(row.label)
  }

  // Checklist item counts for this project's tasks, grouped by task
  const allChecklists = await db.select().from(taskChecklists).where(inArray(taskChecklists.taskId, taskIds))
  const clIds = allChecklists.map((c) => c.id)

  const itemsByChecklist: Record<string, { total: number; done: number }> = {}
  if (clIds.length > 0) {
    const allItems = await db.select().from(taskChecklistItems).where(inArray(taskChecklistItems.checklistId, clIds))
    for (const item of allItems) {
      if (!itemsByChecklist[item.checklistId]) {
        itemsByChecklist[item.checklistId] = { total: 0, done: 0 }
      }
      itemsByChecklist[item.checklistId].total++
      if (item.isCompleted) itemsByChecklist[item.checklistId].done++
    }
  }

  const checklistByTask: Record<string, { total: number; done: number }> = {}
  for (const cl of allChecklists) {
    const counts = itemsByChecklist[cl.id]
    if (counts) {
      if (!checklistByTask[cl.taskId]) {
        checklistByTask[cl.taskId] = { total: 0, done: 0 }
      }
      checklistByTask[cl.taskId].total += counts.total
      checklistByTask[cl.taskId].done += counts.done
    }
  }

  // Attachment / dependency / comment counts (scoped to this project's tasks
  // at the DB level via IN (...), not by scanning every table).
  const attachmentCounts: Record<string, number> = {}
  for (const r of await db.select({ taskId: taskAttachments.taskId }).from(taskAttachments).where(inArray(taskAttachments.taskId, taskIds))) {
    attachmentCounts[r.taskId] = (attachmentCounts[r.taskId] ?? 0) + 1
  }
  const dependencyCounts: Record<string, number> = {}
  for (const r of await db.select({ taskId: taskDependencies.taskId }).from(taskDependencies).where(inArray(taskDependencies.taskId, taskIds))) {
    dependencyCounts[r.taskId] = (dependencyCounts[r.taskId] ?? 0) + 1
  }
  const commentCounts: Record<string, number> = {}
  for (const r of await db.select({ taskId: taskComments.taskId }).from(taskComments).where(inArray(taskComments.taskId, taskIds))) {
    commentCounts[r.taskId] = (commentCounts[r.taskId] ?? 0) + 1
  }

  return { subtaskCounts, labelsByTask, checklistByTask, attachmentCounts, dependencyCounts, commentCounts }
}

// ─── Task Dependencies ────────────────────────────────────────────────

export async function getTaskDependencies(taskId: string) {
  return db
    .select()
    .from(taskDependencies)
    .where(eq(taskDependencies.taskId, taskId))
    .orderBy(asc(taskDependencies.createdAt))
}

export async function addTaskDependency(
  taskId: string,
  dependsOnTaskId: string,
  type: "blocks" | "blocked_by" | "relates_to",
  projectId: string,
) {
  await requireProjectAccess(projectId)
  const existing = await db
    .select()
    .from(taskDependencies)
    .where(
      and(
        eq(taskDependencies.taskId, taskId),
        eq(taskDependencies.dependsOnTaskId, dependsOnTaskId),
      ),
    )

  if (existing.length > 0) return existing[0].id

  const id = createId()
  await db.insert(taskDependencies).values({
    id,
    taskId,
    dependsOnTaskId,
    type,
  })
  revalidatePath(`/projects/${projectId}`)
  return id
}

export async function removeTaskDependency(id: string, projectId: string) {
  await requireProjectAccess(projectId)
  await db.delete(taskDependencies).where(eq(taskDependencies.id, id))
  revalidatePath(`/projects/${projectId}`)
}

// ─── Duplicate Task ───────────────────────────────────────────────────

export async function duplicateTask(taskId: string, projectId: string) {
  await requireProjectAccess(projectId)
  const original = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)))
    .limit(1)

  if (original.length === 0) return null

  const src = original[0]
  const id = createId()
  const now = new Date().toISOString()

  // Get sibling tasks for sort order
  const siblings = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), eq(tasks.statusId, src.statusId)))

  const maxOrder =
    siblings.length > 0 ? Math.max(...siblings.map((t) => t.sortOrder)) : -1

  await db.insert(tasks).values({
    id,
    projectId,
    statusId: src.statusId,
    title: `${src.title} (copy)`,
    description: src.description,
    priority: src.priority,
    startDate: src.startDate,
    dueDate: src.dueDate,
    sortOrder: maxOrder + 1,
    parentTaskId: src.parentTaskId,
    timeEstimate: src.timeEstimate,
    createdAt: now,
    updatedAt: now,
  })

  // Duplicate labels
  const srcLabels = await db
    .select()
    .from(taskToLabels)
    .where(eq(taskToLabels.taskId, taskId))

  for (const lbl of srcLabels) {
    await db.insert(taskToLabels).values({ taskId: id, labelId: lbl.labelId })
  }

  // Duplicate checklists
  const srcChecklists = await db
    .select()
    .from(taskChecklists)
    .where(eq(taskChecklists.taskId, taskId))

  for (const cl of srcChecklists) {
    const newClId = createId()
    await db.insert(taskChecklists).values({
      id: newClId,
      taskId: id,
      title: cl.title,
      sortOrder: cl.sortOrder,
    })

    const items = await db
      .select()
      .from(taskChecklistItems)
      .where(eq(taskChecklistItems.checklistId, cl.id))

    for (const item of items) {
      await db.insert(taskChecklistItems).values({
        id: createId(),
        checklistId: newClId,
        title: item.title,
        sortOrder: item.sortOrder,
      })
    }
  }

  await db
    .update(elements)
    .set({ updatedAt: now })
    .where(eq(elements.id, projectId))

  revalidatePath(`/projects/${projectId}`)
  return id
}

// ─── Task Attachments ─────────────────────────────────────────────────

export async function getTaskAttachments(taskId: string) {
  return db
    .select()
    .from(taskAttachments)
    .where(eq(taskAttachments.taskId, taskId))
    .orderBy(desc(taskAttachments.createdAt))
}
