"use server"

import { db, sqlite } from "@/lib/db"
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
import { eq, desc, and, asc, lte, ne, gte } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { currentUserId } from "@/lib/auth/scope"

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
  const uid = await currentUserId()
  if (!uid) return []
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
    .where(eq(elements.createdBy, uid))
    .orderBy(desc(tasks.priority), asc(tasks.dueDate))
    .limit(limit * 3)

  return allTasks
    .filter((t) => !doneStatusIds.includes(t.task.statusId))
    .slice(0, limit)
}

export async function getUpcomingReminders(limit = 8) {
  const uid = await currentUserId()
  if (!uid) return []
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
        eq(elements.isArchived, false),
        eq(elements.createdBy, uid),
      )
    )
    .orderBy(asc(reminders.remindAt))
    .limit(limit)
}

export async function getRecentActivity(limit = 10) {
  const uid = await currentUserId()
  if (!uid) return []
  return db
    .select({
      activity: activityLog,
      element: elements,
    })
    .from(activityLog)
    .innerJoin(elements, eq(activityLog.elementId, elements.id))
    .where(eq(elements.createdBy, uid))
    .orderBy(desc(activityLog.createdAt))
    .limit(limit)
}

// ─── Home dashboard summary ─────────────────────────────────────────────
// Single fetch that powers the new project-manager home page. Returns
// counts per element type with a "new this week" delta, project status
// breakdown, overall progress, and a 30-day activity heatmap. All scoped
// to the current user. Returns zeros if not signed in so the homepage
// still renders during the no-session moment after a logout.

export type DashboardSummary = {
  /** Total / new-this-week per element type. */
  counts: Record<
    "project" | "page" | "canvas" | "todo_list" | "reminder" | "process",
    { total: number; new7d: number }
  >
  /** Project status breakdown for the donut. */
  projectStatus: { active: number; planning: number; paused: number; completed: number }
  /** Average completion % across non-archived projects (0-100). */
  avgProgress: number
  /** How many tasks the user owns vs. how many are complete. */
  taskTotals: { open: number; done: number; overdue: number }
  /** Daily activity counts for the last 30 days (oldest → newest). */
  activityByDay: { date: string; count: number }[]
  /** Items due in the next 7 days (or already overdue). */
  upcoming: {
    id: string
    title: string
    type: "task" | "reminder"
    href: string
    dueAt: string
    overdue: boolean
    projectTitle?: string
  }[]
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const uid = await currentUserId()
  const empty: DashboardSummary = {
    counts: {
      project: { total: 0, new7d: 0 },
      page: { total: 0, new7d: 0 },
      canvas: { total: 0, new7d: 0 },
      todo_list: { total: 0, new7d: 0 },
      reminder: { total: 0, new7d: 0 },
      process: { total: 0, new7d: 0 },
    },
    projectStatus: { active: 0, planning: 0, paused: 0, completed: 0 },
    avgProgress: 0,
    taskTotals: { open: 0, done: 0, overdue: 0 },
    activityByDay: [],
    upcoming: [],
  }
  if (!uid) return empty

  // ── Counts per type (total + new in last 7 days) ────────────────────
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const countRows = sqlite
    .prepare(
      `SELECT type,
              COUNT(*) AS total,
              SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS new7d
       FROM elements
       WHERE created_by = ?
         AND is_deleted = 0
         AND is_archived = 0
       GROUP BY type`,
    )
    .all(sevenDaysAgo, uid) as { type: string; total: number; new7d: number }[]

  const counts = { ...empty.counts }
  for (const row of countRows) {
    const key = row.type as keyof typeof counts
    if (key in counts) counts[key] = { total: row.total ?? 0, new7d: row.new7d ?? 0 }
  }

  // ── Project status breakdown + average progress ────────────────────
  const projectStatusRows = sqlite
    .prepare(
      `SELECT p.status AS status, COUNT(*) AS n, AVG(p.progress) AS avg_progress
       FROM projects p
       INNER JOIN elements e ON e.id = p.id
       WHERE e.created_by = ?
         AND e.is_deleted = 0
         AND e.is_archived = 0
       GROUP BY p.status`,
    )
    .all(uid) as { status: string; n: number; avg_progress: number | null }[]

  const projectStatus = { active: 0, planning: 0, paused: 0, completed: 0 }
  let progressSum = 0
  let progressCount = 0
  for (const row of projectStatusRows) {
    const key = row.status as keyof typeof projectStatus
    if (key in projectStatus) projectStatus[key] = row.n
    if (row.avg_progress != null) {
      progressSum += row.avg_progress * row.n
      progressCount += row.n
    }
  }
  const avgProgress = progressCount > 0 ? Math.round(progressSum / progressCount) : 0

  // ── Task totals (open / done / overdue) ────────────────────────────
  const doneStatusIdsRow = sqlite
    .prepare(`SELECT id FROM task_statuses WHERE is_done_state = 1`)
    .all() as { id: string }[]
  const doneIds = new Set(doneStatusIdsRow.map((r) => r.id))
  const allUserTasks = sqlite
    .prepare(
      `SELECT t.id, t.status_id, t.due_date
       FROM tasks t
       INNER JOIN elements e ON e.id = t.project_id
       WHERE e.created_by = ?`,
    )
    .all(uid) as { id: string; status_id: string; due_date: string | null }[]

  const todayIso = new Date().toISOString()
  let open = 0
  let done = 0
  let overdue = 0
  for (const t of allUserTasks) {
    if (doneIds.has(t.status_id)) done++
    else {
      open++
      if (t.due_date && t.due_date < todayIso) overdue++
    }
  }

  // ── 30-day activity heatmap ────────────────────────────────────────
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const activityRows = sqlite
    .prepare(
      `SELECT date(a.created_at) AS day, COUNT(*) AS n
       FROM activity_log a
       INNER JOIN elements e ON e.id = a.element_id
       WHERE e.created_by = ?
         AND a.created_at >= ?
       GROUP BY day
       ORDER BY day ASC`,
    )
    .all(uid, thirtyDaysAgo.toISOString()) as { day: string; n: number }[]

  // Fill in zeroes for missing days so the heatmap is a full 30-cell grid.
  const activityMap = new Map(activityRows.map((r) => [r.day, r.n]))
  const activityByDay: { date: string; count: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setUTCHours(0, 0, 0, 0)
    d.setUTCDate(d.getUTCDate() - i)
    const key = d.toISOString().slice(0, 10)
    activityByDay.push({ date: key, count: activityMap.get(key) ?? 0 })
  }

  // ── Upcoming (next 7 days, including overdue) ──────────────────────
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const upcomingTasks = sqlite
    .prepare(
      `SELECT t.id, t.title, t.due_date, t.project_id, e.title AS project_title
       FROM tasks t
       INNER JOIN elements e ON e.id = t.project_id
       WHERE e.created_by = ?
         AND t.due_date IS NOT NULL
         AND t.due_date <= ?
         AND t.status_id NOT IN (SELECT id FROM task_statuses WHERE is_done_state = 1)
       ORDER BY t.due_date ASC
       LIMIT 15`,
    )
    .all(uid, nextWeek) as {
      id: string
      title: string
      due_date: string
      project_id: string
      project_title: string
    }[]
  const upcomingReminders = sqlite
    .prepare(
      `SELECT r.id, e.title AS title, r.remind_at
       FROM reminders r
       INNER JOIN elements e ON e.id = r.id
       WHERE e.created_by = ?
         AND r.is_dismissed = 0
         AND e.is_deleted = 0
         AND e.is_archived = 0
         AND r.remind_at <= ?
       ORDER BY r.remind_at ASC
       LIMIT 15`,
    )
    .all(uid, nextWeek) as { id: string; title: string; remind_at: string }[]

  const upcoming: DashboardSummary["upcoming"] = [
    ...upcomingTasks.map((t) => ({
      id: t.id,
      title: t.title,
      type: "task" as const,
      href: `/projects/${t.project_id}`,
      dueAt: t.due_date,
      overdue: t.due_date < todayIso,
      projectTitle: t.project_title,
    })),
    ...upcomingReminders.map((r) => ({
      id: r.id,
      title: r.title,
      type: "reminder" as const,
      href: "/reminders",
      dueAt: r.remind_at,
      overdue: r.remind_at < todayIso,
    })),
  ]
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, 10)

  return {
    counts,
    projectStatus,
    avgProgress,
    taskTotals: { open, done, overdue },
    activityByDay,
    upcoming,
  }
}

// ─── AI "what to work on today" suggestion ──────────────────────────────
// Looks at the user's open tasks (priority + deadline) and asks their
// configured AI provider to pick the few most important things to do today,
// each with a one-line reason. Degrades gracefully: returns a status the UI
// can render (no AI configured / nothing to do / error) instead of throwing.

export type FocusSuggestion =
  | { status: "ok"; items: { title: string; why: string; href?: string }[] }
  | { status: "no_ai" }
  | { status: "empty" }
  | { status: "error" }

export async function getFocusSuggestion(): Promise<FocusSuggestion> {
  const uid = await currentUserId()
  if (!uid) return { status: "no_ai" }

  const { getUserAIConfig } = await import("@/lib/telegram/nl-intent")
  const cfg = getUserAIConfig(uid)
  if (!cfg || !cfg.enabled) return { status: "no_ai" }

  // Candidate open tasks, priority then soonest deadline first.
  const candidates = sqlite
    .prepare(
      `SELECT t.id, t.title, t.priority, t.due_date, e.id AS project_id, e.title AS project_title
       FROM tasks t
       INNER JOIN elements e ON e.id = t.project_id
       WHERE e.created_by = ?
         AND t.status_id NOT IN (SELECT id FROM task_statuses WHERE is_done_state = 1)
       ORDER BY
         CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END ASC,
         (t.due_date IS NULL) ASC,
         t.due_date ASC
       LIMIT 25`,
    )
    .all(uid) as {
      id: string
      title: string
      priority: string
      due_date: string | null
      project_id: string
      project_title: string
    }[]

  if (candidates.length === 0) return { status: "empty" }

  const today = new Date().toISOString().slice(0, 10)
  const lines = candidates.map((c, i) => {
    const due = c.due_date
      ? c.due_date.slice(0, 10) < today
        ? `OVERDUE (due ${c.due_date.slice(0, 10)})`
        : `due ${c.due_date.slice(0, 10)}`
      : "no due date"
    return `${i + 1}. "${c.title}" — priority ${c.priority}, ${due}, project: ${c.project_title}`
  })

  const system =
    `You are a focus coach for a productivity app. Given a list of the user's open tasks with priority and deadlines, pick the 3-5 MOST important to work on TODAY (${today}). ` +
    `Prioritise overdue and soon-due items, then high priority. Return ONLY JSON: {"items":[{"title":"<exact task title from the list>","why":"<one short reason>"}]}. No markdown, no preamble.`

  let parsed: { items?: { title?: string; why?: string }[] }
  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: lines.join("\n") },
        ],
        temperature: 0.2,
        max_tokens: 500,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return { status: "error" }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const raw = data.choices?.[0]?.message?.content?.trim() ?? ""
    const cleaned = raw.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "")
    parsed = JSON.parse(cleaned)
  } catch {
    return { status: "error" }
  }

  const rawItems = Array.isArray(parsed.items) ? parsed.items : []
  const items = rawItems
    .filter((it) => it && typeof it.title === "string")
    .slice(0, 5)
    .map((it) => {
      const title = String(it.title).trim()
      // Attach a link by matching the returned title back to a candidate.
      const match =
        candidates.find((c) => c.title.toLowerCase() === title.toLowerCase()) ??
        candidates.find((c) => title.toLowerCase().includes(c.title.toLowerCase()))
      return {
        title,
        why: String(it.why ?? "").trim().slice(0, 160),
        href: match ? `/projects/${match.project_id}` : undefined,
      }
    })

  if (items.length === 0) return { status: "error" }
  return { status: "ok", items }
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
