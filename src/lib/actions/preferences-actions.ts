"use server"

import { sqlite } from "@/lib/db"
import { requireAuth, currentUserId } from "@/lib/auth/scope"

/**
 * Per-user preferences storage. The whole preferences object is stored as
 * a single JSON blob — the shape changes often (sidebarLabels, clock prefs,
 * AI config, etc.) and a column-per-key schema would churn endlessly.
 *
 * Reads return null if the user has never saved (so the client falls back
 * to defaults). Writes upsert the entire blob.
 */

export async function getMyPreferences(): Promise<unknown | null> {
  const uid = await currentUserId()
  if (!uid) return null
  const row = sqlite
    .prepare(`SELECT prefs_json FROM user_preferences WHERE user_id = ?`)
    .get(uid) as { prefs_json: string } | undefined
  if (!row) return null
  try {
    return JSON.parse(row.prefs_json)
  } catch {
    return null
  }
}

export async function saveMyPreferences(prefs: unknown): Promise<{ ok: true }> {
  const me = await requireAuth()
  const json = JSON.stringify(prefs)
  // Guard against a JSON payload growing unbounded — 256 KB is generous
  // for a settings blob and stops malicious clients from filling the DB.
  if (json.length > 256 * 1024) {
    throw new Error("Preferences payload too large")
  }
  sqlite
    .prepare(
      `INSERT INTO user_preferences (user_id, prefs_json, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         prefs_json = excluded.prefs_json,
         updated_at = excluded.updated_at`
    )
    .run(me.id, json)
  return { ok: true }
}
