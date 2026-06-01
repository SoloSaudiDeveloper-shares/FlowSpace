import { NextRequest, NextResponse } from "next/server"
import { createOllamaClient } from "@/lib/ai/ollama-client"
import { currentUserId } from "@/lib/auth/scope"

/**
 * POST /api/ai/chat
 *
 * Proxies chat requests to Ollama.
 * Supports both streaming (SSE) and non-streaming responses.
 *
 * Body: {
 *   model: string
 *   messages: { role: string, content: string }[]
 *   stream?: boolean
 *   temperature?: number
 *   maxTokens?: number
 *   ollamaUrl?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Auth-gate: this route fetches an arbitrary `ollamaUrl` server-side, so
    // only authenticated users may drive it (prevents anonymous SSRF probing).
    if (!(await currentUserId())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const body = await request.json()
    const {
      model,
      messages,
      stream = false,
      temperature = 0.7,
      maxTokens = 512,
      ollamaUrl,
      images,
    } = body

    if (!model || !messages?.length) {
      return NextResponse.json(
        { error: "model and messages are required" },
        { status: 400 },
      )
    }

    // If top-level `images` array is provided, attach to the last user message.
    // This supports the analyzeImage() flow where images are sent alongside a prompt.
    // Individual messages may also carry their own `images` field (passed through as-is).
    if (images?.length) {
      const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === "user")
      if (lastUserMsg) {
        lastUserMsg.images = images
      }
    }

    const client = createOllamaClient(ollamaUrl)

    if (stream) {
      const readable = client.chatStream({
        model,
        messages,
        options: {
          temperature,
          num_predict: maxTokens,
        },
      })

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      })
    }

    // Non-streaming
    const result = await client.chat({
      model,
      messages,
      options: {
        temperature,
        num_predict: maxTokens,
      },
    })

    return NextResponse.json({
      text: result.message?.content ?? "",
      model: result.model,
      evalCount: result.eval_count,
      totalDuration: result.total_duration,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[/api/ai/chat] Error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
