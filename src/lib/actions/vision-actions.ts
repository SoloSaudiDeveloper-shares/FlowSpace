"use server"

/**
 * Image vision analysis via the user's OpenAI-compatible AI provider.
 *
 * Works with OpenAI (gpt-4o, gpt-4o-mini), Gemini (gemini-2.5-flash and
 * up), and any other endpoint that accepts the standard chat-completions
 * message shape with image_url content parts.
 *
 *  POST {baseUrl}/chat/completions
 *  body: { model, messages: [{ role: "user", content: [
 *           { type: "text", text: prompt },
 *           { type: "image_url", image_url: { url: dataUrl } }
 *         ]}], ... }
 *
 * Returns plain text on success, error message on failure. Never throws
 * — bad config / network glitches surface as `ok: false`.
 *
 * The Ollama path (VisionButton component) stays around for local-only
 * setups; this is the cloud-provider counterpart.
 */

import { requireAuth } from "@/lib/auth/scope"
import { sqlite } from "@/lib/db"
import { createId } from "@/lib/utils/ids"
import { revalidatePath } from "next/cache"
import { resolveVisionConfig } from "@/lib/ai/vision-config"

/** Run a vision analysis. `dataUrl` should be a `data:image/…;base64,…`
 *  URL so the provider can decode it inline. */
export async function analyzeImageWithAI(input: {
  dataUrl: string
  prompt?: string
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const me = await requireAuth()
  // Local-first (self-hosted Ollama/moondream) → cloud fallback.
  const cfg = resolveVisionConfig(me.id)
  if (!cfg) {
    return {
      ok: false,
      error:
        "Configure an AI provider in Settings → AI features (or set a local VISION_LOCAL_URL on the server).",
    }
  }
  const prompt =
    input.prompt?.trim() ||
    "What's in this image? Be concise and structured. If there's text, transcribe it."

  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: input.dataUrl } },
            ],
          },
        ],
        max_tokens: 1024,
      }),
      // Local CPU vision is slower than a cloud call — give it room.
      signal: AbortSignal.timeout(cfg.isLocal ? 180_000 : 60_000),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      const friendly =
        res.status === 401
          ? "Auth failed — check your API key in Settings → AI features."
          : res.status === 429
            ? "Provider rate-limit hit. Wait or upgrade the plan."
            : `Provider ${res.status}: ${body.slice(0, 200)}`
      return { ok: false, error: friendly }
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: unknown } }[]
    }
    const choice = data.choices?.[0]?.message?.content
    // OpenAI returns string; some providers wrap content in an array of parts
    const text =
      typeof choice === "string"
        ? choice
        : Array.isArray(choice)
          ? choice
              .map((p: { text?: string }) => p.text ?? "")
              .join("")
              .trim()
          : ""
    if (!text) return { ok: false, error: "Empty response from provider." }
    return { ok: true, text }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    }
  }
}

/**
 * Save the result of an image analysis as a Page. The page body
 * embeds the data URL as an <img> + the AI analysis underneath.
 * Returns the element id so the UI can navigate to it.
 */
export async function saveVisionAsPage(input: {
  title: string
  dataUrl: string
  analysis: string
}): Promise<{ ok: true; pageId: string } | { ok: false; error: string }> {
  const me = await requireAuth()
  const title = input.title.trim() || "Image analysis"
  // BlockNote stores doc JSON; for a single-image+text page we cobble
  // together a minimal valid doc with a paragraph (the analysis) and
  // an image block (the dataUrl). BlockNote accepts dataUrls so we
  // don't need a file-upload route.
  const content = JSON.stringify([
    {
      id: createId(),
      type: "image",
      props: { url: input.dataUrl, caption: "", previewWidth: 600 },
      children: [],
    },
    {
      id: createId(),
      type: "paragraph",
      props: {},
      content: [{ type: "text", text: input.analysis, styles: {} }],
      children: [],
    },
  ])
  const pageId = createId()
  // Create the element row + the pages row in a single transaction.
  const tx = sqlite.transaction(() => {
    sqlite
      .prepare(
        `INSERT INTO elements (id, type, title, icon, color, created_by)
         VALUES (?, 'page', ?, 'Image', '#60a5fa', ?)`,
      )
      .run(pageId, title.slice(0, 200), me.id)
    sqlite
      .prepare(`INSERT INTO pages (id, content) VALUES (?, ?)`)
      .run(pageId, content)
  })
  try {
    tx()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Save failed." }
  }
  revalidatePath("/pages")
  return { ok: true, pageId }
}
