"use server"

/**
 * Generic "send any element as email" with templates + variables.
 *
 * Builds on the existing send-task-as-email pattern but extends to all
 * element types (project, page, todo list, reminder, process) using a
 * template engine. Users pick a built-in template (or a custom one from
 * `email_templates` later) and the engine fills in variables from a
 * structured context.
 *
 * Permission: caller must own the element.
 */

import { sqlite } from "@/lib/db"
import { requireAuth } from "@/lib/auth/scope"
import { sendEmail, isEmailConfigured } from "@/lib/email/send"
import { renderTemplate, type TemplateContext } from "@/lib/email/template-engine"
import { BUILTIN_TEMPLATES, getTemplatesForType, type EmailTemplate } from "@/lib/email/templates"
import { createFeedEvent } from "@/lib/actions/feed-actions"

export interface SendElementEmailInput {
  elementId: string
  to: string
  templateId: string
  customMessage?: string
}

const TYPE_LABEL: Record<string, string> = {
  project: "Project",
  page: "Page",
  canvas: "Canvas",
  todo_list: "Todo list",
  reminder: "Reminder",
  process: "Process",
}

export async function getElementEmailTemplates(elementId: string): Promise<
  | { ok: true; templates: { id: string; label: string; description: string }[]; elementType: string; elementTitle: string }
  | { ok: false; error: string }
> {
  const me = await requireAuth()
  const row = sqlite
    .prepare(`SELECT id, type, title FROM elements WHERE id = ? AND created_by = ? AND is_deleted = 0`)
    .get(elementId, me.id) as { id: string; type: string; title: string } | undefined
  if (!row) return { ok: false, error: "Element not found." }
  const list = getTemplatesForType(row.type as "project" | "page" | "canvas" | "todo_list" | "reminder" | "process" | "task")
  return {
    ok: true,
    elementType: row.type,
    elementTitle: row.title,
    templates: list.map((t) => ({ id: t.id, label: t.label, description: t.description })),
  }
}

export async function isElementEmailReady(): Promise<{ ready: boolean }> {
  return { ready: isEmailConfigured() }
}

export async function sendElementAsEmail(
  input: SendElementEmailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requireAuth()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.to)) {
    return { ok: false, error: "That doesn't look like a valid email address." }
  }
  if (!isEmailConfigured()) {
    return { ok: false, error: "Email is not configured on the server." }
  }

  const el = sqlite
    .prepare(`SELECT id, type, title, description FROM elements WHERE id = ? AND created_by = ?`)
    .get(input.elementId, me.id) as
    | { id: string; type: string; title: string; description: string | null }
    | undefined
  if (!el) return { ok: false, error: "Element not found." }

  const template = BUILTIN_TEMPLATES.find((t) => t.id === input.templateId)
  if (!template) return { ok: false, error: "Template not found." }
  if (!template.elementTypes.includes(el.type as EmailTemplate["elementTypes"][number])) {
    return { ok: false, error: "Template doesn't apply to this element type." }
  }

  // Build the template context — what variables are available.
  const ctx = await buildContext(me.id, el, input.customMessage)
  const subject = renderTemplate(template.subject, ctx, { html: false })
  const html = renderTemplate(template.body, ctx, { html: true })
  const text = stripHtml(html)

  const result = await sendEmail({ to: input.to, subject, html, text })
  if (!result.ok) return result

  // Feed event audit.
  try {
    await createFeedEvent({
      type: "comment_added",
      actorUserId: me.id,
      subjectElementId: el.id,
      title: `Emailed "${el.title}" to ${input.to}`,
      summary: `template: ${template.label}`,
      priority: "normal",
      visibility: "private",
      sourceType: "manual",
    })
  } catch {
    // non-fatal
  }
  return { ok: true }
}

async function buildContext(
  userId: string,
  el: { id: string; type: string; title: string; description: string | null },
  customMessage?: string,
): Promise<TemplateContext> {
  const user = sqlite
    .prepare(`SELECT id, display_name, username, email FROM users WHERE id = ?`)
    .get(userId) as { id: string; display_name: string; username: string; email: string | null } | undefined
  const base: TemplateContext["element"] = {
    id: el.id,
    type: el.type,
    typeLabel: TYPE_LABEL[el.type] ?? el.type,
    title: el.title,
    description: el.description ?? "",
  }
  const appUrl = (process.env.PUBLIC_APP_URL || "").replace(/\/+$/, "")
  const ctx: TemplateContext = {
    element: base,
    customMessage: customMessage?.trim() ?? "",
    user: {
      displayName: user?.display_name ?? "FlowSpace",
      username: user?.username ?? "",
      email: user?.email ?? "",
    },
    links: {
      element: appUrl ? buildHref(appUrl, el) : "",
    },
  }

  // Type-specific enrichments
  if (el.type === "project") {
    const proj = sqlite
      .prepare(`SELECT status, progress, due_date FROM projects WHERE id = ?`)
      .get(el.id) as { status: string; progress: number; due_date: string | null } | undefined
    if (proj) {
      ;(base as Record<string, unknown>).status = proj.status
      ;(base as Record<string, unknown>).progress = proj.progress
      ;(base as Record<string, unknown>).dueDate = proj.due_date ? friendlyDate(proj.due_date) : ""
    }
    const total = sqlite
      .prepare(`SELECT COUNT(*) AS n FROM tasks WHERE project_id = ?`)
      .get(el.id) as { n: number }
    const done = sqlite
      .prepare(
        `SELECT COUNT(*) AS n FROM tasks t INNER JOIN task_statuses s ON s.id = t.status_id
         WHERE t.project_id = ? AND s.is_done_state = 1`,
      )
      .get(el.id) as { n: number }
    const openTopRows = sqlite
      .prepare(
        `SELECT t.title FROM tasks t
         WHERE t.project_id = ?
           AND t.status_id NOT IN (SELECT id FROM task_statuses WHERE is_done_state = 1)
         ORDER BY t.priority DESC, t.due_date ASC NULLS LAST LIMIT 5`,
      )
      .all(el.id) as { title: string }[]
    ctx.tasks = {
      total: { count: total.n },
      done: { count: done.n },
      open: { count: total.n - done.n, items: openTopRows },
    }
  }

  if (el.type === "todo_list") {
    const items = sqlite
      .prepare(
        `SELECT title, is_completed FROM todo_items WHERE list_id = ? ORDER BY sort_order ASC LIMIT 30`,
      )
      .all(el.id) as { title: string; is_completed: number }[]
    ctx.items = {
      all: items.map((i) => ({ title: i.title, isCompleted: i.is_completed === 1 })),
    }
  }

  if (el.type === "reminder") {
    const r = sqlite
      .prepare(`SELECT remind_at FROM reminders WHERE id = ?`)
      .get(el.id) as { remind_at: string } | undefined
    if (r) {
      ;(base as Record<string, unknown>).remindAt = friendlyDate(r.remind_at)
    }
  }

  return ctx
}

function buildHref(appUrl: string, el: { id: string; type: string }): string {
  switch (el.type) {
    case "project":   return `${appUrl}/projects/${el.id}`
    case "page":      return `${appUrl}/pages/${el.id}`
    case "canvas":    return `${appUrl}/canvas/${el.id}`
    case "todo_list": return `${appUrl}/todos/${el.id}`
    case "process":   return `${appUrl}/process/${el.id}`
    case "reminder":  return `${appUrl}/reminders`
    default:          return appUrl
  }
}

function friendlyDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s{2,}/g, " ")
    .trim()
}
