/**
 * Telegram message → FlowSpace action dispatcher.
 *
 * The bot is meant to feel agent-y, not basic CLI. We support:
 *
 *   /help                 — list commands
 *   /tasks                — open tasks across all projects (top 10, by due)
 *   /deadlines [days]     — items due in the next N days (default 7)
 *   /projects             — list projects + completion %
 *   /lists                — list todo lists
 *   /add <text>           — quick-capture into the default todo list
 *   /todo <list> <text>   — add an item to a specific list (by name match)
 *   /task <project> <text>— add a task to a project (by name match)
 *   /done <id-prefix>     — mark a task or todo item complete
 *   /me                   — show what bot is connected
 *
 * Anything that doesn't start with `/` is treated as a quick-capture
 * into the user's default todo list. This is the "walking down the street
 * with an idea" path — type, send, done.
 *
 * Each handler returns a plain-text reply. The webhook route formats it
 * (markdown when safe) and posts it back to Telegram.
 */

import "server-only"
import { sqlite } from "@/lib/db"
import { createId } from "@/lib/utils/ids"
import { createElement } from "@/lib/actions/element-actions"
import { classifyIntent, isNLEnabled, getUserAIConfig } from "@/lib/telegram/nl-intent"
import { renderBotReply } from "@/lib/telegram/replies"

interface BotRow {
  user_id: string
  bot_token: string
  target_list_id: string | null
}

// Each handler returns the reply text. Errors propagate so the webhook
// can log them and ack the update either way (we want at-most-once
// processing — Telegram retries on 5xx so silent recovery is fine).

export async function dispatchTelegramMessage(
  bot: BotRow,
  text: string,
): Promise<string> {
  const trimmed = text.trim()
  if (!trimmed) return "Empty message — nothing to do."

  // Slash-command path
  if (trimmed.startsWith("/")) {
    const [cmdRaw, ...rest] = trimmed.split(/\s+/)
    const cmd = cmdRaw.split("@")[0].toLowerCase() // strip /cmd@botname
    const args = rest.join(" ").trim()
    switch (cmd) {
      case "/start": return greeting(bot)
      case "/help":  return helpText()
      case "/me":    return meText(bot)
      case "/tasks": return listOpenTasks(bot)
      case "/deadlines": return listDeadlines(bot, parseDays(args))
      case "/projects": return listProjects(bot)
      case "/lists":    return listTodoLists(bot)
      case "/default":  return setDefaultList(bot, args)
      case "/add":      return addToDefaultList(bot, args)
      case "/todo":     return addToNamedList(bot, args)
      case "/task":     return addTaskToProject(bot, args)
      case "/done":     return markDone(bot, args)
      case "/stats":    return weeklyStats(bot)
      case "/search":   return searchAll(bot, args)
      case "/digest":   return toggleDigest(bot, args)
      case "/voice":    return voiceLanguage(bot, args)
      case "/nl":       return toggleNL(bot, args)
      case "/voiceout": return toggleVoiceOut(bot, args)
      case "/clear":    return clearMyHistory(bot, args)
      default:
        return `Unknown command "${cmd}". Try /help or /menu.`
    }
  }

  // Freeform path: if NL commands are enabled AND user has an AI
  // provider configured, classify intent via AI. Falls back to capture
  // if AI returns nothing useful or errors.
  if (isNLEnabled(bot.user_id)) {
    const intent = await classifyIntent(bot.user_id, trimmed)
    if (intent?.kind === "command") {
      switch (intent.name) {
        case "tasks":     return `🤖 _Interpreted as_ \`/tasks\`\n\n${listOpenTasks(bot)}`
        case "deadlines": return `🤖 _Interpreted as_ \`/deadlines\`\n\n${listDeadlines(bot, 7)}`
        case "projects":  return `🤖 _Interpreted as_ \`/projects\`\n\n${listProjects(bot)}`
        case "lists":     return `🤖 _Interpreted as_ \`/lists\`\n\n${listTodoLists(bot)}`
        case "stats":     return `🤖 _Interpreted as_ \`/stats\`\n\n${weeklyStats(bot)}`
        case "help":      return helpText()
      }
    }
    if (intent?.kind === "capture" && intent.text) {
      return addToDefaultList(bot, intent.text)
    }
  }
  // Freeform path: quick-capture into the user's default todo list.
  return addToDefaultList(bot, trimmed)
}

// ─── command handlers ────────────────────────────────────────────────────

function greeting(bot: BotRow): string {
  return renderBotReply(bot.user_id, "greeting")
}

function helpText(): string {
  return [
    "*FlowSpace bot commands*",
    "",
    "📥 *Capture* (freeform text → todo)",
    "  • `<text>` — drops into your default list",
    "  • `/add <text>` — same as above",
    "  • `/todo <list-name> <text>` — into a specific list",
    "  • `/task <project-name> <text>` — new task in a project",
    "",
    "🪄 *Smart capture* (sprinkle in any message)",
    "  • `!urgent` `!high` `!medium` `!low` — priority",
    "  • `@2026-06-15` or `@today` `@tomorrow` `@next-week` — due date",
    "  • `#release` `#waiting-on-david` — tags",
    "  e.g. `ship v1 @2026-06-15 !high #release`",
    "",
    "📋 *Read*",
    "  • `/tasks` — open tasks (top 10)",
    "  • `/deadlines [days]` — what's due in the next N days",
    "  • `/projects` — projects + completion %",
    "  • `/lists` — your todo lists (⭐ marks default)",
    "  • `/default [name]` — show or set your default capture list",
    "",
    "✅ *Update*",
    "  • `/done <id-prefix>` — complete a task or todo by 8-char prefix",
    "",
    "📊 *Insight*",
    "  • `/stats` — last 7 days at a glance",
    "  • `/search <text>` — find anything",
    "",
    "🌅 *Daily digest*",
    "  • `/digest` — show/toggle/set time (e.g. `/digest 07:30`)",
    "",
    "🎙 *Voice*",
    "  • Hold the mic button — I'll transcribe & route as text",
    "  • `/voice` — show current language",
    "  • `/voice en`, `/voice ar`, `/voice auto` — pick / pin",
    "  • `/voiceout on|off` — hear my replies as voice notes (needs TTS provider)",
    "",
    "ℹ️ *Setup*",
    "  • `/me` — which bot you're connected to",
    "  • Forward any chat message to me → it becomes a todo.",
  ].join("\n")
}

function meText(bot: BotRow): string {
  const row = sqlite
    .prepare(`SELECT u.display_name, u.username, tb.bot_username FROM users u JOIN telegram_bots tb ON tb.user_id = u.id WHERE u.id = ?`)
    .get(bot.user_id) as
    | { display_name: string; username: string; bot_username: string | null }
    | undefined
  if (!row) return "I'm not connected to a FlowSpace account."
  return [
    `Connected to FlowSpace as *${row.display_name}* (@${row.username}).`,
    row.bot_username ? `Bot: @${row.bot_username}` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

function listOpenTasks(bot: BotRow): string {
  type Row = { id: string; title: string; due_date: string | null; project_title: string }
  const rows = sqlite
    .prepare(
      `SELECT t.id, t.title, t.due_date, e.title AS project_title
       FROM tasks t
       INNER JOIN elements e ON e.id = t.project_id
       WHERE e.created_by = ?
         AND t.status_id NOT IN (SELECT id FROM task_statuses WHERE is_done_state = 1)
       ORDER BY (t.due_date IS NULL), t.due_date ASC, t.priority DESC
       LIMIT 10`,
    )
    .all(bot.user_id) as Row[]
  if (rows.length === 0) return "🎉 No open tasks. Inbox zero."
  const lines = ["*Open tasks* (top 10)", ""]
  for (const r of rows) {
    const due = r.due_date ? ` — _${friendlyDate(r.due_date)}_` : ""
    lines.push(`• ${escapeMd(r.title)}${due}\n   in ${escapeMd(r.project_title)} — \`${r.id.slice(0, 8)}\``)
  }
  return lines.join("\n")
}

function listDeadlines(bot: BotRow, days: number): string {
  type Row = { id: string; title: string; due_date: string; project_title: string; kind: string }
  const cutoff = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString()
  const tasks = sqlite
    .prepare(
      `SELECT t.id, t.title, t.due_date, e.title AS project_title, 'task' AS kind
       FROM tasks t
       INNER JOIN elements e ON e.id = t.project_id
       WHERE e.created_by = ?
         AND t.due_date IS NOT NULL
         AND t.due_date <= ?
         AND t.status_id NOT IN (SELECT id FROM task_statuses WHERE is_done_state = 1)`,
    )
    .all(bot.user_id, cutoff) as Row[]
  const reminders = sqlite
    .prepare(
      `SELECT r.id, e.title, r.remind_at AS due_date, '' AS project_title, 'reminder' AS kind
       FROM reminders r
       INNER JOIN elements e ON e.id = r.id
       WHERE e.created_by = ?
         AND r.is_dismissed = 0
         AND r.remind_at <= ?`,
    )
    .all(bot.user_id, cutoff) as Row[]
  const merged = [...tasks, ...reminders].sort((a, b) => a.due_date.localeCompare(b.due_date))
  if (merged.length === 0) return `🗓 Nothing due in the next ${days} day${days === 1 ? "" : "s"}.`
  const lines = [`*Due in the next ${days} day${days === 1 ? "" : "s"}*`, ""]
  const todayIso = new Date().toISOString()
  for (const r of merged.slice(0, 20)) {
    const overdue = r.due_date < todayIso ? " ⚠️ overdue" : ""
    const icon = r.kind === "reminder" ? "🔔" : "📌"
    const where = r.project_title ? ` _(${escapeMd(r.project_title)})_` : ""
    lines.push(`${icon} *${friendlyDate(r.due_date)}*${overdue} — ${escapeMd(r.title)}${where}`)
  }
  return lines.join("\n")
}

function listProjects(bot: BotRow): string {
  type Row = { id: string; title: string; status: string; progress: number; due_date: string | null }
  const rows = sqlite
    .prepare(
      `SELECT e.id, e.title, p.status, p.progress, p.due_date
       FROM projects p
       INNER JOIN elements e ON e.id = p.id
       WHERE e.created_by = ?
         AND e.is_archived = 0
         AND e.is_deleted = 0
       ORDER BY p.status ASC, p.due_date ASC NULLS LAST`,
    )
    .all(bot.user_id) as Row[]
  if (rows.length === 0) return "No projects yet."
  const lines = ["*Projects*", ""]
  for (const r of rows) {
    const due = r.due_date ? ` · due ${friendlyDate(r.due_date)}` : ""
    lines.push(`• ${escapeMd(r.title)} — _${r.status}_, ${r.progress}%${due}`)
  }
  return lines.join("\n")
}

function listTodoLists(bot: BotRow): string {
  type Row = { id: string; title: string; n: number; done: number }
  const rows = sqlite
    .prepare(
      `SELECT e.id, e.title,
              COALESCE(SUM(CASE WHEN ti.id IS NOT NULL THEN 1 ELSE 0 END), 0) AS n,
              COALESCE(SUM(CASE WHEN ti.is_completed = 1 THEN 1 ELSE 0 END), 0) AS done
       FROM elements e
       LEFT JOIN todo_items ti ON ti.list_id = e.id
       WHERE e.created_by = ?
         AND e.type = 'todo_list'
         AND e.is_archived = 0
         AND e.is_deleted = 0
       GROUP BY e.id, e.title
       ORDER BY e.updated_at DESC`,
    )
    .all(bot.user_id) as Row[]
  if (rows.length === 0) return "No todo lists. Use `/add <text>` to create one."
  const defaultId = getDefaultTodoListId(bot.user_id)
  const lines = ["*Todo lists*", ""]
  for (const r of rows) {
    const star = r.id === defaultId ? " ⭐" : ""
    lines.push(`• ${escapeMd(r.title)}${star} — ${r.done}/${r.n}`)
  }
  return lines.join("\n")
}

async function addToDefaultList(bot: BotRow, text: string): Promise<string> {
  if (!text) return "Nothing to add. Try `/add buy milk`."
  let listId = bot.target_list_id ?? getDefaultTodoListId(bot.user_id)
  if (!listId) {
    // No todo list yet — create an "Inbox" one for them.
    const created = await createElementAs(bot.user_id, "todo_list", "Inbox")
    listId = created.id
    sqlite
      .prepare(`UPDATE telegram_bots SET target_list_id = ?, updated_at = datetime('now') WHERE user_id = ?`)
      .run(listId, bot.user_id)
  }
  // Smart-capture: pull out `!high`/`!urgent` priority, `@YYYY-MM-DD` due
  // date, and `#tag`s from the message. The rest becomes the title.
  const captured = parseSmartCapture(text)
  const newId = addTodoItemRaw(listId, captured.title, {
    dueDate: captured.dueDate,
    notes: captured.tags.length > 0 ? captured.tags.map((t) => `#${t}`).join(" ") : undefined,
  })
  // Tell the user EXACTLY what we captured — no silent magic.
  const hits: string[] = []
  if (captured.priority) hits.push(`priority *${captured.priority}*`)
  if (captured.dueDate)  hits.push(`due *${captured.dueDate}*`)
  if (captured.tags.length) hits.push(`tags ${captured.tags.map((t) => `\`#${t}\``).join(" ")}`)
  const detail = hits.length > 0 ? `\n· captured: ${hits.join(" · ")}` : ""
  const body = renderBotReply(bot.user_id, "capture_added", {
    list: escapeMd(getElementTitle(listId) ?? "Inbox"),
    detail,
  })
  return `__UNDO:todo:${newId}__\n${body}`
}

/**
 * Pull out the capture sugar from a freeform message.
 *
 * Recognized tokens (order doesn't matter, can be anywhere in the text):
 *   !urgent | !high | !medium | !low   — priority
 *   @YYYY-MM-DD | @tomorrow | @today    — due date
 *   #tag-name                            — a tag (alphanumeric + dashes)
 *
 * Everything else becomes the title. Whitespace gets collapsed.
 *
 * Examples
 *   "buy milk"                            → title="buy milk"
 *   "review PRs !high"                    → title="review PRs", priority=high
 *   "ship v1 @2026-06-15 #release #urgent"→ title="ship v1", dueDate=2026-06-15, tags=[release,urgent]
 *   "call mom @tomorrow !medium"          → title="call mom", priority=medium, dueDate=<tomorrow ISO>
 */
function parseSmartCapture(raw: string): {
  title: string
  priority: "urgent" | "high" | "medium" | "low" | null
  dueDate: string | null
  tags: string[]
} {
  let s = raw.trim()
  let priority: "urgent" | "high" | "medium" | "low" | null = null
  const tags: string[] = []
  let dueDate: string | null = null

  // Priority
  const pm = s.match(/(?:^|\s)!(urgent|high|medium|low)\b/i)
  if (pm) {
    priority = pm[1].toLowerCase() as "urgent" | "high" | "medium" | "low"
    s = s.replace(pm[0], " ")
  }

  // Due date — ISO first, then sugar words.
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
      if (word === "tomorrow")  d.setDate(d.getDate() + 1)
      if (word === "next-week") d.setDate(d.getDate() + 7)
      dueDate = d.toISOString().slice(0, 10)
      s = s.replace(wordM[0], " ")
    }
  }

  // Tags (collect ALL — could be several)
  for (const tm of s.matchAll(/(?:^|\s)#([a-z0-9][a-z0-9-]*)\b/gi)) {
    tags.push(tm[1].toLowerCase())
  }
  s = s.replace(/(?:^|\s)#[a-z0-9][a-z0-9-]*\b/gi, " ")

  // Collapse whitespace
  const title = s.replace(/\s+/g, " ").trim() || raw.trim()
  return { title, priority, dueDate, tags }
}

async function addToNamedList(bot: BotRow, args: string): Promise<string> {
  if (!args) return "Usage: `/todo <list-name> <text>`"
  // Take the first word as the list name match. Lists with spaces:
  // wrap in quotes — `/todo "Personal weekly" wash car`.
  const { name, rest } = splitFirstQuotedOrWord(args)
  if (!name || !rest) return "Usage: `/todo <list-name> <text>`"
  const list = findListByName(bot.user_id, name)
  if (!list) return `No todo list matching "${name}".`
  addTodoItemRaw(list.id, rest)
  return `✅ Added to *${escapeMd(list.title)}*`
}

async function addTaskToProject(bot: BotRow, args: string): Promise<string> {
  if (!args) return "Usage: `/task <project-name> <title>`"
  const { name, rest } = splitFirstQuotedOrWord(args)
  if (!name || !rest) return "Usage: `/task <project-name> <title>`"
  const proj = findProjectByName(bot.user_id, name)
  if (!proj) return `No project matching "${name}".`
  const todo = sqlite
    .prepare(
      `SELECT id FROM task_statuses WHERE project_id = ? AND is_done_state = 0 ORDER BY sort_order ASC LIMIT 1`,
    )
    .get(proj.id) as { id: string } | undefined
  if (!todo) return `Project "${proj.title}" has no open status column.`
  const taskId = createId()
  const now = new Date().toISOString()
  sqlite
    .prepare(
      `INSERT INTO tasks (id, project_id, status_id, title, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`,
    )
    .run(taskId, proj.id, todo.id, rest, now, now)
  sqlite
    .prepare(`UPDATE elements SET updated_at = ? WHERE id = ?`)
    .run(now, proj.id)
  return `📌 Task added to *${escapeMd(proj.title)}* — \`${taskId.slice(0, 8)}\``
}

/** Public helper: callbacks.ts uses this to mark a task/todo done by its
 *  8-char ID prefix (the same format we surface in /tasks output). */
export function markDoneByPrefix(userId: string, prefix: string): string {
  return markDone({ user_id: userId, bot_token: "", target_list_id: null }, prefix)
}

function markDone(bot: BotRow, args: string): string {
  const prefix = args.trim().split(/\s+/)[0]
  if (!prefix || prefix.length < 4) return "Usage: `/done <id-prefix>` (at least 4 chars)."
  // Try tasks first
  const task = sqlite
    .prepare(
      `SELECT t.id, t.project_id, t.title FROM tasks t
       INNER JOIN elements e ON e.id = t.project_id
       WHERE e.created_by = ? AND t.id LIKE ?
       LIMIT 1`,
    )
    .get(bot.user_id, `${prefix}%`) as { id: string; project_id: string; title: string } | undefined
  if (task) {
    const done = sqlite
      .prepare(
        `SELECT id FROM task_statuses WHERE project_id = ? AND is_done_state = 1 ORDER BY sort_order DESC LIMIT 1`,
      )
      .get(task.project_id) as { id: string } | undefined
    if (!done) return "No Done column in that project."
    sqlite
      .prepare(`UPDATE tasks SET status_id = ?, completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`)
      .run(done.id, task.id)
    return renderBotReply(bot.user_id, "task_done", { title: escapeMd(task.title) })
  }
  // Then todo items
  const todo = sqlite
    .prepare(
      `SELECT ti.id, ti.title FROM todo_items ti
       INNER JOIN elements e ON e.id = ti.list_id
       WHERE e.created_by = ? AND ti.id LIKE ?
       LIMIT 1`,
    )
    .get(bot.user_id, `${prefix}%`) as { id: string; title: string } | undefined
  if (todo) {
    sqlite
      .prepare(`UPDATE todo_items SET is_completed = 1, completed_at = datetime('now') WHERE id = ?`)
      .run(todo.id)
    return renderBotReply(bot.user_id, "todo_done", { title: escapeMd(todo.title) })
  }
  return `Nothing found matching \`${prefix}\`.`
}

// ─── /stats — quick velocity snapshot ────────────────────────────────────

function weeklyStats(bot: BotRow): string {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString()
  const counts = sqlite
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM tasks t INNER JOIN elements e ON e.id = t.project_id
           WHERE e.created_by = ? AND t.created_at >= ?)
           AS new_tasks,
         (SELECT COUNT(*) FROM tasks t INNER JOIN elements e ON e.id = t.project_id
           WHERE e.created_by = ? AND t.completed_at >= ?)
           AS completed_tasks,
         (SELECT COUNT(*) FROM tasks t INNER JOIN elements e ON e.id = t.project_id
           WHERE e.created_by = ?
             AND t.status_id NOT IN (SELECT id FROM task_statuses WHERE is_done_state = 1))
           AS open_tasks,
         (SELECT COUNT(*) FROM tasks t INNER JOIN elements e ON e.id = t.project_id
           WHERE e.created_by = ? AND t.due_date < datetime('now')
             AND t.status_id NOT IN (SELECT id FROM task_statuses WHERE is_done_state = 1))
           AS overdue,
         (SELECT COUNT(*) FROM todo_items ti INNER JOIN elements e ON e.id = ti.list_id
           WHERE e.created_by = ? AND ti.is_completed = 1 AND ti.completed_at >= ?)
           AS todos_done,
         (SELECT COUNT(*) FROM elements
           WHERE created_by = ? AND created_at >= ? AND is_deleted = 0)
           AS new_elements`,
    )
    .get(
      bot.user_id, sevenDaysAgo,
      bot.user_id, sevenDaysAgo,
      bot.user_id,
      bot.user_id,
      bot.user_id, sevenDaysAgo,
      bot.user_id, sevenDaysAgo,
    ) as {
      new_tasks: number
      completed_tasks: number
      open_tasks: number
      overdue: number
      todos_done: number
      new_elements: number
    }
  const ratio = counts.new_tasks > 0
    ? Math.round((counts.completed_tasks / counts.new_tasks) * 100)
    : counts.completed_tasks > 0 ? 100 : 0
  return [
    "📊 *Last 7 days*",
    "",
    `🆕 ${counts.new_tasks} new tasks · ✅ ${counts.completed_tasks} done (${ratio}%)`,
    `📥 ${counts.todos_done} todo items checked off`,
    `📁 ${counts.new_elements} new elements`,
    "",
    "*Right now*",
    `📋 ${counts.open_tasks} open tasks` + (counts.overdue > 0 ? ` · ⚠️ *${counts.overdue} overdue*` : ""),
  ].join("\n")
}

// ─── /search — across tasks, projects, lists ─────────────────────────────

function searchAll(bot: BotRow, query: string): string {
  const q = query.trim()
  if (!q || q.length < 2) return "Usage: `/search <text>` (≥ 2 chars)"
  const like = `%${q}%`

  const tasks = sqlite
    .prepare(
      `SELECT t.id, t.title, e.title AS project_title FROM tasks t
       INNER JOIN elements e ON e.id = t.project_id
       WHERE e.created_by = ? AND LOWER(t.title) LIKE LOWER(?)
       ORDER BY t.updated_at DESC LIMIT 5`,
    )
    .all(bot.user_id, like) as { id: string; title: string; project_title: string }[]

  const elements = sqlite
    .prepare(
      `SELECT id, type, title FROM elements
       WHERE created_by = ? AND LOWER(title) LIKE LOWER(?)
         AND is_deleted = 0 AND is_archived = 0
       ORDER BY updated_at DESC LIMIT 10`,
    )
    .all(bot.user_id, like) as { id: string; type: string; title: string }[]

  const todos = sqlite
    .prepare(
      `SELECT ti.id, ti.title, e.title AS list_title FROM todo_items ti
       INNER JOIN elements e ON e.id = ti.list_id
       WHERE e.created_by = ? AND LOWER(ti.title) LIKE LOWER(?)
       ORDER BY ti.created_at DESC LIMIT 5`,
    )
    .all(bot.user_id, like) as { id: string; title: string; list_title: string }[]

  if (tasks.length + elements.length + todos.length === 0) {
    return `🔍 No matches for "${q}".`
  }
  const lines = [`🔍 *Results for "${escMd(q)}"*`, ""]
  if (elements.length > 0) {
    lines.push(`*Elements*`)
    for (const e of elements) {
      lines.push(`• ${typeIcon(e.type)} ${escMd(e.title)} _(${e.type.replace(/_/g, " ")})_`)
    }
    lines.push("")
  }
  if (tasks.length > 0) {
    lines.push(`*Tasks*`)
    for (const t of tasks) {
      lines.push(`• 📌 ${escMd(t.title)} _(in ${escMd(t.project_title)})_ — \`${t.id.slice(0, 8)}\``)
    }
    lines.push("")
  }
  if (todos.length > 0) {
    lines.push(`*Todo items*`)
    for (const t of todos) {
      lines.push(`• ▫️ ${escMd(t.title)} _(in ${escMd(t.list_title)})_ — \`${t.id.slice(0, 8)}\``)
    }
  }
  return lines.join("\n").trim()
}

function typeIcon(t: string): string {
  return t === "project" ? "📁"
    : t === "page" ? "📄"
    : t === "canvas" ? "🖼"
    : t === "todo_list" ? "📝"
    : t === "reminder" ? "⏰"
    : t === "process" ? "🔀"
    : "•"
}

// ─── /digest — toggle the morning summary ────────────────────────────────

function toggleDigest(bot: BotRow, args: string): string {
  const a = args.trim().toLowerCase()
  if (!a) {
    const row = sqlite
      .prepare(
        `SELECT digest_enabled, digest_time, digest_evening_enabled, digest_evening_time
         FROM telegram_bots WHERE user_id = ?`,
      )
      .get(bot.user_id) as
      | { digest_enabled: number; digest_time: string; digest_evening_enabled: number; digest_evening_time: string }
      | undefined
    if (!row) return "Bot not configured."
    return [
      `🌅 *Digests*`,
      ``,
      row.digest_enabled
        ? `Morning: *on* at *${row.digest_time}*`
        : `Morning: *off*`,
      row.digest_evening_enabled
        ? `Evening: *on* at *${row.digest_evening_time}*`
        : `Evening: *off*`,
      ``,
      `*Morning*`,
      `  \`/digest on\` or \`/digest off\``,
      `  \`/digest 07:30\` — set time`,
      ``,
      `*Evening wrap-up*`,
      `  \`/digest evening on\` or \`/digest evening off\``,
      `  \`/digest evening 19:00\` — set time`,
    ].join("\n")
  }
  // Evening subcommand
  if (a.startsWith("evening")) {
    const tail = a.slice(7).trim()
    if (tail === "on") {
      sqlite.prepare(`UPDATE telegram_bots SET digest_evening_enabled = 1 WHERE user_id = ?`).run(bot.user_id)
      return "🌙 Evening wrap-up *on*. You'll get an end-of-day summary."
    }
    if (tail === "off") {
      sqlite.prepare(`UPDATE telegram_bots SET digest_evening_enabled = 0 WHERE user_id = ?`).run(bot.user_id)
      return "🌙 Evening wrap-up *off*."
    }
    const m = tail.match(/^([0-2]?\d):([0-5]\d)$/)
    if (m) {
      const hh = String(parseInt(m[1], 10)).padStart(2, "0")
      const mm = m[2]
      sqlite
        .prepare(`UPDATE telegram_bots SET digest_evening_time = ?, digest_evening_enabled = 1 WHERE user_id = ?`)
        .run(`${hh}:${mm}`, bot.user_id)
      return `🌙 Evening digest set to *${hh}:${mm}*. Enabled.`
    }
    return "Usage: `/digest evening on|off` or `/digest evening HH:MM`"
  }
  if (a === "on") {
    sqlite.prepare(`UPDATE telegram_bots SET digest_enabled = 1 WHERE user_id = ?`).run(bot.user_id)
    return "🌅 Daily digest *on*. You'll get a morning summary."
  }
  if (a === "off") {
    sqlite.prepare(`UPDATE telegram_bots SET digest_enabled = 0 WHERE user_id = ?`).run(bot.user_id)
    return "🌅 Daily digest *off*."
  }
  const m = a.match(/^([0-2]?\d):([0-5]\d)$/)
  if (m) {
    const hh = String(parseInt(m[1], 10)).padStart(2, "0")
    const mm = m[2]
    sqlite
      .prepare(`UPDATE telegram_bots SET digest_time = ?, digest_enabled = 1 WHERE user_id = ?`)
      .run(`${hh}:${mm}`, bot.user_id)
    return `🌅 Morning digest set to *${hh}:${mm}*. Enabled.`
  }
  return "Usage: `/digest on|off`, `/digest HH:MM`, or `/digest evening on|off|HH:MM`"
}

// (escMd is escapeMd lower below — keep one definition only)
const escMd = (s: string): string => escapeMd(s)

// ─── /nl — toggle natural-language command routing ──────────────────────
function toggleNL(bot: BotRow, args: string): string {
  const a = args.trim().toLowerCase()
  const ai = getUserAIConfig(bot.user_id)
  if (!a) {
    const enabled = isNLEnabled(bot.user_id)
    const lines = [
      "🤖 *Natural-language commands*",
      "",
      enabled ? "Currently: *ON*" : "Currently: *OFF*",
    ]
    if (!ai) {
      lines.push(
        "",
        "⚠️ You haven't configured an AI provider. Set one in",
        "FlowSpace → Settings → AI features before turning this on.",
      )
    } else {
      lines.push(
        "",
        "When on, text that isn't a slash command or markdown is",
        "routed through your AI provider — say _\"what am I working on\"_",
        "and the bot understands.",
        "",
        "Toggle: `/nl on` or `/nl off`",
      )
    }
    return lines.join("\n")
  }
  if (a === "on") {
    if (!ai) {
      return "⚠️ Configure an AI provider in FlowSpace → Settings → AI features first."
    }
    sqlite.prepare(`UPDATE telegram_bots SET nl_commands_enabled = 1 WHERE user_id = ?`).run(bot.user_id)
    return "🤖 Natural-language commands *ON*. Talk to me normally — I'll route through your AI provider."
  }
  if (a === "off") {
    sqlite.prepare(`UPDATE telegram_bots SET nl_commands_enabled = 0 WHERE user_id = ?`).run(bot.user_id)
    return "🤖 Natural-language commands *OFF*. Freeform text now goes straight to capture."
  }
  return "Usage: `/nl on` or `/nl off`"
}

// ─── /voiceout — toggle TTS voice-note replies ─────────────────────────
function toggleVoiceOut(bot: BotRow, args: string): string {
  const a = args.trim().toLowerCase()
  const row = sqlite
    .prepare(`SELECT voice_out_enabled FROM telegram_bots WHERE user_id = ?`)
    .get(bot.user_id) as { voice_out_enabled: number | null } | undefined
  const enabled = row?.voice_out_enabled === 1
  if (!a) {
    const ai = getUserAIConfig(bot.user_id)
    const lines = [
      "🔊 *Voice OUT* (TTS replies)",
      "",
      enabled ? "Currently: *ON*" : "Currently: *OFF*",
    ]
    if (!ai) {
      lines.push(
        "",
        "⚠️ Configure an AI provider (Settings → AI features) with a",
        "TTS-capable model (e.g. OpenAI `tts-1`) before turning this on.",
      )
    } else {
      lines.push(
        "",
        "When on, every text reply is also sent as a voice note,",
        "synthesised through your AI provider's `/audio/speech`",
        "endpoint. Off by default — voice notes can be noisy.",
        "",
        "Toggle: `/voiceout on` or `/voiceout off`",
      )
    }
    return lines.join("\n")
  }
  if (a === "on") {
    if (!getUserAIConfig(bot.user_id)) {
      return "⚠️ Configure an AI provider first (Settings → AI features)."
    }
    sqlite
      .prepare(`UPDATE telegram_bots SET voice_out_enabled = 1 WHERE user_id = ?`)
      .run(bot.user_id)
    return "🔊 Voice OUT *ON*. I'll speak my replies."
  }
  if (a === "off") {
    sqlite
      .prepare(`UPDATE telegram_bots SET voice_out_enabled = 0 WHERE user_id = ?`)
      .run(bot.user_id)
    return "🔊 Voice OUT *OFF*. Text replies only."
  }
  return "Usage: `/voiceout on` or `/voiceout off`"
}

// ─── /clear — wipe the user's bot message history ──────────────────────
//
// Two modes:
//   /clear           → ask for confirmation (sends a count + instructions)
//   /clear confirm   → actually delete
//
// Two-step on purpose: the history table is the user's audit trail; we
// don't want a fat-fingered `/clear` to nuke it.
function clearMyHistory(bot: BotRow, args: string): string {
  const a = args.trim().toLowerCase()
  const row = sqlite
    .prepare(
      `SELECT COUNT(*) AS n FROM telegram_messages WHERE user_id = ?`,
    )
    .get(bot.user_id) as { n: number } | undefined
  const count = row?.n ?? 0
  if (a !== "confirm") {
    if (count === 0) return "Your bot history is already empty."
    return [
      `🗑 *Clear ${count} message${count === 1 ? "" : "s"}?*`,
      "",
      "This wipes the inbound + outbound bot log from Settings →",
      "Telegram → Message history. The actual elements you captured",
      "stay; only the chat audit goes away.",
      "",
      "Send `/clear confirm` to proceed.",
    ].join("\n")
  }
  sqlite
    .prepare(`DELETE FROM telegram_messages WHERE user_id = ?`)
    .run(bot.user_id)
  return `✅ Cleared ${count} message${count === 1 ? "" : "s"} from your bot history.`
}

// ─── /voice — set transcription language for voice messages ─────────────
//
// Whisper auto-detects per utterance, which surprises bilingual users —
// single-word utterances often default to English while longer phrases
// can flip to the user's native language. Pinning a language fixes that.
//
//   /voice            → show current setting
//   /voice en|ar|es…  → pin a language by ISO 639-1 code
//   /voice auto       → let Whisper guess each time
const KNOWN_LANGUAGES: Record<string, string> = {
  en: "English", ar: "Arabic", es: "Spanish", fr: "French", de: "German",
  it: "Italian", pt: "Portuguese", ru: "Russian", tr: "Turkish",
  zh: "Chinese", ja: "Japanese", ko: "Korean", hi: "Hindi", ur: "Urdu",
  fa: "Persian", he: "Hebrew", nl: "Dutch", pl: "Polish", sv: "Swedish",
}

function voiceLanguage(bot: BotRow, args: string): string {
  const a = args.trim().toLowerCase()
  if (!a) {
    const row = sqlite
      .prepare(`SELECT voice_language, voice_auto_skip FROM telegram_bots WHERE user_id = ?`)
      .get(bot.user_id) as { voice_language: string; voice_auto_skip: number } | undefined
    const cur = row?.voice_language ?? "en"
    const niceCur = cur === "auto" ? "auto-detect" : (KNOWN_LANGUAGES[cur] ?? cur.toUpperCase())
    const skipOn = (row?.voice_auto_skip ?? 0) === 1
    return [
      "🎙 *Voice settings*",
      "",
      `Default language: *${niceCur}* (\`${cur}\`)`,
      `Auto-skip pickers: *${skipOn ? "ON" : "OFF"}*`,
      "",
      "*Set defaults*",
      "  `/voice en`  English",
      "  `/voice ar`  Arabic",
      "  `/voice es`  Spanish",
      "  `/voice auto`  let Whisper decide",
      "",
      "*Auto-skip* — when on, voice notes go straight to your default list with no taps:",
      "  `/voice skip on`",
      "  `/voice skip off`",
      "",
      "Full language list: ISO 639-1 codes (en, ar, es, fr, de, it, pt, ru, tr, zh, ja, ko, hi, ur, fa, he, nl, pl, sv …)",
    ].join("\n")
  }
  // Skip-mode subcommand: /voice skip on|off
  if (a.startsWith("skip")) {
    const tail = a.slice(4).trim()
    if (tail === "on" || tail === "off") {
      const val = tail === "on" ? 1 : 0
      sqlite.prepare(`UPDATE telegram_bots SET voice_auto_skip = ? WHERE user_id = ?`).run(val, bot.user_id)
      return tail === "on"
        ? "⚡ Voice auto-skip *ON* — voice notes now drop straight into your default list with no taps."
        : "🎙 Voice auto-skip *OFF* — you'll see the language + destination pickers again."
    }
    return "Usage: `/voice skip on` or `/voice skip off`"
  }
  if (a === "auto") {
    sqlite.prepare(`UPDATE telegram_bots SET voice_language = 'auto' WHERE user_id = ?`).run(bot.user_id)
    return "🎙 Voice language set to *auto-detect*. Whisper will guess each clip's language."
  }
  if (!/^[a-z]{2}$/.test(a)) {
    return "Use a 2-letter ISO code like `en`, `ar`, `es`, or `auto`. Or `/voice skip on|off`."
  }
  sqlite.prepare(`UPDATE telegram_bots SET voice_language = ? WHERE user_id = ?`).run(a, bot.user_id)
  const nice = KNOWN_LANGUAGES[a] ?? a.toUpperCase()
  return `🎙 Voice language pinned to *${nice}* (\`${a}\`).`
}

// ─── data helpers ────────────────────────────────────────────────────────

function getDefaultTodoListId(userId: string): string | null {
  const row = sqlite
    .prepare(
      `SELECT id FROM elements
       WHERE created_by = ? AND type = 'todo_list' AND is_archived = 0 AND is_deleted = 0
       ORDER BY updated_at DESC LIMIT 1`,
    )
    .get(userId) as { id: string } | undefined
  return row?.id ?? null
}

function getElementTitle(id: string): string | null {
  const row = sqlite.prepare(`SELECT title FROM elements WHERE id = ?`).get(id) as { title: string } | undefined
  return row?.title ?? null
}

/**
 * Show or change the default capture destination (telegram_bots.target_list_id).
 *   /default            → show the current default + usage
 *   /default <name>     → set the default to the matching list
 *   /default clear      → clear it (fall back to most-recent list)
 */
function setDefaultList(bot: BotRow, args: string): string {
  const a = args.trim()
  if (!a) {
    const current = bot.target_list_id ? getElementTitle(bot.target_list_id) : null
    return [
      current
        ? `⭐ Your default list is *${escapeMd(current)}*.`
        : "⭐ No default list set — captures land in your most-recently-used list.",
      "",
      "Change it with `/default <list name>`, or `/default clear` to unset.",
      "See your lists with `/lists`.",
    ].join("\n")
  }
  if (a.toLowerCase() === "clear") {
    sqlite.prepare(`UPDATE telegram_bots SET target_list_id = NULL WHERE user_id = ?`).run(bot.user_id)
    return "⭐ Default list cleared. Captures now go to your most-recently-used list."
  }
  const list = findListByName(bot.user_id, a)
  if (!list) {
    return `No list matching "${escapeMd(a)}". Try \`/lists\` to see them, or create one first.`
  }
  sqlite.prepare(`UPDATE telegram_bots SET target_list_id = ? WHERE user_id = ?`).run(list.id, bot.user_id)
  return `⭐ Default list set to *${escapeMd(list.title)}*. New captures land here.`
}

function findListByName(userId: string, name: string) {
  return sqlite
    .prepare(
      `SELECT id, title FROM elements
       WHERE created_by = ? AND type = 'todo_list' AND is_archived = 0 AND is_deleted = 0
         AND LOWER(title) LIKE LOWER(?)
       ORDER BY updated_at DESC LIMIT 1`,
    )
    .get(userId, `%${name}%`) as { id: string; title: string } | undefined
}

function findProjectByName(userId: string, name: string) {
  return sqlite
    .prepare(
      `SELECT id, title FROM elements
       WHERE created_by = ? AND type = 'project' AND is_archived = 0 AND is_deleted = 0
         AND LOWER(title) LIKE LOWER(?)
       ORDER BY updated_at DESC LIMIT 1`,
    )
    .get(userId, `%${name}%`) as { id: string; title: string } | undefined
}

function addTodoItemRaw(
  listId: string,
  title: string,
  extras: { dueDate?: string | null; notes?: string } = {},
): string {
  const id = createId()
  // Find current max sort order so new items land at the end.
  const max = sqlite
    .prepare(`SELECT COALESCE(MAX(sort_order), -1) AS m FROM todo_items WHERE list_id = ?`)
    .get(listId) as { m: number }
  sqlite
    .prepare(
      `INSERT INTO todo_items (id, list_id, title, is_completed, sort_order, due_date, notes, created_at)
       VALUES (?, ?, ?, 0, ?, ?, ?, datetime('now'))`,
    )
    .run(id, listId, title, max.m + 1, extras.dueDate ?? null, extras.notes ?? null)
  sqlite.prepare(`UPDATE elements SET updated_at = datetime('now') WHERE id = ?`).run(listId)
  return id
}

/**
 * Magic prefix the webhook layer recognises and converts into an inline
 * keyboard with an "↩️ Undo" button. We stick the new todo's ID into the
 * prefix so the callback can delete the right row. Stripped from the
 * actual message body before posting.
 *
 * Format: `__UNDO:todo:<id>__\n<rest of reply>`
 */
const UNDO_PREFIX_RE = /^__UNDO:todo:([A-Za-z0-9_-]+)__\n/

export function parseUndoMarker(reply: string): {
  text: string
  todoId: string | null
} {
  const m = reply.match(UNDO_PREFIX_RE)
  if (!m) return { text: reply, todoId: null }
  return { text: reply.slice(m[0].length), todoId: m[1] }
}

export function softDeleteTodoForUser(
  userId: string,
  todoId: string,
): boolean {
  // Verify ownership through the list element, then delete the item.
  const ok = sqlite
    .prepare(
      `SELECT 1 FROM todo_items ti
       INNER JOIN elements e ON e.id = ti.list_id
        WHERE ti.id = ? AND e.created_by = ?`,
    )
    .get(todoId, userId) as { 1: number } | undefined
  if (!ok) return false
  sqlite.prepare(`DELETE FROM todo_items WHERE id = ?`).run(todoId)
  return true
}

// Call createElement on behalf of a user — bypasses the require-auth check
// because the bot is acting under its bound user's authority. The existing
// element-actions.ts helper requires a logged-in cookie session, which we
// can't have here. Insert directly with the right createdBy.
async function createElementAs(userId: string, type: string, title: string) {
  const id = createId()
  const now = new Date().toISOString()
  sqlite
    .prepare(
      `INSERT INTO elements (id, type, title, icon, color, created_by, created_at, updated_at)
       VALUES (?, ?, ?, NULL, NULL, ?, ?, ?)`,
    )
    .run(id, type, title, userId, now, now)
  if (type === "todo_list") {
    sqlite.prepare(`INSERT INTO todo_lists (id) VALUES (?)`).run(id)
  }
  return { id, type }
}

// ─── small parsing helpers ───────────────────────────────────────────────

function parseDays(args: string): number {
  const n = parseInt(args, 10)
  if (!Number.isFinite(n) || n < 1) return 7
  return Math.min(n, 90)
}

function splitFirstQuotedOrWord(s: string): { name: string; rest: string } {
  const trimmed = s.trim()
  if (trimmed.startsWith('"')) {
    const close = trimmed.indexOf('"', 1)
    if (close > 0) {
      return { name: trimmed.slice(1, close).trim(), rest: trimmed.slice(close + 1).trim() }
    }
  }
  const sp = trimmed.indexOf(" ")
  if (sp < 0) return { name: trimmed, rest: "" }
  return { name: trimmed.slice(0, sp).trim(), rest: trimmed.slice(sp + 1).trim() }
}

function escapeMd(s: string): string {
  // For Telegram's classic Markdown (parse_mode: "Markdown") we just need
  // to escape *, _, `, [.
  return s.replace(/[*_`[\]]/g, "\\$&")
}

function friendlyDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - today.getTime()) / (24 * 3600 * 1000))
  if (diff === 0) return "today"
  if (diff === 1) return "tomorrow"
  if (diff === -1) return "yesterday"
  if (diff > 1 && diff < 7) return d.toLocaleDateString(undefined, { weekday: "long" })
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}
