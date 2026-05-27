/**
 * AI Service Types
 *
 * Type definitions for AI capabilities powered by Ollama and browser APIs.
 *
 * Architecture:
 *   - LLM: Ollama (llama3.1, mistral, gemma2, phi3, qwen2.5, etc.)
 *   - Embeddings: Ollama (nomic-embed-text, all-minilm, etc.)
 *   - TTS: Browser SpeechSynthesis API (window.speechSynthesis)
 *   - STT: Phase 2 — Faster-Whisper integration (currently WebAI.js)
 */

// ─── Model Categories ────────────────────────────────────────────────────

export type AICapability = "tts" | "llm" | "embeddings" | "vision"

export interface AIModelInfo {
  id: string
  name: string
  capability: AICapability
  size: string
  sizeBytes: number
  description?: string
}

// ─── Model State ─────────────────────────────────────────────────────────

export type AIModelStatus = "idle" | "downloading" | "ready" | "error"

export interface AIModelState {
  modelId: string
  status: AIModelStatus
  progress: number // 0-100, -1 if unknown
  error?: string
}

// ─── LLM ─────────────────────────────────────────────────────────────────

export interface LLMMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface LLMGenerateOptions {
  messages: LLMMessage[]
  maxTokens?: number
  temperature?: number
  onStream?: (token: string) => void
  /** Base64-encoded images to include with the request (for vision models) */
  images?: string[]
}

export interface LLMGenerateResult {
  text: string
  tokenCount?: number
}

// ─── TTS ─────────────────────────────────────────────────────────────────

export interface TTSOptions {
  text: string
  voice?: string
  speed?: number
}

export interface TTSResult {
  audioUrl: string
  duration?: number
}

// ─── Embeddings ──────────────────────────────────────────────────────────

export interface EmbeddingsOptions {
  texts: string[]
  normalize?: boolean
  pooling?: "mean" | "cls"
}

export interface EmbeddingsResult {
  embeddings: number[][]
  dimensions: number
}

// ─── Recommended Ollama Models ──────────────────────────────────────────
//
// These are shown in the settings UI as suggestions.
// Users can also use any model installed in their Ollama instance.

export const AI_LLM_MODELS: AIModelInfo[] = [
  {
    id: "llama3.1:8b",
    name: "Llama 3.1 8B",
    capability: "llm",
    size: "4.7 GB",
    sizeBytes: 4_700_000_000,
    description: "Best all-round model — fast, capable, multilingual",
  },
  {
    id: "mistral:7b",
    name: "Mistral 7B",
    capability: "llm",
    size: "4.1 GB",
    sizeBytes: 4_100_000_000,
    description: "Great for writing, summaries, and code",
  },
  {
    id: "gemma2:9b",
    name: "Gemma 2 9B",
    capability: "llm",
    size: "5.4 GB",
    sizeBytes: 5_400_000_000,
    description: "Strong reasoning and instruction following",
  },
  {
    id: "phi3:3.8b",
    name: "Phi 3 3.8B",
    capability: "llm",
    size: "2.2 GB",
    sizeBytes: 2_200_000_000,
    description: "Compact — good for basic tasks on limited hardware",
  },
  {
    id: "qwen2.5:7b",
    name: "Qwen 2.5 7B",
    capability: "llm",
    size: "4.4 GB",
    sizeBytes: 4_400_000_000,
    description: "Excellent multilingual and coding support",
  },
]

export const AI_TTS_MODELS: AIModelInfo[] = [
  // TTS uses the browser's built-in SpeechSynthesis API — no downloadable models needed.
]

export const AI_EMBEDDINGS_MODELS: AIModelInfo[] = [
  {
    id: "nomic-embed-text",
    name: "Nomic Embed Text",
    capability: "embeddings",
    size: "274 MB",
    sizeBytes: 274_000_000,
    description: "Best local embeddings for semantic search",
  },
  {
    id: "all-minilm",
    name: "All-MiniLM",
    capability: "embeddings",
    size: "45 MB",
    sizeBytes: 45_000_000,
    description: "Lightweight and fast embeddings",
  },
]

export const AI_VISION_MODELS: AIModelInfo[] = [
  {
    id: "llava:7b",
    name: "LLaVA 7B",
    capability: "vision" as AICapability,
    size: "4.7 GB",
    sizeBytes: 4_700_000_000,
    description: "Multimodal — understands images and text",
  },
  {
    id: "llava-llama3:8b",
    name: "LLaVA Llama3 8B",
    capability: "vision" as AICapability,
    size: "5.5 GB",
    sizeBytes: 5_500_000_000,
    description: "Latest vision model with Llama 3 base",
  },
]

// ─── TTS Voices ────────────────────────────────────────────────────────
//
// Voices are provided by the browser's SpeechSynthesis API at runtime.
// Use window.speechSynthesis.getVoices() to list available voices.
// The user's preferred voice name is stored in preferences.aiTTSVoice.
