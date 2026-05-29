"use server"

/**
 * Habits CRUD + check-ins + streak computation.
 *
 * A habit is a recurring intention ("meditate 10 minutes daily").
 * Each day the user check-ins to mark it done. The streak is the count
 * of consecutive days ending today (or yesterday — we don't break the
 * streak until the second missed day).
 */

import { sqlite } from "@/lib/db"
import { requireAuth } from "@/lib/auth/scope"
import { createId } from "@/lib/utils/ids"

export type HabitCadence = "daily" | "weekly" | "custom"

export interface Habit {
  id: string
  name: string
  icon: string | null
  color: string | null
  cadence: HabitCadence
  isArchived: boolean
  sortOrder: number
  createdAt: string
  // Computed
  currentStreak: number
  doneToday: boolean
}

function isoDate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10)
}

export async function listMyHabits(): Promise<Habit[]> {
  const me = await requireAuth()
  const rows = sqlite
    .prepare(
      `SELECT id, name, icon, color, cadence, is_archived AS isArchived,
              sort_order AS sortOrder, created_at AS createdAt
         FROM habits
        WHERE user_id = ? AND is_archived = 0
        ORDER BY sort_order ASC, created_at ASC`,
    )
    .all(me.id) as Omit<Habit, "currentStreak" | "doneToday">[]
  // Single round-trip: pull all entries grouped by habit id for the
  // last 60 days; compute streak in JS.
  const cutoff = new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10)
  const entries = sqlite
    .prepare(
      `SELECT h.id AS habitId, e.date
         FROM habits h
         JOIN habit_entries e ON e.habit_id = h.id
        WHERE h.user_id = ? AND e.date >= ?`,
    )
    .all(me.id, cutoff) as { habitId: string; date: string }[]
  const byHabit = new Map<string, Set<string>>()
  for (const e of entries) {
    if (!byHabit.has(e.habitId)) byHabit.set(e.habitId, new Set())
    byHabit.get(e.habitId)!.add(e.date)
  }
  const today = isoDate()
  return rows.map((row) => {
    const dates = byHabit.get(row.id) ?? new Set<string>()
    const doneToday = dates.has(today)
    // Walk backwards from today
    let streak = 0
    const cursor = new Date()
    if (!doneToday) cursor.setDate(cursor.getDate() - 1)
    while (dates.has(isoDate(cursor))) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    }
    return {
      ...row,
      isArchived: row.isArchived as unknown as boolean,
      currentStreak: streak,
      doneToday,
    }
  })
}

export async function createHabit(input: {
  name: string
  icon?: string
  color?: string
  cadence?: HabitCadence
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const me = await requireAuth()
  const name = input.name.trim()
  if (!name) return { ok: false, error: "Name is required." }
  const id = createId()
  sqlite
    .prepare(
      `INSERT INTO habits (id, user_id, name, icon, color, cadence)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      me.id,
      name.slice(0, 100),
      input.icon ?? null,
      input.color ?? null,
      input.cadence ?? "daily",
    )
  return { ok: true, id }
}

export async function checkInHabit(
  habitId: string,
  date?: string,
): Promise<{ ok: true; doneToday: boolean }> {
  const me = await requireAuth()
  const owner = sqlite
    .prepare(`SELECT user_id FROM habits WHERE id = ?`)
    .get(habitId) as { user_id: string } | undefined
  if (!owner || owner.user_id !== me.id) {
    throw new Error("Forbidden")
  }
  const d = date ?? isoDate()
  // Toggle — if entry exists, remove; else insert
  const existing = sqlite
    .prepare(`SELECT id FROM habit_entries WHERE habit_id = ? AND date = ?`)
    .get(habitId, d) as { id: string } | undefined
  if (existing) {
    sqlite.prepare(`DELETE FROM habit_entries WHERE id = ?`).run(existing.id)
    return { ok: true, doneToday: false }
  }
  sqlite
    .prepare(
      `INSERT INTO habit_entries (id, habit_id, date) VALUES (?, ?, ?)`,
    )
    .run(createId(), habitId, d)
  return { ok: true, doneToday: true }
}

export async function archiveHabit(
  habitId: string,
): Promise<{ ok: true }> {
  const me = await requireAuth()
  sqlite
    .prepare(`UPDATE habits SET is_archived = 1 WHERE id = ? AND user_id = ?`)
    .run(habitId, me.id)
  return { ok: true }
}
