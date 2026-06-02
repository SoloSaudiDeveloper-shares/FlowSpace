/**
 * Voice-message → text via Groq Whisper.
 *
 * The user already has a Groq API key set client-side for the in-browser
 * mic (Settings → Speech). It's stored in `user_preferences.prefs_json`
 * under `speechGroqApiKey`. Rather than ask them to paste it again
 * server-side, we read it from there. Falls back to a server env var
 * (`TELEGRAM_VOICE_GROQ_KEY`) so admins can provide a shared key for
 * users who haven't configured their own.
 *
 * Pipeline:
 *   1. Telegram update has `message.voice = { file_id, ... }`
 *   2. getFile(file_id) returns a relative `file_path`
 *   3. Download the OGG from Telegram's CDN
 *   4. POST it to Groq's transcription endpoint as multipart/form-data
 *   5. Return the transcript string (or null on any failure)
 *
 * Voice notes are typically OGG/Opus and a few KB to a few hundred KB —
 * fits well within Groq's 25 MB cap.
 */

import "server-only"
import { sqlite } from "@/lib/db"
import { fileDownloadUrl, getFile } from "@/lib/telegram/client"

/** Resolve the Groq API key for a given user, respecting their per-user
 *  choice between own key and the shared workspace key (env var).
 *
 *  Order:
 *    - If user opted into the shared key (voice_key_use_shared = 1):
 *        env var only — even if they have their own key set.
 *    - Otherwise:
 *        their own key from preferences → fallback to env if missing,
 *        so a user who hasn't gotten around to setting one isn't blocked
 *        on day one.
 */
export function resolveGroqKey(userId: string): string | null {
  const env = process.env.TELEGRAM_VOICE_GROQ_KEY?.trim() || null

  // Read the user's preference
  const botRow = sqlite
    .prepare(`SELECT voice_key_use_shared FROM telegram_bots WHERE user_id = ?`)
    .get(userId) as { voice_key_use_shared: number | null } | undefined
  if (botRow?.voice_key_use_shared === 1) {
    return env
  }

  // Default path: prefer the user's own key
  const row = sqlite
    .prepare(`SELECT prefs_json FROM user_preferences WHERE user_id = ?`)
    .get(userId) as { prefs_json: string } | undefined
  if (row?.prefs_json) {
    try {
      const prefs = JSON.parse(row.prefs_json) as { speechGroqApiKey?: string }
      const k = prefs.speechGroqApiKey?.trim()
      if (k) return k
    } catch {
      /* ignore malformed prefs */
    }
  }
  return env
}

/**
 * Download a Telegram voice file and transcribe it via Groq.
 * Returns the transcript string on success, or null on any failure
 * (which the webhook converts into a user-friendly "couldn't hear that"
 * reply rather than a silent drop).
 */
export async function transcribeTelegramVoice(
  botToken: string,
  groqApiKey: string,
  fileId: string,
  /** ISO 639-1 code (e.g. "en", "ar", "es"), or "auto" to let Whisper
   *  detect. Short utterances detect more reliably when this is pinned. */
  language: string = "en",
  /** Optional — the FlowSpace user the bot belongs to. Used to bump
   *  per-day voice-transcription stats so Settings → Speech can show
   *  "today's usage" (Groq has no balance endpoint). */
  ownerUserId?: string,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  // Step 1: ask Telegram for the file path on its CDN.
  const fileResp = await getFile(botToken, fileId)
  if (!fileResp.ok) {
    return { ok: false, error: `Telegram getFile failed: ${fileResp.description}` }
  }
  const path = fileResp.result.file_path
  if (!path) return { ok: false, error: "No file_path returned by Telegram." }

  // Step 2: download the audio bytes.
  let audioBytes: ArrayBuffer
  try {
    const audioRes = await fetch(fileDownloadUrl(botToken, path), {
      signal: AbortSignal.timeout(20_000),
    })
    if (!audioRes.ok) {
      return { ok: false, error: `Download failed: ${audioRes.status}` }
    }
    audioBytes = await audioRes.arrayBuffer()
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Download error",
    }
  }

  // Step 3: transcribe. Local-first (self-hosted faster-whisper) with a Groq
  // fallback. Both expose the OpenAI `/audio/transcriptions` multipart shape,
  // so the only differences per engine are the URL and auth header. We try the
  // local server first when configured and fall back to Groq if it's down,
  // errors, or returns nothing — so a flaky local box never loses a capture.
  const buildForm = () => {
    const form = new FormData()
    form.append("file", new Blob([audioBytes], { type: "audio/ogg" }), "voice.ogg")
    form.append("model", "whisper-large-v3-turbo")
    // Pin the language unless caller asked for auto-detect — short utterances
    // otherwise get misclassified as Arabic/Spanish/etc.
    if (language && language !== "auto") form.append("language", language)
    form.append("response_format", "json")
    return form
  }

  const localUrl = process.env.TELEGRAM_VOICE_LOCAL_URL?.replace(/\/+$/, "")
  const attempts: { name: "local" | "groq"; url: string; headers: Record<string, string> }[] = []
  if (localUrl) {
    // Self-hosted faster-whisper-server needs no key.
    attempts.push({ name: "local", url: `${localUrl}/audio/transcriptions`, headers: {} })
  }
  if (groqApiKey) {
    attempts.push({
      name: "groq",
      url: "https://api.groq.com/openai/v1/audio/transcriptions",
      headers: { Authorization: `Bearer ${groqApiKey}` },
    })
  }
  if (attempts.length === 0) {
    return { ok: false, error: "No transcription engine configured (no local server, no Groq key)." }
  }

  let lastError = "Transcription failed."
  for (const attempt of attempts) {
    try {
      const res = await fetch(attempt.url, {
        method: "POST",
        headers: attempt.headers,
        body: buildForm(),
        // Local Whisper (CPU, Medium) is slower than Groq — give it room.
        signal: AbortSignal.timeout(attempt.name === "local" ? 180_000 : 60_000),
      })
      if (!res.ok) {
        const txt = await res.text().catch(() => "")
        lastError =
          attempt.name === "groq"
            ? res.status === 401
              ? "Invalid Groq API key. Re-check Settings → Speech."
              : res.status === 429
                ? "Groq rate-limit hit. Wait, or switch to a paid plan."
                : `Groq ${res.status}: ${txt.slice(0, 120)}`
            : `Local Whisper ${res.status}: ${txt.slice(0, 120)}`
        continue // fall through to the next engine
      }
      const data = (await res.json()) as { text?: string; duration?: number }
      const text = (data.text ?? "").trim()
      if (!text) {
        lastError = "Empty transcription."
        continue
      }
      // Bump daily-usage counter — fire-and-forget.
      if (ownerUserId) {
        const today = new Date().toISOString().slice(0, 10)
        const seconds = Math.max(0, Math.round(data.duration ?? 0))
        try {
          sqlite
            .prepare(
              `INSERT INTO voice_usage_daily (user_id, date, count, seconds)
               VALUES (?, ?, 1, ?)
               ON CONFLICT(user_id, date)
               DO UPDATE SET count = count + 1, seconds = seconds + excluded.seconds`,
            )
            .run(ownerUserId, today, seconds)
        } catch {
          /* don't let stats failures break transcription */
        }
      }
      return { ok: true, text }
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Transcription error"
      continue // try the next engine
    }
  }
  return { ok: false, error: lastError }
}
