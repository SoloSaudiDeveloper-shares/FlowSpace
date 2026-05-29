"use server"

/**
 * Inbound email approval flow.
 *
 * The webhook route parks new emails as `pending`. The user sees them
 * via the bell badge (count rolled up by getMyNotificationCount) and
 * acts on each one:
 *
 *   - Approve → create a todo in the user's default Inbox list with
 *     subject as title and body as notes; mark email `imported`
 *   - Dismiss → just mark `dismissed`
 *
 * Listing returns the pending queue plus stats for the bell badge.
 */

import { sqlite } from "@/lib/db"
import { requireAuth } from "@/lib/auth/scope"
import { createId } from "@/lib/utils/ids"

export interface PendingInboundEmail {
  id: string
  from: string
  fromName: string | null
  subject: string
  preview: string
  createdAt: string
}

export async function listPendingInboundEmails(): Promise<PendingInboundEmail[]> {
  const me = await requireAuth()
  const rows = sqlite
    .prepare(
      `SELECT id, from_addr AS \`from\`, from_name AS fromName, subject,
              substr(body_text, 1, 200) AS preview, created_at AS createdAt
         FROM inbound_emails
        WHERE user_id = ? AND status = 'pending'
        ORDER BY created_at DESC
        LIMIT 50`,
    )
    .all(me.id) as PendingInboundEmail[]
  return rows
}

export async function countPendingInboundEmails(): Promise<number> {
  const me = await requireAuth()
  const row = sqlite
    .prepare(
      `SELECT COUNT(*) AS n FROM inbound_emails WHERE user_id = ? AND status = 'pending'`,
    )
    .get(me.id) as { n: number }
  return row.n
}

export async function approveInboundEmail(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requireAuth()
  const email = sqlite
    .prepare(
      `SELECT id, from_addr, subject, body_text FROM inbound_emails
        WHERE id = ? AND user_id = ? AND status = 'pending'`,
    )
    .get(id, me.id) as
    | { id: string; from_addr: string; subject: string; body_text: string }
    | undefined
  if (!email) return { ok: false, error: "Email not found or already handled." }

  // Find or create the user's Inbox todo list (same one Telegram uses).
  let listId = sqlite
    .prepare(
      `SELECT target_list_id FROM telegram_bots WHERE user_id = ?`,
    )
    .get(me.id) as { target_list_id: string | null } | undefined
  let inboxId = listId?.target_list_id ?? null
  if (!inboxId) {
    const existing = sqlite
      .prepare(
        `SELECT id FROM elements
          WHERE created_by = ? AND type = 'todo_list' AND is_deleted = 0
            AND lower(title) = 'inbox' LIMIT 1`,
      )
      .get(me.id) as { id: string } | undefined
    if (existing) {
      inboxId = existing.id
    } else {
      inboxId = createId()
      sqlite
        .prepare(
          `INSERT INTO elements (id, type, title, created_by) VALUES (?, 'todo_list', 'Inbox', ?)`,
        )
        .run(inboxId, me.id)
    }
  }

  const title = (email.subject || "(no subject)").slice(0, 200)
  const notes =
    `From: ${email.from_addr}\n\n${email.body_text.slice(0, 4000)}`.trim()
  // Insert a todo item; mirror the columns used elsewhere
  sqlite
    .prepare(
      `INSERT INTO todo_items (id, list_id, title, notes, is_completed, created_at)
       VALUES (?, ?, ?, ?, 0, datetime('now'))`,
    )
    .run(createId(), inboxId, title, notes)

  sqlite
    .prepare(
      `UPDATE inbound_emails
          SET status = 'imported', target_list_id = ?, handled_at = datetime('now')
        WHERE id = ?`,
    )
    .run(inboxId, id)

  return { ok: true }
}

export async function dismissInboundEmail(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requireAuth()
  const r = sqlite
    .prepare(
      `UPDATE inbound_emails
          SET status = 'dismissed', handled_at = datetime('now')
        WHERE id = ? AND user_id = ? AND status = 'pending'`,
    )
    .run(id, me.id)
  if (r.changes === 0) return { ok: false, error: "Already handled." }
  return { ok: true }
}
