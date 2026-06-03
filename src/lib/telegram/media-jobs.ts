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
import { sendMessage, inlineKeyboard, getFile, fileDownloadUrl } from "@/lib/telegram/client"
import { captureRouterRows } from "@/lib/telegram/menus"
import { resolveGroqKey, transcribeAudioFile, transcribeAudioBytes } from "@/lib/telegram/voice"
import { checkBinaries, downloadMediaAudio } from "@/lib/telegram/media-download"
import { summarizeTranscript } from "@/lib/telegram/summarize"

// ── Tunables (env-overridable) ──────────────────────────────────────────
const MAX_DURATION_SEC = Number(process.env.MEDIA_CAPTURE_MAX_DURATION_SEC) || 1800
// Bounds the SOURCE video download (we keep only the extracted audio), so it's
// generous — the duration cap is the real guard. TikTok-style muxed videos can
// be large; we still only transcribe a few-MB mono-16kHz audio track.
const MAX_FILESIZE_MB = Number(process.env.MEDIA_CAPTURE_MAX_FILESIZE_MB) || 500
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
  source: string
  source_url: string | null
  file_id: string | null
  file_name: string | null
  platform: string | null
  language: string
}

// Map a file extension → mime type. Cloud transcribers (Groq) key off the
// filename EXTENSION, so labelling an upload correctly matters; local
// faster-whisper sniffs content and is unaffected.
const EXT_TO_MIME: Record<string, string> = {
  ogg: "audio/ogg", oga: "audio/ogg", opus: "audio/ogg",
  mp3: "audio/mpeg", mpga: "audio/mpeg", mpeg: "audio/mpeg",
  m4a: "audio/mp4", m4b: "audio/mp4", aac: "audio/aac",
  wav: "audio/wav", flac: "audio/flac", amr: "audio/amr",
  wma: "audio/x-ms-wma", mka: "audio/x-matroska", caf: "audio/x-caf",
  aif: "audio/aiff", aiff: "audio/aiff",
  mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime",
  webm: "video/webm", "3gp": "video/3gpp", "3gpp": "video/3gpp",
}
const MIME_TO_EXT: Record<string, string> = {
  "audio/ogg": "ogg", "application/ogg": "ogg", "audio/opus": "ogg", "audio/x-opus+ogg": "ogg",
  "audio/mpeg": "mp3", "audio/mp3": "mp3",
  "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/aac": "m4a", "audio/aacp": "m4a",
  "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav", "audio/vnd.wave": "wav",
  "audio/flac": "flac", "audio/x-flac": "flac",
  "audio/amr": "amr",
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "video/3gpp": "3gp",
}

function extOf(name: string): string {
  const m = /\.([a-z0-9]{1,5})$/i.exec(name.trim())
  return m ? m[1].toLowerCase() : ""
}

/**
 * Derive a transcriber-friendly { filename, mime } from whatever Telegram gave
 * us (a document file_name and/or a mime type). Prefers the real extension;
 * falls back to the mime; finally to ogg (Telegram voice notes are ogg/opus).
 */
export function resolveUploadName(
  fileName?: string | null,
  mime?: string | null,
): { filename: string; mime: string } {
  const base = (fileName ?? "").split(/[\\/]/).pop()?.slice(0, 120) ?? ""
  let ext = extOf(base)
  if (!ext && mime) ext = MIME_TO_EXT[mime.toLowerCase()] ?? ""
  if (!ext) ext = "ogg"
  const resolvedMime = EXT_TO_MIME[ext] ?? mime ?? "audio/ogg"
  // Keep the real name if it already carries a usable extension, else synthesize.
  const filename = extOf(base) ? base : `recording.${ext}`
  return { filename, mime: resolvedMime }
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
  // Media links are arbitrary internet clips in ANY language, so let Whisper
  // auto-detect rather than pinning the user's short-voice default (usually
  // "en", which would force-transcribe an Arabic clip as garbled English).
  const language = "auto"
  sqlite
    .prepare(
      `INSERT INTO transcription_jobs
         (id, user_id, source, bot_token, chat_id, message_id, source_url, platform, language, status)
       VALUES (?, ?, 'media_url', ?, ?, ?, ?, ?, ?, 'queued')`,
    )
    .run(id, args.userId, args.botToken, args.chatId, args.messageId, args.url, args.platform, language)
  return id
}

/** Enqueue a long/large UPLOADED audio file (voice note, audio, video note)
 *  for async transcription — the inline picker path can't handle these
 *  (Telegram callback deadline + tight engine timeouts). */
export function enqueueAudioJob(args: {
  userId: string
  botToken: string
  chatId: string
  messageId: number
  fileId: string
  durationSec?: number | null
  language?: string | null
  /** Original Telegram file name (documents) — used to label the upload. */
  fileName?: string | null
  /** Telegram-reported mime type (voice/audio/document). */
  mime?: string | null
}): string {
  const id = createId()
  // Long uploads can be any language (the user might forward an Arabic clip),
  // so default to auto-detect unless an explicit language was passed.
  const language = args.language || "auto"
  // Normalize to a transcriber-friendly filename now (we have the metadata
  // here); the worker re-derives the mime from this filename's extension.
  const { filename } = resolveUploadName(args.fileName, args.mime)
  sqlite
    .prepare(
      `INSERT INTO transcription_jobs
         (id, user_id, source, bot_token, chat_id, message_id, file_id, file_name, platform, duration_sec, language, status)
       VALUES (?, ?, 'audio_upload', ?, ?, ?, ?, ?, 'recording', ?, ?, 'queued')`,
    )
    .run(id, args.userId, args.botToken, args.chatId, args.messageId, args.fileId, filename, args.durationSec ?? null, language)
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

/** Download an uploaded Telegram file to bytes. Bound by Telegram's 20 MB
 *  getFile cap unless a self-hosted Bot API server is configured. */
async function downloadTelegramFile(
  botToken: string,
  fileId: string,
): Promise<{ ok: true; bytes: ArrayBuffer } | { ok: false; code: "too_large" | "download_failed"; error: string }> {
  const f = await getFile(botToken, fileId)
  if (!f.ok) {
    const tooBig = /too big/i.test(f.description || "")
    return { ok: false, code: tooBig ? "too_large" : "download_failed", error: f.description }
  }
  const p = f.result.file_path
  if (!p) return { ok: false, code: "download_failed", error: "No file_path returned by Telegram." }
  try {
    const res = await fetch(fileDownloadUrl(botToken, p), { signal: AbortSignal.timeout(120_000) })
    if (!res.ok) return { ok: false, code: "download_failed", error: `Download failed: ${res.status}` }
    return { ok: true, bytes: await res.arrayBuffer() }
  } catch (err) {
    return { ok: false, code: "download_failed", error: err instanceof Error ? err.message : "Download error" }
  }
}

async function processMediaJob(id: string): Promise<void> {
  const job = sqlite
    .prepare(
      `SELECT id, user_id, bot_token, chat_id, source, source_url, file_id, file_name, platform, language FROM transcription_jobs WHERE id = ?`,
    )
    .get(id) as JobRow | undefined
  if (!job) return

  const isUpload = job.source === "audio_upload"
  const platform = job.platform ?? (isUpload ? "recording" : "media")
  const workDir = path.join(getDataDir(), "uploads", "media-tmp", job.id)

  try {
    let transcript: string
    let metaTitle: string | null = null
    let sourceUrl: string | null = job.source_url
    const groqKey = resolveGroqKey(job.user_id)

    if (isUpload) {
      // ── Uploaded audio (voice note / audio / video note) ──────────────
      if (!job.file_id) {
        await failJob(job, "⚠️ Couldn't process that recording (missing file).", "no file_id")
        return
      }
      const dl = await downloadTelegramFile(job.bot_token, job.file_id)
      if (!dl.ok) {
        const userMsg =
          dl.code === "too_large"
            ? "⚠️ That recording is over Telegram's 20 MB bot download limit. To transcribe big files, the admin needs to run a self-hosted Telegram Bot API server (see TRANSCRIPTION.md)."
            : "⚠️ Couldn't download that recording from Telegram. Try sending it again."
        await failJob(job, userMsg, `${dl.code}: ${dl.error}`)
        return
      }
      setStatus(job.id, "transcribing")
      // Label the upload with its real extension/mime so the cloud engine
      // (Groq keys off the extension) accepts it; local whisper is unaffected.
      const { filename, mime } = resolveUploadName(job.file_name, null)
      const tr = await transcribeAudioBytes(dl.bytes, {
        groqApiKey: groqKey,
        language: job.language,
        ownerUserId: job.user_id,
        mime,
        filename,
        localTimeoutMs: 1_500_000, // 25 min — long recordings on a CPU box
        groqTimeoutMs: 120_000,
      })
      if (!tr.ok) {
        await failJob(job, `⚠️ Couldn't transcribe that recording: ${tr.error.slice(0, 160)}`, `transcribe: ${tr.error}`)
        return
      }
      transcript = tr.text
    } else {
      // ── Media URL (TikTok/YouTube/…) ──────────────────────────────────
      if (!job.source_url) return
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
              ? `⚠️ That ${platform} video is unusually large (over ${MAX_FILESIZE_MB} MB to download). Try a shorter clip.`
              : dl.code === "missing_binary"
                ? `⚠️ Can't process media links yet — yt-dlp/ffmpeg isn't installed on the server. Ask the admin.`
                : dl.code === "timeout"
                  ? `⚠️ Timed out downloading that ${platform} clip. Try again later.`
                  : `⚠️ Couldn't download that ${platform} clip. It may be private, region-locked, or unavailable.`
        await failJob(job, userMsg, `${dl.code}: ${dl.error}`)
        return
      }
      sqlite
        .prepare(`UPDATE transcription_jobs SET title = ?, duration_sec = ?, source_url = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(dl.title, dl.durationSec, dl.webpageUrl, job.id)
      metaTitle = dl.title
      sourceUrl = dl.webpageUrl

      setStatus(job.id, "transcribing")
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
      transcript = tr.text
    }

    sqlite
      .prepare(`UPDATE transcription_jobs SET transcript = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(transcript, job.id)

    // AI summary (optional — null if no provider / failure)
    setStatus(job.id, "summarizing")
    const summary = await summarizeTranscript(job.user_id, transcript)
    if (summary) {
      sqlite
        .prepare(`UPDATE transcription_jobs SET summary = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(summary, job.id)
    }

    // Capture as a todo (raw INSERT as the bot's user)
    setStatus(job.id, "saving")
    const { todoId, listTitle } = captureTodo(job.user_id, {
      summary,
      title: metaTitle,
      transcript,
      url: sourceUrl,
      platform,
    })
    sqlite
      .prepare(`UPDATE transcription_jobs SET status = 'done', result_todo_id = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(todoId, job.id)

    // Notify
    const headline = firstLine(summary) ?? metaTitle ?? transcript.slice(0, 80)
    const body = [
      isUpload ? `✅ Transcribed your recording → ${listTitle}` : `✅ Captured from ${platform} → ${listTitle}`,
      ``,
      headline,
      summary ? `\n${summary}` : ``,
      sourceUrl ? `\n🔗 ${sourceUrl}` : ``,
    ]
      .filter((l) => l !== "")
      .join("\n")
    // Plain text (no parseMode) — transcript/summary can contain arbitrary
    // characters that would break Telegram's Markdown parser.
    await sendMessage(job.bot_token, job.chat_id, body, {
      replyMarkup: inlineKeyboard(captureRouterRows(todoId)),
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
  data: { summary: string | null; title: string | null; transcript: string; url: string | null; platform: string },
): { todoId: string; listTitle: string } {
  const todoTitle = (firstLine(data.summary) ?? data.title ?? data.transcript.slice(0, 80) ?? "Media capture").slice(0, 200)
  const notesParts: string[] = []
  if (data.url) notesParts.push(`Source: ${data.url}`)
  notesParts.push(`From: ${data.platform}`)
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
