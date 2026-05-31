/**
 * Google Calendar one-way sync engine (FlowSpace → Google).
 *
 * Runs from the cron every 5 minutes (all enabled users) and on demand via
 * the "Sync now" button (a single user). For each user it:
 *  - mints a fresh access token from their refresh token (if expired)
 *  - gathers every dated item they own — tasks, standalone to-dos,
 *    reminders, and project due dates — that isn't yet on the calendar
 *  - POSTs each as an all-day event and records source_id ↔ event_id in
 *    google_calendar_events (the `task_id` column is used as a generic
 *    source id; any element/task/todo/reminder id goes there)
 *  - deletes events whose source was removed or had its date cleared
 *
 * Failures are logged but never throw — one user's broken refresh shouldn't
 * block the others.
 */

import "server-only"
import { sqlite } from "@/lib/db"

interface SyncRow {
  userId: string
  refreshToken: string
  accessToken: string | null
  accessExpiresAt: string | null
  calendarId: string
}

/** A calendar-worthy item from any source, normalised to a single date. */
interface CalendarItem {
  id: string
  title: string
  description: string | null
  date: string
}

async function ensureAccessToken(row: SyncRow): Promise<string | null> {
  // Reuse existing access token if it's still valid for >60s
  if (row.accessToken && row.accessExpiresAt) {
    const expMs = new Date(row.accessExpiresAt).getTime()
    if (expMs - Date.now() > 60_000) return row.accessToken
  }
  const body = new URLSearchParams({
    refresh_token: row.refreshToken,
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    grant_type: "refresh_token",
  })
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })
  if (!res.ok) return null
  const tokens = (await res.json()) as {
    access_token?: string
    expires_in?: number
  }
  if (!tokens.access_token) return null
  const exp = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null
  sqlite
    .prepare(
      `UPDATE google_calendar_sync
          SET access_token = ?, access_expires_at = ?
        WHERE user_id = ?`,
    )
    .run(tokens.access_token, exp, row.userId)
  return tokens.access_token
}

/** Every dated item a user owns, across all four sources. */
function collectCalendarItems(userId: string): CalendarItem[] {
  const items: CalendarItem[] = []

  // 1. Tasks with a due date (project owned by the user, project not trashed).
  items.push(
    ...(sqlite
      .prepare(
        `SELECT t.id, t.title, t.description, t.due_date AS date
           FROM tasks t
           JOIN elements e ON e.id = t.project_id
          WHERE e.created_by = ? AND e.is_deleted = 0
            AND t.due_date IS NOT NULL AND t.due_date != ''`,
      )
      .all(userId) as CalendarItem[]),
  )

  // 2. Standalone to-do items with a due date (list owned by the user).
  items.push(
    ...(sqlite
      .prepare(
        `SELECT ti.id, ti.title, ti.notes AS description, ti.due_date AS date
           FROM todo_items ti
           JOIN elements e ON e.id = ti.list_id
          WHERE e.created_by = ? AND e.is_deleted = 0
            AND ti.due_date IS NOT NULL AND ti.due_date != ''`,
      )
      .all(userId) as CalendarItem[]),
  )

  // 3. Reminders (the element itself carries the title/description).
  items.push(
    ...(sqlite
      .prepare(
        `SELECT r.id, e.title, e.description, r.remind_at AS date
           FROM reminders r
           JOIN elements e ON e.id = r.id
          WHERE e.created_by = ? AND e.is_deleted = 0
            AND r.is_dismissed = 0
            AND r.remind_at IS NOT NULL AND r.remind_at != ''`,
      )
      .all(userId) as CalendarItem[]),
  )

  // 4. Project due dates.
  items.push(
    ...(sqlite
      .prepare(
        `SELECT p.id, e.title, e.description, p.due_date AS date
           FROM projects p
           JOIN elements e ON e.id = p.id
          WHERE e.created_by = ? AND e.is_deleted = 0
            AND p.due_date IS NOT NULL AND p.due_date != ''`,
      )
      .all(userId) as CalendarItem[]),
  )

  return items
}

async function pushEvent(
  accessToken: string,
  calendarId: string,
  item: CalendarItem,
): Promise<string | null> {
  const date = item.date.slice(0, 10)
  const next = new Date(date + "T00:00:00Z")
  next.setUTCDate(next.getUTCDate() + 1)
  const nextDate = next.toISOString().slice(0, 10)
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: item.title,
        description: (item.description ?? "") + "\n\n— from FlowSpace",
        start: { date },
        end: { date: nextDate },
      }),
    },
  )
  if (!res.ok) return null
  const data = (await res.json()) as { id?: string }
  return data.id ?? null
}

async function deleteEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<boolean> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  )
  // 410 Gone is fine — already deleted.
  return res.ok || res.status === 410
}

/**
 * Sync one user. Returns how many events were created / removed, or null if
 * the access token couldn't be minted. Never throws.
 */
export async function syncGoogleCalendarForUser(
  row: SyncRow,
): Promise<{ pushed: number; removed: number } | null> {
  const token = await ensureAccessToken(row)
  if (!token) return null

  const items = collectCalendarItems(row.userId)
  const validIds = new Set(items.map((i) => i.id))

  // What's already on the calendar for this user.
  const existing = sqlite
    .prepare(
      `SELECT task_id AS sourceId, event_id AS eventId
         FROM google_calendar_events WHERE user_id = ?`,
    )
    .all(row.userId) as { sourceId: string; eventId: string }[]
  const existingIds = new Set(existing.map((e) => e.sourceId))

  let pushed = 0
  for (const item of items) {
    if (existingIds.has(item.id)) continue
    const eventId = await pushEvent(token, row.calendarId, item)
    if (eventId) {
      sqlite
        .prepare(
          `INSERT OR REPLACE INTO google_calendar_events (task_id, event_id, user_id)
           VALUES (?, ?, ?)`,
        )
        .run(item.id, eventId, row.userId)
      pushed++
    }
  }

  let removed = 0
  for (const e of existing) {
    if (validIds.has(e.sourceId)) continue
    const ok = await deleteEvent(token, row.calendarId, e.eventId)
    if (ok) {
      sqlite
        .prepare(`DELETE FROM google_calendar_events WHERE task_id = ?`)
        .run(e.sourceId)
      removed++
    }
  }

  sqlite
    .prepare(
      `UPDATE google_calendar_sync SET last_sync_at = datetime('now') WHERE user_id = ?`,
    )
    .run(row.userId)

  return { pushed, removed }
}

/** Cron entry point: sync every enabled user. */
export async function syncGoogleCalendarForAllUsers(): Promise<void> {
  const rows = sqlite
    .prepare(
      `SELECT user_id AS userId, refresh_token AS refreshToken,
              access_token AS accessToken,
              access_expires_at AS accessExpiresAt,
              calendar_id AS calendarId
         FROM google_calendar_sync
        WHERE enabled = 1`,
    )
    .all() as SyncRow[]
  for (const row of rows) {
    try {
      await syncGoogleCalendarForUser(row)
    } catch (err) {
      console.error("[gcal-sync] user", row.userId, err)
    }
  }
}

/**
 * Manual "Sync now" for a single user. Looks up their connection (must be
 * connected; runs even if paused since it's an explicit action) and syncs.
 * Returns counts, or an error reason.
 */
export async function syncGoogleCalendarNow(
  userId: string,
): Promise<{ ok: true; pushed: number; removed: number } | { ok: false; error: string }> {
  const row = sqlite
    .prepare(
      `SELECT user_id AS userId, refresh_token AS refreshToken,
              access_token AS accessToken,
              access_expires_at AS accessExpiresAt,
              calendar_id AS calendarId
         FROM google_calendar_sync WHERE user_id = ?`,
    )
    .get(userId) as SyncRow | undefined
  if (!row) return { ok: false, error: "Connect Google Calendar first." }
  try {
    const result = await syncGoogleCalendarForUser(row)
    if (!result) {
      return { ok: false, error: "Couldn't reach Google — try reconnecting." }
    }
    return { ok: true, ...result }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Sync failed.",
    }
  }
}
