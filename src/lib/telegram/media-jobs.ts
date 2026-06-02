/**
 * Async media-link transcription pipeline (single-flight worker).
 *
 * Flow:
 *   webhook detects a media URL → enqueueMediaJob() inserts a `queued` row
 *   and the webhook acks instantly. A worker then drains the queue ONE job
 *   at a time: yt-dlp download → transcribe (local-first/Groq) → AI summary
 *   → capture a todo → DM the user.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ CRITICAL: the heavy work (processMediaJob) is launched UN-AWAITED from │
 * │ runMediaWorkerTick. The cron tick awaits jobs sequentially, so if this │
 * │ ever blocks the tick, every user's reminders/digests freeze for the    │
 * │ duration of a multi-minute download. Do NOT `await processMediaJob`    │
 * │ inside the tick. The in-memory `isProcessing` flag guarantees only one │
 * │ yt-dlp/ffmpeg runs at a time (important on the small ARM VM).          │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * Durability: a DB watchdog re-queues jobs left in a non-terminal status
 * with a stale `updated_at` (e.g. the process restarted mid-job). The
 * `isProcessing` flag is a module-level `let`, so it resets to false on boot.
 */

import "server-only"
import path from "node:path"
import { mkdir, rm } from "node:fs/promises"
import { sqlite } from "@/lib/db"
import { createId } from "@/lib/utils/ids"
import { getDataDir } from "@/lib/utils/data-dir"
import { sendMessage, inlineKeyboard } from "@/lib/telegram/client"
import { resolveGroqKey, transcribeAudioFile } from "@/lib/telegram/voice"
import { checkBinaries, downloadMediaAudio } from "@/lib/telegram/media-download"
import { summarizeTranscript } from "@/lib/telegram/summarize"

// ── Tunables (env-overridable) ──────────────────────────────────────────
const MAX_DURATION_SEC = Number(process.env.MEDIA_CAPTURE_MAX_DURATION_SEC) || 1800
const MAX_FILESIZE_MB = Number(process.env.MEDIA_CAPTURE_MAX_FILESIZE_MB) || 50
const DOWNLOAD_TIMEOUT_MS = Number(process.env.MEDIA_CAPTURE_TIMEOUT_MS) || 300_000
const MAX_ATTEMPTS = 3
const STALE = "-15 minutes" // watchdog threshold for SQLite datetime()

const NON_TERMINAL = "('downloading','transcribing','summarizing','saving')"

// ── Single-flight guard (per process) ───────────────────────────────────
let isProcessing = false

interface JobRow {
  id: string
  user_id: string
  bot_token: string
  chat_id: string
  source_url: string | null
  platform: string | null
  language: string
}

// ── Enqueue ─────────────────────────────────────────────────────────────

export function enqueueMediaJob(args: {
  userId: string
  botToken: string
  chatId: string
  messageId: number
  url: string
  platform: string
}): string {
  const id = createId()
  // Pin the transcription language to the user's voice preference if set.
  const pref = sqlite
    .prepare(`SELECT voice_language FROM telegram_bots WHERE user_id = ?`)
    .get(args.userId) as { voice_language: string | null } | undefined
  const language = pref?.voice_language || "en"
  sqlite
    .prepare(
      `INSERT INTO transcription_jobs
         (id, user_id, source, bot_token, chat_id, message_id, source_url, platform, language, status)
       VALUES (?, ?, 'media_url', ?, ?, ?, ?, ?, ?, 'queued')`,
    )
    .run(id, args.userId, args.botToken, args.chatId, args.messageId, args.url, args.platform, language)
  return id
}

/** Fire-and-forget nudge so a freshly-enqueued job starts without waiting
 *  for the next 60s cron tick. Safe to call repeatedly. */
export function kickMediaWorker(): void {
  setTimeout(() => {
    void runMediaWorkerTick()
  }, 0)
}

// ── Worker tick (called by cron AND by kickMediaWorker) ─────────────────

export async function runMediaWorkerTick(): Promise<void> {
  requeueStaleJobs()
  if (isProcessing) return

  const row = sqlite
    .prepare(`SELECT id FROM transcription_jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1`)
    .get() as { id: string } | undefined
  if (!row) return

  // Atomic claim — increment attempts so the watchdog can give up eventually.
  const claim = sqlite
    .prepare(
      `UPDATE transcription_jobs
         SET status = 'downloading', attempts = attempts + 1, updated_at = datetime('now')
       WHERE id = ? AND status = 'queued'`,
    )
    .run(row.id)
  if (claim.changes !== 1) return // someone else claimed it

  isProcessing = true
  // INTENTIONALLY NOT AWAITED — see file header.
  void processMediaJob(row.id).finally(() => {
    isProcessing = false
    kickMediaWorker() // drain the next queued job, if any
  })
}

/** Re-queue jobs stuck in a non-terminal status past the stale threshold,
 *  and permanently fail those that have exhausted their attempts. */
function requeueStaleJobs(): void {
  try {
    const exhausted = sqlite
      .prepare(
        `SELECT id, bot_token, chat_id, platform FROM transcription_jobs
          WHERE status IN ${NON_TERMINAL}
            AND attempts >= ?
            AND updated_at < datetime('now', ?)`,
      )
      .all(MAX_ATTEMPTS, STALE) as { id: string; bot_token: string; chat_id: string; platform: string | null }[]
    for (const j of exhausted) {
      sqlite
        .prepare(
          `UPDATE transcription_jobs SET status = 'failed', error = 'Gave up after repeated failures.', updated_at = datetime('now') WHERE id = ?`,
        )
        .run(j.id)
      void sendMessage(
        j.bot_token,
        j.chat_id,
        `⚠️ Couldn't process that ${j.platform ?? "media"} clip after a few tries. The server may be missing yt-dlp/ffmpeg, or the clip is unavailable.`,
      ).catch(() => undefined)
    }
    sqlite
      .prepare(
        `UPDATE transcription_jobs
            SET status = 'queued', updated_at = datetime('now')
          WHERE status IN ${NON_TERMINAL}
            AND attempts < ?
            AND updated_at < datetime('now', ?)`,
      )
      .run(MAX_ATTEMPTS, STALE)
  } catch (err) {
    console.error("[media-jobs] watchdog failed:", err)
  }
}

// ── Job processing ──────────────────────────────────────────────────────

function setStatus(id: string, status: string): void {
  sqlite
    .prepare(`UPDATE transcription_jobs SET status = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(status, id)
}

async function failJob(job: JobRow, userMessage: string, errorDetail: string): Promise<void> {
  sqlite
    .prepare(`UPDATE transcription_jobs SET status = 'failed', error = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(errorDetail.slice(0, 500), job.id)
  await sendMessage(job.bot_token, job.chat_id, userMessage).catch(() => undefined)
}

async function processMediaJob(id: string): Promise<void> {
  const job = sqlite
    .prepare(
      `SELECT id, user_id, bot_token, chat_id, source_url, platform, language FROM transcription_jobs WHERE id = ?`,
    )
    .get(id) as JobRow | undefined
  if (!job || !job.source_url) return

  const platform = job.platform ?? "media"
  const workDir = path.join(getDataDir(), "uploads", "media-tmp", job.id)

  try {
    // 0) binaries present?
    const bins = await checkBinaries()
    if (!bins.ytdlp || !bins.ffmpeg) {
      const missing = [!bins.ytdlp && "yt-dlp", !bins.ffmpeg && "ffmpeg"].filter(Boolean).join(" + ")
      await failJob(
        job,
        `⚠️ Can't process media links yet — ${missing} isn't installed on the server. Ask the admin to install it (see TRANSCRIPTION.md).`,
        `missing_binary: ${missing}`,
      )
      return
    }

    // 1) download + extract audio
    await mkdir(workDir, { recursive: true })
    const dl = await downloadMediaAudio(job.source_url, {
      workDir,
      maxDurationSec: MAX_DURATION_SEC,
      maxFileSizeMb: MAX_FILESIZE_MB,
      timeoutMs: DOWNLOAD_TIMEOUT_MS,
    })
    if (!dl.ok) {
      const userMsg =
        dl.code === "too_long"
          ? `⚠️ That ${platform} clip is too long to transcribe (limit ${Math.round(MAX_DURATION_SEC / 60)} min).`
          : dl.code === "too_large"
            ? `⚠️ That ${platform} clip's audio is too large to transcribe (limit ${MAX_FILESIZE_MB} MB).`
            : dl.code === "missing_binary"
              ? `⚠️ Can't process media links yet — yt-dlp/ffmpeg isn't installed on the server. Ask the admin.`
              : dl.code === "timeout"
                ? `⚠️ Timed out downloading that ${platform} clip. Try again later.`
                : `⚠️ Couldn't download that ${platform} clip. It may be private, region-locked, or unavailable.`
      await failJob(job, userMsg, `${dl.code}: ${dl.error}`)
      return
    }

    // persist metadata
    sqlite
      .prepare(`UPDATE transcription_jobs SET title = ?, duration_sec = ?, source_url = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(dl.title, dl.durationSec, dl.webpageUrl, job.id)

    // 2) transcribe (local-first → Groq). Media gets a generous local
    //    timeout since a long clip on a CPU box is slow.
    setStatus(job.id, "transcribing")
    const groqKey = resolveGroqKey(job.user_id)
    const tr = await transcribeAudioFile(dl.audioPath, {
      groqApiKey: groqKey,
      language: job.language,
      ownerUserId: job.user_id,
      mime: "audio/mpeg",
      filename: "media.mp3",
      localTimeoutMs: 1_500_000, // 25 min
      groqTimeoutMs: 120_000,
    })
    if (!tr.ok) {
      await failJob(
        job,
        `⚠️ Downloaded the ${platform} clip but couldn't transcribe it: ${tr.error.slice(0, 160)}`,
        `transcribe: ${tr.error}`,
      )
      return
    }
    const transcript = tr.text
    sqlite
      .prepare(`UPDATE transcription_jobs SET transcript = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(transcript, job.id)

    // 3) AI summary (optional — null if no provider / failure)
    setStatus(job.id, "summarizing")
    const summary = await summarizeTranscript(job.user_id, transcript)
    if (summary) {
      sqlite
        .prepare(`UPDATE transcription_jobs SET summary = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(summary, job.id)
    }

    // 4) capture as a todo (raw INSERT as the bot's user)
    setStatus(job.id, "saving")
    const { todoId, listTitle } = captureTodo(job.user_id, {
      summary,
      title: dl.title,
      transcript,
      url: dl.webpageUrl,
      platform,
    })
    sqlite
      .prepare(`UPDATE transcription_jobs SET status = 'done', result_todo_id = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(todoId, job.id)

    // 5) notify
    const headline = firstLine(summary) ?? dl.title ?? transcript.slice(0, 80)
    const body = [
      `✅ Captured from ${platform} → ${listTitle}`,
      ``,
      headline,
      summary ? `\n${summary}` : ``,
      ``,
      `🔗 ${dl.webpageUrl}`,
    ]
      .filter((l) => l !== undefined)
      .join("\n")
    // Plain text (no parseMode) — transcript/summary can contain arbitrary
    // characters that would break Telegram's Markdown parser.
    await sendMessage(job.bot_token, job.chat_id, body, {
      replyMarkup: inlineKeyboard([
        [
          { text: "↩️ Undo", callback_data: `undo:todo:${todoId}` },
          { text: "🏠 Menu", callback_data: "menu:main" },
        ],
      ]),
    }).catch(() => undefined)
  } catch (err) {
    await failJob(
      job,
      `⚠️ FlowSpace hit an error processing that ${platform} clip.`,
      err instanceof Error ? err.message : String(err),
    ).catch(() => undefined)
  } finally {
    // Always clean the scratch dir.
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

// ── Capture helper (mirrors callbacks.ts captureToDefault/captureToList) ──

function firstLine(s: string | null): string | null {
  if (!s) return null
  const line = s.split(/\r?\n/).map((l) => l.trim()).find(Boolean)
  return line ? line.slice(0, 120) : null
}

function resolveTargetList(userId: string): string {
  const target = sqlite
    .prepare(`SELECT target_list_id FROM telegram_bots WHERE user_id = ?`)
    .get(userId) as { target_list_id: string | null } | undefined
  let listId = target?.target_list_id ?? null
  if (!listId) {
    const row = sqlite
      .prepare(
        `SELECT id FROM elements WHERE created_by = ? AND type = 'todo_list'
           AND is_archived = 0 AND is_deleted = 0 ORDER BY updated_at DESC LIMIT 1`,
      )
      .get(userId) as { id: string } | undefined
    listId = row?.id ?? null
  }
  if (!listId) {
    listId = createId()
    const now = new Date().toISOString()
    sqlite
      .prepare(`INSERT INTO elements (id, type, title, created_by, created_at, updated_at) VALUES (?, 'todo_list', 'Inbox', ?, ?, ?)`)
      .run(listId, userId, now, now)
    sqlite.prepare(`INSERT INTO todo_lists (id) VALUES (?)`).run(listId)
  }
  return listId
}

function captureTodo(
  userId: string,
  data: { summary: string | null; title: string | null; transcript: string; url: string; platform: string },
): { todoId: string; listTitle: string } {
  const todoTitle = (firstLine(data.summary) ?? data.title ?? data.transcript.slice(0, 80) ?? "Media capture").slice(0, 200)
  const notesParts = [`Source: ${data.url}`, `Platform: ${data.platform}`]
  if (data.summary) notesParts.push("", data.summary)
  notesParts.push("", "— Transcript —", data.transcript.slice(0, 8000))
  const notes = notesParts.join("\n")

  const todoId = createId()
  const tx = sqlite.transaction((listId: string) => {
    const max = sqlite
      .prepare(`SELECT COALESCE(MAX(sort_order), -1) AS m FROM todo_items WHERE list_id = ?`)
      .get(listId) as { m: number }
    sqlite
      .prepare(
        `INSERT INTO todo_items (id, list_id, title, is_completed, sort_order, due_date, notes, created_at)
         VALUES (?, ?, ?, 0, ?, NULL, ?, datetime('now'))`,
      )
      .run(todoId, listId, todoTitle, max.m + 1, notes)
    sqlite.prepare(`UPDATE elements SET updated_at = datetime('now') WHERE id = ?`).run(listId)
  })
  const listId = resolveTargetList(userId)
  tx(listId)
  const listRow = sqlite.prepare(`SELECT title FROM elements WHERE id = ?`).get(listId) as { title: string } | undefined
  return { todoId, listTitle: listRow?.title ?? "Inbox" }
}
