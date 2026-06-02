/**
 * Media download + audio extraction via yt-dlp (which delegates to ffmpeg).
 *
 * This is the ONE genuinely new external stage in the media-link pipeline.
 * yt-dlp handles TikTok / YouTube / Instagram / X / etc. and `-x` rips the
 * audio track; ffmpeg (invoked by yt-dlp) post-processes it to mp3 so the
 * Whisper engines get a friendly format.
 *
 * SECURITY: we ALWAYS use `execFile` with an args ARRAY — never a shell
 * string. The URL is passed as a literal argv element, so even though it's
 * already been validated by `detectMediaUrl`, there is no shell-injection
 * surface. SSRF is bounded by the host allowlist + `--no-playlist`.
 *
 * GRACEFUL DEGRADATION: if yt-dlp or ffmpeg isn't installed, we return a
 * structured `missing_binary` error instead of throwing — the worker turns
 * that into a clear "ask the admin" reply and never crashes the process.
 */

import "server-only"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { stat } from "node:fs/promises"
import path from "node:path"

const execFileP = promisify(execFile)

const YTDLP_BIN = process.env.YTDLP_BIN || "yt-dlp"
const FFMPEG_BIN = process.env.FFMPEG_BIN || "ffmpeg"

export interface MediaDownloadResult {
  ok: true
  /** Absolute path to the extracted audio file (mp3). */
  audioPath: string
  /** yt-dlp-reported title, used to label the capture. */
  title: string | null
  /** Duration in seconds, if yt-dlp reported it. */
  durationSec: number | null
  /** Canonical source URL (yt-dlp's `webpage_url`), for the reply link. */
  webpageUrl: string
}

export type MediaDownloadErrorCode =
  | "missing_binary"
  | "too_long"
  | "too_large"
  | "timeout"
  | "download_failed"

export interface MediaDownloadError {
  ok: false
  code: MediaDownloadErrorCode
  error: string
}

export interface CheckBinariesResult {
  ytdlp: boolean
  ffmpeg: boolean
}

/** Probe whether yt-dlp and ffmpeg are callable. Cheap; safe to call per-job. */
export async function checkBinaries(): Promise<CheckBinariesResult> {
  const probe = async (bin: string, arg: string): Promise<boolean> => {
    try {
      await execFileP(bin, [arg], { timeout: 10_000 })
      return true
    } catch {
      // ENOENT (not installed) or any non-zero exit → treat as unavailable.
      return false
    }
  }
  const [ytdlp, ffmpeg] = await Promise.all([
    probe(YTDLP_BIN, "--version"),
    probe(FFMPEG_BIN, "-version"),
  ])
  return { ytdlp, ffmpeg }
}

interface DownloadOpts {
  /** Per-job scratch directory (already created by the caller). */
  workDir: string
  /** Reject clips longer than this. Default 1800s (30 min). */
  maxDurationSec?: number
  /** Cap the downloaded file size (yt-dlp `--max-filesize`). Default 50 MB. */
  maxFileSizeMb?: number
  /** Overall timeout for the download step. Default 300_000 ms. */
  timeoutMs?: number
}

function isENOENT(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as { code?: string }).code === "ENOENT"
}

function isTimeout(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const e = err as { killed?: boolean; signal?: string; code?: string }
  return e.killed === true || e.signal === "SIGTERM" || e.code === "ETIMEDOUT"
}

/**
 * Download the media at `url` and extract its audio as mp3 into `workDir`.
 * `url` MUST already be validated by `detectMediaUrl`.
 */
export async function downloadMediaAudio(
  url: string,
  opts: DownloadOpts,
): Promise<MediaDownloadResult | MediaDownloadError> {
  const maxDuration = opts.maxDurationSec ?? 1800
  const maxFileSizeMb = opts.maxFileSizeMb ?? 50
  const timeoutMs = opts.timeoutMs ?? 300_000

  // ── Step 1: probe metadata (fast, cheap) so we can reject over-long
  // clips BEFORE downloading any bytes.
  let title: string | null = null
  let durationSec: number | null = null
  let webpageUrl = url
  try {
    const { stdout } = await execFileP(
      YTDLP_BIN,
      ["--no-playlist", "--no-warnings", "--dump-single-json", "--socket-timeout", "15", url],
      { timeout: 30_000, maxBuffer: 16 * 1024 * 1024 },
    )
    const meta = JSON.parse(stdout) as {
      title?: string
      duration?: number
      webpage_url?: string
    }
    title = meta.title ?? null
    durationSec = typeof meta.duration === "number" ? Math.round(meta.duration) : null
    webpageUrl = meta.webpage_url ?? url
  } catch (err) {
    if (isENOENT(err)) {
      return { ok: false, code: "missing_binary", error: "yt-dlp is not installed on the server." }
    }
    if (isTimeout(err)) {
      return { ok: false, code: "timeout", error: "Timed out fetching media info." }
    }
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, code: "download_failed", error: msg.slice(0, 200) }
  }

  if (durationSec !== null && durationSec > maxDuration) {
    return {
      ok: false,
      code: "too_long",
      error: `Clip is ${Math.round(durationSec / 60)} min — over the ${Math.round(maxDuration / 60)} min limit.`,
    }
  }

  // ── Step 2: download audio-only and let ffmpeg transcode to mp3.
  const outTemplate = path.join(opts.workDir, "media.%(ext)s")
  const dlArgs = [
    "--no-playlist",
    "--no-warnings",
    "--no-progress",
    "-f",
    "bestaudio/best",
    "-x",
    "--audio-format",
    "mp3",
    "--audio-quality",
    "5",
    "--max-filesize",
    `${maxFileSizeMb}M`,
    "--match-filter",
    `duration < ${maxDuration}`,
    "--retries",
    "2",
    "--socket-timeout",
    "15",
  ]
  // Only point yt-dlp at a specific ffmpeg when the admin overrode the path.
  // Passing a bare "ffmpeg" name as --ffmpeg-location confuses yt-dlp (it
  // expects a path/dir), so default to letting it find ffmpeg on PATH.
  if (process.env.FFMPEG_BIN) {
    dlArgs.push("--ffmpeg-location", FFMPEG_BIN)
  }
  dlArgs.push("-o", outTemplate, "--print", "after_move:filepath", url)

  let audioPath: string
  try {
    const { stdout } = await execFileP(YTDLP_BIN, dlArgs, {
      timeout: timeoutMs,
      maxBuffer: 16 * 1024 * 1024,
      cwd: opts.workDir,
    })
    // `--print after_move:filepath` echoes the final path on stdout. If the
    // file was skipped by the size/duration filter, stdout may be empty.
    audioPath = stdout.trim().split(/\r?\n/).filter(Boolean).pop() ?? ""
    if (!audioPath) {
      // Fall back to the expected mp3 name.
      audioPath = path.join(opts.workDir, "media.mp3")
    }
  } catch (err) {
    if (isENOENT(err)) {
      return { ok: false, code: "missing_binary", error: "yt-dlp/ffmpeg is not installed on the server." }
    }
    if (isTimeout(err)) {
      return { ok: false, code: "timeout", error: "Download timed out." }
    }
    const msg = err instanceof Error ? err.message : String(err)
    if (/file is larger than max-filesize|max-filesize/i.test(msg)) {
      return { ok: false, code: "too_large", error: `Audio exceeds the ${maxFileSizeMb} MB limit.` }
    }
    return { ok: false, code: "download_failed", error: msg.slice(0, 200) }
  }

  // ── Step 3: belt-and-suspenders — confirm the file exists and is bounded.
  try {
    const s = await stat(audioPath)
    if (s.size === 0) {
      return { ok: false, code: "download_failed", error: "Downloaded audio is empty." }
    }
    if (s.size > maxFileSizeMb * 1024 * 1024 * 1.5) {
      return { ok: false, code: "too_large", error: `Audio exceeds the ${maxFileSizeMb} MB limit.` }
    }
  } catch {
    return { ok: false, code: "download_failed", error: "Audio file not found after download." }
  }

  return { ok: true, audioPath, title, durationSec, webpageUrl }
}
