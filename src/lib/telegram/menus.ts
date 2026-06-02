/**
 * Inline-keyboard menu builders for the Telegram bot.
 *
 * Telegram inline keyboards attach to a single message. When the user
 * taps a button we receive a `callback_query` update carrying the
 * `callback_data` we set; we then edit the original message in place
 * (no new lines in chat) and reply with a fresh keyboard. That gives
 * the on-the-go user a smooth tap-tap-tap flow.
 *
 * `callback_data` is capped at 64 BYTES by the Telegram API. Our
 * scheme keeps every action under that ceiling:
 *
 *   menu:main                      → root
 *   v:tasks                        → view: open tasks
 *   v:deadlines:7                  → view: deadlines (N days, ≤90)
 *   v:projects                     → view: projects
 *   v:lists                        → view: todo lists
 *   v:help                         → view: help
 *   t:done:<8-char-prefix>         → mark task/todo done (12 bytes)
 *   i:approve:<importId>           → approve pending import (~20 bytes)
 *   i:dismiss:<importId>
 *   i:preview:<importId>
 *
 * Building menus here so the agent.ts and webhook stay focused on
 * routing and data, not button-payload juggling.
 */

import "server-only"
import { sqlite } from "@/lib/db"
import {
  inlineKeyboard,
  type InlineKeyboardMarkup,
} from "@/lib/telegram/client"
import { PRIORITIES } from "@/lib/priority"

export interface MenuResponse {
  text: string
  markup: InlineKeyboardMarkup
}

// ── Main menu ──────────────────────────────────────────────────────────

/** Public app URL for deep-link buttons, or null when PUBLIC_APP_URL
 *  isn't set on the server. Telegram refuses to render `url:` buttons
 *  with an empty or invalid scheme, so we omit the button entirely
 *  when we can't build a real one. */
function appUrl(): string | null {
  const raw = process.env.PUBLIC_APP_URL?.replace(/\/+$/, "")
  if (!raw || !/^https?:\/\//.test(raw)) return null
  return raw
}

/** Optional "🔗 Open in FlowSpace" row appended to menus when the env
 *  is configured. Lets the user one-tap from Telegram into the web UI
 *  at the matching page. Pass a path like "/" or "/projects/abc". */
function openInAppRow(path: string = "/"): { text: string; url: string }[][] {
  const base = appUrl()
  if (!base) return []
  return [[{ text: "🔗 Open in FlowSpace", url: `${base}${path}` }]]
}

export function mainMenu(): MenuResponse {
  return {
    text: [
      "🏠 *FlowSpace*",
      "",
      "Tap to navigate, create, or update. Or just text me an idea and I'll capture it as a todo.",
    ].join("\n"),
    markup: inlineKeyboard([
      [{ text: "➕ Create new…", callback_data: "c:choose" }],
      [
        { text: "📋 Tasks", callback_data: "v:tasks" },
        { text: "🗓 Deadlines", callback_data: "v:deadlines:7" },
      ],
      [
        { text: "📂 Projects", callback_data: "v:projects" },
        { text: "📝 Todo lists", callback_data: "v:lists" },
      ],
      [{ text: "🆘 Help", callback_data: "v:help" }],
      ...openInAppRow("/"),
    ]),
  }
}

// ── Create submenu — type picker ───────────────────────────────────────

export function createTypeMenu(): MenuResponse {
  return {
    text: [
      "➕ *What would you like to create?*",
      "",
      "I'll ask for a name next.",
    ].join("\n"),
    markup: inlineKeyboard([
      [
        { text: "📁 Project", callback_data: "c:start:project" },
        { text: "📝 Todo list", callback_data: "c:start:todo" },
      ],
      [
        { text: "⏰ Reminder", callback_data: "c:start:reminder" },
        { text: "📄 Page", callback_data: "c:start:page" },
      ],
      [
        { text: "🖼 Canvas", callback_data: "c:start:canvas" },
        { text: "🔀 Process", callback_data: "c:start:process" },
      ],
      [{ text: "⬅️ Back", callback_data: "menu:main" }],
    ]),
  }
}

// ── View: open tasks ───────────────────────────────────────────────────

export function tasksMenu(userId: string): MenuResponse {
  type Row = {
    id: string
    title: string
    due_date: string | null
    project_title: string
  }
  const rows = sqlite
    .prepare(
      `SELECT t.id, t.title, t.due_date, e.title AS project_title
       FROM tasks t
       INNER JOIN elements e ON e.id = t.project_id
       WHERE e.created_by = ?
         AND t.status_id NOT IN (SELECT id FROM task_statuses WHERE is_done_state = 1)
       ORDER BY (t.due_date IS NULL), t.due_date ASC, t.priority DESC
       LIMIT 5`,
    )
    .all(userId) as Row[]

  if (rows.length === 0) {
    return {
      text: "🎉 No open tasks. Inbox zero.",
      markup: inlineKeyboard([[{ text: "⬅️ Back", callback_data: "menu:main" }]]),
    }
  }

  const lines = ["*Open tasks* (top 5)", "", "_Tap a number to manage. Tap ✅ to mark done._", ""]
  const numberRow: { text: string; callback_data: string }[] = []
  const doneRow: { text: string; callback_data: string }[] = []
  rows.forEach((r, i) => {
    const due = r.due_date ? ` _(${friendlyDate(r.due_date)})_` : ""
    lines.push(`${i + 1}. ${escMd(r.title)}${due}\n   in ${escMd(r.project_title)}`)
    numberRow.push({
      text: `${i + 1}`,
      callback_data: `t:o:${r.id.slice(0, 8)}`,
    })
    doneRow.push({
      text: `✅ ${i + 1}`,
      callback_data: `t:done:${r.id.slice(0, 8)}`,
    })
  })

  return {
    text: lines.join("\n"),
    markup: inlineKeyboard([
      numberRow,
      doneRow,
      [
        { text: "🔄 Refresh", callback_data: "v:tasks" },
        { text: "⬅️ Back", callback_data: "menu:main" },
      ],
    ]),
  }
}

// ── Drill: single task with full action menu ──────────────────────────

const PRIORITY_DISPLAY: Record<string, string> = Object.fromEntries(
  PRIORITIES.map((p) => [p.value, `${p.emoji} ${p.label}`]),
)

export function taskDrillMenu(userId: string, taskPrefix: string): MenuResponse {
  const row = sqlite
    .prepare(
      `SELECT t.id, t.title, t.priority, t.due_date, t.project_id, t.status_id,
              e.title AS project_title, s.name AS status_name, s.is_done_state
       FROM tasks t
       INNER JOIN elements e ON e.id = t.project_id
       LEFT  JOIN task_statuses s ON s.id = t.status_id
       WHERE e.created_by = ? AND t.id LIKE ?
       LIMIT 1`,
    )
    .get(userId, `${taskPrefix}%`) as
    | {
        id: string
        title: string
        priority: string
        due_date: string | null
        project_id: string
        status_id: string
        project_title: string
        status_name: string | null
        is_done_state: number | null
      }
    | undefined
  if (!row) {
    return {
      text: "Task not found. It may already be done.",
      markup: inlineKeyboard([[{ text: "⬅️ Back", callback_data: "v:tasks" }]]),
    }
  }
  const p = taskPrefix
  const due = row.due_date ? `· _${friendlyDate(row.due_date)}_` : "· _no date_"
  const pri = PRIORITY_DISPLAY[row.priority] ?? row.priority
  const status = row.status_name ?? "—"
  return {
    text: [
      `📌 *${escMd(row.title)}*`,
      "",
      `in *${escMd(row.project_title)}*`,
      `${status} · ${pri} ${due}`,
    ].join("\n"),
    markup: inlineKeyboard([
      [
        { text: "✅ Mark done", callback_data: `t:done:${p}` },
      ],
      [
        { text: "📅 Reschedule", callback_data: `t:r:${p}` },
        { text: "⚡ Priority", callback_data: `t:pri:${p}` },
      ],
      [{ text: "🔀 Move status", callback_data: `t:s:${p}` }],
      [{ text: "🗑 Delete", callback_data: `t:del:${p}` }],
      ...openInAppRow(`/projects/${row.project_id}`),
      [{ text: "⬅️ Back to tasks", callback_data: "v:tasks" }],
    ]),
  }
}

// ── Submenu: reschedule a task ─────────────────────────────────────────

export function rescheduleMenu(taskPrefix: string): MenuResponse {
  const p = taskPrefix
  return {
    text: "📅 *Reschedule* — pick a new due date",
    markup: inlineKeyboard([
      [
        { text: "Today", callback_data: `t:rs:${p}:t` },
        { text: "Tomorrow", callback_data: `t:rs:${p}:m` },
      ],
      [
        { text: "+3 days", callback_data: `t:rs:${p}:3` },
        { text: "+7 days", callback_data: `t:rs:${p}:7` },
      ],
      [{ text: "Clear due date", callback_data: `t:rs:${p}:x` }],
      [{ text: "⬅️ Back", callback_data: `t:o:${p}` }],
    ]),
  }
}

// ── Submenu: change priority ───────────────────────────────────────────

export function priorityMenu(taskPrefix: string): MenuResponse {
  const p = taskPrefix
  return {
    text: "⚡ *Priority*",
    markup: inlineKeyboard([
      [
        { text: PRIORITY_DISPLAY.urgent, callback_data: `t:pr:${p}:urgent` },
        { text: PRIORITY_DISPLAY.high, callback_data: `t:pr:${p}:high` },
      ],
      [
        { text: PRIORITY_DISPLAY.medium, callback_data: `t:pr:${p}:medium` },
        { text: PRIORITY_DISPLAY.low, callback_data: `t:pr:${p}:low` },
      ],
      [{ text: PRIORITY_DISPLAY.none, callback_data: `t:pr:${p}:none` }],
      [{ text: "⬅️ Back", callback_data: `t:o:${p}` }],
    ]),
  }
}

// ── Submenu: change status (column) ────────────────────────────────────

export function statusMenu(userId: string, taskPrefix: string): MenuResponse {
  const row = sqlite
    .prepare(
      `SELECT t.id, t.status_id, t.project_id, e.title AS project_title
       FROM tasks t INNER JOIN elements e ON e.id = t.project_id
       WHERE e.created_by = ? AND t.id LIKE ? LIMIT 1`,
    )
    .get(userId, `${taskPrefix}%`) as
    | { id: string; status_id: string; project_id: string; project_title: string }
    | undefined
  if (!row) {
    return {
      text: "Task not found.",
      markup: inlineKeyboard([[{ text: "⬅️ Back", callback_data: "v:tasks" }]]),
    }
  }
  const statuses = sqlite
    .prepare(
      `SELECT id, name, color, is_done_state FROM task_statuses
       WHERE project_id = ? ORDER BY sort_order ASC`,
    )
    .all(row.project_id) as { id: string; name: string; is_done_state: number }[]

  const buttons = statuses.map((s) => [
    {
      text: `${s.id === row.status_id ? "✓ " : ""}${s.name}`,
      callback_data: `t:sm:${taskPrefix}:${s.id.slice(0, 12)}`,
    },
  ])
  return {
    text: `🔀 *Move status* — ${escMd(row.project_title)}`,
    markup: inlineKeyboard([
      ...buttons,
      [{ text: "⬅️ Back", callback_data: `t:o:${taskPrefix}` }],
    ]),
  }
}

// ── Confirm delete ────────────────────────────────────────────────────

export function deleteConfirmMenu(userId: string, taskPrefix: string): MenuResponse {
  const row = sqlite
    .prepare(
      `SELECT t.title FROM tasks t INNER JOIN elements e ON e.id = t.project_id
       WHERE e.created_by = ? AND t.id LIKE ? LIMIT 1`,
    )
    .get(userId, `${taskPrefix}%`) as { title: string } | undefined
  if (!row) {
    return {
      text: "Task not found.",
      markup: inlineKeyboard([[{ text: "⬅️ Back", callback_data: "v:tasks" }]]),
    }
  }
  return {
    text: [
      "🗑 *Delete this task?*",
      "",
      `_${escMd(row.title)}_`,
      "",
      "This can't be undone.",
    ].join("\n"),
    markup: inlineKeyboard([
      [
        { text: "✅ Yes, delete", callback_data: `t:dc:${taskPrefix}` },
        { text: "⬅️ Cancel", callback_data: `t:o:${taskPrefix}` },
      ],
    ]),
  }
}

// ── View: deadlines ────────────────────────────────────────────────────

export function deadlinesMenu(userId: string, days: number): MenuResponse {
  const cutoff = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString()
  const tasks = sqlite
    .prepare(
      `SELECT t.id, t.title, t.due_date, e.title AS project_title, 'task' AS kind
       FROM tasks t INNER JOIN elements e ON e.id = t.project_id
       WHERE e.created_by = ? AND t.due_date IS NOT NULL AND t.due_date <= ?
         AND t.status_id NOT IN (SELECT id FROM task_statuses WHERE is_done_state = 1)`,
    )
    .all(userId, cutoff) as {
      id: string
      title: string
      due_date: string
      project_title: string
      kind: string
    }[]
  const reminders = sqlite
    .prepare(
      `SELECT r.id, e.title, r.remind_at AS due_date, '' AS project_title, 'reminder' AS kind
       FROM reminders r INNER JOIN elements e ON e.id = r.id
       WHERE e.created_by = ? AND r.is_dismissed = 0 AND r.remind_at <= ?`,
    )
    .all(userId, cutoff) as typeof tasks
  const merged = [...tasks, ...reminders]
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 10)

  const lines = [`*Due in the next ${days} day${days === 1 ? "" : "s"}*`, ""]
  if (merged.length === 0) {
    lines.push("🗓 Nothing on the radar.")
  } else {
    const todayIso = new Date().toISOString()
    for (const r of merged) {
      const overdue = r.due_date < todayIso ? " ⚠️" : ""
      const icon = r.kind === "reminder" ? "🔔" : "📌"
      const where = r.project_title ? ` _(${escMd(r.project_title)})_` : ""
      lines.push(`${icon} *${friendlyDate(r.due_date)}*${overdue} — ${escMd(r.title)}${where}`)
    }
  }

  return {
    text: lines.join("\n"),
    markup: inlineKeyboard([
      [
        { text: "Today", callback_data: "v:deadlines:1" },
        { text: "7 days", callback_data: "v:deadlines:7" },
        { text: "30 days", callback_data: "v:deadlines:30" },
      ],
      [{ text: "⬅️ Back", callback_data: "menu:main" }],
    ]),
  }
}

// ── View: projects ─────────────────────────────────────────────────────

const PAGE_SIZE = 8

export function projectsMenu(userId: string, page = 0): MenuResponse {
  const totalRow = sqlite
    .prepare(
      `SELECT COUNT(*) AS n FROM projects p INNER JOIN elements e ON e.id = p.id
       WHERE e.created_by = ? AND e.is_archived = 0 AND e.is_deleted = 0`,
    )
    .get(userId) as { n: number }
  const total = totalRow.n
  const safePage = Math.max(0, Math.min(page, Math.max(0, Math.ceil(total / PAGE_SIZE) - 1)))
  const rows = sqlite
    .prepare(
      `SELECT e.id, e.title, p.status, p.progress
       FROM projects p INNER JOIN elements e ON e.id = p.id
       WHERE e.created_by = ? AND e.is_archived = 0 AND e.is_deleted = 0
       ORDER BY e.updated_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(userId, PAGE_SIZE, safePage * PAGE_SIZE) as {
      id: string
      title: string
      status: string
      progress: number
    }[]

  if (total === 0) {
    return {
      text: "*Projects*\n\nNo projects yet.",
      markup: inlineKeyboard([
        [{ text: "➕ New project", callback_data: "c:start:project" }],
        [{ text: "⬅️ Back", callback_data: "menu:main" }],
      ]),
    }
  }

  const buttons = rows.map((r) => [
    {
      text: `📁 ${truncate(r.title, 28)} · ${r.progress}%`,
      callback_data: `p:o:${r.id}`,
    },
  ])
  const pageInfo = paginationFooter("v:projects", safePage, total)
  return {
    text: `*Projects* — tap to open${pageInfo.label}`,
    markup: inlineKeyboard([
      ...buttons,
      ...(pageInfo.row ? [pageInfo.row] : []),
      [
        { text: "➕ New project", callback_data: "c:start:project" },
        { text: "⬅️ Back", callback_data: "menu:main" },
      ],
    ]),
  }
}

// ── Drill: a single project ────────────────────────────────────────────

export function projectDrillMenu(userId: string, projectId: string): MenuResponse {
  const row = sqlite
    .prepare(
      `SELECT e.title, p.status, p.progress, p.due_date,
              (SELECT COUNT(*) FROM tasks t WHERE t.project_id = e.id) AS total,
              (SELECT COUNT(*) FROM tasks t INNER JOIN task_statuses s ON s.id = t.status_id
               WHERE t.project_id = e.id AND s.is_done_state = 1) AS done
       FROM elements e INNER JOIN projects p ON p.id = e.id
       WHERE e.id = ? AND e.created_by = ? AND e.is_deleted = 0`,
    )
    .get(projectId, userId) as
    | { title: string; status: string; progress: number; due_date: string | null; total: number; done: number }
    | undefined
  if (!row) {
    return {
      text: "Project not found.",
      markup: inlineKeyboard([[{ text: "⬅️ Back", callback_data: "v:projects" }]]),
    }
  }
  const due = row.due_date ? ` · due ${friendlyDate(row.due_date)}` : ""
  return {
    text: [
      `📁 *${escMd(row.title)}*`,
      "",
      `Status: _${row.status}_, ${row.progress}% complete${due}`,
      `Tasks: ${row.done}/${row.total}`,
    ].join("\n"),
    markup: inlineKeyboard([
      [{ text: "➕ Add task", callback_data: `p:t:${projectId}` }],
      [{ text: "📋 Open tasks", callback_data: `p:list:${projectId}` }],
      [
        { text: "✏️ Rename", callback_data: `p:rn:${projectId}` },
        { text: "📦 Archive", callback_data: `p:ar:${projectId}` },
      ],
      [{ text: "⬅️ Back to projects", callback_data: "v:projects" }],
    ]),
  }
}

export function projectArchiveConfirm(userId: string, projectId: string): MenuResponse {
  const row = sqlite
    .prepare(`SELECT title FROM elements WHERE id = ? AND created_by = ?`)
    .get(projectId, userId) as { title: string } | undefined
  if (!row) return { text: "Project not found.", markup: inlineKeyboard([[{ text: "⬅️ Back", callback_data: "v:projects" }]]) }
  return {
    text: [
      "📦 *Archive project?*",
      "",
      `_${escMd(row.title)}_`,
      "",
      "It hides from your active lists. You can restore from Trash later.",
    ].join("\n"),
    markup: inlineKeyboard([
      [
        { text: "✅ Yes, archive", callback_data: `p:arc:${projectId}` },
        { text: "⬅️ Cancel", callback_data: `p:o:${projectId}` },
      ],
    ]),
  }
}

// ── View: open tasks in a single project (drill-down) ─────────────────

export function projectTasksMenu(userId: string, projectId: string): MenuResponse {
  type Row = { id: string; title: string; due_date: string | null }
  const project = sqlite
    .prepare(`SELECT title FROM elements WHERE id = ? AND created_by = ?`)
    .get(projectId, userId) as { title: string } | undefined
  if (!project) {
    return {
      text: "Project not found.",
      markup: inlineKeyboard([[{ text: "⬅️ Back", callback_data: "v:projects" }]]),
    }
  }
  const rows = sqlite
    .prepare(
      `SELECT t.id, t.title, t.due_date FROM tasks t
       WHERE t.project_id = ?
         AND t.status_id NOT IN (SELECT id FROM task_statuses WHERE is_done_state = 1)
       ORDER BY (t.due_date IS NULL), t.due_date ASC, t.priority DESC
       LIMIT 5`,
    )
    .all(projectId) as Row[]

  const lines = [`*${escMd(project.title)}* — open tasks`, ""]
  const doneRow: { text: string; callback_data: string }[] = []
  if (rows.length === 0) {
    lines.push("🎉 No open tasks here.")
  } else {
    rows.forEach((r, i) => {
      const due = r.due_date ? ` _(${friendlyDate(r.due_date)})_` : ""
      lines.push(`${i + 1}. ${escMd(r.title)}${due}`)
      doneRow.push({
        text: `✅ ${i + 1}`,
        callback_data: `t:done:${r.id.slice(0, 8)}`,
      })
    })
  }
  return {
    text: lines.join("\n"),
    markup: inlineKeyboard([
      ...(doneRow.length > 0 ? [doneRow] : []),
      [
        { text: "➕ Add task", callback_data: `p:t:${projectId}` },
        { text: "⬅️ Back", callback_data: `p:o:${projectId}` },
      ],
    ]),
  }
}

// ── View: todo lists ───────────────────────────────────────────────────

export function listsMenu(userId: string, page = 0): MenuResponse {
  const totalRow = sqlite
    .prepare(
      `SELECT COUNT(*) AS n FROM elements
       WHERE created_by = ? AND type = 'todo_list' AND is_archived = 0 AND is_deleted = 0`,
    )
    .get(userId) as { n: number }
  const total = totalRow.n
  const safePage = Math.max(0, Math.min(page, Math.max(0, Math.ceil(total / PAGE_SIZE) - 1)))
  const rows = sqlite
    .prepare(
      `SELECT e.id, e.title,
              COALESCE(SUM(CASE WHEN ti.id IS NOT NULL THEN 1 ELSE 0 END), 0) AS n,
              COALESCE(SUM(CASE WHEN ti.is_completed = 1 THEN 1 ELSE 0 END), 0) AS done
       FROM elements e
       LEFT JOIN todo_items ti ON ti.list_id = e.id
       WHERE e.created_by = ? AND e.type = 'todo_list'
         AND e.is_archived = 0 AND e.is_deleted = 0
       GROUP BY e.id, e.title
       ORDER BY e.updated_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(userId, PAGE_SIZE, safePage * PAGE_SIZE) as {
      id: string
      title: string
      n: number
      done: number
    }[]

  if (total === 0) {
    return {
      text: "*Todo lists*\n\nNo todo lists yet.",
      markup: inlineKeyboard([
        [{ text: "➕ New list", callback_data: "c:start:todo" }],
        [{ text: "⬅️ Back", callback_data: "menu:main" }],
      ]),
    }
  }

  const buttons = rows.map((r) => [
    {
      text: `📝 ${truncate(r.title, 24)} · ${r.done}/${r.n}`,
      callback_data: `l:o:${r.id}`,
    },
  ])
  const pageInfo = paginationFooter("v:lists", safePage, total)
  return {
    text: `*Todo lists* — tap to open${pageInfo.label}`,
    markup: inlineKeyboard([
      ...buttons,
      ...(pageInfo.row ? [pageInfo.row] : []),
      [
        { text: "➕ New list", callback_data: "c:start:todo" },
        { text: "⬅️ Back", callback_data: "menu:main" },
      ],
    ]),
  }
}

/**
 * Build the pagination footer. Returns null `row` when there's only one
 * page — the menu builder then skips rendering nav controls entirely.
 * The label appended to the header reads "Page N / M" when there are
 * multiple pages.
 */
function paginationFooter(
  prefix: string,
  page: number,
  total: number,
): {
  row: { text: string; callback_data: string }[] | null
  label: string
} {
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  if (pageCount <= 1) return { row: null, label: "" }
  const label = `  _(page ${page + 1} / ${pageCount})_`
  const buttons: { text: string; callback_data: string }[] = []
  if (page > 0) buttons.push({ text: "⏮ Prev", callback_data: `${prefix}:${page - 1}` })
  if (page < pageCount - 1)
    buttons.push({ text: "Next ⏭", callback_data: `${prefix}:${page + 1}` })
  return { row: buttons.length > 0 ? buttons : null, label }
}

// ── Drill: a single todo list ──────────────────────────────────────────

export function listDrillMenu(userId: string, listId: string): MenuResponse {
  const list = sqlite
    .prepare(`SELECT title FROM elements WHERE id = ? AND created_by = ?`)
    .get(listId, userId) as { title: string } | undefined
  if (!list) {
    return {
      text: "List not found.",
      markup: inlineKeyboard([[{ text: "⬅️ Back", callback_data: "v:lists" }]]),
    }
  }
  const items = sqlite
    .prepare(
      `SELECT id, title, is_completed FROM todo_items WHERE list_id = ?
       ORDER BY is_completed ASC, sort_order ASC LIMIT 8`,
    )
    .all(listId) as { id: string; title: string; is_completed: number }[]

  const lines = [`📝 *${escMd(list.title)}*`, ""]
  const doneRow: { text: string; callback_data: string }[] = []
  if (items.length === 0) {
    lines.push("_Empty list. Tap Add item._")
  } else {
    items.forEach((it, i) => {
      const mark = it.is_completed ? "✅" : "▫️"
      lines.push(`${mark} ${i + 1}. ${escMd(it.title)}`)
      if (!it.is_completed) {
        doneRow.push({
          text: `✅ ${i + 1}`,
          callback_data: `t:done:${it.id.slice(0, 8)}`,
        })
      }
    })
  }
  return {
    text: lines.join("\n"),
    markup: inlineKeyboard([
      ...(doneRow.length > 0 ? [doneRow] : []),
      [
        { text: "➕ Add item", callback_data: `l:a:${listId}` },
        { text: "⬅️ Back", callback_data: "v:lists" },
      ],
    ]),
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s
}

// ─── Voice flow menus ───────────────────────────────────────────────────
//
// Three stages, each presented by editing the SAME message in place:
//   1. languagePickerMenu  — bot just received a voice; ask language
//   2. voiceDestinationMenu — transcription done; ask where to send it
//   3. voiceListPickerMenu / voiceProjectPickerMenu — drill down to a target
//
// The `pid` is the 8-char prefix of the pending_voices row id — keeps
// callback_data well under Telegram's 64-byte limit.

export function languagePickerMenu(): MenuResponse {
  return {
    text: [
      "🎙 *Voice note received.*",
      "",
      "Pick a transcription language:",
    ].join("\n"),
    markup: inlineKeyboard([
      [
        { text: "🇬🇧 English", callback_data: "" },  // placeholder, filled below
        { text: "🇸🇦 Arabic",  callback_data: "" },
        { text: "🌐 Auto",     callback_data: "" },
      ],
      [{ text: "❌ Cancel",     callback_data: "" }],
    ]),
  }
}

/** Fills the placeholder buttons in `languagePickerMenu()` with the
 *  pending-voice id. We do it in a builder so the menu shape stays in
 *  one place. The "⚡ Skip — defaults" row transcribes with the user's
 *  pinned default language and lands straight in their default list. */
export function languagePickerFor(pid: string, defaultLangLabel: string): MenuResponse {
  return {
    text: [
      "🎙 *Voice note received.*",
      "",
      "Pick a transcription language — or Skip to use your defaults:",
    ].join("\n"),
    markup: inlineKeyboard([
      [
        { text: `⚡ Skip → ${defaultLangLabel} + default list`, callback_data: `vp:l:${pid}:def` },
      ],
      [
        { text: "🇬🇧 English", callback_data: `vp:l:${pid}:en` },
        { text: "🇸🇦 Arabic",  callback_data: `vp:l:${pid}:ar` },
        { text: "🌐 Auto",     callback_data: `vp:l:${pid}:au` },
      ],
      [{ text: "❌ Cancel",     callback_data: `vp:c:${pid}` }],
    ]),
  }
}

/**
 * The "Send to…" router shown under every capture confirmation (text, voice,
 * media). The item already exists as a to-do in the default list; these
 * buttons re-route it: one tap → Page (new page from the content), pick a
 * Project (becomes a task), or move to another to-do list. Undo / Menu round
 * it out. Keep callback_data short — Telegram caps it at 64 bytes.
 */
export function captureRouterRows(
  todoId: string,
): { text: string; callback_data: string }[][] {
  return [
    [
      { text: "📄 → Page", callback_data: `snd:pg:${todoId}` },
      { text: "📁 → Project", callback_data: `snd:pr:${todoId}` },
    ],
    [{ text: "📂 Move to another list", callback_data: `move:todo:${todoId}` }],
    [
      { text: "↩️ Undo", callback_data: `undo:todo:${todoId}` },
      { text: "🏠 Menu", callback_data: "menu:main" },
    ],
  ]
}

export function voiceDestinationMenu(pid: string, transcript: string): MenuResponse {
  return {
    text: [
      `🎙 *Heard:* "${escMd(transcript)}"`,
      "",
      "Where should this go?",
    ].join("\n"),
    markup: inlineKeyboard([
      [{ text: "➕ Default todo list", callback_data: `vp:d:${pid}:def` }],
      [
        { text: "📂 Pick list…",    callback_data: `vp:d:${pid}:lst` },
        { text: "📁 As task in…",   callback_data: `vp:d:${pid}:tsk` },
      ],
      [{ text: "💬 As command",     callback_data: `vp:d:${pid}:cmd` }],
      [{ text: "❌ Cancel",          callback_data: `vp:c:${pid}` }],
    ]),
  }
}

export function voiceListPicker(userId: string, pid: string): MenuResponse {
  const rows = sqlite
    .prepare(
      `SELECT id, title FROM elements
       WHERE created_by = ? AND type = 'todo_list'
         AND is_archived = 0 AND is_deleted = 0
       ORDER BY updated_at DESC LIMIT 6`,
    )
    .all(userId) as { id: string; title: string }[]

  const buttons = rows.map((r) => [
    {
      text: `📝 ${truncate(r.title, 28)}`,
      callback_data: `vp:dl:${pid}:${r.id.slice(0, 12)}`,
    },
  ])
  return {
    text: "📂 *Pick a list*",
    markup: inlineKeyboard([
      ...buttons,
      ...(buttons.length === 0
        ? [[{ text: "(no lists yet — pick Default)", callback_data: `vp:d:${pid}:def` }]]
        : []),
      [{ text: "⬅️ Back", callback_data: `vp:d:${pid}:back` }],
    ]),
  }
}

export function voiceProjectPicker(userId: string, pid: string): MenuResponse {
  const rows = sqlite
    .prepare(
      `SELECT id, title FROM elements
       WHERE created_by = ? AND type = 'project'
         AND is_archived = 0 AND is_deleted = 0
       ORDER BY updated_at DESC LIMIT 6`,
    )
    .all(userId) as { id: string; title: string }[]

  const buttons = rows.map((r) => [
    {
      text: `📁 ${truncate(r.title, 28)}`,
      callback_data: `vp:dt:${pid}:${r.id.slice(0, 12)}`,
    },
  ])
  return {
    text: "📁 *Pick a project* — new task lands in its first column",
    markup: inlineKeyboard([
      ...buttons,
      ...(buttons.length === 0
        ? [[{ text: "(no projects yet)", callback_data: `vp:d:${pid}:back` }]]
        : []),
      [{ text: "⬅️ Back", callback_data: `vp:d:${pid}:back` }],
    ]),
  }
}

// ── View: help ─────────────────────────────────────────────────────────

export function helpMenu(): MenuResponse {
  return {
    text: [
      "*Cheatsheet*",
      "",
      "🪄 *Smart capture* (in any message)",
      "  `!urgent` `!high` `!medium` `!low`",
      "  `@2026-06-15` or `@today` `@tomorrow` `@next-week`",
      "  `#tag-name`",
      "",
      "📥 *Capture commands*",
      "  `<text>` — drops into default list",
      "  `/todo <list> <text>`",
      "  `/task <project> <text>`",
      "",
      "📋 *Read*",
      "  `/tasks` `/deadlines` `/projects` `/lists`",
      "",
      "📦 *Paste-from-AI*",
      "  Paste FlowSpace markdown for project/page/etc — I'll queue for your approval.",
    ].join("\n"),
    markup: inlineKeyboard([[{ text: "⬅️ Back", callback_data: "menu:main" }]]),
  }
}

// ── Pending-import notification (NEW message, not edit) ────────────────

export function pendingImportMenu(
  importId: string,
  summary: string,
): MenuResponse {
  return {
    text: [
      "📥 *Import waiting for your approval*",
      "",
      `_${escMd(summary)}_`,
      "",
      "Nothing has been created yet — choose below.",
    ].join("\n"),
    markup: inlineKeyboard([
      [
        { text: "✅ Approve", callback_data: `i:approve:${importId}` },
        { text: "❌ Dismiss", callback_data: `i:dismiss:${importId}` },
      ],
    ]),
  }
}

// ── Shared formatting helpers ──────────────────────────────────────────

function escMd(s: string): string {
  return s.replace(/[*_`[\]]/g, "\\$&")
}

function friendlyDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const t = new Date(d)
  t.setHours(0, 0, 0, 0)
  const diff = Math.round((t.getTime() - today.getTime()) / (24 * 3600 * 1000))
  if (diff === 0) return "today"
  if (diff === 1) return "tomorrow"
  if (diff === -1) return "yesterday"
  if (diff > 1 && diff < 7) return d.toLocaleDateString(undefined, { weekday: "long" })
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}
