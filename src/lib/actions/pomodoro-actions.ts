"use server"

/**
 * Pomodoro session logging.
 *
 * The widget keeps its own client-side timer; we only persist completed
 * sessions for stats. A "session" is one focus block (default 25 min)
 * or a break block (5 / 15 min).
 *
 * Stats live on the home dashboard ("today's focus" tile) and in
 * weekly stats. Failure to log a session is non-fatal — we'd rather
 * miss a stats entry than break the timer.
 */

import { sqlite } from "@/lib/db"
import { requireAuth } from "@/lib/auth/scope"
import { createId } from "@/lib/utils/ids"

export type PomodoroKind = "focus" | "short_break" | "long_break"

export interface PomodoroStats {
  todayFocusMinutes: number
  todayCount: number
  weekFocusMinutes: number
}

export async function logPomodoroSession(input: {
  taskId?: string | null
  kind: PomodoroKind
  durationSec: number
  completed: boolean
}): Promise<{ ok: true }> {
  const me = await requireAuth()
  const now = new Date()
  sqlite
    .prepare(
      `INSERT INTO pomodoro_sessions (id, user_id, task_id, started_at, ended_at, duration_sec, kind, completed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      createId(),
      me.id,
      input.taskId ?? null,
      new Date(now.getTime() - input.durationSec * 1000).toISOString(),
      now.toISOString(),
      Math.max(0, Math.floor(input.durationSec)),
      input.kind,
      input.completed ? 1 : 0,
    )
  return { ok: true }
}

export async function getMyPomodoroStats(): Promise<PomodoroStats> {
  const me = await requireAuth()
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const weekAgo = new Date(Date.now() - 7 * 86400_000)

  const today = sqlite
    .prepare(
      `SELECT COALESCE(SUM(duration_sec), 0) AS sec, COUNT(*) AS n
         FROM pomodoro_sessions
        WHERE user_id = ? AND kind = 'focus' AND completed = 1 AND started_at >= ?`,
    )
    .get(me.id, startOfToday.toISOString()) as { sec: number; n: number }

  const week = sqlite
    .prepare(
      `SELECT COALESCE(SUM(duration_sec), 0) AS sec
         FROM pomodoro_sessions
        WHERE user_id = ? AND kind = 'focus' AND completed = 1 AND started_at >= ?`,
    )
    .get(me.id, weekAgo.toISOString()) as { sec: number }

  return {
    todayFocusMinutes: Math.round(today.sec / 60),
    todayCount: today.n,
    weekFocusMinutes: Math.round(week.sec / 60),
  }
}
