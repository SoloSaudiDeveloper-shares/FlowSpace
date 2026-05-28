/**
 * Speech Recognizer Factory
 *
 * Uses WebAI.js (default) or Web Speech API as engines.
 */

import type { SpeechEngine, SpeechRecognizer, SpeechRecognizerOptions } from "./types"

// ─── Change this to swap the default engine ──────────────────────────
// Default to Web Speech API — it works instantly without downloading models.
// Users can switch to WebAI.js (local Whisper) or Groq (cloud, free) in
// Settings → Speech.
export const DEFAULT_ENGINE: SpeechEngine = "web-speech"

// ─── Factory ─────────────────────────────────────────────────────────

export function createRecognizer(
  options: SpeechRecognizerOptions,
  engine: SpeechEngine = DEFAULT_ENGINE,
): SpeechRecognizer {
  switch (engine) {
    case "webai": {
      const { WebAIRecognizer } = require("./webai-recognizer")
      return new WebAIRecognizer(options)
    }
    case "web-speech": {
      const { WebSpeechRecognizer } = require("./web-speech-recognizer")
      return new WebSpeechRecognizer(options)
    }
    case "groq": {
      const { GroqRecognizer } = require("./groq-recognizer")
      return new GroqRecognizer(options)
    }
    default:
      throw new Error(`Unknown speech engine: ${engine}`)
  }
}

// ─── Feature detection ───────────────────────────────────────────────

export function isWebSpeechSupported(): boolean {
  if (typeof window === "undefined") return false
  return "SpeechRecognition" in window || "webkitSpeechRecognition" in window
}

export function isWebAISupported(): boolean {
  if (typeof window === "undefined") return false
  return typeof WebAssembly !== "undefined"
}

export function isGroqSupported(): boolean {
  if (typeof window === "undefined") return false
  return "MediaRecorder" in window && !!navigator.mediaDevices?.getUserMedia
}

export function getAvailableEngines(): { engine: SpeechEngine; name: string; supported: boolean }[] {
  return [
    {
      engine: "groq",
      name: "Groq Whisper — Cloud, free (2000/day, no card)",
      supported: isGroqSupported(),
    },
    {
      engine: "web-speech",
      name: "Web Speech API — Chrome/Edge only, no setup",
      supported: isWebSpeechSupported(),
    },
    {
      engine: "webai",
      name: "WebAI.js (Whisper/Moonshine) — Local, private, downloads model",
      supported: isWebAISupported(),
    },
  ]
}
