/**
 * Ollama REST API Client (Server-Side)
 *
 * Handles communication with the Ollama service.
 * Used exclusively by API routes — never imported by client code.
 *
 * Ollama API reference:
 *   POST /api/chat       — Chat completion (streaming/non-streaming)
 *   POST /api/embed      — Generate embeddings
 *   GET  /api/tags       — List local models
 *   POST /api/pull       — Pull (download) a model
 *   DELETE /api/delete    — Delete a model
 *   GET  /                — Health check
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OllamaChatMessage {
  role: "system" | "user" | "assistant"
  content: string
  /** Base64-encoded images (for multimodal/vision models like LLaVA) */
  images?: string[]
}

export interface OllamaChatRequest {
  model: string
  messages: OllamaChatMessage[]
  stream?: boolean
  options?: {
    temperature?: number
    num_predict?: number
    top_p?: number
    top_k?: number
    seed?: number
  }
}

export interface OllamaChatResponse {
  model: string
  message: OllamaChatMessage
  done: boolean
  total_duration?: number
  eval_count?: number
  eval_duration?: number
}

export interface OllamaEmbedRequest {
  model: string
  input: string | string[]
}

export interface OllamaEmbedResponse {
  model: string
  embeddings: number[][]
}

export interface OllamaModelInfo {
  name: string
  size: number
  digest: string
  modified_at: string
  details: {
    format: string
    family: string
    parameter_size: string
    quantization_level: string
  }
}

export interface OllamaPullProgress {
  status: string
  digest?: string
  total?: number
  completed?: number
}

// ─── Client ─────────────────────────────────────────────────────────────────

const DEFAULT_URL = "http://localhost:11434"

export class OllamaClient {
  private baseUrl: string

  constructor(baseUrl?: string) {
    this.baseUrl = (baseUrl || DEFAULT_URL).replace(/\/$/, "")
  }

  /** Check if Ollama is running */
  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(this.baseUrl, {
        signal: AbortSignal.timeout(3000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  /** List locally available models */
  async listModels(): Promise<OllamaModelInfo[]> {
    const res = await fetch(`${this.baseUrl}/api/tags`)
    if (!res.ok) throw new Error(`Ollama error: ${res.status}`)
    const data = await res.json()
    return data.models || []
  }

  /** Non-streaming chat completion */
  async chat(request: OllamaChatRequest): Promise<OllamaChatResponse> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...request, stream: false }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Ollama chat error: ${res.status} — ${text}`)
    }
    return res.json()
  }

  /**
   * Streaming chat completion.
   * Returns a ReadableStream of text tokens.
   */
  chatStream(request: OllamaChatRequest): ReadableStream<Uint8Array> {
    const url = `${this.baseUrl}/api/chat`
    const body = JSON.stringify({ ...request, stream: true })

    return new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          })
          if (!res.ok) {
            const errText = await res.text()
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: errText })}\n\n`),
            )
            controller.close()
            return
          }

          const reader = res.body!.getReader()
          const decoder = new TextDecoder()
          let buffer = ""

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split("\n")
            buffer = lines.pop() || ""

            for (const line of lines) {
              if (!line.trim()) continue
              try {
                const json = JSON.parse(line)
                if (json.message?.content) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ token: json.message.content })}\n\n`,
                    ),
                  )
                }
                if (json.done) {
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"))
                  controller.close()
                  return
                }
              } catch {
                // skip malformed JSON lines
              }
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          controller.close()
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`),
          )
          controller.close()
        }
      },
    })
  }

  /** Generate embeddings for one or more texts */
  async embed(request: OllamaEmbedRequest): Promise<OllamaEmbedResponse> {
    const res = await fetch(`${this.baseUrl}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Ollama embed error: ${res.status} — ${text}`)
    }
    return res.json()
  }

  /**
   * Pull (download) a model from the Ollama registry.
   * Returns a ReadableStream of progress events (SSE format).
   */
  pullStream(model: string): ReadableStream<Uint8Array> {
    const url = `${this.baseUrl}/api/pull`
    const body = JSON.stringify({ name: model, stream: true })

    return new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          })
          if (!res.ok) {
            const errText = await res.text()
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: errText })}\n\n`),
            )
            controller.close()
            return
          }

          const reader = res.body!.getReader()
          const decoder = new TextDecoder()
          let buffer = ""

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split("\n")
            buffer = lines.pop() || ""

            for (const line of lines) {
              if (!line.trim()) continue
              try {
                const json: OllamaPullProgress = JSON.parse(line)
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(json)}\n\n`),
                )
                if (json.status === "success") {
                  controller.close()
                  return
                }
              } catch {
                // skip
              }
            }
          }

          controller.close()
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`),
          )
          controller.close()
        }
      },
    })
  }

  /** Delete a model from local storage */
  async deleteModel(model: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/delete`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: model }),
    })
    if (!res.ok) {
      throw new Error(`Failed to delete model: ${res.status}`)
    }
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Create an OllamaClient.
 * Priority: explicit url > OLLAMA_URL env var > default localhost:11434
 */
export function createOllamaClient(url?: string): OllamaClient {
  return new OllamaClient(url || process.env.OLLAMA_URL || DEFAULT_URL)
}
