/**
 * AI Manager — Singleton (Client-Side)
 *
 * Manages AI capabilities via Ollama running on the server.
 * Communicates through Next.js API routes which proxy to Ollama.
 *
 * Architecture:
 *   Browser (this file) → fetch("/api/ai/...") → Next.js API Route → Ollama
 *
 * This replaces the previous WebAI.js browser-side implementation.
 * The interface is kept stable so all consumer components (AIActionButton,
 * TTSButton, EmbeddingsIndex, etc.) continue to work without changes.
 */

import type {
  AICapability,
  AIModelState,
  LLMGenerateOptions,
  LLMGenerateResult,
  EmbeddingsOptions,
  EmbeddingsResult,
} from "./types"

// ─── Types ──────────────────────────────────────────────────────────────────

type StateListener = (states: Map<string, AIModelState>) => void

export interface OllamaInstalledModel {
  name: string
  size: number
  family: string
  parameterSize: string
  quantization: string
}

// ─── Manager ────────────────────────────────────────────────────────────────

class AIManager {
  private states = new Map<string, AIModelState>()
  private listeners = new Set<StateListener>()
  private ollamaUrl = "http://localhost:11434"
  private _installedModels: OllamaInstalledModel[] = []
  private _connected = false

  // ─── Configuration ────────────────────────────────────────────────

  setOllamaUrl(url: string) {
    this.ollamaUrl = url.replace(/\/$/, "")
  }

  getOllamaUrl(): string {
    return this.ollamaUrl
  }

  get connected(): boolean {
    return this._connected
  }

  get installedModels(): OllamaInstalledModel[] {
    return this._installedModels
  }

  // ─── State Management ─────────────────────────────────────────────

  getState(modelId: string): AIModelState {
    return this.states.get(modelId) ?? { modelId, status: "idle", progress: -1 }
  }

  getAllStates(): Map<string, AIModelState> {
    return new Map(this.states)
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private setState(modelId: string, patch: Partial<AIModelState>) {
    const current = this.getState(modelId)
    const next = { ...current, ...patch }
    this.states.set(modelId, next)
    this.listeners.forEach((fn) => fn(this.states))
  }

  // ─── Connection Check ─────────────────────────────────────────────

  /** Check Ollama connection and refresh installed models list */
  async checkConnection(): Promise<boolean> {
    try {
      const url = `/api/ai/status?ollamaUrl=${encodeURIComponent(this.ollamaUrl)}`
      const res = await fetch(url)
      const data = await res.json()

      this._connected = data.status === "connected"

      if (this._connected) {
        await this.refreshModels()
      }

      return this._connected
    } catch {
      this._connected = false
      return false
    }
  }

  /** Refresh the list of installed models from Ollama */
  async refreshModels(): Promise<OllamaInstalledModel[]> {
    try {
      const url = `/api/ai/models?ollamaUrl=${encodeURIComponent(this.ollamaUrl)}`
      const res = await fetch(url)
      const data = await res.json()

      this._installedModels = data.models || []

      // Mark all installed models as "ready"
      for (const model of this._installedModels) {
        this.setState(model.name, { status: "ready", progress: 100 })
      }

      this.listeners.forEach((fn) => fn(this.states))
      return this._installedModels
    } catch {
      this._installedModels = []
      return []
    }
  }

  /** Check if a specific model is installed */
  isModelInstalled(modelId: string): boolean {
    return this._installedModels.some(
      (m) => m.name === modelId || m.name === `${modelId}:latest`,
    )
  }

  // ─── Model Management ─────────────────────────────────────────────

  /**
   * Ensure a model is available.
   * If not installed, pulls it from the Ollama registry.
   */
  async initModel(modelId: string, _capability: AICapability): Promise<void> {
    // If already ready, skip
    if (this.getState(modelId).status === "ready") return

    // Check if model is installed
    await this.refreshModels()
    if (this.isModelInstalled(modelId)) {
      this.setState(modelId, { status: "ready", progress: 100 })
      return
    }

    // Pull the model
    await this.pullModel(modelId)
  }

  /** Pull (download) a model from the Ollama registry with progress tracking */
  async pullModel(modelId: string): Promise<void> {
    this.setState(modelId, { status: "downloading", progress: 0 })

    try {
      const res = await fetch("/api/ai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "pull",
          model: modelId,
          ollamaUrl: this.ollamaUrl,
        }),
      })

      if (!res.ok) {
        throw new Error(`Pull failed: ${res.status}`)
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
          if (!line.startsWith("data: ")) continue
          const payload = line.slice(6).trim()
          if (!payload || payload === "[DONE]") continue

          try {
            const data = JSON.parse(payload)
            if (data.error) throw new Error(data.error)

            // Calculate progress from pull status
            if (data.total && data.completed) {
              const pct = Math.round((data.completed / data.total) * 100)
              this.setState(modelId, { progress: pct })
            }

            if (data.status === "success") {
              this.setState(modelId, { status: "ready", progress: 100 })
              await this.refreshModels()
              return
            }
          } catch (e) {
            if (e instanceof Error && e.message !== payload) throw e
          }
        }
      }

      // If we got here without "success", refresh and check
      await this.refreshModels()
      if (this.isModelInstalled(modelId)) {
        this.setState(modelId, { status: "ready", progress: 100 })
      } else {
        throw new Error("Pull completed but model not found")
      }
    } catch (err) {
      this.setState(modelId, {
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  }

  /** Delete a model from Ollama */
  async deleteModel(modelId: string): Promise<void> {
    try {
      await fetch("/api/ai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          model: modelId,
          ollamaUrl: this.ollamaUrl,
        }),
      })
      this.states.delete(modelId)
      await this.refreshModels()
    } catch (err) {
      console.error("[AIManager] Delete failed:", err)
    }
  }

  // ─── LLM ──────────────────────────────────────────────────────────

  async generateText(
    modelId: string,
    options: LLMGenerateOptions,
  ): Promise<LLMGenerateResult> {
    // Auto-init if needed
    if (!this.isModelInstalled(modelId)) {
      await this.initModel(modelId, "llm")
    }

    const body: Record<string, unknown> = {
      model: modelId,
      messages: options.messages,
      stream: !!options.onStream,
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens ?? 512,
      ollamaUrl: this.ollamaUrl,
    }

    // Pass images through for vision models
    if (options.images?.length) {
      body.images = options.images
    }

    // ── Streaming ───────────────────────────────────────────────────
    if (options.onStream) {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Chat request failed: ${res.status}`)
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullText = ""
      let sseBuffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        sseBuffer += decoder.decode(value, { stream: true })
        const lines = sseBuffer.split("\n")
        sseBuffer = lines.pop() || ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const payload = line.slice(6).trim()
          if (payload === "[DONE]") continue

          try {
            const data = JSON.parse(payload)
            if (data.error) throw new Error(data.error)
            if (data.token) {
              fullText += data.token
              options.onStream!(data.token)
            }
          } catch (e) {
            if (e instanceof Error && e.message !== payload) throw e
          }
        }
      }

      return { text: fullText }
    }

    // ── Non-streaming ───────────────────────────────────────────────
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || `Chat request failed: ${res.status}`)
    }

    const data = await res.json()
    return { text: data.text ?? "" }
  }

  // ─── Vision ───────────────────────────────────────────────────────

  /**
   * Analyze an image using a multimodal/vision model (e.g. LLaVA).
   * Sends the base64 image alongside a text prompt and returns the model's description.
   */
  async analyzeImage(
    modelId: string,
    imageBase64: string,
    prompt: string,
  ): Promise<{ text: string }> {
    // Auto-init if needed
    if (!this.isModelInstalled(modelId)) {
      await this.initModel(modelId, "vision")
    }

    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "user", content: prompt },
        ],
        images: [imageBase64],
        stream: false,
        temperature: 0.7,
        maxTokens: 1024,
        ollamaUrl: this.ollamaUrl,
      }),
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || `Vision request failed: ${res.status}`)
    }

    const data = await res.json()
    return { text: data.text ?? "" }
  }

  // ─── Embeddings ───────────────────────────────────────────────────

  async embed(
    modelId: string,
    options: EmbeddingsOptions,
  ): Promise<EmbeddingsResult> {
    if (!this.isModelInstalled(modelId)) {
      await this.initModel(modelId, "embeddings")
    }

    const res = await fetch("/api/ai/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelId,
        input: options.texts,
        ollamaUrl: this.ollamaUrl,
      }),
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || `Embeddings request failed: ${res.status}`)
    }

    const data = await res.json()
    return {
      embeddings: data.embeddings ?? [],
      dimensions: data.dimensions ?? 0,
    }
  }

  // ─── TTS (Browser SpeechSynthesis) ────────────────────────────────

  async speak(
    _modelId: string,
    options: { text: string; voice?: string; speed?: number },
  ): Promise<{ audioUrl: string; duration: number }> {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      throw new Error("Speech synthesis is not supported in this browser")
    }

    // Cancel any current speech
    window.speechSynthesis.cancel()

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(options.text)

      // Find voice matching preference
      if (options.voice) {
        const voices = window.speechSynthesis.getVoices()
        const match = voices.find(
          (v) => v.name === options.voice || v.voiceURI === options.voice,
        )
        if (match) utterance.voice = match
      }

      if (options.speed) utterance.rate = options.speed

      utterance.onend = () => resolve({ audioUrl: "", duration: 0 })
      utterance.onerror = (e) => reject(new Error(`TTS error: ${e.error}`))

      window.speechSynthesis.speak(utterance)
    })
  }

  /** Stop any current speech synthesis playback */
  stopSpeaking(): void {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
  }

  /** Check if speech synthesis is currently speaking */
  get isSpeaking(): boolean {
    if (typeof window === "undefined" || !window.speechSynthesis) return false
    return window.speechSynthesis.speaking
  }

  /** Get available speech synthesis voices */
  getVoices(): SpeechSynthesisVoice[] {
    if (typeof window === "undefined" || !window.speechSynthesis) return []
    return window.speechSynthesis.getVoices()
  }

  // ─── Dispose ──────────────────────────────────────────────────────

  disposeModel(modelId: string): void {
    // With Ollama, "dispose" just clears the local state.
    // Ollama manages its own memory — models auto-unload after timeout.
    this.states.delete(modelId)
    this.listeners.forEach((fn) => fn(this.states))
  }

  disposeAll(): void {
    this.states.clear()
    this.listeners.forEach((fn) => fn(this.states))
  }

  isReady(modelId: string): boolean {
    return this.getState(modelId).status === "ready"
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const aiManager = new AIManager()
