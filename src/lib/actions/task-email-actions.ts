"use server"

/**
 * "Send this task as an email" — gives users a quick way to ping someone
 * about a task from anywhere it's shown (detail sheet, board, list, etc.)
 *
 * The composer collects: recipient email + optional custom note + which
 * task fields to include. We compose a clean HTML+text email using the
 * existing Resend/Gmail transport, NEVER exposing secrets to the client.
 *
 * Permission: the caller must own the task's parent project. That keeps
 * one user from emailing out another user's data.
 */

import { db } from "@/lib/db"
import {
  tasks,
  elements,
  taskStatuses,
  users,
} from "@/lib/db/schema"
import { eq, inArray } from "drizzle-orm"
import { requireAuth } from "@/lib/auth/scope"
import { sendEmail, isEmailConfigured } from "@/lib/email/send"
import { createFeedEvent } from "@/lib/actions/feed-actions"
import { escapeHtml, escapeAttr } from "@/lib/utils"

import { PRIORITY_BY_VALUE as PRIORITY_TONE } from "@/lib/priority"

export interface SendTaskEmailInput {
  taskId: string
  to: string
  customMessage?: string
  include?: {
    description?: boolean
    dueDate?: boolean
    status?: boolean
    priority?: boolean
    appLink?: boolean
  }
}

export async function isTaskEmailReady(): Promise<{
  ready: boolean
  provider: string
}> {
  const ready = isEmailConfigured()
  return {
    ready,
    provider: ready
      ? process.env.RESEND_API_KEY
        ? "resend"
        : "gmail"
      : "none",
  }
}

export async function sendTaskAsEmail(
  input: SendTaskEmailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requireAuth()

  // Basic email shape check — server-side sanity, the UI does its own too.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.to)) {
    return { ok: false, error: "That doesn't look like a valid email address." }
  }

  // Look up the task, its project, and its status. Verify ownership.
  const rows = await db
    .select({
      task: tasks,
      project: elements,
      status: taskStatuses,
    })
    .from(tasks)
    .innerJoin(elements, eq(elements.id, tasks.projectId))
    .leftJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
    .where(eq(tasks.id, input.taskId))
    .limit(1)

  if (rows.length === 0) return { ok: false, error: "Task not found" }
  const { task, project, status } = rows[0]

  if (project.createdBy !== me.id) {
    return { ok: false, error: "You don't have access to this task." }
  }

  // Defaults — when callers don't pass `include`, send the full picture.
  const include = {
    description: true,
    dueDate: true,
    status: true,
    priority: true,
    appLink: true,
    ...(input.include ?? {}),
  }

  const appBase = (process.env.PUBLIC_APP_URL || "").replace(/\/+$/, "")
  const taskUrl = appBase ? `${appBase}/projects/${task.projectId}` : ""
  const fromName = me.displayName || "FlowSpace"

  const { html, text, subject } = buildEmailBody({
    task,
    project,
    status,
    include,
    customMessage: input.customMessage?.trim(),
    taskUrl,
    fromName,
  })

  const result = await sendEmail({ to: input.to, subject, html, text })
  if (!result.ok) return result

  // Drop a feed event so the workspace shows the outbound message. Stays
  // visible only to the sender (owner). Useful audit trail.
  try {
    await createFeedEvent({
      type: "comment_added",
      actorUserId: me.id,
      subjectElementId: task.projectId,
      subjectTaskId: task.id,
      projectId: task.projectId,
      title: `Emailed task "${task.title}" to ${input.to}`,
      summary: input.customMessage?.slice(0, 200),
      priority: "normal",
      visibility: "private",
      sourceType: "manual",
    })
  } catch {
    // Non-fatal — the email already went out.
  }

  return { ok: true }
}

// ─── Bulk: one combined digest email for many tasks ───────────────────────

export async function sendTasksDigestEmail(input: {
  taskIds: string[]
  projectId: string
  to: string
  customMessage?: string
}): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const me = await requireAuth()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.to)) {
    return { ok: false, error: "That doesn't look like a valid email address." }
  }
  if (!input.taskIds.length) {
    return { ok: false, error: "No tasks selected." }
  }

  const rows = await db
    .select({ task: tasks, project: elements, status: taskStatuses })
    .from(tasks)
    .innerJoin(elements, eq(elements.id, tasks.projectId))
    .leftJoin(taskStatuses, eq(taskStatuses.id, tasks.statusId))
    .where(inArray(tasks.id, input.taskIds))

  // Keep only tasks the caller owns (via their parent project).
  const owned = rows.filter((r) => r.project.createdBy === me.id)
  if (owned.length === 0) {
    return { ok: false, error: "You don't have access to these tasks." }
  }

  const project = owned[0].project
  const appBase = (process.env.PUBLIC_APP_URL || "").replace(/\/+$/, "")
  const projectUrl = appBase ? `${appBase}/projects/${input.projectId}` : ""
  const fromName = me.displayName || "FlowSpace"

  const { html, text, subject } = buildDigestBody({
    items: owned,
    projectTitle: project.title,
    customMessage: input.customMessage?.trim(),
    projectUrl,
    fromName,
  })

  const result = await sendEmail({ to: input.to, subject, html, text })
  if (!result.ok) return result

  try {
    await createFeedEvent({
      type: "comment_added",
      actorUserId: me.id,
      subjectElementId: input.projectId,
      projectId: input.projectId,
      title: `Emailed ${owned.length} task${owned.length === 1 ? "" : "s"} to ${input.to}`,
      summary: input.customMessage?.slice(0, 200),
      priority: "normal",
      visibility: "private",
      sourceType: "manual",
    })
  } catch {
    // Non-fatal — the email already went out.
  }

  return { ok: true, count: owned.length }
}

function buildDigestBody(args: {
  items: {
    task: typeof tasks.$inferSelect
    status: typeof taskStatuses.$inferSelect | null
  }[]
  projectTitle: string
  customMessage?: string
  projectUrl: string
  fromName: string
}) {
  const { items, projectTitle, customMessage, projectUrl, fromName } = args
  const n = items.length
  const subject = `${n} task${n === 1 ? "" : "s"} from ${projectTitle}`

  const noteBlock = customMessage
    ? `<div style="margin:0 0 24px 0;padding:14px 16px;background:#eff6ff;border-left:3px solid #3b82f6;border-radius:4px;color:#1e3a8a;font-size:14px;line-height:1.6;white-space:pre-wrap;"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#1d4ed8;margin-bottom:6px;">Message from ${escapeHtml(fromName)}</div>${escapeHtml(customMessage)}</div>`
    : ""

  const itemRows = items
    .map(({ task, status }) => {
      const tone = PRIORITY_TONE[task.priority] ?? PRIORITY_TONE.none
      const overdue = task.dueDate && new Date(task.dueDate) < new Date()
      const due = task.dueDate
        ? new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
        : null
      const chips: string[] = []
      if (status) chips.push(`<span style="display:inline-block;padding:1px 8px;border-radius:9999px;background:${escapeAttr(status.color)};color:#fff;font-size:11px;font-weight:600;">${escapeHtml(status.name)}</span>`)
      if (task.priority && task.priority !== "none") chips.push(`<span style="display:inline-block;padding:1px 8px;border-radius:9999px;background:${tone.color};color:#fff;font-size:11px;font-weight:600;">${escapeHtml(tone.label)}</span>`)
      if (due) chips.push(`<span style="color:${overdue ? "#dc2626" : "#64748b"};font-size:12px;font-weight:${overdue ? "700" : "500"};">${escapeHtml(due)}${overdue ? " · OVERDUE" : ""}</span>`)
      const titleStyle = task.isCompleted ? "text-decoration:line-through;color:#94a3b8;" : "color:#0f172a;"
      return `<tr><td style="padding:12px 0;border-bottom:1px solid #eef2f7;">
        <div style="font-size:15px;font-weight:600;${titleStyle}">${escapeHtml(task.title)}</div>
        ${chips.length ? `<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">${chips.join(" ")}</div>` : ""}
        ${task.description ? `<div style="margin-top:6px;color:#475569;font-size:13px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(task.description.slice(0, 280))}${task.description.length > 280 ? "…" : ""}</div>` : ""}
      </td></tr>`
    })
    .join("")

  const linkBlock = projectUrl
    ? `<div style="margin-top:24px;"><a href="${escapeAttr(projectUrl)}" style="display:inline-block;padding:10px 18px;background:#0f172a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Open project in FlowSpace</a></div>`
    : ""

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0f172a;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f1f5f9;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <tr><td style="padding:28px 32px 8px 32px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;margin-bottom:10px;">Task digest · ${escapeHtml(projectTitle)}</div>
        <h1 style="margin:0 0 16px 0;font-size:20px;line-height:1.3;color:#0f172a;">${n} task${n === 1 ? "" : "s"}</h1>
        ${noteBlock}
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${itemRows}</table>
        ${linkBlock}
      </td></tr>
      <tr><td style="padding:20px 32px 28px 32px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:11px;line-height:1.5;">
        Sent from <strong style="color:#475569;">FlowSpace</strong> by ${escapeHtml(fromName)}.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`

  const textParts: string[] = [`Task digest — ${projectTitle} (${n} task${n === 1 ? "" : "s"})`, ""]
  if (customMessage) textParts.push(`Message from ${fromName}:`, customMessage, "")
  for (const { task, status } of items) {
    const bits: string[] = []
    if (status) bits.push(status.name)
    if (task.priority && task.priority !== "none") bits.push((PRIORITY_TONE[task.priority] ?? PRIORITY_TONE.none).label)
    if (task.dueDate) {
      const overdue = new Date(task.dueDate) < new Date()
      bits.push(`due ${new Date(task.dueDate).toLocaleDateString()}${overdue ? " (OVERDUE)" : ""}`)
    }
    textParts.push(`• ${task.isCompleted ? "[done] " : ""}${task.title}${bits.length ? `  (${bits.join(", ")})` : ""}`)
  }
  if (projectUrl) textParts.push("", `Open project: ${projectUrl}`)
  textParts.push("", `— ${fromName} via FlowSpace`)

  return { html, text: textParts.join("\n"), subject }
}

// ─── Email body composer ──────────────────────────────────────────────────

function buildEmailBody(args: {
  task: typeof tasks.$inferSelect
  project: typeof elements.$inferSelect
  status: typeof taskStatuses.$inferSelect | null
  include: {
    description: boolean
    dueDate: boolean
    status: boolean
    priority: boolean
    appLink: boolean
  }
  customMessage?: string
  taskUrl: string
  fromName: string
}) {
  const { task, project, status, include, customMessage, taskUrl, fromName } = args

  const priorityTone =
    PRIORITY_TONE[task.priority] ?? PRIORITY_TONE.none
  const dueDate = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null
  const overdue = task.dueDate && new Date(task.dueDate) < new Date()

  const subject = `${task.title} — reminder from ${fromName}`

  // ── HTML body — table-based, inline styles, dark/light agnostic ───
  const rows: string[] = []
  if (include.status && status) {
    rows.push(metaRow("Status", `<span style="display:inline-block;padding:2px 10px;border-radius:9999px;background:${escapeAttr(status.color)};color:#fff;font-size:12px;font-weight:600;">${escapeHtml(status.name)}</span>`))
  }
  if (include.priority && task.priority && task.priority !== "none") {
    rows.push(metaRow("Priority", `<span style="display:inline-block;padding:2px 10px;border-radius:9999px;background:${priorityTone.color};color:#fff;font-size:12px;font-weight:600;">${escapeHtml(priorityTone.label)}</span>`))
  }
  if (include.dueDate && dueDate) {
    rows.push(metaRow("Due", `<span style="color:${overdue ? "#dc2626" : "#0f172a"};font-weight:${overdue ? "700" : "500"};">${escapeHtml(dueDate)}${overdue ? " — OVERDUE" : ""}</span>`))
  }
  rows.push(metaRow("Project", escapeHtml(project.title)))

  const descBlock =
    include.description && task.description
      ? `<div style="margin:20px 0;padding:14px 16px;background:#f8fafc;border-left:3px solid #94a3b8;border-radius:4px;color:#334155;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(task.description)}</div>`
      : ""

  const noteBlock = customMessage
    ? `<div style="margin:0 0 24px 0;padding:14px 16px;background:#eff6ff;border-left:3px solid #3b82f6;border-radius:4px;color:#1e3a8a;font-size:14px;line-height:1.6;white-space:pre-wrap;"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#1d4ed8;margin-bottom:6px;">Message from ${escapeHtml(fromName)}</div>${escapeHtml(customMessage)}</div>`
    : ""

  const linkBlock =
    include.appLink && taskUrl
      ? `<div style="margin-top:24px;"><a href="${escapeAttr(taskUrl)}" style="display:inline-block;padding:10px 18px;background:#0f172a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Open in FlowSpace</a></div>`
      : ""

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0f172a;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f1f5f9;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <tr><td style="padding:28px 32px 8px 32px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;margin-bottom:10px;">Task reminder</div>
        <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;color:#0f172a;">${escapeHtml(task.title)}</h1>
        ${noteBlock}
        ${rows.length > 0 ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px 0;font-size:13px;">${rows.join("")}</table>` : ""}
        ${descBlock}
        ${linkBlock}
      </td></tr>
      <tr><td style="padding:20px 32px 28px 32px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:11px;line-height:1.5;">
        Sent from <strong style="color:#475569;">FlowSpace</strong> by ${escapeHtml(fromName)}. You're receiving this because they sent you a task reminder.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`

  // ── Plain-text fallback ──────────────────────────────────────────
  const textParts: string[] = [
    `Task reminder: ${task.title}`,
    "",
  ]
  if (customMessage) {
    textParts.push(`Message from ${fromName}:`, customMessage, "")
  }
  if (include.status && status) textParts.push(`Status: ${status.name}`)
  if (include.priority && task.priority && task.priority !== "none") textParts.push(`Priority: ${priorityTone.label}`)
  if (include.dueDate && dueDate) textParts.push(`Due: ${dueDate}${overdue ? " (OVERDUE)" : ""}`)
  textParts.push(`Project: ${project.title}`)
  if (include.description && task.description) {
    textParts.push("", "Description:", task.description)
  }
  if (include.appLink && taskUrl) {
    textParts.push("", `Open in FlowSpace: ${taskUrl}`)
  }
  textParts.push("", `— ${fromName} via FlowSpace`)
  const text = textParts.join("\n")

  return { html, text, subject }
}

function metaRow(label: string, valueHtml: string): string {
  return `<tr><td style="padding:4px 16px 4px 0;color:#64748b;font-size:13px;">${escapeHtml(label)}</td><td style="padding:4px 0;font-size:13px;">${valueHtml}</td></tr>`
}
