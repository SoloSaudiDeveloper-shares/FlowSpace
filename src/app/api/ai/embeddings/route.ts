import { NextRequest, NextResponse } from "next/server"
import { createOllamaClient } from "@/lib/ai/ollama-client"

/**
 * POST /api/ai/embeddings
 *
 * Generate embeddings via Ollama.
 *
 * Body: {
 *   model: string
 *   input: string | string[]
 *   ollamaUrl?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { model, input, ollamaUrl } = body

    if (!model || !input) {
      return NextResponse.json(
        { error: "model and input are required" },
        { status: 400 },
      )
    }

    const client = createOllamaClient(ollamaUrl)
    const result = await client.embed({ model, input })

    return NextResponse.json({
      embeddings: result.embeddings,
      model: result.model,
      dimensions: result.embeddings?.[0]?.length ?? 0,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[/api/ai/embeddings] Error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
