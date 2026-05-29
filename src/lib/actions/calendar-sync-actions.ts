"use server"

/**
 * Google Calendar one-way sync.
 *
 * Enrollment: a separate OAuth flow at /api/auth/google-calendar grants
 * the Calendar scope and stores the refresh_token in
 * `google_calendar_sync`. The cron uses the refresh token to mint
 * short-lived access tokens.
 *
 * Sync direction: tasks → Google Calendar only. Every 5 minutes the
 * cron pushes any task with a due_date that hasn't been synced yet, as
 * an all-day event. Task title becomes the event summary; description
 * goes into the body. Deletion of a task removes the linked event.
 *
 * Two-way sync (events → tasks) is intentionally out of scope: users
 * already have a calendar full of meetings they don't want to clutter
 * their task list with. We can add it later behind a flag.
 *
 * Setup:
 *   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET — shared with the sign-in
 *   OAuth client (Google's console lets you list both calendar and
 *   userinfo as scopes for the same client).
 */

import { sqlite } from "@/lib/db"
import { requireAuth } from "@/lib/auth/scope"

export interface CalendarSyncStatus {
  connected: boolean
  enabled: boolean
  calendarId: string
  lastSyncAt: string | null
}

export async function getCalendarSyncStatus(): Promise<CalendarSyncStatus> {
  const me = await requireAuth()
  const row = sqlite
    .prepare(
      `SELECT calendar_id AS calendarId, last_sync_at AS lastSyncAt, enabled
         FROM google_calendar_sync WHERE user_id = ?`,
    )
    .get(me.id) as
    | { calendarId: string; lastSyncAt: string | null; enabled: number }
    | undefined
  return {
    connected: !!row,
    enabled: row?.enabled === 1,
    calendarId: row?.calendarId ?? "primary",
    lastSyncAt: row?.lastSyncAt ?? null,
  }
}

export async function setCalendarSyncEnabled(
  enabled: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requireAuth()
  const r = sqlite
    .prepare(`UPDATE google_calendar_sync SET enabled = ? WHERE user_id = ?`)
    .run(enabled ? 1 : 0, me.id)
  if (r.changes === 0) {
    return { ok: false, error: "Connect Google Calendar first." }
  }
  return { ok: true }
}

export async function disconnectCalendarSync(): Promise<{ ok: true }> {
  const me = await requireAuth()
  sqlite
    .prepare(`DELETE FROM google_calendar_sync WHERE user_id = ?`)
    .run(me.id)
  return { ok: true }
}
