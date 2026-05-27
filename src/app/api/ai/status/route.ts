import { NextRequest, NextResponse } from "next/server"
import { createOllamaClient } from "@/lib/ai/ollama-client"

/**
 * GET /api/ai/status?ollamaUrl=...
 *
 * Check if Ollama is running and return server info.
 */
export async function GET(request: NextRequest) {
  try {
    const ollamaUrl = request.nextUrl.searchParams.get("ollamaUrl") || undefined
    const client = createOllamaClient(ollamaUrl)
    const available = await client.isAvailable()

    if (!available) {
      return NextResponse.json({
        status: "disconnected",
        message: "Ollama is not running. Start it with: ollama serve",
      })
    }

    const models = await client.listModels()
    return NextResponse.json({
      status: "connected",
      modelCount: models.length,
      models: models.map((m) => m.name),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({
      status: "error",
      message,
    })
  }
}
