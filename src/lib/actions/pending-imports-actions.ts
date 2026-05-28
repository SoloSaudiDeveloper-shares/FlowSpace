"use server"

/**
 * Pending imports — the approval queue for inbound payloads from the bot
 * (and later, email / API). Each entry holds raw markdown the user pasted
 * via Telegram. The app shows a notification bell; the user previews,
 * then either approves (creates real elements via importFromAI) or
 * dismisses.
 *
 * This is the "FlowSpace as inbox" idea — Claude/ChatGPT outputs in our
 * format, the user pastes via bot from anywhere, FlowSpace waits for
 * explicit human approval before touching anything.
 */

import { sqlite } from "@/lib/db"
import { requireAuth } from "@/lib/auth/scope"
import { parseAIImport } from "@/lib/import/ai-import-parser"
import { importFromAI } from "@/lib/actions/import-actions"
import { revalidatePath } from "next/cache"

export interface PendingImport {
  id: string
  source: "telegram" | "email" | "api"
  payload: string
  parsedSummary: string | null
  status: "pending" | "approved" | "dismissed"
  createdAt: string
  resolvedAt: string | null
}

export async function getMyPendingImports(): Promise<PendingImport[]> {
  const me = await requireAuth()
  const rows = sqlite
    .prepare(
      `SELECT id, source, payload, parsed_summary, status, created_at, resolved_at
       FROM pending_imports
       WHERE user_id = ? AND status = 'pending'
       ORDER BY created_at DESC`,
    )
    .all(me.id) as {
      id: string
      source: "telegram" | "email" | "api"
      payload: string
      parsed_summary: string | null
      status: "pending" | "approved" | "dismissed"
      created_at: string
      resolved_at: string | null
    }[]
  return rows.map((r) => ({
    id: r.id,
    source: r.source,
    payload: r.payload,
    parsedSummary: r.parsed_summary,
    status: r.status,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
  }))
}

export async function getMyPendingImportCount(): Promise<number> {
  const me = await requireAuth()
  const row = sqlite
    .prepare(
      `SELECT COUNT(*) AS n FROM pending_imports WHERE user_id = ? AND status = 'pending'`,
    )
    .get(me.id) as { n: number }
  return row.n
}

/**
 * Approve a pending import: parse the stored markdown and create the
 * element + child rows via the existing importFromAI server action. On
 * success, mark the import row as approved. Returns enough to route the
 * user to the newly-created element.
 */
export async function approvePendingImport(
  id: string,
): Promise<
  | { ok: true; elementId: string; type: string }
  | { ok: false; error: string }
> {
  const me = await requireAuth()
  const row = sqlite
    .prepare(
      `SELECT payload, status FROM pending_imports WHERE id = ? AND user_id = ? LIMIT 1`,
    )
    .get(id, me.id) as { payload: string; status: string } | undefined
  if (!row) return { ok: false, error: "Pending import not found." }
  if (row.status !== "pending") return { ok: false, error: "Already resolved." }

  const parsed = parseAIImport(row.payload)
  if (!parsed) {
    return { ok: false, error: "Couldn't parse the markdown — the format may have drifted." }
  }
  const result = await importFromAI(parsed)
  if (!result.ok) return result

  sqlite
    .prepare(
      `UPDATE pending_imports SET status = 'approved', resolved_at = datetime('now') WHERE id = ?`,
    )
    .run(id)
  revalidatePath("/")
  return { ok: true, elementId: result.id, type: result.type }
}

export async function dismissPendingImport(id: string): Promise<{ ok: true }> {
  const me = await requireAuth()
  sqlite
    .prepare(
      `UPDATE pending_imports SET status = 'dismissed', resolved_at = datetime('now')
       WHERE id = ? AND user_id = ?`,
    )
    .run(id, me.id)
  revalidatePath("/")
  return { ok: true }
}
