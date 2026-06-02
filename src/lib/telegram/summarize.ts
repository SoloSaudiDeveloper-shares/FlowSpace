/**
 * AI summarization for media-link transcripts.
 *
 * Reuses the user's OpenAI-compatible AI provider (the same config the NL
 * commands + in-app AI features read from). We call `/chat/completions`
 * directly with `fetch` — the same shape as `nl-intent.ts` — because the
 * `openai-client.ts` helper is a client module and can't be imported here.
 *
 * For long transcripts we map-reduce: summarize each ~6k-char chunk, then
 * summarize the chunk-summaries into one final digest. If no AI provider is
 * configured (or it errors), we return null and the caller captures the raw
 * transcript instead — the feature degrades, it doesn't break.
 */

import "server-only"
import { getUserAIConfig } from "@/lib/telegram/nl-intent"

const CHUNK_CHARS = 6000
const FINAL_PROMPT = `You summarize transcripts of short videos / audio clips for a productivity app. Produce a concise, skimmable summary in this exact shape:

<one-line title, max ~80 chars, no quotes>
• key point
• key point
• key point
Action items: <comma-separated, or "none">

Keep it tight. No preamble, no markdown headers, no code fences. Reply in the same language as the transcript.`

const CHUNK_PROMPT = `Summarize this PART of a longer transcript into 2-4 tight bullet points capturing the substantive content. No preamble, no headers.`

interface ChatResult {
  choices?: { message?: { content?: string } }[]
}

async function chat(
  cfg: NonNullable<ReturnType<typeof getUserAIConfig>>,
  system: string,
  user: string,
  maxTokens: number,
  timeoutMs: number,
): Promise<string | null> {
  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.3,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return null
    const data = (await res.json()) as ChatResult
    const text = data.choices?.[0]?.message?.content?.trim()
    return text || null
  } catch {
    return null
  }
}

/** Split into ~CHUNK_CHARS pieces on paragraph/sentence boundaries. */
function chunk(text: string): string[] {
  if (text.length <= CHUNK_CHARS) return [text]
  const out: string[] = []
  let i = 0
  while (i < text.length) {
    let end = Math.min(i + CHUNK_CHARS, text.length)
    if (end < text.length) {
      // Prefer to break on the last sentence/space boundary in the window.
      const slice = text.slice(i, end)
      const lastBreak = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("\n"))
      if (lastBreak > CHUNK_CHARS * 0.5) end = i + lastBreak + 1
    }
    out.push(text.slice(i, end).trim())
    i = end
  }
  return out.filter(Boolean)
}

/**
 * Summarize a transcript for `userId`. Returns the summary text, or null if
 * no AI provider is configured / it failed (caller falls back to raw text).
 */
export async function summarizeTranscript(
  userId: string,
  transcript: string,
): Promise<string | null> {
  const cfg = getUserAIConfig(userId)
  if (!cfg || !cfg.enabled) return null
  const clean = transcript.trim()
  if (!clean) return null

  const chunks = chunk(clean)
  let condensed = clean
  if (chunks.length > 1) {
    // Map: summarize each chunk.
    const partials: string[] = []
    for (const c of chunks) {
      const part = await chat(cfg, CHUNK_PROMPT, c, 300, 30_000)
      partials.push(part ?? c.slice(0, 400))
    }
    condensed = partials.join("\n")
  }

  // Reduce: one final digest.
  const summary = await chat(cfg, FINAL_PROMPT, condensed, 400, 30_000)
  return summary
}
