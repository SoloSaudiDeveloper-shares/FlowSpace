/**
 * Web Speech API Recognizer (Fallback)
 *
 * Uses the browser's built-in SpeechRecognition API.
 * Works in Chrome/Edge. Audio is sent to Google's servers.
 *
 * This exists as a drop-in replacement to demonstrate
 * the swappable architecture. Swap engines by changing
 * one line in speech-factory.ts.
 */

import type {
  SpeechRecognizer,
  SpeechRecognizerOptions,
  SpeechStatus,
} from "./types"

/* eslint-disable @typescript-eslint/no-explicit-any */

export class WebSpeechRecognizer implements SpeechRecognizer {
  readonly name = "Web Speech API"
  readonly supportsStreaming = true

  private options: SpeechRecognizerOptions
  private status: SpeechStatus = "idle"
  private recognition: any = null
  private listening = false

  constructor(options: SpeechRecognizerOptions = {}) {
    this.options = options
  }

  async init(): Promise<void> {
    const SpeechRecognitionCtor = (
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
        : null
    )

    if (!SpeechRecognitionCtor) {
      this.setStatus("error")
      this.options.onError?.({
        code: "not_supported",
        message: "Web Speech API is not supported in this browser. Try Chrome or Edge.",
      })
      throw new Error("Web Speech API not supported")
    }

    this.recognition = new SpeechRecognitionCtor()
    this.recognition.continuous = true
    this.recognition.interimResults = true
    this.recognition.lang = this.options.language ?? "en-US"

    // Wire up events
    this.recognition.onresult = (event: any) => {
      let interim = ""
      let finalText = ""

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalText += result[0].transcript
        } else {
          interim += result[0].transcript
        }
      }

      if (interim) {
        this.options.onInterim?.(interim)
      }
      if (finalText) {
        this.options.onResult?.(finalText.trim())
      }
    }

    this.recognition.onerror = (event: any) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        this.options.onError?.({
          code: "microphone_denied",
          message: "Microphone access was denied.",
        })
      } else {
        this.options.onError?.({
          code: "unknown",
          message: `Speech recognition error: ${event.error}`,
        })
      }
      this.listening = false
      this.setStatus("ready")
    }

    this.recognition.onend = () => {
      // Auto-restart if we're still supposed to be listening
      if (this.listening && this.recognition) {
        try {
          this.recognition.start()
        } catch {
          // Ignore if already started
        }
      } else {
        this.setStatus("ready")
      }
    }

    this.setStatus("ready")
  }

  async start(): Promise<void> {
    if (this.listening) return
    if (!this.recognition) await this.init()
    if (!this.recognition) return

    try {
      this.recognition.start()
      this.listening = true
      this.setStatus("listening")
    } catch (err) {
      this.options.onError?.({
        code: "unknown",
        message: `Failed to start: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }

  async stop(): Promise<void> {
    if (!this.listening || !this.recognition) return

    this.listening = false
    this.recognition.stop()
    this.setStatus("ready")
  }

  isListening(): boolean {
    return this.listening
  }

  getStatus(): SpeechStatus {
    return this.status
  }

  dispose(): void {
    this.stop()
    this.recognition = null
    this.status = "idle"
  }

  private setStatus(status: SpeechStatus): void {
    this.status = status
    this.options.onStatusChange?.(status)
  }
}
