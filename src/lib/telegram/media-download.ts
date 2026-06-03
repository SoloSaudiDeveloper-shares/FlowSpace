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
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

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
  // This bounds the SOURCE download, not the audio we keep. On sites that only
  // offer a combined video+audio stream (e.g. TikTok), yt-dlp must pull the
  // whole video before ffmpeg strips the audio — so this is deliberately
  // generous. The real guard is the duration cap above; the extracted audio is
  // tiny (mono 16 kHz, see below).
  const maxFileSizeMb = opts.maxFileSizeMb ?? 500
  const timeoutMs = opts.timeoutMs ?? 300_000
  // The extracted audio is what we transcribe. Mono 16 kHz keeps it small
  // (a few MB even for ~30 min) and well under Groq's 25 MB cap.
  const AUDIO_MAX_MB = 60
  // Optional cookies (Netscape cookies.txt). Lets yt-dlp authenticate like a
  // real browser to get past region/IP blocks. Export once and point
  // YTDLP_COOKIES_FILE at it (e.g. /data/cookies.txt). Ignored if unset.
  const cookieArgs =
    process.env.YTDLP_COOKIES_FILE && process.env.YTDLP_COOKIES_FILE.trim()
      ? ["--cookies", process.env.YTDLP_COOKIES_FILE.trim()]
      : []

  // ── Step 1: probe metadata (best-effort) to reject over-long clips early.
  // TikTok / Instagram / X intermittently fail extraction on the FIRST request
  // from a datacenter IP, so retry a few times with backoff. Crucially, if the
  // probe still fails we do NOT abort — the download step enforces the duration
  // cap via --match-filter and has its own retries, so a flaky probe never
  // blocks a download that would otherwise succeed. (This is why a manual
  // resend "always worked": the first probe flaked, the retry got through.)
  let title: string | null = null
  let durationSec: number | null = null
  let webpageUrl = url
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { stdout } = await execFileP(
        YTDLP_BIN,
        ["--no-playlist", "--no-warnings", "--dump-single-json", "--extractor-retries", "3", "--socket-timeout", "20", ...cookieArgs, url],
        { timeout: 45_000, maxBuffer: 16 * 1024 * 1024 },
      )
      const meta = JSON.parse(stdout) as { title?: string; duration?: number; webpage_url?: string }
      title = meta.title ?? null
      durationSec = typeof meta.duration === "number" ? Math.round(meta.duration) : null
      webpageUrl = meta.webpage_url ?? url
      break
    } catch (err) {
      if (isENOENT(err)) {
        return { ok: false, code: "missing_binary", error: "yt-dlp is not installed on the server." }
      }
      // Transient — back off and retry; on the last attempt, fall through to
      // the download anyway (best-effort, no early too_long check).
      if (attempt < 3) await sleep(1500 * attempt)
    }
  }

  if (durationSec !== null && durationSec > maxDuration) {
    return {
      ok: false,
      code: "too_long",
      error: `Clip is ${Math.round(durationSec / 60)} min — over the ${Math.round(maxDuration / 60)} min limit.`,
    }
  }

  // ── Step 2: grab audio (prefer an audio-only stream; fall back to the
  // full video on sites that only mux), then transcode to a COMPACT mp3 —
  // mono, 16 kHz, low bitrate. Whisper downsamples to 16 kHz mono anyway, so
  // this loses nothing for transcription while shrinking a long clip to a few
  // MB. `--postprocessor-args ffmpeg:…` passes the resample flags to ffmpeg.
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
    "9", // smallest LAME VBR — fine at 16 kHz mono for speech
    "--postprocessor-args",
    "ffmpeg:-ac 1 -ar 16000",
    "--max-filesize",
    `${maxFileSizeMb}M`,
    "--match-filter",
    `duration < ${maxDuration}`,
    "--extractor-retries",
    "3",
    "--retries",
    "5",
    "--socket-timeout",
    "20",
  ]
  // Only point yt-dlp at a specific ffmpeg when the admin overrode the path.
  // Passing a bare "ffmpeg" name as --ffmpeg-location confuses yt-dlp (it
  // expects a path/dir), so default to letting it find ffmpeg on PATH.
  if (process.env.FFMPEG_BIN) {
    dlArgs.push("--ffmpeg-location", FFMPEG_BIN)
  }
  if (cookieArgs.length) dlArgs.push(...cookieArgs)
  dlArgs.push("-o", outTemplate, "--print", "after_move:filepath", url)

  // ── Step 3: download with retries. Transient extraction/network errors get
  // a few attempts with backoff before we give up — so the user never has to
  // resend a link. Non-retryable failures (too large) return immediately.
  let lastError = "Download failed."
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { stdout } = await execFileP(YTDLP_BIN, dlArgs, {
        timeout: timeoutMs,
        maxBuffer: 16 * 1024 * 1024,
        cwd: opts.workDir,
      })
      // `--print after_move:filepath` echoes the final path on stdout. If the
      // file was skipped by the size/duration filter, stdout may be empty.
      let audioPath = stdout.trim().split(/\r?\n/).filter(Boolean).pop() ?? ""
      if (!audioPath) audioPath = path.join(opts.workDir, "media.mp3")

      const s = await stat(audioPath).catch(() => null)
      if (!s || s.size === 0) {
        // Empty output — usually a transient extraction hiccup. Retry.
        lastError = "Downloaded audio is empty."
        if (attempt < 3) { await sleep(2500 * attempt); continue }
        return { ok: false, code: "download_failed", error: lastError }
      }
      // Sanity bound on the EXTRACTED audio (not the source video). With mono
      // 16 kHz this is generous — it should never trip for in-duration clips.
      if (s.size > AUDIO_MAX_MB * 1024 * 1024) {
        return { ok: false, code: "too_large", error: `Extracted audio exceeds ${AUDIO_MAX_MB} MB.` }
      }
      return { ok: true, audioPath, title, durationSec, webpageUrl }
    } catch (err) {
      if (isENOENT(err)) {
        return { ok: false, code: "missing_binary", error: "yt-dlp/ffmpeg is not installed on the server." }
      }
      // IMPORTANT: classify on yt-dlp's actual STDERR, not err.message — Node
      // prefixes err.message with the full command line, which contains the
      // literal "--max-filesize 500M" and would false-match the oversize check
      // for EVERY failure (that's the "over 500 MB" bug).
      const e = err as { stderr?: string; message?: string }
      const stderr = (e.stderr || e.message || String(err)).toString()
      // yt-dlp's genuine oversize message is "larger than max-filesize".
      if (/larger than max-filesize/i.test(stderr)) {
        return { ok: false, code: "too_large", error: `Source exceeds the ${maxFileSizeMb} MB download limit.` }
      }
      if (isTimeout(err)) {
        lastError = "Download timed out."
        if (attempt < 3) { await sleep(2500 * attempt); continue }
        return { ok: false, code: "timeout", error: lastError }
      }
      // Prefer the real yt-dlp ERROR line for the detail, not the command echo.
      const detail =
        stderr.split(/\r?\n/).filter((l) => /^ERROR|unable|unavailable|private|not available/i.test(l)).pop() ||
        stderr.split(/\r?\n/).filter(Boolean).pop() ||
        "Download failed."
      lastError = detail.slice(0, 200)
      if (attempt < 3) { await sleep(2500 * attempt); continue }
      return { ok: false, code: "download_failed", error: lastError }
    }
  }
  return { ok: false, code: "download_failed", error: lastError }
}
