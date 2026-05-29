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

  // Step 3: hand it to Groq Whisper.
  const form = new FormData()
  form.append(
    "file",
    new Blob([audioBytes], { type: "audio/ogg" }),
    "voice.ogg",
  )
  form.append("model", "whisper-large-v3-turbo")
  // Pin the language unless caller explicitly asked for auto-detect.
  // Without this Whisper guesses per-utterance — and short single-word
  // captures get misclassified as Arabic / Spanish / etc fairly often.
  if (language && language !== "auto") {
    form.append("language", language)
  }
  form.append("response_format", "json")

  // Allow a self-hosted Whisper endpoint to take over by setting
  // TELEGRAM_VOICE_LOCAL_URL (e.g. http://127.0.0.1:8001/v1). Falls
  // back to Groq when unset. The local endpoint exposes the same
  // /audio/transcriptions shape so the body/form stay identical.
  const localUrl = process.env.TELEGRAM_VOICE_LOCAL_URL?.replace(/\/+$/, "")
  const endpoint = localUrl
    ? `${localUrl}/audio/transcriptions`
    : "https://api.groq.com/openai/v1/audio/transcriptions"
  // Faster-whisper-server doesn't require a key; Groq does.
  const headers: Record<string, string> = {}
  if (!localUrl && groqApiKey) headers.Authorization = `Bearer ${groqApiKey}`

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: form,
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => "")
      const friendly =
        res.status === 401
          ? "Invalid Groq API key. Re-check Settings → Speech."
          : res.status === 429
            ? "Groq rate-limit hit. Wait, or switch to a paid plan."
            : `Groq ${res.status}: ${txt.slice(0, 120)}`
      return { ok: false, error: friendly }
    }
    const data = (await res.json()) as { text?: string }
    const text = (data.text ?? "").trim()
    if (!text) return { ok: false, error: "Empty transcription." }
    return { ok: true, text }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Transcription error",
    }
  }
}
