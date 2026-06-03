import "server-only"
import { sqlite } from "@/lib/db"

/**
 * Resolve which vision (image-understanding) endpoint to use, local-first.
 *
 * Mirrors the Whisper local-first pattern: if a self-hosted OpenAI-compatible
 * vision endpoint is configured (e.g. Ollama serving `moondream`), use it —
 * free, private, runs on the VM. Otherwise fall back to the user's configured
 * cloud provider (which must be a vision-capable model).
 *
 *   VISION_LOCAL_URL    e.g. http://127.0.0.1:11434/v1  (Ollama's OpenAI shim)
 *   VISION_LOCAL_MODEL  default "moondream"
 *   VISION_LOCAL_KEY    optional bearer token (Ollama needs none)
 */
export interface VisionConfig {
  baseUrl: string
  /** Empty string = send no Authorization header (local Ollama). */
  apiKey: string
  model: string
  isLocal: boolean
}

export function resolveVisionConfig(userId: string): VisionConfig | null {
  const localUrl = process.env.VISION_LOCAL_URL?.replace(/\/+$/, "")
  if (localUrl) {
    return {
      baseUrl: localUrl,
      apiKey: process.env.VISION_LOCAL_KEY?.trim() || "",
      model: process.env.VISION_LOCAL_MODEL?.trim() || "moondream",
      isLocal: true,
    }
  }
  // Cloud fallback — the user's general OpenAI-compatible provider.
  const row = sqlite
    .prepare(`SELECT prefs_json FROM user_preferences WHERE user_id = ?`)
    .get(userId) as { prefs_json: string } | undefined
  if (!row?.prefs_json) return null
  try {
    const p = JSON.parse(row.prefs_json) as {
      aiOpenAIBaseUrl?: string
      aiOpenAIApiKey?: string
      aiOpenAIModel?: string
    }
    if (!p.aiOpenAIBaseUrl || !p.aiOpenAIApiKey) return null
    return {
      baseUrl: p.aiOpenAIBaseUrl.replace(/\/+$/, ""),
      apiKey: p.aiOpenAIApiKey,
      model: p.aiOpenAIModel?.trim() || "gpt-4o-mini",
      isLocal: false,
    }
  } catch {
    return null
  }
}
