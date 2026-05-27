import { NextRequest, NextResponse } from "next/server"
import { createOllamaClient } from "@/lib/ai/ollama-client"

/**
 * GET /api/ai/models?ollamaUrl=...
 *
 * List locally available Ollama models.
 */
export async function GET(request: NextRequest) {
  try {
    const ollamaUrl = request.nextUrl.searchParams.get("ollamaUrl") || undefined
    const client = createOllamaClient(ollamaUrl)
    const models = await client.listModels()

    return NextResponse.json({
      models: models.map((m) => ({
        name: m.name,
        size: m.size,
        family: m.details?.family ?? "",
        parameterSize: m.details?.parameter_size ?? "",
        quantization: m.details?.quantization_level ?? "",
        modifiedAt: m.modified_at,
      })),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/ai/models
 *
 * Pull (download) or delete a model.
 *
 * Body: {
 *   action: "pull" | "delete"
 *   model: string
 *   ollamaUrl?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, model, ollamaUrl } = body

    if (!action || !model) {
      return NextResponse.json(
        { error: "action and model are required" },
        { status: 400 },
      )
    }

    const client = createOllamaClient(ollamaUrl)

    if (action === "pull") {
      const stream = client.pullStream(model)
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      })
    }

    if (action === "delete") {
      await client.deleteModel(model)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
