/**
 * Google Calendar one-way sync engine.
 *
 * Called by the cron every 5 minutes. For each connected user:
 *  - mint a fresh access token from their refresh token (if expired)
 *  - find tasks with a due_date that don't yet have a linked event
 *  - POST each one to /calendar/v3/calendars/{id}/events as an all-day
 *    event
 *  - record the event id in google_calendar_events for future updates
 *  - find linked events whose task was deleted or unscheduled, and
 *    delete them
 *
 * Failures are logged but never throw — one user's broken refresh
 * shouldn't block the others.
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

async function pushTask(
  accessToken: string,
  calendarId: string,
  task: { id: string; title: string; description: string | null; dueDate: string },
): Promise<string | null> {
  const date = task.dueDate.slice(0, 10)
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
        summary: task.title,
        description: (task.description ?? "") + "\n\n— from FlowSpace",
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
      const token = await ensureAccessToken(row)
      if (!token) continue
      // Tasks with due dates that haven't been pushed yet
      const newTasks = sqlite
        .prepare(
          `SELECT t.id, t.title, t.description, t.due_date AS dueDate
             FROM tasks t
        LEFT JOIN google_calendar_events g ON g.task_id = t.id
        LEFT JOIN elements e ON e.id = t.project_id
            WHERE e.created_by = ?
              AND t.due_date IS NOT NULL
              AND g.event_id IS NULL`,
        )
        .all(row.userId) as { id: string; title: string; description: string | null; dueDate: string }[]
      for (const task of newTasks) {
        const eventId = await pushTask(token, row.calendarId, task)
        if (eventId) {
          sqlite
            .prepare(
              `INSERT INTO google_calendar_events (task_id, event_id) VALUES (?, ?)`,
            )
            .run(task.id, eventId)
        }
      }
      // Orphans: linked event but task deleted/unscheduled
      const orphans = sqlite
        .prepare(
          `SELECT g.task_id AS taskId, g.event_id AS eventId
             FROM google_calendar_events g
        LEFT JOIN tasks t ON t.id = g.task_id
        LEFT JOIN elements e ON e.id = t.project_id
            WHERE (t.id IS NULL OR t.due_date IS NULL OR (e.created_by IS NULL OR e.created_by != ?))`,
        )
        .all(row.userId) as { taskId: string; eventId: string }[]
      for (const o of orphans) {
        const ok = await deleteEvent(token, row.calendarId, o.eventId)
        if (ok) {
          sqlite
            .prepare(`DELETE FROM google_calendar_events WHERE task_id = ?`)
            .run(o.taskId)
        }
      }
      sqlite
        .prepare(
          `UPDATE google_calendar_sync SET last_sync_at = datetime('now') WHERE user_id = ?`,
        )
        .run(row.userId)
    } catch (err) {
      console.error("[gcal-sync] user", row.userId, err)
    }
  }
}
