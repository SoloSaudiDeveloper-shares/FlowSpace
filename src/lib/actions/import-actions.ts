"use server"

/**
 * Server-side ingestion for the AI-import format.
 *
 * The client parses the markdown locally to render a preview, then sends
 * the parsed structure here. We re-validate, create the element + its
 * child rows (tasks, page body, etc.) under the current user, and emit a
 * single feed event so the workspace sees the import.
 *
 * Returns `{ ok: true, id, type }` on success — the UI can route directly
 * to the new element.
 */

import { db } from "@/lib/db"
import {
  elements,
  projects,
  pages,
  canvases,
  todoLists,
  todoItems,
  reminders,
  processes,
  taskStatuses,
  tasks,
} from "@/lib/db/schema"
import { createId } from "@/lib/utils/ids"
import { requireAuth } from "@/lib/auth/scope"
import { createFeedEvent } from "@/lib/actions/feed-actions"
import { eq, asc } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import type {
  ParsedImport,
  ImportElementType,
} from "@/lib/import/ai-import-parser"

const ICONS: Record<ImportElementType, string | null> = {
  project: "folder-kanban",
  page: "file-text",
  todo: "list-todo",
  canvas: "layout",
  reminder: "bell",
  process: "git-branch",
}

const COLORS: Record<ImportElementType, string> = {
  project: "#a78bfa",
  page: "#60a5fa",
  todo: "#fbbf24",
  canvas: "#67e8f9",
  reminder: "#fb7185",
  process: "#6ee7b7",
}

// Map import types onto the DB element-type enum.
const DB_TYPE: Record<ImportElementType, "project" | "page" | "todo_list" | "canvas" | "reminder" | "process"> = {
  project: "project",
  page: "page",
  todo: "todo_list",
  canvas: "canvas",
  reminder: "reminder",
  process: "process",
}

export async function importFromAI(
  parsed: ParsedImport,
): Promise<
  | { ok: true; id: string; type: string }
  | { ok: false; error: string }
> {
  const user = await requireAuth()
  return importFromAIAs(user.id, parsed)
}

/**
 * Internal: same as importFromAI but takes the user-id explicitly. Used
 * by paths that DON'T have a Next.js session cookie — currently the
 * Telegram webhook (acting on behalf of the bot's bound user). Server
 * actions that DO have a cookie should keep calling `importFromAI` so
 * the auth check stays in one place.
 *
 * Marked async (despite no awaits in its prelude) because callers
 * already use it that way and it lets us keep the DB inserts on a
 * promise chain.
 */
export async function importFromAIAs(
  userId: string,
  parsed: ParsedImport,
): Promise<
  | { ok: true; id: string; type: string }
  | { ok: false; error: string }
> {
  if (!parsed || !parsed.title?.trim()) {
    return { ok: false, error: "Nothing to import — the parser didn't find a header." }
  }

  const id = createId()
  const now = new Date().toISOString()
  const dbType = DB_TYPE[parsed.type]

  // ── 1. Create the element row ─────────────────────────────────────
  await db.insert(elements).values({
    id,
    type: dbType,
    title: parsed.title.slice(0, 200),
    description: parsed.notes ? parsed.notes.slice(0, 2000) : null,
    icon: ICONS[parsed.type],
    color: COLORS[parsed.type],
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  })

  // ── 2. Type-specific row + children ──────────────────────────────
  switch (parsed.type) {
    case "project": {
      // The DB's project.status enum is active | paused | completed | archived.
      // Our import format also allows "planning" — collapse it to "paused"
      // (closest equivalent: project exists but not actively being worked).
      const dbStatus =
        parsed.status === "planning" ? "paused"
        : parsed.status === "active" ? "active"
        : parsed.status === "paused" ? "paused"
        : parsed.status === "completed" ? "completed"
        : "active"
      await db.insert(projects).values({
        id,
        status: dbStatus,
        dueDate: parsed.dueDate ?? null,
      })
      // Default 3-column board.
      const statusDefs = [
        { name: "To Do",       color: "#94a3b8", sortOrder: 0, isDoneState: false },
        { name: "In Progress", color: "#3b82f6", sortOrder: 1, isDoneState: false },
        { name: "Done",        color: "#22c55e", sortOrder: 2, isDoneState: true },
      ]
      const statusIds: { todoId: string; doneId: string } = { todoId: "", doneId: "" }
      for (const s of statusDefs) {
        const sid = createId()
        if (s.name === "To Do") statusIds.todoId = sid
        if (s.name === "Done")  statusIds.doneId = sid
        await db.insert(taskStatuses).values({
          id: sid,
          projectId: id,
          name: s.name,
          color: s.color,
          sortOrder: s.sortOrder,
          isDoneState: s.isDoneState,
        })
      }

      // Insert each parsed task — completed ones go in Done, others in To Do.
      let sort = 0
      for (const t of parsed.tasks) {
        await db.insert(tasks).values({
          id: createId(),
          projectId: id,
          statusId: t.isCompleted ? statusIds.doneId : statusIds.todoId,
          title: t.title.slice(0, 200),
          priority: t.priority,
          dueDate: t.dueDate,
          // Completed tasks must carry the flag too, or they land in the Done
          // column un-crossed with a grey dot.
          isCompleted: t.isCompleted,
          completedAt: t.isCompleted ? now : null,
          sortOrder: sort++,
          createdAt: now,
          updatedAt: now,
        })
      }

      // Recompute progress from completion ratio.
      if (parsed.tasks.length > 0) {
        const completed = parsed.tasks.filter((t) => t.isCompleted).length
        await db
          .update(projects)
          .set({ progress: Math.round((completed / parsed.tasks.length) * 100) })
          .where(eq(projects.id, id))
      }
      break
    }
    case "page":
      // Page body uses BlockNote JSON — for now we drop the markdown text
      // into the description column above. A future enhancement could
      // convert markdown → BlockNote blocks.
      await db.insert(pages).values({ id })
      break
    case "todo": {
      await db.insert(todoLists).values({ id })
      let sort = 0
      for (const t of parsed.tasks) {
        await db.insert(todoItems).values({
          id: createId(),
          listId: id,
          title: t.title.slice(0, 500),
          isCompleted: t.isCompleted,
          dueDate: t.dueDate,
          sortOrder: sort++,
          completedAt: t.isCompleted ? now : null,
          createdAt: now,
        })
      }
      break
    }
    case "canvas":
      await db.insert(canvases).values({ id })
      break
    case "reminder":
      await db.insert(reminders).values({
        id,
        remindAt: parsed.dueDate
          ? new Date(parsed.dueDate).toISOString()
          : new Date(Date.now() + 24 * 3600_000).toISOString(),
      })
      break
    case "process":
      await db.insert(processes).values({ id })
      // Steps not yet first-class — they'll show up in the description.
      break
  }

  // ── 3. Feed event so it surfaces in the ticker + activity heatmap ─
  try {
    await createFeedEvent({
      type: "user_joined", // closest existing enum value; not perfect but expressive
      actorUserId: userId,
      subjectElementId: id,
      title: `Imported from AI: "${parsed.title}"`,
      summary: `${parsed.tasks.length} task${parsed.tasks.length === 1 ? "" : "s"}, ${parsed.tags.length} tag${parsed.tags.length === 1 ? "" : "s"}`,
      priority: "normal",
      sourceType: "manual",
    })
  } catch {
    // Non-fatal
  }

  revalidatePath("/")
  return { ok: true, id, type: dbType }
}
