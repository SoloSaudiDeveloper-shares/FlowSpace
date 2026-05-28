/**
 * Abstract Speech Recognition Interface
 *
 * This is the swappable contract. To replace the speech engine:
 * 1. Create a new class implementing SpeechRecognizer
 * 2. Change the factory in speech-factory.ts
 * 3. Done — no other code needs to change.
 */

export interface SpeechRecognizerOptions {
  /** Language code (e.g. "en", "ar", "fr") */
  language?: string
  /** Process in real-time chunks vs full recording */
  streaming?: boolean
  /** WebAI.js model ID (e.g. "whisper-base", "moonshine-tiny-en") */
  modelId?: string
  /** API key for cloud-based engines (Groq). Browser-side. */
  apiKey?: string
  /** Callback fired with interim (partial) results */
  onInterim?: (text: string) => void
  /** Callback fired with final confirmed results */
  onResult?: (text: string) => void
  /** Callback fired when an error occurs */
  onError?: (error: SpeechError) => void
  /** Callback fired when recognition status changes */
  onStatusChange?: (status: SpeechStatus) => void
  /** Callback fired with download progress (0-100) */
  onDownloadProgress?: (progress: number) => void
}

export type SpeechStatus =
  | "idle"
  | "loading"       // Model downloading / initializing
  | "ready"         // Model loaded, waiting to start
  | "listening"     // Actively capturing audio
  | "processing"    // Transcribing audio (batch mode)
  | "error"

export interface SpeechError {
  code:
    | "model_load_failed"
    | "microphone_denied"
    | "not_supported"
    | "processing_failed"
    | "no_api_key"
    | "api_error"
    | "network_error"
    | "unknown"
  message: string
}

export interface SpeechRecognizer {
  /** Human-readable name for the engine */
  readonly name: string

  /** Whether this engine supports real-time streaming */
  readonly supportsStreaming: boolean

  /** Initialize the recognizer (download model if needed) */
  init(): Promise<void>

  /** Start listening and transcribing */
  start(): Promise<void>

  /** Stop listening */
  stop(): Promise<void>

  /** Whether the recognizer is currently listening */
  isListening(): boolean

  /** Get the current status */
  getStatus(): SpeechStatus

  /** Clean up resources (Web Workers, audio contexts, etc.) */
  dispose(): void
}

/** Available speech engine backends */
export type SpeechEngine = "webai" | "web-speech" | "groq"

/** Available WebAI.js speech models */
export const WEBAI_SPEECH_MODELS = [
  { id: "moonshine-tiny-en", name: "Moonshine Tiny (English)", size: "27 MB", sizeBytes: 27_000_000 },
  { id: "whisper-tiny-en", name: "Whisper Tiny (English)", size: "39 MB", sizeBytes: 39_000_000 },
  { id: "moonshine-base-en", name: "Moonshine Base (English)", size: "60 MB", sizeBytes: 60_000_000 },
  { id: "whisper-base", name: "Whisper Base (Multilingual)", size: "73 MB", sizeBytes: 73_000_000 },
  { id: "whisper-base-en", name: "Whisper Base (English)", size: "73 MB", sizeBytes: 73_000_000 },
] as const

export type WebAISpeechModelId = (typeof WEBAI_SPEECH_MODELS)[number]["id"]
