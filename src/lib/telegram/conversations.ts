/**
 * Conversation state for multi-step bot flows.
 *
 * Some flows can't be done in one tap — creating a project needs a
 * name, adding a task needs a title. We track the "next text becomes
 * X" state in `telegram_conversations` and route inbound text through
 * the matching handler. Once handled, state is cleared and the user
 * sees a confirmation with quick-action buttons.
 *
 * Step format (kept short to fit the column easily):
 *   "c:project"            → user typing a new project name
 *   "c:todo"               → user typing a new todo-list name
 *   "c:reminder"           → user typing a new reminder title
 *   "c:page"               → user typing a new page title
 *   "c:canvas"             → user typing a new canvas title
 *   "c:process"            → user typing a new process title
 *   "l:add:<listId>"       → user typing the item to add to a list
 *   "p:task:<projectId>"   → user typing the task title for a project
 *
 * All flows accept a `/cancel` command or the [❌ Cancel] button to
 * abort without making changes.
 */

import "server-only"
import { sqlite } from "@/lib/db"
import { createId } from "@/lib/utils/ids"
import { inlineKeyboard, type InlineKeyboardMarkup } from "@/lib/telegram/client"
import type { MenuResponse } from "@/lib/telegram/menus"

const FLOW_TIMEOUT_MIN = 10

export interface ConversationState {
  step: string
  context: Record<string, unknown>
}

export function getState(userId: string): ConversationState | null {
  const row = sqlite
    .prepare(
      `SELECT step, context, expires_at FROM telegram_conversations WHERE user_id = ?`,
    )
    .get(userId) as { step: string; context: string | null; expires_at: string } | undefined
  if (!row) return null
  // Honour the expiry — stale flows are equivalent to no flow.
  if (row.expires_at < new Date().toISOString()) {
    clearState(userId)
    return null
  }
  let context: Record<string, unknown> = {}
  if (row.context) {
    try {
      context = JSON.parse(row.context) as Record<string, unknown>
    } catch {
      /* malformed context — treat as empty */
    }
  }
  return { step: row.step, context }
}

export function setState(
  userId: string,
  step: string,
  context: Record<string, unknown> = {},
): void {
  const expiresAt = new Date(Date.now() + FLOW_TIMEOUT_MIN * 60_000).toISOString()
  sqlite
    .prepare(
      `INSERT INTO telegram_conversations (user_id, step, context, expires_at, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         step       = excluded.step,
         context    = excluded.context,
         expires_at = excluded.expires_at,
         updated_at = datetime('now')`,
    )
    .run(userId, step, JSON.stringify(context), expiresAt)
}

export function clearState(userId: string): void {
  sqlite.prepare(`DELETE FROM telegram_conversations WHERE user_id = ?`).run(userId)
}

// ── Standard "cancel" footer ────────────────────────────────────────────

function cancelFooter(): InlineKeyboardMarkup {
  return inlineKeyboard([
    [{ text: "❌ Cancel", callback_data: "cancel" }],
  ])
}

// ── Prompt builders (sent when the user taps Create/Add) ───────────────

export function promptForCreateName(
  type:
    | "project"
    | "todo"
    | "reminder"
    | "page"
    | "canvas"
    | "process",
): MenuResponse {
  const label = type === "todo" ? "todo list" : type
  return {
    text: [
      `📝 *New ${label}*`,
      "",
      "Send the name as your next message. (Or tap Cancel.)",
    ].join("\n"),
    markup: cancelFooter(),
  }
}

export function promptForListItem(listTitle: string): MenuResponse {
  return {
    text: [
      `➕ *Add to "${escMd(listTitle)}"*`,
      "",
      "Send the item as your next message. Smart syntax works:",
      "`!high`  `@tomorrow`  `#tag`",
    ].join("\n"),
    markup: cancelFooter(),
  }
}

export function promptForTaskTitle(projectTitle: string): MenuResponse {
  return {
    text: [
      `➕ *New task in "${escMd(projectTitle)}"*`,
      "",
      "Send the title as your next message.",
    ].join("\n"),
    markup: cancelFooter(),
  }
}

// ── Dispatcher — called from webhook when state is active ──────────────

export interface FlowReply {
  text: string
  markup: InlineKeyboardMarkup
}

/**
 * Route a text message according to the active conversation state.
 * Always clears state on success. On error, leaves state in place so
 * the user can retry without re-navigating.
 */
export function handleStatedMessage(
  userId: string,
  state: ConversationState,
  text: string,
): FlowReply {
  const trimmed = text.trim()
  if (!trimmed) {
    return {
      text: "Empty message — nothing to use. Try again or tap Cancel.",
      markup: cancelFooter(),
    }
  }
  if (trimmed === "/cancel") {
    clearState(userId)
    return doneFooter("Cancelled.")
  }

  // ── Create-element flows ──────────────────────────────────────────
  if (state.step.startsWith("c:")) {
    const type = state.step.slice(2) as
      | "project"
      | "todo"
      | "reminder"
      | "page"
      | "canvas"
      | "process"
    const elementType =
      type === "todo" ? "todo_list" : type
    const { id } = createElementInline(userId, elementType, trimmed.slice(0, 200))
    clearState(userId)
    const label = type === "todo" ? "Todo list" : capitalize(type)
    return successWithActions(
      `✅ ${label} *${escMd(trimmed)}* created.`,
      type === "project"
        ? [
            // Project → easy follow-ups: add a task or jump back to menu
            [{ text: "➕ Add task", callback_data: `p:t:${id}` }],
            [{ text: "🏠 Menu", callback_data: "menu:main" }],
          ]
        : type === "todo"
        ? [
            [{ text: "➕ Add item", callback_data: `l:a:${id}` }],
            [{ text: "🏠 Menu", callback_data: "menu:main" }],
          ]
        : [
            [{ text: "🏠 Menu", callback_data: "menu:main" }],
          ],
    )
  }

  // ── Add item to existing todo list ───────────────────────────────
  if (state.step.startsWith("l:add:")) {
    const listId = state.step.slice("l:add:".length)
    // Validate list still belongs to this user (safety: state is keyed
    // by user_id but we sanity-check the binding anyway).
    const list = sqlite
      .prepare(
        `SELECT title FROM elements WHERE id = ? AND created_by = ? AND type = 'todo_list' AND is_deleted = 0`,
      )
      .get(listId, userId) as { title: string } | undefined
    if (!list) {
      clearState(userId)
      return doneFooter("That list is gone. Try again from the menu.")
    }
    const captured = parseSmartCapture(trimmed)
    addTodoItem(listId, captured)
    clearState(userId)
    const hits = captureHits(captured)
    return successWithActions(
      `✅ Added to *${escMd(list.title)}*${hits}`,
      [
        [{ text: "➕ Add another", callback_data: `l:a:${listId}` }],
        [{ text: "🏠 Menu", callback_data: "menu:main" }],
      ],
    )
  }

  // ── Rename a project ─────────────────────────────────────────────
  if (state.step.startsWith("p:rename:")) {
    const projectId = state.step.slice("p:rename:".length)
    const owned = sqlite
      .prepare(
        `SELECT 1 FROM elements WHERE id = ? AND created_by = ? AND type = 'project' AND is_deleted = 0`,
      )
      .get(projectId, userId)
    if (!owned) {
      clearState(userId)
      return doneFooter("That project is gone.")
    }
    sqlite
      .prepare(`UPDATE elements SET title = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(trimmed.slice(0, 200), projectId)
    clearState(userId)
    return successWithActions(
      `✏️ Renamed to *${escMd(trimmed)}*`,
      [[{ text: "🏠 Menu", callback_data: "menu:main" }]],
    )
  }

  // ── Add task to existing project ─────────────────────────────────
  if (state.step.startsWith("p:task:")) {
    const projectId = state.step.slice("p:task:".length)
    const project = sqlite
      .prepare(
        `SELECT title FROM elements WHERE id = ? AND created_by = ? AND type = 'project' AND is_deleted = 0`,
      )
      .get(projectId, userId) as { title: string } | undefined
    if (!project) {
      clearState(userId)
      return doneFooter("That project is gone. Try again from the menu.")
    }
    const captured = parseSmartCapture(trimmed)
    const taskId = addTaskInline(projectId, captured)
    if (!taskId) {
      return {
        text: "Project has no open status column. Add one in FlowSpace first.",
        markup: cancelFooter(),
      }
    }
    clearState(userId)
    const hits = captureHits(captured)
    return successWithActions(
      `📌 Task added to *${escMd(project.title)}*${hits}`,
      [
        [{ text: "➕ Add another", callback_data: `p:t:${projectId}` }],
        [{ text: "🏠 Menu", callback_data: "menu:main" }],
      ],
    )
  }

  // ── New gallery album (then file the pending image into it) ──────────
  if (state.step.startsWith("ga:new:")) {
    const imageId = state.step.slice("ga:new:".length)
    const albumId = createId()
    sqlite
      .prepare(`INSERT INTO gallery_albums (id, user_id, name) VALUES (?, ?, ?)`)
      .run(albumId, userId, trimmed.slice(0, 80))
    sqlite
      .prepare(`UPDATE gallery_images SET album_id = ? WHERE id = ? AND user_id = ?`)
      .run(albumId, imageId, userId)
    clearState(userId)
    return successWithActions(
      `📁 Album *${escMd(trimmed)}* created — image filed there.`,
      [[{ text: "🏠 Menu", callback_data: "menu:main" }]],
    )
  }

  // ── Edit a gallery image's caption ───────────────────────────────────
  if (state.step.startsWith("gc:edit:")) {
    const imageId = state.step.slice("gc:edit:".length)
    const r = sqlite
      .prepare(`UPDATE gallery_images SET caption = ?, caption_status = 'done' WHERE id = ? AND user_id = ?`)
      .run(trimmed.slice(0, 280), imageId, userId)
    clearState(userId)
    return r.changes > 0
      ? successWithActions(`✏️ Caption updated.`, [[{ text: "🏠 Menu", callback_data: "menu:main" }]])
      : doneFooter("That image is gone.")
  }

  // ── Add a comment to a gallery image ─────────────────────────────────
  if (state.step.startsWith("gc:cmt:")) {
    const imageId = state.step.slice("gc:cmt:".length)
    const owns = sqlite.prepare(`SELECT 1 FROM gallery_images WHERE id = ? AND user_id = ?`).get(imageId, userId)
    clearState(userId)
    if (!owns) return doneFooter("That image is gone.")
    sqlite
      .prepare(`INSERT INTO gallery_comments (id, image_id, user_id, body) VALUES (?, ?, ?, ?)`)
      .run(createId(), imageId, userId, trimmed.slice(0, 4000))
    return successWithActions(`💬 Comment added.`, [[{ text: "🏠 Menu", callback_data: "menu:main" }]])
  }

  // Unknown state — wipe it so the user isn't stuck.
  clearState(userId)
  return doneFooter("Lost track of where we were. Try the menu again.")
}

// ── Helpers ─────────────────────────────────────────────────────────────

function successWithActions(text: string, rows: { text: string; callback_data: string }[][]): FlowReply {
  return { text, markup: inlineKeyboard(rows) }
}

function doneFooter(text: string): FlowReply {
  return {
    text,
    markup: inlineKeyboard([[{ text: "🏠 Menu", callback_data: "menu:main" }]]),
  }
}

function escMd(s: string): string {
  return s.replace(/[*_`[\]]/g, "\\$&")
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}

function capitalize2(s: string): string {
  return capitalize(s)
}
void capitalize2 // silence noUnusedLocals if it ever drifts

// ── Direct DB writes for create flows ──────────────────────────────────
// We call SQL directly rather than going through the element-actions
// server actions because those use requireAuth() which only works when
// there's a Next.js session cookie. The bot acts under its bound user.

function createElementInline(
  userId: string,
  type: string,
  title: string,
): { id: string } {
  const id = createId()
  const now = new Date().toISOString()
  sqlite
    .prepare(
      `INSERT INTO elements (id, type, title, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, type, title, userId, now, now)
  // Type-specific row + child columns.
  switch (type) {
    case "project": {
      sqlite.prepare(`INSERT INTO projects (id, status, progress) VALUES (?, 'active', 0)`).run(id)
      // Default 3-column board so the project is immediately usable.
      const cols = [
        { name: "To Do",       color: "#94a3b8", sortOrder: 0, isDone: 0 },
        { name: "In Progress", color: "#3b82f6", sortOrder: 1, isDone: 0 },
        { name: "Done",        color: "#22c55e", sortOrder: 2, isDone: 1 },
      ]
      for (const c of cols) {
        sqlite
          .prepare(
            `INSERT INTO task_statuses (id, project_id, name, color, sort_order, is_done_state)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(createId(), id, c.name, c.color, c.sortOrder, c.isDone)
      }
      break
    }
    case "page":
      sqlite.prepare(`INSERT INTO pages (id) VALUES (?)`).run(id)
      break
    case "todo_list":
      sqlite.prepare(`INSERT INTO todo_lists (id) VALUES (?)`).run(id)
      break
    case "canvas":
      sqlite.prepare(`INSERT INTO canvases (id) VALUES (?)`).run(id)
      break
    case "reminder":
      sqlite
        .prepare(`INSERT INTO reminders (id, remind_at, is_dismissed) VALUES (?, ?, 0)`)
        .run(id, new Date(Date.now() + 24 * 3600 * 1000).toISOString())
      break
    case "process":
      sqlite.prepare(`INSERT INTO processes (id) VALUES (?)`).run(id)
      break
  }
  return { id }
}

interface Captured {
  title: string
  priority: "urgent" | "high" | "medium" | "low" | null
  dueDate: string | null
  tags: string[]
}

function addTodoItem(listId: string, captured: Captured): string {
  const id = createId()
  const max = sqlite
    .prepare(`SELECT COALESCE(MAX(sort_order), -1) AS m FROM todo_items WHERE list_id = ?`)
    .get(listId) as { m: number }
  sqlite
    .prepare(
      `INSERT INTO todo_items (id, list_id, title, is_completed, sort_order, due_date, notes, created_at)
       VALUES (?, ?, ?, 0, ?, ?, ?, datetime('now'))`,
    )
    .run(
      id,
      listId,
      captured.title,
      max.m + 1,
      captured.dueDate,
      captured.tags.length > 0 ? captured.tags.map((t) => `#${t}`).join(" ") : null,
    )
  sqlite.prepare(`UPDATE elements SET updated_at = datetime('now') WHERE id = ?`).run(listId)
  return id
}

function addTaskInline(projectId: string, captured: Captured): string | null {
  const todo = sqlite
    .prepare(
      `SELECT id FROM task_statuses WHERE project_id = ? AND is_done_state = 0 ORDER BY sort_order ASC LIMIT 1`,
    )
    .get(projectId) as { id: string } | undefined
  if (!todo) return null
  const id = createId()
  const now = new Date().toISOString()
  sqlite
    .prepare(
      `INSERT INTO tasks (id, project_id, status_id, title, priority, due_date, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    )
    .run(
      id,
      projectId,
      todo.id,
      captured.title,
      captured.priority ?? "none",
      captured.dueDate,
      now,
      now,
    )
  sqlite.prepare(`UPDATE elements SET updated_at = ? WHERE id = ?`).run(now, projectId)
  return id
}

// ── Smart-capture parser (duplicate of agent.ts so this module is
//    self-contained — keeps the import graph from getting tangled). ──

function parseSmartCapture(raw: string): Captured {
  let s = raw.trim()
  let priority: Captured["priority"] = null
  const tags: string[] = []
  let dueDate: string | null = null

  const pm = s.match(/(?:^|\s)!(urgent|high|medium|low)\b/i)
  if (pm) {
    priority = pm[1].toLowerCase() as Captured["priority"]
    s = s.replace(pm[0], " ")
  }
  const isoM = s.match(/(?:^|\s)@(\d{4}-\d{2}-\d{2})\b/)
  if (isoM) {
    dueDate = isoM[1]
    s = s.replace(isoM[0], " ")
  } else {
    const wordM = s.match(/(?:^|\s)@(today|tomorrow|next-week)\b/i)
    if (wordM) {
      const word = wordM[1].toLowerCase()
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      if (word === "tomorrow") d.setDate(d.getDate() + 1)
      if (word === "next-week") d.setDate(d.getDate() + 7)
      dueDate = d.toISOString().slice(0, 10)
      s = s.replace(wordM[0], " ")
    }
  }
  for (const tm of s.matchAll(/(?:^|\s)#([a-z0-9][a-z0-9-]*)\b/gi)) {
    tags.push(tm[1].toLowerCase())
  }
  s = s.replace(/(?:^|\s)#[a-z0-9][a-z0-9-]*\b/gi, " ")
  const title = s.replace(/\s+/g, " ").trim() || raw.trim()
  return { title, priority, dueDate, tags }
}

function captureHits(c: Captured): string {
  const bits: string[] = []
  if (c.priority) bits.push(`priority *${c.priority}*`)
  if (c.dueDate) bits.push(`due *${c.dueDate}*`)
  if (c.tags.length) bits.push(`tags ${c.tags.map((t) => `\`#${t}\``).join(" ")}`)
  return bits.length ? `\n· ${bits.join(" · ")}` : ""
}
