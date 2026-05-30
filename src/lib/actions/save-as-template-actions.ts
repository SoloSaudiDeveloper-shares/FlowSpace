"use server"

/**
 * Snapshot an existing project as a reusable template.
 *
 * Walks the project → tasks → statuses graph and stores it as a
 * structured JSON blob in the templates table's `content` column,
 * along with template_items rows for the tasks themselves so the
 * existing "create from template" flow can rehydrate it cleanly.
 *
 * What we capture:
 *  - project title + description + icon + color
 *  - task statuses (To Do / In Progress / Done + any custom columns)
 *  - each task: title, description, priority, status column, sort order
 *  - subtasks
 *
 * What we DON'T capture (intentionally):
 *  - dates (templates are reusable; the user picks dates at creation)
 *  - assignees (no user identity should leak across templates)
 *  - comments + attachments
 *  - completed_at / progress
 */

import { sqlite } from "@/lib/db"
import { requireAuth } from "@/lib/auth/scope"
import { createId } from "@/lib/utils/ids"
import { revalidatePath } from "next/cache"

export async function saveProjectAsTemplate(input: {
  projectId: string
  templateName: string
  templateDescription?: string
}): Promise<{ ok: true; templateId: string } | { ok: false; error: string }> {
  const me = await requireAuth()
  const project = sqlite
    .prepare(
      `SELECT e.id, e.title, e.description, e.icon, e.color, e.type
         FROM elements e
        WHERE e.id = ? AND e.created_by = ? AND e.is_deleted = 0`,
    )
    .get(input.projectId, me.id) as
    | { id: string; title: string; description: string | null; icon: string | null; color: string | null; type: string }
    | undefined
  if (!project || project.type !== "project") {
    return { ok: false, error: "Project not found." }
  }

  const statuses = sqlite
    .prepare(
      `SELECT id, name, color, sort_order AS sortOrder, is_done_state AS isDoneState
         FROM task_statuses WHERE project_id = ? ORDER BY sort_order ASC`,
    )
    .all(project.id) as { id: string; name: string; color: string; sortOrder: number; isDoneState: number }[]

  const tasks = sqlite
    .prepare(
      `SELECT id, title, description, priority, status_id AS statusId,
              parent_task_id AS parentTaskId, sort_order AS sortOrder
         FROM tasks WHERE project_id = ?
         ORDER BY sort_order ASC`,
    )
    .all(project.id) as {
      id: string
      title: string
      description: string | null
      priority: string | null
      statusId: string
      parentTaskId: string | null
      sortOrder: number
    }[]

  // Build a structured content blob — used by createFromTemplate to
  // rebuild the project structure with new IDs.
  const content = {
    version: 1,
    project: {
      title: project.title,
      description: project.description,
      icon: project.icon,
      color: project.color,
    },
    statuses: statuses.map((s) => ({
      name: s.name,
      color: s.color,
      sortOrder: s.sortOrder,
      isDoneState: s.isDoneState === 1,
    })),
    tasks: tasks.map((t) => ({
      // Use the position of the status in the list as a stable handle —
      // the actual statusId won't exist when we re-instantiate.
      statusIndex: statuses.findIndex((s) => s.id === t.statusId),
      // Same for parent task: position in the task list (or -1).
      parentIndex: t.parentTaskId
        ? tasks.findIndex((p) => p.id === t.parentTaskId)
        : -1,
      title: t.title,
      description: t.description,
      priority: t.priority,
      sortOrder: t.sortOrder,
    })),
  }

  const templateId = createId()
  const now = new Date().toISOString()
  sqlite
    .prepare(
      `INSERT INTO templates (id, name, description, type, icon, color, content,
                              created_by, is_published, is_favorite, usage_count,
                              created_at, updated_at)
       VALUES (?, ?, ?, 'project', ?, ?, ?, ?, 1, 0, 0, ?, ?)`,
    )
    .run(
      templateId,
      input.templateName.trim(),
      input.templateDescription?.trim() ?? null,
      project.icon,
      project.color,
      JSON.stringify(content),
      me.id,
      now,
      now,
    )

  revalidatePath("/templates")
  return { ok: true, templateId }
}

/**
 * Generic "save any element as a template". Projects delegate to the richer
 * snapshot above; canvases, todo lists, processes and pages each capture
 * their own children into the template `content` JSON, which
 * createFromTemplate rehydrates. Dates / completion / assignees are dropped
 * so templates stay reusable.
 */
export async function saveElementAsTemplate(input: {
  elementId: string
  templateName: string
  templateDescription?: string
}): Promise<{ ok: true; templateId: string } | { ok: false; error: string }> {
  const me = await requireAuth()
  const el = sqlite
    .prepare(
      `SELECT id, title, description, icon, color, type
         FROM elements WHERE id = ? AND created_by = ? AND is_deleted = 0`,
    )
    .get(input.elementId, me.id) as
    | { id: string; title: string; description: string | null; icon: string | null; color: string | null; type: string }
    | undefined
  if (!el) return { ok: false, error: "Element not found." }

  // Projects have a richer snapshot (statuses + tasks) — reuse it.
  if (el.type === "project") {
    return saveProjectAsTemplate({
      projectId: el.id,
      templateName: input.templateName,
      templateDescription: input.templateDescription,
    })
  }

  // templateType must be one of the templates.type enum values.
  let templateType = el.type
  const content: Record<string, unknown> = { version: 1 }

  switch (el.type) {
    case "canvas": {
      const cfg = sqlite
        .prepare(
          `SELECT background_variant AS backgroundVariant, background_gap AS backgroundGap,
                  snap_to_grid AS snapToGrid, show_minimap AS showMinimap
             FROM canvases WHERE id = ?`,
        )
        .get(el.id) as Record<string, unknown> | undefined
      const nodes = sqlite
        .prepare(
          `SELECT id, type, position_x AS positionX, position_y AS positionY,
                  width, height, data, style
             FROM canvas_nodes WHERE canvas_id = ?`,
        )
        .all(el.id) as { id: string; [k: string]: unknown }[]
      const edges = sqlite
        .prepare(
          `SELECT source_node_id AS s, target_node_id AS t, source_handle AS sourceHandle,
                  target_handle AS targetHandle, type, label, style, animated
             FROM canvas_edges WHERE canvas_id = ?`,
        )
        .all(el.id) as { s: string; t: string; [k: string]: unknown }[]
      const idx = new Map(nodes.map((n, i) => [n.id, i]))
      content.canvas = cfg ?? {}
      content.nodes = nodes.map((n) => ({
        type: n.type, positionX: n.positionX, positionY: n.positionY,
        width: n.width, height: n.height, data: n.data, style: n.style,
      }))
      content.edges = edges
        .filter((e) => idx.has(e.s) && idx.has(e.t))
        .map((e) => ({
          sourceIndex: idx.get(e.s), targetIndex: idx.get(e.t),
          sourceHandle: e.sourceHandle, targetHandle: e.targetHandle,
          type: e.type, label: e.label, style: e.style, animated: e.animated,
        }))
      break
    }
    case "todo_list": {
      content.items = sqlite
        .prepare(
          `SELECT title, notes, priority, sort_order AS sortOrder
             FROM todo_items WHERE list_id = ? ORDER BY sort_order ASC`,
        )
        .all(el.id)
      break
    }
    case "process": {
      content.steps = sqlite
        .prepare(
          `SELECT title, description, sort_order AS sortOrder
             FROM process_steps WHERE process_id = ? ORDER BY sort_order ASC`,
        )
        .all(el.id)
      break
    }
    case "page": {
      const page = sqlite
        .prepare(`SELECT content, cover_image AS coverImage FROM pages WHERE id = ?`)
        .get(el.id) as { content: string | null; coverImage: string | null } | undefined
      content.page = { content: page?.content ?? null, coverImage: page?.coverImage ?? null }
      break
    }
    default:
      return { ok: false, error: `Can't template a ${el.type} yet.` }
  }

  const templateId = createId()
  const now = new Date().toISOString()
  sqlite
    .prepare(
      `INSERT INTO templates (id, name, description, type, icon, color, content,
                              created_by, is_published, is_favorite, usage_count,
                              created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0, ?, ?)`,
    )
    .run(
      templateId,
      input.templateName.trim(),
      input.templateDescription?.trim() ?? null,
      templateType,
      el.icon,
      el.color,
      JSON.stringify(content),
      me.id,
      now,
      now,
    )

  revalidatePath("/templates")
  return { ok: true, templateId }
}
