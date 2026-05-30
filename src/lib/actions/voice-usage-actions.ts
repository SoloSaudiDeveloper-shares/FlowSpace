"use server"

/**
 * Voice transcription usage stats (per-user).
 *
 * Groq doesn't expose a balance / quota endpoint, so the next-best
 * signal we can surface is how much WE'VE spent. The voice module
 * bumps `voice_usage_daily` on every successful transcription. This
 * action rolls up today's row + the trailing 7-day total so Settings
 * → Speech can show "Today: 12 transcriptions · ~3 min" plus a small
 * weekly trend.
 */

import { sqlite } from "@/lib/db"
import { requireAuth } from "@/lib/auth/scope"

export interface VoiceUsageStats {
  todayCount: number
  todaySeconds: number
  weekCount: number
  weekSeconds: number
  /** ISO yyyy-mm-dd buckets for the last 7 days (oldest → newest). */
  trend: { date: string; count: number; seconds: number }[]
}

function isoDate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10)
}

export async function getMyVoiceUsage(): Promise<VoiceUsageStats> {
  const me = await requireAuth()
  const today = isoDate()
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6) // include today
  const weekFloor = isoDate(sevenDaysAgo)

  const todayRow = sqlite
    .prepare(
      `SELECT COALESCE(count, 0) AS count, COALESCE(seconds, 0) AS seconds
         FROM voice_usage_daily WHERE user_id = ? AND date = ?`,
    )
    .get(me.id, today) as { count: number; seconds: number } | undefined

  const weekAgg = sqlite
    .prepare(
      `SELECT COALESCE(SUM(count), 0) AS count, COALESCE(SUM(seconds), 0) AS seconds
         FROM voice_usage_daily WHERE user_id = ? AND date >= ?`,
    )
    .get(me.id, weekFloor) as { count: number; seconds: number }

  // Fill the 7-day trend so days with no transcriptions still appear as 0.
  const rows = sqlite
    .prepare(
      `SELECT date, count, seconds FROM voice_usage_daily
        WHERE user_id = ? AND date >= ? ORDER BY date ASC`,
    )
    .all(me.id, weekFloor) as { date: string; count: number; seconds: number }[]
  const byDate = new Map(rows.map((r) => [r.date, r]))
  const trend: VoiceUsageStats["trend"] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = isoDate(d)
    const r = byDate.get(key)
    trend.push({ date: key, count: r?.count ?? 0, seconds: r?.seconds ?? 0 })
  }

  return {
    todayCount: todayRow?.count ?? 0,
    todaySeconds: todayRow?.seconds ?? 0,
    weekCount: weekAgg.count,
    weekSeconds: weekAgg.seconds,
    trend,
  }
}
