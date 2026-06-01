"use client"

import type { LLMGenerateOptions, LLMGenerateResult, EmbeddingsOptions, EmbeddingsResult } from "./types"

/**
 * Minimal OpenAI-compatible Chat Completions + Embeddings client.
 *
 * Works with any endpoint that speaks the OpenAI Chat Completions wire
 * format. Verified targets:
 *   - OpenAI            base https://api.openai.com  / v1
 *   - Gemini (compat)   base https://generativelanguage.googleapis.com/v1beta/openai
 *   - LM Studio         base http://localhost:1234 / v1
 *   - Ollama (v1 shim)  base http://localhost:11434 / v1
 *   - llama.cpp server, vLLM, oobabooga text-generation-webui, etc.
 *
 * The user supplies baseUrl, apiKey (empty allowed for local), and model.
 * No SDK dependency — just `fetch` against the canonical endpoints.
 */

export interface OpenAIConfig {
  baseUrl: string   // e.g. "https://api.openai.com/v1" — no trailing slash
  apiKey: string    // can be empty for unauthenticated local endpoints
  model: string     // e.g. "gpt-4o-mini", "gemini-2.5-flash", "llama3.1:8b"
}

function authHeader(apiKey: string): Record<string, string> {
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
}

function normalizeBase(url: string): string {
  // Allow users to paste either ".../v1" or just the root. We tolerate
  // both because every UI in the wild gets this wrong sometimes.
  const trimmed = url.replace(/\/+$/, "")
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`
}

export async function openaiGenerate(
  config: OpenAIConfig,
  options: LLMGenerateOptions
): Promise<LLMGenerateResult> {
  const base = normalizeBase(config.baseUrl)
  const stream = !!options.onStream

  const body = {
    model: config.model,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens,
    stream,
  }

  if (!stream) {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader(config.apiKey),
      },
      body: JSON.stringify(body),
      // Don't let a hung/slow provider block the server action forever.
      signal: AbortSignal.timeout(90_000),
    })
    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`OpenAI-compat ${res.status}: ${errText.slice(0, 300)}`)
    }
    const json = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>
      usage?: { total_tokens?: number }
    }
    const text = json.choices?.[0]?.message?.content ?? ""
    return { text, tokenCount: json.usage?.total_tokens }
  }

  // Streaming: SSE response body.
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...authHeader(config.apiKey),
    },
    body: JSON.stringify(body),
    // Generous cap for long generations, but still bounded.
    signal: AbortSignal.timeout(180_000),
  })
  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => "")
    throw new Error(`OpenAI-compat ${res.status}: ${errText.slice(0, 300)}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let full = ""

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE = "data: {...}\n\n" — split on blank lines, parse each chunk.
    const chunks = buffer.split("\n\n")
    buffer = chunks.pop() ?? ""
    for (const chunk of chunks) {
      const line = chunk.split("\n").find((l) => l.startsWith("data: "))
      if (!line) continue
      const payload = line.slice(6).trim()
      if (payload === "[DONE]") continue
      try {
        const parsed = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> }
        const token = parsed.choices?.[0]?.delta?.content
        if (token) {
          full += token
          options.onStream?.(token)
        }
      } catch {
        // Some servers send keep-alive pings as :comments — ignore parse errors.
      }
    }
  }

  return { text: full }
}

export async function openaiEmbeddings(
  config: OpenAIConfig,
  options: EmbeddingsOptions
): Promise<EmbeddingsResult> {
  const base = normalizeBase(config.baseUrl)
  const res = await fetch(`${base}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(config.apiKey),
    },
    body: JSON.stringify({
      model: config.model,
      input: options.texts,
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`OpenAI-compat ${res.status}: ${errText.slice(0, 300)}`)
  }
  const json = (await res.json()) as {
    data?: Array<{ embedding: number[] }>
  }
  const embeddings = json.data?.map((d) => d.embedding) ?? []
  return {
    embeddings,
    dimensions: embeddings[0]?.length ?? 0,
  }
}

/**
 * Lightweight liveness probe. Returns "ok" or an error description. Used
 * by the Settings UI to show a green/red indicator after the user enters
 * config.
 */
export async function openaiPing(config: OpenAIConfig): Promise<{ ok: true; models?: string[] } | { ok: false; error: string }> {
  const base = normalizeBase(config.baseUrl)
  try {
    const res = await fetch(`${base}/models`, {
      headers: authHeader(config.apiKey),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200) || res.statusText}` }
    }
    const json = (await res.json().catch(() => ({}))) as { data?: Array<{ id: string }> }
    return { ok: true, models: json.data?.map((m) => m.id).slice(0, 50) }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Common presets the UI offers as quick picks ──────────────────────

export interface ProviderPreset {
  id: string
  label: string
  baseUrl: string
  modelHint: string
  needsKey: boolean
  helpUrl?: string
}

export const OPENAI_COMPAT_PRESETS: ProviderPreset[] = [
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    modelHint: "gpt-4o-mini",
    needsKey: true,
    helpUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "gemini",
    label: "Google Gemini (OpenAI-compat)",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    modelHint: "gemini-2.5-flash",
    needsKey: true,
    helpUrl: "https://aistudio.google.com",
  },
  {
    id: "ollama-local",
    label: "Ollama (localhost, no key)",
    baseUrl: "http://localhost:11434/v1",
    modelHint: "llama3.1:8b",
    needsKey: false,
    helpUrl: "https://ollama.com/download",
  },
  {
    id: "lmstudio-local",
    label: "LM Studio (localhost, no key)",
    baseUrl: "http://localhost:1234/v1",
    modelHint: "<the model you loaded in LM Studio>",
    needsKey: false,
    helpUrl: "https://lmstudio.ai",
  },
  {
    id: "custom",
    label: "Custom / other OpenAI-compatible endpoint",
    baseUrl: "",
    modelHint: "",
    needsKey: false,
  },
]
