/**
 * Registered cron jobs.
 *
 * Importing this module side-effect-registers every job into the cron
 * runner. The cron singleton's tick loop then invokes them every minute.
 *
 * Jobs MUST be idempotent. The cleanest pattern:
 *   1. SELECT pending work + a "last attempt" marker
 *   2. UPDATE the marker before doing the side-effect
 *   3. Do the work
 * If we crash between (2) and (3), the work is lost for that user but
 * we don't spam them with duplicates — strongly preferred direction.
 */

import "server-only"
import { sqlite } from "@/lib/db"
import { registerJob } from "@/lib/cron"
import {
  sendMessage,
  inlineKeyboard,
} from "@/lib/telegram/client"
import { dispatchTelegramMessage } from "@/lib/telegram/agent"

// ─── Job 1: fire due reminders as Telegram DMs ──────────────────────────

registerJob({
  name: "telegram:remind",
  async run() {
    const now = new Date().toISOString()
    // All due reminders for users who (a) have a connected bot, (b) have
    // a chat_id (i.e. messaged the bot at least once), and (c) we haven't
    // already fired this specific reminder.
    const rows = sqlite
      .prepare(
        `SELECT r.id, e.title, r.remind_at, tb.bot_token, tb.chat_id
         FROM reminders r
         INNER JOIN elements e ON e.id = r.id
         INNER JOIN telegram_bots tb ON tb.user_id = e.created_by
         WHERE r.is_dismissed = 0
           AND r.bot_fired_at IS NULL
           AND r.remind_at <= ?
           AND tb.is_active = 1
           AND tb.chat_id IS NOT NULL
           AND e.is_deleted = 0
           AND e.is_archived = 0
         LIMIT 50`,
      )
      .all(now) as {
        id: string
        title: string
        remind_at: string
        bot_token: string
        chat_id: string
      }[]

    for (const r of rows) {
      // Mark fired BEFORE sending so a crash mid-flight doesn't re-DM.
      sqlite
        .prepare(`UPDATE reminders SET bot_fired_at = datetime('now') WHERE id = ?`)
        .run(r.id)
      const text = [
        `🔔 *Reminder*`,
        ``,
        `_${escMd(r.title)}_`,
      ].join("\n")
      await sendMessage(r.bot_token, r.chat_id, text, {
        parseMode: "Markdown",
        replyMarkup: inlineKeyboard([
          [
            { text: "Snooze 1h", callback_data: `r:s:${r.id.slice(0, 12)}:1h` },
            { text: "Snooze 1d", callback_data: `r:s:${r.id.slice(0, 12)}:1d` },
          ],
          [{ text: "✅ Dismiss", callback_data: `r:d:${r.id.slice(0, 12)}` }],
        ]),
      }).catch(() => undefined) // best-effort; the user will see it next time if Telegram is down
    }
  },
})

// ─── Job 2: daily morning digest ────────────────────────────────────────

registerJob({
  name: "telegram:digest",
  async run() {
    // We only check time-of-day in 1-minute resolution. For each bot whose
    // digest_time matches NOW (HH:MM in SERVER local time) and which hasn't
    // sent today's digest, send one.
    const d = new Date()
    const hh = String(d.getHours()).padStart(2, "0")
    const mm = String(d.getMinutes()).padStart(2, "0")
    const nowHHMM = `${hh}:${mm}`
    const todayDate = d.toISOString().slice(0, 10)

    const due = sqlite
      .prepare(
        `SELECT user_id, bot_token, chat_id FROM telegram_bots
         WHERE is_active = 1
           AND digest_enabled = 1
           AND digest_time = ?
           AND chat_id IS NOT NULL
           AND (digest_last_sent IS NULL OR substr(digest_last_sent, 1, 10) <> ?)
         LIMIT 100`,
      )
      .all(nowHHMM, todayDate) as {
        user_id: string
        bot_token: string
        chat_id: string
      }[]

    for (const b of due) {
      // Mark sent BEFORE doing the work to prevent dupes.
      sqlite
        .prepare(`UPDATE telegram_bots SET digest_last_sent = datetime('now') WHERE user_id = ?`)
        .run(b.user_id)
      const text = await buildDigest(b.user_id)
      await sendMessage(b.bot_token, b.chat_id, text, {
        parseMode: "Markdown",
        replyMarkup: inlineKeyboard([[{ text: "🏠 Menu", callback_data: "menu:main" }]]),
      }).catch(() => undefined)
    }
  },
})

async function buildDigest(userId: string): Promise<string> {
  // Compare on date boundaries: task due dates are stored date-only
  // ("YYYY-MM-DD") in most paths, so a raw string compare against a full ISO
  // timestamp mis-classifies "due today" as overdue. date(...) normalizes both.
  const overdue = sqlite
    .prepare(
      `SELECT COUNT(*) AS n FROM tasks t INNER JOIN elements e ON e.id = t.project_id
       WHERE e.created_by = ? AND t.due_date IS NOT NULL
         AND date(t.due_date) < date('now','localtime')
         AND t.status_id NOT IN (SELECT id FROM task_statuses WHERE is_done_state = 1)`,
    )
    .get(userId) as { n: number }

  const dueToday = sqlite
    .prepare(
      `SELECT t.title, e.title AS project_title FROM tasks t INNER JOIN elements e ON e.id = t.project_id
       WHERE e.created_by = ? AND date(t.due_date) = date('now','localtime')
         AND t.status_id NOT IN (SELECT id FROM task_statuses WHERE is_done_state = 1)
       ORDER BY t.priority DESC LIMIT 10`,
    )
    .all(userId) as { title: string; project_title: string }[]

  const lines = [
    "🌅 *Good morning — your day at a glance*",
    "",
  ]
  if (overdue.n > 0) lines.push(`⚠️ *${overdue.n} overdue* — handle these first`)
  if (dueToday.length === 0) {
    lines.push("🎉 Nothing due today.")
  } else {
    lines.push(`*Due today (${dueToday.length})*`)
    for (const t of dueToday) {
      lines.push(`• ${escMd(t.title)} _(${escMd(t.project_title)})_`)
    }
  }
  return lines.join("\n")
}

function escMd(s: string): string {
  return s.replace(/[*_`[\]]/g, "\\$&")
}

// ─── Job 2.5: end-of-day digest ────────────────────────────────────────
// Mirror of morning digest. Sends an evening summary: today's completions
// + slipped items + tomorrow's load. Helps close the loop on a workday.

registerJob({
  name: "telegram:digest-evening",
  async run() {
    const d = new Date()
    const hh = String(d.getHours()).padStart(2, "0")
    const mm = String(d.getMinutes()).padStart(2, "0")
    const nowHHMM = `${hh}:${mm}`
    const todayDate = d.toISOString().slice(0, 10)

    const due = sqlite
      .prepare(
        `SELECT user_id, bot_token, chat_id FROM telegram_bots
         WHERE is_active = 1
           AND digest_evening_enabled = 1
           AND digest_evening_time = ?
           AND chat_id IS NOT NULL
           AND (digest_evening_last_sent IS NULL OR substr(digest_evening_last_sent, 1, 10) <> ?)
         LIMIT 100`,
      )
      .all(nowHHMM, todayDate) as {
        user_id: string
        bot_token: string
        chat_id: string
      }[]

    for (const b of due) {
      sqlite
        .prepare(`UPDATE telegram_bots SET digest_evening_last_sent = datetime('now') WHERE user_id = ?`)
        .run(b.user_id)
      const text = await buildEveningDigest(b.user_id)
      await sendMessage(b.bot_token, b.chat_id, text, {
        parseMode: "Markdown",
        replyMarkup: inlineKeyboard([[{ text: "🏠 Menu", callback_data: "menu:main" }]]),
      }).catch(() => undefined)
    }
  },
})

async function buildEveningDigest(userId: string): Promise<string> {
  const startOfTodayIso = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()

  // Today's completions (completed_at is a full ISO timestamp, so a timestamp
  // compare is correct here).
  const completed = sqlite
    .prepare(
      `SELECT COUNT(*) AS n FROM tasks t INNER JOIN elements e ON e.id = t.project_id
       WHERE e.created_by = ? AND t.completed_at >= ?`,
    )
    .get(userId, startOfTodayIso) as { n: number }
  // Today's todo items checked off
  const todosDone = sqlite
    .prepare(
      `SELECT COUNT(*) AS n FROM todo_items ti INNER JOIN elements e ON e.id = ti.list_id
       WHERE e.created_by = ? AND ti.is_completed = 1 AND ti.completed_at >= ?`,
    )
    .get(userId, startOfTodayIso) as { n: number }
  // What slipped — tasks that were due today and are not done (date-normalized)
  const slipped = sqlite
    .prepare(
      `SELECT COUNT(*) AS n FROM tasks t INNER JOIN elements e ON e.id = t.project_id
       WHERE e.created_by = ? AND date(t.due_date) = date('now','localtime')
         AND t.status_id NOT IN (SELECT id FROM task_statuses WHERE is_done_state = 1)`,
    )
    .get(userId) as { n: number }
  // Tomorrow's load (date-normalized)
  const tomorrow = sqlite
    .prepare(
      `SELECT t.title, e.title AS project_title FROM tasks t INNER JOIN elements e ON e.id = t.project_id
       WHERE e.created_by = ? AND date(t.due_date) = date('now','localtime','+1 day')
         AND t.status_id NOT IN (SELECT id FROM task_statuses WHERE is_done_state = 1)
       ORDER BY t.priority DESC LIMIT 10`,
    )
    .all(userId) as { title: string; project_title: string }[]

  const lines = [
    "🌙 *Day wrap-up*",
    "",
  ]
  if (completed.n > 0 || todosDone.n > 0) {
    lines.push(`✅ Completed today: ${completed.n} task${completed.n === 1 ? "" : "s"} · ${todosDone.n} todo item${todosDone.n === 1 ? "" : "s"}`)
  } else {
    lines.push("✅ Nothing logged complete today. Tomorrow's a fresh start.")
  }
  if (slipped.n > 0) {
    lines.push(`⚠️ Slipped to tomorrow: *${slipped.n}* task${slipped.n === 1 ? "" : "s"}`)
  }
  if (tomorrow.length > 0) {
    lines.push("")
    lines.push(`*Tomorrow's load (${tomorrow.length})*`)
    for (const t of tomorrow) {
      lines.push(`• ${escMd(t.title)} _(${escMd(t.project_title)})_`)
    }
  } else {
    lines.push("")
    lines.push("🌤 Tomorrow looks light. Good day to plan something.")
  }
  return lines.join("\n")
}

// ─── Job 3: clean up stale pending voice messages ──────────────────────
// User received a voice picker but abandoned it. After 1 hour the
// pending row is meaningless — Telegram's file_id may expire too.

registerJob({
  name: "telegram:pending-voices",
  run() {
    // IMPORTANT: use SQLite's own `datetime()` for the cutoff. The
    // `created_at` column is populated by `datetime('now')` which gives
    // `"YYYY-MM-DD HH:MM:SS"` (space separator). Comparing against
    // `new Date().toISOString()` (`T` separator) would be a string-sort
    // mismatch — every row would look "older" than the cutoff and get
    // deleted on first tick.
    sqlite
      .prepare(`DELETE FROM pending_voices WHERE created_at < datetime('now', '-1 hour')`)
      .run()
  },
})

// ─── Job 5: Google Calendar sync (every 5 minutes) ──────────────────────
//
// Pushes tasks-with-due-dates to each connected user's Google Calendar
// as all-day events. Idempotent: tracked by google_calendar_events
// (task_id ↔ event_id). Skips silently when GOOGLE_CLIENT_ID isn't set.

let gcalLastRun = 0
registerJob({
  name: "calendar:google-sync",
  async run() {
    // Throttle to every 5 minutes (300_000ms).
    const now = Date.now()
    if (now - gcalLastRun < 300_000) return
    gcalLastRun = now
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return
    }
    const { syncGoogleCalendarForAllUsers } = await import(
      "@/lib/calendar/google-sync"
    )
    await syncGoogleCalendarForAllUsers().catch((err) =>
      console.error("[gcal-sync]", err),
    )
  },
})

// Keep the imported-but-unused symbol around so esbuild doesn't drop it.
void dispatchTelegramMessage
