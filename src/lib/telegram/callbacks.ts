/**
 * Callback-query router.
 *
 * Telegram delivers button taps as `callback_query` updates carrying a
 * short `data` string. We parse that prefix and dispatch to the right
 * menu builder OR mutation. The webhook calls handleCallback then either
 * edits the original message (smooth drill-down) or sends a fresh one
 * (for terminal actions like approve/dismiss).
 *
 * Returns:
 *   - `toast`: short notification shown in Telegram's toast area after
 *     the user's tap (max ~200 chars). Optional but lets us confirm an
 *     action ("✅ Done") without modifying the message.
 *   - `edit`: when set, edit the original message to this text+markup
 *     (drill-down navigation).
 *   - `replace`: when set, edit the message to a terminal state (no
 *     buttons — used for approve/dismiss confirmations).
 */

import "server-only"
import { sqlite } from "@/lib/db"
import {
  mainMenu,
  tasksMenu,
  deadlinesMenu,
  projectsMenu,
  listsMenu,
  helpMenu,
  createTypeMenu,
  projectDrillMenu,
  projectTasksMenu,
  listDrillMenu,
  taskDrillMenu,
  rescheduleMenu,
  priorityMenu,
  statusMenu,
  deleteConfirmMenu,
  projectArchiveConfirm,
  voiceDestinationMenu,
  captureRouterRows,
  galleryAlbumPicker,
  voiceListPicker,
  voiceProjectPicker,
  type MenuResponse,
} from "@/lib/telegram/menus"
import { dispatchTelegramMessage, markDoneByPrefix } from "@/lib/telegram/agent"
import { transcribeTelegramVoice, resolveGroqKey } from "@/lib/telegram/voice"
import { createId } from "@/lib/utils/ids"
import { parseAIImport } from "@/lib/import/ai-import-parser"
import { importFromAIAs } from "@/lib/actions/import-actions"
import {
  setState,
  clearState,
  promptForCreateName,
  promptForListItem,
  promptForTaskTitle,
} from "@/lib/telegram/conversations"

export interface CallbackResult {
  toast?: string
  edit?: MenuResponse
  /** When set, replace the original message text and clear the keyboard. */
  replace?: { text: string }
}

export async function handleCallback(
  userId: string,
  data: string,
): Promise<CallbackResult> {
  try {
    // Root menu
    if (data === "menu:main") return { edit: mainMenu() }
    if (data === "cancel") {
      clearState(userId)
      return { toast: "Cancelled", edit: mainMenu() }
    }

    // Undo a capture — softdeletes the just-created todo if it still
    // belongs to this user. Replaces the message body so the user sees
    // the undo took effect, with no buttons (idempotent — second tap
    // does nothing dangerous).
    if (data.startsWith("undo:todo:")) {
      const id = data.slice("undo:todo:".length)
      const { softDeleteTodoForUser } = await import("@/lib/telegram/agent")
      const ok = softDeleteTodoForUser(userId, id)
      return {
        toast: ok ? "Undone" : "Already gone",
        replace: { text: ok ? "↩️ _Undone._" : "↩️ _Already gone._" },
      }
    }

    // Move a captured todo to a different list. `move:todo:<id>` opens a
    // list picker; `mtl:<todoId>:<listId>` performs the move.
    if (data.startsWith("move:todo:")) {
      const todoId = data.slice("move:todo:".length)
      return { edit: moveListPickerMenu(userId, todoId) }
    }
    if (data.startsWith("mtl:")) {
      const [, todoId, listId] = data.split(":")
      const moved = moveTodoToList(userId, todoId, listId)
      if (!moved.ok) return { toast: "Couldn't move that." }
      return {
        toast: "Moved",
        edit: {
          text: `📂 *Moved to ${escMd(moved.listTitle)}*`,
          markup: {
            inline_keyboard: [
              [
                { text: "↩️ Undo", callback_data: `undo:todo:${todoId}` },
                { text: "📂 Move again", callback_data: `move:todo:${todoId}` },
              ],
              [{ text: "🏠 Menu", callback_data: "menu:main" }],
            ],
          },
        },
      }
    }

    // Send a captured to-do somewhere else: → a new Page, or → a Project task.
    if (data.startsWith("snd:pg:")) {
      const todoId = data.slice("snd:pg:".length)
      const r = convertTodoToPage(userId, todoId)
      if (!r.ok) return { toast: "Couldn't create that page." }
      return {
        toast: "Page created",
        edit: {
          text: `📄 *Created page:* "${escMd(r.title)}"`,
          markup: {
            inline_keyboard: [
              [{ text: "↩️ Undo", callback_data: `undo:page:${r.pageId}` }],
              [{ text: "🏠 Menu", callback_data: "menu:main" }],
            ],
          },
        },
      }
    }
    if (data.startsWith("snd:pr:")) {
      const todoId = data.slice("snd:pr:".length)
      return { edit: sendProjectPickerMenu(userId, todoId) }
    }
    if (data.startsWith("stp:")) {
      const [, todoId, projectId] = data.split(":")
      const r = sendTodoToProject(userId, todoId, projectId)
      if (!r.ok) return { toast: "Couldn't add the task." }
      return {
        toast: "Task added",
        edit: {
          text: `📁 *Added to ${escMd(r.projectTitle)}:* "${escMd(r.title)}"`,
          markup: {
            inline_keyboard: [
              [{ text: "↩️ Undo", callback_data: `undo:task:${r.taskId}` }],
              [{ text: "🏠 Menu", callback_data: "menu:main" }],
            ],
          },
        },
      }
    }
    if (data.startsWith("undo:page:")) {
      const ok = deletePageForUser(userId, data.slice("undo:page:".length))
      return { toast: ok ? "Removed" : "Already gone", replace: { text: ok ? "↩️ _Page removed._" : "↩️ _Already gone._" } }
    }
    if (data.startsWith("undo:task:")) {
      const ok = deleteTaskForUser(userId, data.slice("undo:task:".length))
      return { toast: ok ? "Removed" : "Already gone", replace: { text: ok ? "↩️ _Task removed._" : "↩️ _Already gone._" } }
    }

    // ── Gallery: file a saved photo into an album / describe it ──────────
    if (data.startsWith("ga:mv:")) {
      const parts = data.split(":")
      const imageId = parts[2]
      const albumId = parts[3]
      const { moveImageToAlbumForBot } = await import("@/lib/telegram/gallery")
      const r = moveImageToAlbumForBot(userId, imageId, albumId)
      if (!r.ok) return { toast: "Couldn't file that." }
      return { toast: `Filed in ${r.albumName}`, replace: { text: `📁 *Filed into ${escMd(r.albumName)}.*` } }
    }
    if (data.startsWith("ga:un:")) {
      const imageId = data.slice("ga:un:".length)
      const { moveImageToAlbumForBot } = await import("@/lib/telegram/gallery")
      moveImageToAlbumForBot(userId, imageId, null)
      return { toast: "Kept unsorted", replace: { text: "📥 _Kept in Unsorted._" } }
    }
    if (data.startsWith("ga:new:")) {
      const imageId = data.slice("ga:new:".length)
      setState(userId, `ga:new:${imageId}`)
      return {
        edit: {
          text: "📁 *New album*\n\nSend the album name as your next message.",
          markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "cancel" }]] },
        },
      }
    }
    if (data.startsWith("ga:cap:")) {
      const imageId = data.slice("ga:cap:".length)
      const { describeGalleryImage } = await import("@/lib/telegram/gallery")
      // Vision can take many seconds — run it in the background; it notifies
      // when the caption is ready (with edit/refine/album/comment actions).
      void describeGalleryImage(userId, imageId, { overwrite: true, notify: true })
      return {
        toast: "Describing…",
        replace: { text: "✨ _Describing the image with AI — I'll send the caption here when it's ready._" },
      }
    }

    // ── Caption-ready actions (edit / refine / album / comment) ──────────
    if (data.startsWith("gc:edit:")) {
      const imageId = data.slice("gc:edit:".length)
      setState(userId, `gc:edit:${imageId}`)
      return {
        edit: {
          text: "✏️ *Edit caption*\n\nSend the new caption as your next message.",
          markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "cancel" }]] },
        },
      }
    }
    if (data.startsWith("gc:refine:")) {
      const imageId = data.slice("gc:refine:".length)
      const { describeGalleryImage } = await import("@/lib/telegram/gallery")
      void describeGalleryImage(userId, imageId, { overwrite: true, notify: true })
      return { toast: "Refining…", replace: { text: "🔄 _Generating a fresh caption — I'll send it here shortly._" } }
    }
    if (data.startsWith("gc:album:")) {
      const imageId = data.slice("gc:album:".length)
      return { edit: galleryAlbumPicker(userId, imageId) }
    }
    if (data.startsWith("gc:cmt:")) {
      const imageId = data.slice("gc:cmt:".length)
      setState(userId, `gc:cmt:${imageId}`)
      return {
        edit: {
          text: "💬 *Add a comment*\n\nSend your comment as your next message.",
          markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "cancel" }]] },
        },
      }
    }

    // View routes
    if (data === "v:tasks")      return { edit: tasksMenu(userId) }
    if (data === "v:projects")   return { edit: projectsMenu(userId, 0) }
    if (data === "v:lists")      return { edit: listsMenu(userId, 0) }
    if (data === "v:help")       return { edit: helpMenu() }
    if (data.startsWith("v:projects:")) {
      const page = Math.max(0, parseInt(data.split(":")[2], 10) || 0)
      return { edit: projectsMenu(userId, page) }
    }
    if (data.startsWith("v:lists:")) {
      const page = Math.max(0, parseInt(data.split(":")[2], 10) || 0)
      return { edit: listsMenu(userId, page) }
    }
    if (data.startsWith("v:deadlines:")) {
      const days = Math.min(parseInt(data.split(":")[2], 10) || 7, 90)
      return { edit: deadlinesMenu(userId, days) }
    }

    // Create flow — choose a type, then save state and prompt for name
    if (data === "c:choose") return { edit: createTypeMenu() }
    if (data.startsWith("c:start:")) {
      const type = data.slice("c:start:".length) as
        | "project"
        | "todo"
        | "reminder"
        | "page"
        | "canvas"
        | "process"
      setState(userId, `c:${type}`)
      return { edit: promptForCreateName(type) }
    }

    // Drill into a project
    if (data.startsWith("p:o:")) {
      const projectId = data.slice("p:o:".length)
      return { edit: projectDrillMenu(userId, projectId) }
    }

    // Project rename: save state, prompt for new name
    if (data.startsWith("p:rn:")) {
      const projectId = data.slice("p:rn:".length)
      const project = sqlite
        .prepare(`SELECT title FROM elements WHERE id = ? AND created_by = ?`)
        .get(projectId, userId) as { title: string } | undefined
      if (!project) return { toast: "Project not found." }
      setState(userId, `p:rename:${projectId}`, { projectId })
      return {
        edit: {
          text: `✏️ *Rename "${stripMd(project.title)}"*\n\nSend the new name as your next message.`,
          markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "cancel" }]] },
        },
      }
    }

    // Project archive: show confirm
    if (data.startsWith("p:ar:")) {
      const projectId = data.slice("p:ar:".length)
      return { edit: projectArchiveConfirm(userId, projectId) }
    }
    if (data.startsWith("p:arc:")) {
      const projectId = data.slice("p:arc:".length)
      const r = sqlite
        .prepare(
          `UPDATE elements SET is_archived = 1, updated_at = datetime('now')
           WHERE id = ? AND created_by = ?`,
        )
        .run(projectId, userId)
      if (r.changes === 0) return { toast: "Project not found." }
      return {
        toast: "📦 Archived",
        replace: { text: "📦 _Project archived._ Restore from Trash any time." },
      }
    }
    if (data.startsWith("p:list:")) {
      const projectId = data.slice("p:list:".length)
      return { edit: projectTasksMenu(userId, projectId) }
    }
    // Project → add task: save state, prompt for title
    if (data.startsWith("p:t:")) {
      const projectId = data.slice("p:t:".length)
      const project = sqlite
        .prepare(`SELECT title FROM elements WHERE id = ? AND created_by = ?`)
        .get(projectId, userId) as { title: string } | undefined
      if (!project) return { toast: "Project not found." }
      setState(userId, `p:task:${projectId}`, { projectId })
      return { edit: promptForTaskTitle(project.title) }
    }

    // Drill into a todo list
    if (data.startsWith("l:o:")) {
      const listId = data.slice("l:o:".length)
      return { edit: listDrillMenu(userId, listId) }
    }
    // List → add item: save state, prompt for text
    if (data.startsWith("l:a:")) {
      const listId = data.slice("l:a:".length)
      const list = sqlite
        .prepare(`SELECT title FROM elements WHERE id = ? AND created_by = ?`)
        .get(listId, userId) as { title: string } | undefined
      if (!list) return { toast: "List not found." }
      setState(userId, `l:add:${listId}`, { listId })
      return { edit: promptForListItem(list.title) }
    }

    // Task done
    if (data.startsWith("t:done:")) {
      const prefix = data.slice("t:done:".length)
      const reply = markDoneByPrefix(userId, prefix)
      // After marking done, refresh the task list so the just-completed
      // item drops out of view.
      return { toast: stripMd(reply).slice(0, 180), edit: tasksMenu(userId) }
    }

    // ── Task: open action menu (tapped the number in the task list) ──
    if (data.startsWith("t:o:")) {
      const prefix = data.slice("t:o:".length)
      return { edit: taskDrillMenu(userId, prefix) }
    }

    // Task: open reschedule submenu
    if (data.startsWith("t:r:") && !data.startsWith("t:rs:")) {
      const prefix = data.slice("t:r:".length)
      return { edit: rescheduleMenu(prefix) }
    }
    // Task: apply reschedule (today/tomorrow/+3/+7/clear)
    if (data.startsWith("t:rs:")) {
      const [, , prefix, token] = data.split(":")
      const newDate = computeRescheduleDate(token)
      const updated = rescheduleTask(userId, prefix, newDate)
      if (!updated) return { toast: "Task not found." }
      const friendly = newDate ? niceDate(newDate) : "no due date"
      return {
        toast: `📅 Set to ${friendly}`,
        edit: taskDrillMenu(userId, prefix),
      }
    }

    // Task: open priority submenu
    if (data.startsWith("t:pri:")) {
      const prefix = data.slice("t:pri:".length)
      return { edit: priorityMenu(prefix) }
    }
    // Task: apply priority
    if (data.startsWith("t:pr:")) {
      const [, , prefix, level] = data.split(":")
      const updated = setTaskPriority(userId, prefix, level)
      if (!updated) return { toast: "Task not found." }
      return {
        toast: `⚡ Priority: ${level}`,
        edit: taskDrillMenu(userId, prefix),
      }
    }

    // Task: open status submenu
    if (data.startsWith("t:s:") && !data.startsWith("t:sm:")) {
      const prefix = data.slice("t:s:".length)
      return { edit: statusMenu(userId, prefix) }
    }
    // Task: apply status (move to column)
    if (data.startsWith("t:sm:")) {
      const [, , prefix, statusIdPrefix] = data.split(":")
      const moved = moveTaskStatus(userId, prefix, statusIdPrefix)
      if (!moved.ok) return { toast: moved.error }
      return {
        toast: `🔀 Moved to ${moved.statusName}`,
        edit: taskDrillMenu(userId, prefix),
      }
    }

    // Task: delete confirm + apply
    if (data.startsWith("t:del:")) {
      const prefix = data.slice("t:del:".length)
      return { edit: deleteConfirmMenu(userId, prefix) }
    }
    if (data.startsWith("t:dc:")) {
      const prefix = data.slice("t:dc:".length)
      const deleted = deleteTask(userId, prefix)
      if (!deleted) return { toast: "Task not found." }
      return {
        toast: "🗑 Deleted",
        edit: tasksMenu(userId),
      }
    }

    // ── Reminder snooze / dismiss ──────────────────────────────────
    if (data.startsWith("r:s:")) {
      const [, , prefix, dur] = data.split(":")
      const ms = dur === "1h" ? 3600_000 : dur === "1d" ? 86_400_000 : 3600_000
      const newAt = new Date(Date.now() + ms).toISOString()
      const r = sqlite
        .prepare(
          `UPDATE reminders SET remind_at = ?, bot_fired_at = NULL
           WHERE id IN (
             SELECT r.id FROM reminders r INNER JOIN elements e ON e.id = r.id
             WHERE e.created_by = ? AND r.id LIKE ?
           )`,
        )
        .run(newAt, userId, `${prefix}%`)
      if (r.changes === 0) return { toast: "Reminder not found." }
      return {
        toast: `Snoozed ${dur === "1d" ? "1 day" : "1 hour"}`,
        replace: { text: `💤 _Snoozed for ${dur === "1d" ? "1 day" : "1 hour"}._` },
      }
    }
    if (data.startsWith("r:d:")) {
      const prefix = data.slice("r:d:".length)
      const r = sqlite
        .prepare(
          `UPDATE reminders SET is_dismissed = 1
           WHERE id IN (
             SELECT r.id FROM reminders r INNER JOIN elements e ON e.id = r.id
             WHERE e.created_by = ? AND r.id LIKE ?
           )`,
        )
        .run(userId, `${prefix}%`)
      if (r.changes === 0) return { toast: "Reminder not found." }
      return {
        toast: "Dismissed",
        replace: { text: "✅ _Reminder dismissed._" },
      }
    }

    // ── Voice pickers (language → destination) ─────────────────────
    if (data.startsWith("vp:")) {
      return await handleVoicePicker(userId, data)
    }

    // Pending-import actions
    if (data.startsWith("i:approve:")) {
      const id = data.slice("i:approve:".length)
      return await approveImport(userId, id)
    }
    if (data.startsWith("i:dismiss:")) {
      const id = data.slice("i:dismiss:".length)
      return dismissImport(userId, id)
    }

    return { toast: `Unknown action: ${data.slice(0, 40)}` }
  } catch (err) {
    return {
      toast: err instanceof Error ? err.message.slice(0, 180) : "Action failed",
    }
  }
}

// ── Import actions ──────────────────────────────────────────────────────

async function approveImport(
  userId: string,
  importId: string,
): Promise<CallbackResult> {
  const row = sqlite
    .prepare(
      `SELECT payload, status FROM pending_imports WHERE id = ? AND user_id = ? LIMIT 1`,
    )
    .get(importId, userId) as { payload: string; status: string } | undefined
  if (!row) return { toast: "That import is no longer available." }
  if (row.status !== "pending") {
    return { toast: `Already ${row.status}.`, replace: { text: `_(Already ${row.status}.)_` } }
  }

  const parsed = parseAIImport(row.payload)
  if (!parsed) {
    return { toast: "Couldn't parse the markdown." }
  }

  // Use the userId-explicit variant — the webhook has no Next.js session
  // cookie, so requireAuth() inside importFromAI would fail here.
  const result = await importFromAIAs(userId, parsed)
  if (!result.ok) {
    return { toast: `Failed: ${result.error.slice(0, 150)}` }
  }

  sqlite
    .prepare(
      `UPDATE pending_imports SET status = 'approved', resolved_at = datetime('now') WHERE id = ?`,
    )
    .run(importId)

  return {
    toast: "✅ Created in FlowSpace",
    replace: {
      text: `✅ *Approved & created*\n\n_${escMd(parsed.title)}_ is now in your workspace.`,
    },
  }
}

function dismissImport(userId: string, importId: string): CallbackResult {
  sqlite
    .prepare(
      `UPDATE pending_imports SET status = 'dismissed', resolved_at = datetime('now')
       WHERE id = ? AND user_id = ?`,
    )
    .run(importId, userId)
  return {
    toast: "Dismissed",
    replace: { text: "❌ _Dismissed. Payload discarded._" },
  }
}

function escMd(s: string): string {
  return s.replace(/[*_`[\]]/g, "\\$&")
}

function stripMd(s: string): string {
  return s.replace(/[*_`[\]]/g, "")
}

// ── Task mutations (used by the edit menus) ─────────────────────────────
// All check ownership via a JOIN to elements.created_by so a leaked
// callback_data can never act on another user's task.

function rescheduleTask(userId: string, prefix: string, isoDate: string | null): boolean {
  const r = sqlite
    .prepare(
      `UPDATE tasks SET due_date = ?, updated_at = datetime('now')
       WHERE id IN (
         SELECT t.id FROM tasks t
         INNER JOIN elements e ON e.id = t.project_id
         WHERE e.created_by = ? AND t.id LIKE ?
       )`,
    )
    .run(isoDate, userId, `${prefix}%`)
  return r.changes > 0
}

function setTaskPriority(userId: string, prefix: string, level: string): boolean {
  if (!["urgent", "high", "medium", "low", "none"].includes(level)) return false
  const r = sqlite
    .prepare(
      `UPDATE tasks SET priority = ?, updated_at = datetime('now')
       WHERE id IN (
         SELECT t.id FROM tasks t
         INNER JOIN elements e ON e.id = t.project_id
         WHERE e.created_by = ? AND t.id LIKE ?
       )`,
    )
    .run(level, userId, `${prefix}%`)
  return r.changes > 0
}

function moveTaskStatus(
  userId: string,
  prefix: string,
  statusIdPrefix: string,
): { ok: true; statusName: string } | { ok: false; error: string } {
  const task = sqlite
    .prepare(
      `SELECT t.id, t.project_id FROM tasks t
       INNER JOIN elements e ON e.id = t.project_id
       WHERE e.created_by = ? AND t.id LIKE ? LIMIT 1`,
    )
    .get(userId, `${prefix}%`) as { id: string; project_id: string } | undefined
  if (!task) return { ok: false, error: "Task not found." }
  const status = sqlite
    .prepare(
      `SELECT id, name, is_done_state FROM task_statuses
       WHERE project_id = ? AND id LIKE ? LIMIT 1`,
    )
    .get(task.project_id, `${statusIdPrefix}%`) as
    | { id: string; name: string; is_done_state: number }
    | undefined
  if (!status) return { ok: false, error: "Status not found." }
  sqlite
    .prepare(
      `UPDATE tasks SET status_id = ?, updated_at = datetime('now'),
       completed_at = CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END
       WHERE id = ?`,
    )
    .run(status.id, status.is_done_state, task.id)
  return { ok: true, statusName: status.name }
}

function deleteTask(userId: string, prefix: string): boolean {
  const r = sqlite
    .prepare(
      `DELETE FROM tasks
       WHERE id IN (
         SELECT t.id FROM tasks t
         INNER JOIN elements e ON e.id = t.project_id
         WHERE e.created_by = ? AND t.id LIKE ?
       )`,
    )
    .run(userId, `${prefix}%`)
  return r.changes > 0
}

function computeRescheduleDate(token: string): string | null {
  if (token === "x") return null
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  if (token === "t") return d.toISOString().slice(0, 10)
  if (token === "m") { d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10) }
  if (token === "3") { d.setDate(d.getDate() + 3); return d.toISOString().slice(0, 10) }
  if (token === "7") { d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10) }
  return null
}

function niceDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date(); today.setHours(0,0,0,0)
  const t = new Date(d); t.setHours(0,0,0,0)
  const diff = Math.round((t.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return "today"
  if (diff === 1) return "tomorrow"
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

// ─── Voice picker dispatcher ────────────────────────────────────────────
//
// Stages, all identified by the 8-char `pid` (prefix of the pending_voices
// row id):
//
//   vp:l:<pid>:en|ar|au   → transcribe with chosen language, then show
//                            the destination picker
//   vp:d:<pid>:def|lst|tsk|cmd|back
//                          → choose destination or go back
//   vp:dl:<pid>:<listId12> → capture transcript to a specific list
//   vp:dt:<pid>:<projId12> → add transcript as a task in a specific project
//   vp:c:<pid>             → cancel; delete the pending row
//
// Each terminal action edits the original message to a confirmation,
// removing the buttons so the user can't tap stale options.

interface PendingVoice {
  id: string
  user_id: string
  file_id: string
  chat_id: string
  message_id: number
  transcript: string | null
  language: string | null
}

function findPendingVoice(userId: string, pid: string): PendingVoice | null {
  const row = sqlite
    .prepare(`SELECT * FROM pending_voices WHERE user_id = ? AND id LIKE ? LIMIT 1`)
    .get(userId, `${pid}%`) as PendingVoice | undefined
  return row ?? null
}

async function handleVoicePicker(userId: string, data: string): Promise<CallbackResult> {
  const parts = data.split(":")
  // parts[0] = "vp", parts[1] = action, parts[2] = pid, parts[3]+ = args

  // Cancel: vp:c:<pid>
  if (parts[1] === "c") {
    sqlite.prepare(`DELETE FROM pending_voices WHERE id LIKE ?`).run(`${parts[2]}%`)
    return { toast: "Cancelled", replace: { text: "❌ _Voice note discarded._" } }
  }

  const v = findPendingVoice(userId, parts[2])
  if (!v) {
    return {
      toast: "This voice note expired (1 hour limit). Send another.",
      replace: { text: "⏰ _This voice note expired. Send another to try again._" },
    }
  }

  // Language tap: vp:l:<pid>:<lang>
  // `def` is a one-tap fast path — use the user's pinned default language
  // AND skip the destination picker, dropping straight into the default
  // todo list. The webhook also synthesises this same callback when the
  // user has the global `voice_auto_skip` setting enabled.
  if (parts[1] === "l") {
    const code = parts[3]
    if (code === "def") {
      const botRow = sqlite
        .prepare(`SELECT voice_language FROM telegram_bots WHERE user_id = ?`)
        .get(v.user_id) as { voice_language: string | null } | undefined
      const lang = botRow?.voice_language ?? "en"
      const transcribed = await runTranscription(v, lang)
      // runTranscription returned a destination picker; instead we want
      // to go straight to the default list. Look up the refreshed row
      // (transcript is now set) and call captureToDefault directly.
      if ("edit" in transcribed && transcribed.edit) {
        const fresh = findPendingVoice(v.user_id, parts[2])
        if (fresh?.transcript) {
          return await captureToDefault(fresh)
        }
      }
      return transcribed
    }
    const language = code === "au" ? "auto" : code
    return await runTranscription(v, language)
  }

  // Destination main: vp:d:<pid>:<choice>
  if (parts[1] === "d") {
    const choice = parts[3]
    if (!v.transcript) {
      return { toast: "Pick a language first." }
    }
    if (choice === "def") return await captureToDefault(v)
    if (choice === "lst") return { edit: voiceListPicker(userId, parts[2]) }
    if (choice === "tsk") return { edit: voiceProjectPicker(userId, parts[2]) }
    if (choice === "cmd") return await runAsCommand(v)
    if (choice === "back") return { edit: voiceDestinationMenu(parts[2], v.transcript) }
  }

  // Pick a specific list: vp:dl:<pid>:<listIdPrefix>
  if (parts[1] === "dl") {
    if (!v.transcript) return { toast: "Pick a language first." }
    const listId = await resolveListId(userId, parts[3])
    if (!listId) return { toast: "List not found." }
    return await captureToList(v, listId)
  }

  // Pick a specific project: vp:dt:<pid>:<projIdPrefix>
  if (parts[1] === "dt") {
    if (!v.transcript) return { toast: "Pick a language first." }
    const projectId = await resolveProjectId(userId, parts[3])
    if (!projectId) return { toast: "Project not found." }
    return await addAsTask(v, projectId)
  }

  return { toast: "Unknown voice action." }
}

async function runTranscription(v: PendingVoice, language: string): Promise<CallbackResult> {
  const groqKey = resolveGroqKey(v.user_id)
  if (!groqKey) {
    return {
      toast: "No Groq API key set.",
      replace: { text: "🎙 _No Groq key configured. Set one in FlowSpace → Settings → Speech._" },
    }
  }
  const botRow = sqlite
    .prepare(`SELECT bot_token FROM telegram_bots WHERE user_id = ?`)
    .get(v.user_id) as { bot_token: string } | undefined
  if (!botRow) return { toast: "Bot not configured." }

  const result = await transcribeTelegramVoice(botRow.bot_token, groqKey, v.file_id, language, v.user_id)
  if (!result.ok) {
    return {
      toast: "Couldn't transcribe.",
      replace: { text: `🎙 _Transcription failed: ${result.error.slice(0, 200)}_` },
    }
  }
  sqlite
    .prepare(`UPDATE pending_voices SET transcript = ?, language = ? WHERE id = ?`)
    .run(result.text, language, v.id)
  return {
    edit: voiceDestinationMenu(v.id.slice(0, 8), result.text),
  }
}

// ── Capture handlers ───────────────────────────────────────────────────

async function captureToDefault(v: PendingVoice): Promise<CallbackResult> {
  if (!v.transcript) return { toast: "No transcript." }
  // Find the user's preferred target list, falling back to most-recent.
  const targetRow = sqlite
    .prepare(`SELECT target_list_id FROM telegram_bots WHERE user_id = ?`)
    .get(v.user_id) as { target_list_id: string | null } | undefined
  let listId = targetRow?.target_list_id ?? null
  if (!listId) {
    const row = sqlite
      .prepare(
        `SELECT id FROM elements WHERE created_by = ? AND type = 'todo_list'
         AND is_archived = 0 AND is_deleted = 0 ORDER BY updated_at DESC LIMIT 1`,
      )
      .get(v.user_id) as { id: string } | undefined
    listId = row?.id ?? null
  }
  if (!listId) {
    // No list exists at all — create "Inbox".
    listId = createId()
    const now = new Date().toISOString()
    sqlite.prepare(`INSERT INTO elements (id, type, title, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
      listId, "todo_list", "Inbox", v.user_id, now, now,
    )
    sqlite.prepare(`INSERT INTO todo_lists (id) VALUES (?)`).run(listId)
  }
  return await captureToList(v, listId)
}

async function captureToList(v: PendingVoice, listId: string): Promise<CallbackResult> {
  if (!v.transcript) return { toast: "No transcript." }
  const captured = parseCaptureForVoice(v.transcript)
  const itemId = createId()
  const max = sqlite
    .prepare(`SELECT COALESCE(MAX(sort_order), -1) AS m FROM todo_items WHERE list_id = ?`)
    .get(listId) as { m: number }
  sqlite
    .prepare(
      `INSERT INTO todo_items (id, list_id, title, is_completed, sort_order, due_date, notes, created_at)
       VALUES (?, ?, ?, 0, ?, ?, ?, datetime('now'))`,
    )
    .run(itemId, listId, captured.title, max.m + 1, captured.dueDate, captured.tags.length ? captured.tags.map((t) => `#${t}`).join(" ") : null)
  sqlite.prepare(`UPDATE elements SET updated_at = datetime('now') WHERE id = ?`).run(listId)
  const list = sqlite.prepare(`SELECT title FROM elements WHERE id = ?`).get(listId) as { title: string } | undefined
  sqlite.prepare(`DELETE FROM pending_voices WHERE id = ?`).run(v.id)
  return {
    toast: "Added",
    edit: {
      text: [
        `✅ *Added to ${escMd(list?.title ?? "Inbox")}*`,
        "",
        `_"${escMd(captured.title)}"_${captureHits(captured)}`,
      ].join("\n"),
      markup: { inline_keyboard: captureRouterRows(itemId) },
    },
  }
}

/** List picker shown when the user taps "Move to…" on a capture. Lists the
 *  user's todo lists as buttons that move the given todo. */
function moveListPickerMenu(userId: string, todoId: string): { text: string; markup: { inline_keyboard: { text: string; callback_data: string }[][] } } {
  const lists = sqlite
    .prepare(
      `SELECT id, title FROM elements
       WHERE created_by = ? AND type = 'todo_list'
         AND is_archived = 0 AND is_deleted = 0
       ORDER BY updated_at DESC LIMIT 8`,
    )
    .all(userId) as { id: string; title: string }[]
  const rows = lists.map((l) => [
    { text: `📝 ${l.title.slice(0, 30)}`, callback_data: `mtl:${todoId}:${l.id}` },
  ])
  return {
    text: "📂 *Move to which list?*",
    markup: {
      inline_keyboard: [
        ...rows,
        [{ text: "🏠 Menu", callback_data: "menu:main" }],
      ],
    },
  }
}

/** Move a captured todo into another list, verifying the user owns both the
 *  todo (via its current list) and the target list. */
function moveTodoToList(userId: string, todoId: string, listId: string): { ok: boolean; listTitle: string } {
  // Target list must belong to the user.
  const target = sqlite
    .prepare(`SELECT title FROM elements WHERE id = ? AND created_by = ? AND type = 'todo_list'`)
    .get(listId, userId) as { title: string } | undefined
  if (!target) return { ok: false, listTitle: "" }
  // The todo's current list must also belong to the user.
  const owns = sqlite
    .prepare(
      `SELECT 1 FROM todo_items ti
       INNER JOIN elements e ON e.id = ti.list_id
       WHERE ti.id = ? AND e.created_by = ?`,
    )
    .get(todoId, userId) as { 1: number } | undefined
  if (!owns) return { ok: false, listTitle: "" }
  const max = sqlite
    .prepare(`SELECT COALESCE(MAX(sort_order), -1) AS m FROM todo_items WHERE list_id = ?`)
    .get(listId) as { m: number }
  sqlite
    .prepare(`UPDATE todo_items SET list_id = ?, sort_order = ? WHERE id = ?`)
    .run(listId, max.m + 1, todoId)
  sqlite.prepare(`UPDATE elements SET updated_at = datetime('now') WHERE id = ?`).run(listId)
  return { ok: true, listTitle: target.title }
}

// ── BlockNote helpers (build a structured page document) ────────────────

type BNBlock = {
  id: string
  type: string
  props: Record<string, unknown>
  content: { type: string; text: string; styles: Record<string, unknown> }[]
  children: BNBlock[]
}

function bnParagraph(text: string): BNBlock {
  return { id: createId(), type: "paragraph", props: {}, content: [{ type: "text", text, styles: {} }], children: [] }
}
function bnHeading(text: string): BNBlock {
  return {
    id: createId(),
    type: "heading",
    props: { level: 2, textColor: "default", backgroundColor: "default", textAlignment: "left" },
    content: [{ type: "text", text, styles: {} }],
    children: [],
  }
}
function bnDivider(): BNBlock {
  // Core BlockNote has no divider block, so use a thin em-dash rule paragraph.
  return { id: createId(), type: "paragraph", props: {}, content: [{ type: "text", text: "———", styles: {} }], children: [] }
}
/** Turn a blob of prose into readable paragraph blocks: split on blank lines,
 *  and break any very long run at sentence boundaries (~800 chars). */
function bnProse(text: string): BNBlock[] {
  const out: BNBlock[] = []
  for (const part of text.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean)) {
    if (part.length <= 1200) { out.push(bnParagraph(part)); continue }
    let buf = ""
    for (const sentence of part.split(/(?<=[.!?؟])\s+/)) {
      if (buf && buf.length + sentence.length > 800) { out.push(bnParagraph(buf.trim())); buf = "" }
      buf += (buf ? " " : "") + sentence
    }
    if (buf.trim()) out.push(bnParagraph(buf.trim()))
  }
  return out
}

/** Recover the clean summary + full transcript for a captured to-do. Prefers
 *  the transcription_jobs row (full, untruncated columns); falls back to
 *  parsing the to-do's notes (which media captures format with a
 *  "— Transcript —" delimiter); else treats the note as plain text. */
function splitCapture(
  userId: string,
  todoId: string,
  todo: { title: string; notes: string | null },
): { summary: string | null; transcript: string | null; sourceUrl: string | null; fallback: string } {
  const job = sqlite
    .prepare(
      `SELECT summary, transcript, source_url FROM transcription_jobs
       WHERE result_todo_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1`,
    )
    .get(todoId, userId) as { summary: string | null; transcript: string | null; source_url: string | null } | undefined
  if (job?.transcript?.trim()) {
    return {
      summary: job.summary?.trim() || null,
      transcript: job.transcript.trim(),
      sourceUrl: job.source_url?.trim() || null,
      fallback: "",
    }
  }
  const notes = todo.notes ?? ""
  if (notes.includes("— Transcript —")) {
    const idx = notes.indexOf("— Transcript —")
    const head = notes.slice(0, idx)
    const transcript = notes.slice(idx + "— Transcript —".length).trim()
    let sourceUrl: string | null = null
    const summaryLines: string[] = []
    for (const line of head.split(/\r?\n/)) {
      const m = line.match(/^Source:\s*(\S+)/)
      if (m) { sourceUrl = m[1]; continue }
      if (/^From:\s*/.test(line)) continue
      summaryLines.push(line)
    }
    return {
      summary: summaryLines.join("\n").trim() || null,
      transcript: transcript || null,
      sourceUrl,
      fallback: "",
    }
  }
  return { summary: null, transcript: null, sourceUrl: null, fallback: notes.trim() || todo.title }
}

/** Convert a captured to-do into a brand-new Page, then delete the to-do.
 *  When the capture has a transcript, the page is structured: the AI summary
 *  on top, a "Transcript" heading separating it, then the full transcript
 *  below. Ownership verified via the to-do's list. */
function convertTodoToPage(userId: string, todoId: string): { ok: boolean; pageId: string; title: string } {
  const todo = sqlite
    .prepare(
      `SELECT ti.title AS title, ti.notes AS notes FROM todo_items ti
       INNER JOIN elements e ON e.id = ti.list_id
       WHERE ti.id = ? AND e.created_by = ?`,
    )
    .get(todoId, userId) as { title: string; notes: string | null } | undefined
  if (!todo) return { ok: false, pageId: "", title: "" }
  const title = (todo.title || "Untitled note").slice(0, 200)

  const { summary, transcript, sourceUrl, fallback } = splitCapture(userId, todoId, todo)
  const blocks: BNBlock[] = []
  if (sourceUrl) blocks.push(bnParagraph(`Source: ${sourceUrl}`))
  if (transcript) {
    if (summary) {
      blocks.push(bnHeading("✨ Summary"))
      blocks.push(...bnProse(summary))
      blocks.push(bnDivider())
    }
    blocks.push(bnHeading("📄 Transcript"))
    blocks.push(...bnProse(transcript))
  } else {
    blocks.push(...bnProse(fallback))
  }
  if (blocks.length === 0) blocks.push(bnParagraph(title))
  const content = JSON.stringify(blocks)

  const pageId = createId()
  const now = new Date().toISOString()
  sqlite.transaction(() => {
    sqlite
      .prepare(
        `INSERT INTO elements (id, type, title, icon, color, created_by, created_at, updated_at)
         VALUES (?, 'page', ?, 'FileText', '#a78bfa', ?, ?, ?)`,
      )
      .run(pageId, title, userId, now, now)
    sqlite.prepare(`INSERT INTO pages (id, content) VALUES (?, ?)`).run(pageId, content)
    sqlite.prepare(`DELETE FROM todo_items WHERE id = ?`).run(todoId)
  })()
  return { ok: true, pageId, title }
}

/** Project picker for the "→ Project" capture action. */
function sendProjectPickerMenu(
  userId: string,
  todoId: string,
): { text: string; markup: { inline_keyboard: { text: string; callback_data: string }[][] } } {
  const projects = sqlite
    .prepare(
      `SELECT id, title FROM elements
       WHERE created_by = ? AND type = 'project' AND is_archived = 0 AND is_deleted = 0
       ORDER BY updated_at DESC LIMIT 6`,
    )
    .all(userId) as { id: string; title: string }[]
  const rows = projects.map((p) => [
    { text: `📁 ${p.title.slice(0, 30)}`, callback_data: `stp:${todoId}:${p.id}` },
  ])
  return {
    text: projects.length ? "📁 *Add as a task in which project?*" : "_You have no projects yet._",
    markup: { inline_keyboard: [...rows, [{ text: "🏠 Menu", callback_data: "menu:main" }]] },
  }
}

/** Turn a captured to-do into a task in the given project's first open column,
 *  then delete the to-do. Ownership verified on both ends. */
function sendTodoToProject(
  userId: string,
  todoId: string,
  projectId: string,
): { ok: boolean; taskId: string; title: string; projectTitle: string } {
  const fail = { ok: false, taskId: "", title: "", projectTitle: "" }
  const project = sqlite
    .prepare(`SELECT title FROM elements WHERE id = ? AND created_by = ? AND type = 'project'`)
    .get(projectId, userId) as { title: string } | undefined
  if (!project) return fail
  const todo = sqlite
    .prepare(
      `SELECT ti.title AS title FROM todo_items ti
       INNER JOIN elements e ON e.id = ti.list_id
       WHERE ti.id = ? AND e.created_by = ?`,
    )
    .get(todoId, userId) as { title: string } | undefined
  if (!todo) return fail
  const status = sqlite
    .prepare(`SELECT id FROM task_statuses WHERE project_id = ? AND is_done_state = 0 ORDER BY sort_order ASC LIMIT 1`)
    .get(projectId) as { id: string } | undefined
  if (!status) return fail
  const taskId = createId()
  const now = new Date().toISOString()
  sqlite.transaction(() => {
    sqlite
      .prepare(
        `INSERT INTO tasks (id, project_id, status_id, title, priority, due_date, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'none', NULL, 0, ?, ?)`,
      )
      .run(taskId, projectId, status.id, todo.title, now, now)
    sqlite.prepare(`UPDATE elements SET updated_at = ? WHERE id = ?`).run(now, projectId)
    sqlite.prepare(`DELETE FROM todo_items WHERE id = ?`).run(todoId)
  })()
  return { ok: true, taskId, title: todo.title, projectTitle: project.title }
}

/** Undo a "→ Page" — delete the page element (+ its pages row) if owned. */
function deletePageForUser(userId: string, pageId: string): boolean {
  const owns = sqlite
    .prepare(`SELECT 1 FROM elements WHERE id = ? AND created_by = ? AND type = 'page'`)
    .get(pageId, userId) as { 1: number } | undefined
  if (!owns) return false
  sqlite.transaction(() => {
    sqlite.prepare(`DELETE FROM pages WHERE id = ?`).run(pageId)
    sqlite.prepare(`DELETE FROM elements WHERE id = ?`).run(pageId)
  })()
  return true
}

/** Undo a "→ Project" — delete the task if owned (via its project). */
function deleteTaskForUser(userId: string, taskId: string): boolean {
  const r = sqlite
    .prepare(
      `DELETE FROM tasks WHERE id IN (
         SELECT t.id FROM tasks t INNER JOIN elements e ON e.id = t.project_id
         WHERE t.id = ? AND e.created_by = ?
       )`,
    )
    .run(taskId, userId)
  return r.changes > 0
}

async function addAsTask(v: PendingVoice, projectId: string): Promise<CallbackResult> {
  if (!v.transcript) return { toast: "No transcript." }
  const todo = sqlite
    .prepare(
      `SELECT id FROM task_statuses WHERE project_id = ? AND is_done_state = 0 ORDER BY sort_order ASC LIMIT 1`,
    )
    .get(projectId) as { id: string } | undefined
  if (!todo) return { toast: "Project has no open status column." }
  const captured = parseCaptureForVoice(v.transcript)
  const taskId = createId()
  const now = new Date().toISOString()
  sqlite
    .prepare(
      `INSERT INTO tasks (id, project_id, status_id, title, priority, due_date, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    )
    .run(taskId, projectId, todo.id, captured.title, captured.priority ?? "none", captured.dueDate, now, now)
  sqlite.prepare(`UPDATE elements SET updated_at = ? WHERE id = ?`).run(now, projectId)
  const proj = sqlite.prepare(`SELECT title FROM elements WHERE id = ?`).get(projectId) as { title: string } | undefined
  sqlite.prepare(`DELETE FROM pending_voices WHERE id = ?`).run(v.id)
  return {
    toast: "Task added",
    replace: {
      text: [
        `📌 *Task added to ${escMd(proj?.title ?? "project")}*`,
        "",
        `_"${escMd(captured.title)}"_${captureHits(captured)}`,
      ].join("\n"),
    },
  }
}

async function runAsCommand(v: PendingVoice): Promise<CallbackResult> {
  if (!v.transcript) return { toast: "No transcript." }
  const botRow = sqlite
    .prepare(`SELECT user_id, bot_token, target_list_id FROM telegram_bots WHERE user_id = ?`)
    .get(v.user_id) as { user_id: string; bot_token: string; target_list_id: string | null } | undefined
  if (!botRow) return { toast: "Bot not configured." }
  const reply = await dispatchTelegramMessage(botRow, v.transcript)
  sqlite.prepare(`DELETE FROM pending_voices WHERE id = ?`).run(v.id)
  return {
    replace: {
      text: [
        `💬 *Treated as command*`,
        ``,
        `_"${escMd(v.transcript)}"_`,
        ``,
        reply,
      ].join("\n"),
    },
  }
}

// ── Helpers for voice capture ──────────────────────────────────────────

async function resolveListId(userId: string, prefix: string): Promise<string | null> {
  const row = sqlite
    .prepare(
      `SELECT id FROM elements WHERE created_by = ? AND type = 'todo_list' AND id LIKE ? LIMIT 1`,
    )
    .get(userId, `${prefix}%`) as { id: string } | undefined
  return row?.id ?? null
}

async function resolveProjectId(userId: string, prefix: string): Promise<string | null> {
  const row = sqlite
    .prepare(
      `SELECT id FROM elements WHERE created_by = ? AND type = 'project' AND id LIKE ? LIMIT 1`,
    )
    .get(userId, `${prefix}%`) as { id: string } | undefined
  return row?.id ?? null
}

interface CapturedVoice {
  title: string
  priority: "urgent" | "high" | "medium" | "low" | null
  dueDate: string | null
  tags: string[]
}

/** Voice-friendly capture parsing — same syntax as text smart-capture
 *  (`!high @tomorrow #tag`) so spoken phrases stay consistent. */
function parseCaptureForVoice(raw: string): CapturedVoice {
  let s = raw.trim()
  let priority: CapturedVoice["priority"] = null
  const tags: string[] = []
  let dueDate: string | null = null

  const pm = s.match(/(?:^|\s)!(urgent|high|medium|low)\b/i)
  if (pm) {
    priority = pm[1].toLowerCase() as CapturedVoice["priority"]
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

function captureHits(c: CapturedVoice): string {
  const bits: string[] = []
  if (c.priority) bits.push(`priority *${c.priority}*`)
  if (c.dueDate) bits.push(`due *${c.dueDate}*`)
  if (c.tags.length) bits.push(`tags ${c.tags.map((t) => `\`#${t}\``).join(" ")}`)
  return bits.length ? `\n· ${bits.join(" · ")}` : ""
}
