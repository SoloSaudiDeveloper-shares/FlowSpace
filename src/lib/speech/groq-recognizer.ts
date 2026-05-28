/**
 * Groq Whisper recognizer.
 *
 * Why: Web Speech API only works in Chrome/Edge and silently fails on iOS PWAs,
 * Safari, and Firefox. Local Whisper (WebAI.js) makes the user download 27–73 MB
 * on first use and is awkward on phones. Groq's `whisper-large-v3-turbo`
 * endpoint is free (2000 requests/day, no credit card), works in every modern
 * browser via `MediaRecorder`, returns in ~300 ms, and degrades gracefully when
 * offline. That makes it the most reliable cross-browser default we can ship
 * for a self-hosted app.
 *
 * The key is stored client-side (browser only — never reaches our server).
 * That's the same model we use for the OpenAI-compat AI provider key.
 */

import type {
  SpeechError,
  SpeechRecognizer,
  SpeechRecognizerOptions,
  SpeechStatus,
} from "./types"

export class GroqRecognizer implements SpeechRecognizer {
  readonly name = "Groq Whisper (cloud, free)"
  readonly supportsStreaming = false

  private options: SpeechRecognizerOptions
  private apiKey: string
  private status: SpeechStatus = "idle"
  private stream: MediaStream | null = null
  private recorder: MediaRecorder | null = null
  private chunks: Blob[] = []

  constructor(options: SpeechRecognizerOptions) {
    this.options = options
    this.apiKey = (options.apiKey ?? "").trim()
  }

  isListening(): boolean {
    return this.status === "listening"
  }
  getStatus(): SpeechStatus {
    return this.status
  }

  async init(): Promise<void> {
    if (!this.apiKey) {
      this.fail("no_api_key", "No Groq API key set. Add one in Settings → Speech.")
      return
    }
    if (typeof window === "undefined" || !("MediaRecorder" in window)) {
      this.fail("not_supported", "Your browser doesn't support audio recording.")
      return
    }
    this.setStatus("ready")
  }

  async start(): Promise<void> {
    if (!this.apiKey) {
      this.fail("no_api_key", "No Groq API key set. Add one in Settings → Speech.")
      return
    }
    try {
      // getUserMedia throws different errors depending on the browser — map
      // each to a user-friendly message so the toast tells the user exactly
      // what's wrong (denied permission vs no mic vs unsupported).
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      const e = err as DOMException
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        this.fail("microphone_denied", "Microphone permission denied. Click the lock icon in your address bar to grant access.")
      } else if (e.name === "NotFoundError") {
        this.fail("not_supported", "No microphone found. Check that one is plugged in and selected in your OS.")
      } else if (e.name === "NotReadableError") {
        this.fail("not_supported", "Microphone is busy — close other apps using it (Zoom, Meet, etc.) and try again.")
      } else {
        this.fail("unknown", `Couldn't access microphone: ${e.message || e.name || "unknown"}`)
      }
      return
    }

    const mime = pickSupportedMime()
    if (!mime) {
      this.fail("not_supported", "Your browser doesn't support a Groq-compatible audio format.")
      this.cleanup()
      return
    }

    this.chunks = []
    this.recorder = new MediaRecorder(this.stream, { mimeType: mime })
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data)
    }
    this.recorder.onstop = () => {
      void this.transcribeChunks(mime)
    }
    this.recorder.start()
    this.setStatus("listening")
  }

  async stop(): Promise<void> {
    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.stop()
    }
    if (this.stream) {
      for (const t of this.stream.getTracks()) t.stop()
      this.stream = null
    }
    // status moves to "processing" once we POST to Groq inside transcribeChunks
  }

  dispose(): void {
    this.cleanup()
    this.setStatus("idle")
  }

  // ── internals ──────────────────────────────────────────────────────

  private cleanup() {
    if (this.recorder && this.recorder.state !== "inactive") {
      try { this.recorder.stop() } catch { /* ignore */ }
    }
    this.recorder = null
    if (this.stream) {
      for (const t of this.stream.getTracks()) t.stop()
      this.stream = null
    }
    this.chunks = []
  }

  private async transcribeChunks(mime: string) {
    if (this.chunks.length === 0) {
      this.setStatus("ready")
      return
    }
    this.setStatus("processing")
    const blob = new Blob(this.chunks, { type: mime })
    this.chunks = []

    const form = new FormData()
    // Groq's endpoint mirrors OpenAI's transcription API.
    form.append("file", blob, "audio.webm")
    form.append("model", "whisper-large-v3-turbo")
    form.append("language", this.options.language || "en")
    form.append("response_format", "json")

    try {
      const res = await fetch(
        "https://api.groq.com/openai/v1/audio/transcriptions",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${this.apiKey}` },
          body: form,
        },
      )
      if (!res.ok) {
        const errText = await res.text().catch(() => "")
        const friendly =
          res.status === 401
            ? "Groq says the API key is invalid. Re-check it in Settings → Speech."
            : res.status === 429
              ? "Groq rate-limit hit. Free tier is 2000 requests/day — wait or switch engine."
              : `Groq returned ${res.status}: ${errText.slice(0, 120)}`
        this.fail("api_error", friendly)
        this.cleanup()
        return
      }
      const data = (await res.json()) as { text?: string }
      const text = (data.text ?? "").trim()
      if (text) {
        this.options.onResult?.(text)
      }
      this.setStatus("ready")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "network error"
      this.fail("network_error", `Couldn't reach Groq: ${msg}`)
      this.cleanup()
    }
  }

  private setStatus(s: SpeechStatus) {
    this.status = s
    this.options.onStatusChange?.(s)
  }
  private fail(code: SpeechError["code"], message: string) {
    this.setStatus("error")
    this.options.onError?.({ code, message })
  }
}

/** Pick a MIME type the browser will record AND Groq accepts. */
function pickSupportedMime(): string | null {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ]
  for (const m of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) {
      return m
    }
  }
  return null
}
