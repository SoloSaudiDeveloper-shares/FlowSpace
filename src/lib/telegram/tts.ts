/**
 * Text → speech for the Telegram bot.
 *
 * When the user enables voice OUT, the bot replies to text/voice-note
 * messages with a voice note in addition to the text body. The audio is
 * synthesised by calling the user's OpenAI-compatible AI provider
 * (configured in Settings → AI) — OpenAI's tts-1 model is the
 * reference, but any provider exposing `/audio/speech` with the same
 * payload works (Gemini, LM Studio with a TTS model, ElevenLabs proxy,
 * a self-hosted endpoint, etc.).
 *
 * Telegram accepts OGG/Opus as voice notes. OpenAI tts-1 returns MP3
 * by default; we request `opus` format to get an OGG-friendly stream
 * that Telegram will render as a round-mic playback bubble.
 *
 * Failure modes:
 *  - User hasn't configured an AI provider → return null, agent falls
 *    back to text-only
 *  - Provider returns 401/429 → return null, log the reason for the
 *    user in the message-history table later
 *  - Text > 4000 chars → truncate; people don't want a 90-second voice
 *    note anyway
 */

import "server-only"
import { sqlite } from "@/lib/db"

interface TTSConfig {
  baseUrl: string
  apiKey: string
  model: string
  voice: string
  format: "opus" | "mp3" | "wav"
}

/** Read user's TTS config from their preferences blob. Returns null when
 *  not configured. */
export function getUserTTSConfig(userId: string): TTSConfig | null {
  const row = sqlite
    .prepare(`SELECT prefs_json FROM user_preferences WHERE user_id = ?`)
    .get(userId) as { prefs_json: string } | undefined
  if (!row?.prefs_json) return null
  try {
    const prefs = JSON.parse(row.prefs_json) as {
      aiOpenAIBaseUrl?: string
      aiOpenAIApiKey?: string
      aiTTSModel?: string
      aiTTSVoice?: string
    }
    if (!prefs.aiOpenAIBaseUrl || !prefs.aiOpenAIApiKey) return null
    // Sensible defaults so the user only has to set a key.
    const model = prefs.aiTTSModel?.trim() || "tts-1"
    const voice = prefs.aiTTSVoice?.trim() || "alloy"
    return {
      baseUrl: prefs.aiOpenAIBaseUrl.replace(/\/+$/, ""),
      apiKey: prefs.aiOpenAIApiKey,
      model,
      voice,
      format: "opus",
    }
  } catch {
    return null
  }
}

/** True if the user has opted into voice-out replies. Off by default —
 *  not everyone wants their phone to vibrate with an audio note when
 *  they tap /done. */
export function isVoiceOutEnabled(userId: string): boolean {
  const row = sqlite
    .prepare(`SELECT voice_out_enabled FROM telegram_bots WHERE user_id = ?`)
    .get(userId) as { voice_out_enabled: number | null } | undefined
  return row?.voice_out_enabled === 1
}

/**
 * Synthesize `text` into an OGG/Opus audio buffer. Returns null when the
 * user hasn't configured TTS or the provider call fails. The caller
 * (telegram agent) should fall through to text-only on null.
 */
export async function synthesizeSpeech(
  userId: string,
  text: string,
): Promise<ArrayBuffer | null> {
  const cfg = getUserTTSConfig(userId)
  if (!cfg) return null
  // Strip Telegram MarkdownV2 markers — TTS engines pronounce the asterisks.
  const clean = text
    .replace(/[*_`]/g, "")
    .replace(/\\([_*\[\]()~`>#+\-=|{}.!\\])/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000)
  if (clean.length === 0) return null
  try {
    const res = await fetch(`${cfg.baseUrl}/audio/speech`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        voice: cfg.voice,
        input: clean,
        response_format: cfg.format,
      }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return null
    return await res.arrayBuffer()
  } catch {
    return null
  }
}
