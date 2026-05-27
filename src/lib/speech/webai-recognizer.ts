/**
 * WebAI.js Speech Recognizer
 *
 * Uses @axols/webai-js to run Whisper/Moonshine speech models
 * entirely in the browser via ONNX Runtime (WebGPU or WASM).
 *
 * Audio pipeline:
 * 1. MediaRecorder captures microphone audio
 * 2. Every CHUNK_MS, audio is harvested as a Blob
 * 3. Blob -> object URL -> webai.generate({ audio_blob_url }) -> text
 * 4. No manual AudioContext decoding needed — WebAI handles it
 */

import type {
  SpeechRecognizer,
  SpeechRecognizerOptions,
  SpeechStatus,
} from "./types"

// ─── Config ────────────────────────────────────────────────────────────────

const DEFAULT_MODEL = "whisper-base"
const CHUNK_MS = 5000 // Process audio every 5 seconds

// ─── Recognizer ────────────────────────────────────────────────────────────

export class WebAIRecognizer implements SpeechRecognizer {
  readonly name = "WebAI.js (Speech)"
  readonly supportsStreaming = false

  private options: SpeechRecognizerOptions
  private modelId: string
  private status: SpeechStatus = "idle"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private webai: any = null
  private mediaRecorder: MediaRecorder | null = null
  private audioStream: MediaStream | null = null
  private chunks: Blob[] = []
  private chunkTimer: ReturnType<typeof setInterval> | null = null
  private listening = false
  private processing = false

  constructor(options: SpeechRecognizerOptions = {}) {
    this.options = options
    this.modelId = options.modelId || DEFAULT_MODEL
  }

  // ─── Public Interface ───────────────────────────────────────────────

  async init(): Promise<void> {
    if (this.webai) return

    this.setStatus("loading")

    try {
      const { WebAI } = await import("@axols/webai-js")

      this.webai = await WebAI.create({ modelId: this.modelId })

      await this.webai.init({
        mode: "auto",
        onDownloadProgress: (progress: { progress?: number }) => {
          const pct = typeof progress?.progress === "number" ? progress.progress : -1
          this.options.onDownloadProgress?.(pct)
          this.options.onStatusChange?.("loading")
        },
      })

      this.setStatus("ready")
    } catch (err) {
      this.setStatus("error")
      this.options.onError?.({
        code: "model_load_failed",
        message: `Failed to load WebAI model "${this.modelId}": ${err instanceof Error ? err.message : String(err)}`,
      })
      throw err
    }
  }

  async start(): Promise<void> {
    if (this.listening) return
    if (!this.webai) await this.init()

    // Request microphone
    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
    } catch (err) {
      this.setStatus("error")
      this.options.onError?.({
        code: "microphone_denied",
        message: `Microphone access denied: ${err instanceof Error ? err.message : String(err)}`,
      })
      return
    }

    this.listening = true
    this.chunks = []
    this.setStatus("listening")

    // Start recording
    this.startRecorder()

    // Process chunks periodically
    this.chunkTimer = setInterval(() => {
      if (!this.listening) return
      this.harvestAndProcess()
    }, CHUNK_MS)
  }

  async stop(): Promise<void> {
    if (!this.listening) return
    this.listening = false

    if (this.chunkTimer) {
      clearInterval(this.chunkTimer)
      this.chunkTimer = null
    }

    this.stopRecorder()
    await this.sleep(200) // Let ondataavailable fire

    // Process remaining audio
    if (this.chunks.length > 0) {
      this.setStatus("processing")
      await this.processChunks()
    }

    // Release microphone
    if (this.audioStream) {
      this.audioStream.getTracks().forEach((t) => t.stop())
      this.audioStream = null
    }

    this.setStatus("ready")
  }

  isListening(): boolean {
    return this.listening
  }

  getStatus(): SpeechStatus {
    return this.status
  }

  dispose(): void {
    if (this.listening) {
      this.listening = false
      if (this.chunkTimer) {
        clearInterval(this.chunkTimer)
        this.chunkTimer = null
      }
      this.stopRecorder()
      if (this.audioStream) {
        this.audioStream.getTracks().forEach((t) => t.stop())
        this.audioStream = null
      }
    }
    if (this.webai) {
      try { this.webai.terminate() } catch { /* ignore */ }
      this.webai = null
    }
    this.status = "idle"
  }

  // ─── Private: Recording ─────────────────────────────────────────────

  private startRecorder(): void {
    if (!this.audioStream) return

    const mimeType = this.getSupportedMimeType()
    this.mediaRecorder = new MediaRecorder(this.audioStream, { mimeType })

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.chunks.push(e.data)
      }
    }

    this.mediaRecorder.start()
  }

  private stopRecorder(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try { this.mediaRecorder.stop() } catch { /* ignore */ }
    }
    this.mediaRecorder = null
  }

  private async harvestAndProcess(): Promise<void> {
    if (this.processing || !this.listening) return

    this.stopRecorder()
    await this.sleep(150)

    if (this.chunks.length > 0) {
      await this.processChunks()
    }

    if (this.listening && this.audioStream) {
      this.startRecorder()
    }
  }

  // ─── Private: Transcription ─────────────────────────────────────────

  private async processChunks(): Promise<void> {
    if (!this.webai || this.chunks.length === 0) return

    this.processing = true

    try {
      // Merge chunks into one blob
      const blob = new Blob(this.chunks, { type: this.chunks[0].type })
      this.chunks = []

      // Skip very short audio (< 0.5 seconds approximately)
      if (blob.size < 4000) {
        this.processing = false
        return
      }

      // Show interim indicator
      this.options.onInterim?.("...")

      // Convert webm/opus to WAV — WebAI.js uses mpg123 internally which
      // cannot decode webm/opus. We decode via AudioContext then re-encode
      // as a proper WAV file.
      const wavBlob = await this.convertToWav(blob)
      const blobUrl = URL.createObjectURL(wavBlob)

      try {
        const modelConfig: Record<string, unknown> = {
          target_sample_rate: 16000,
        }

        // Run transcription via WebAI.js
        const result = await this.webai.generate({
          userInput: {
            audio_blob_url: blobUrl,
          },
          modelConfig,
        })

        // Extract text
        const text: string = (result?.result ?? result?.text ?? "").trim()

        // Filter out hallucination artifacts
        if (text && text.length > 1 && !this.isHallucination(text)) {
          this.options.onResult?.(text)
        } else {
          this.options.onInterim?.("")
        }
      } finally {
        URL.revokeObjectURL(blobUrl)
      }
    } catch (err) {
      console.error("[WebAI Speech] Transcription error:", err)
      this.options.onError?.({
        code: "processing_failed",
        message: `Transcription failed: ${err instanceof Error ? err.message : String(err)}`,
      })
    } finally {
      this.processing = false
    }
  }

  // ─── Private: Audio Format Conversion ──────────────────────────────

  /**
   * Converts a recorded audio blob (webm/opus) to 16kHz mono WAV.
   * WebAI.js internally uses mpg123 which only handles MP3/WAV,
   * so we must convert before passing audio for transcription.
   */
  private async convertToWav(blob: Blob): Promise<Blob> {
    const arrayBuffer = await blob.arrayBuffer()
    const audioCtx = new AudioContext({ sampleRate: 16000 })

    try {
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)

      // Get mono channel (mix down if stereo)
      const numChannels = 1
      const sampleRate = 16000
      let samples: Float32Array

      if (audioBuffer.numberOfChannels === 1) {
        // Resample if needed
        if (audioBuffer.sampleRate === sampleRate) {
          samples = audioBuffer.getChannelData(0)
        } else {
          samples = this.resample(audioBuffer.getChannelData(0), audioBuffer.sampleRate, sampleRate)
        }
      } else {
        // Mix channels to mono then resample
        const left = audioBuffer.getChannelData(0)
        const right = audioBuffer.getChannelData(1)
        const mono = new Float32Array(left.length)
        for (let i = 0; i < left.length; i++) {
          mono[i] = (left[i] + right[i]) / 2
        }
        if (audioBuffer.sampleRate === sampleRate) {
          samples = mono
        } else {
          samples = this.resample(mono, audioBuffer.sampleRate, sampleRate)
        }
      }

      // Encode as WAV
      return this.encodeWav(samples, sampleRate, numChannels)
    } finally {
      await audioCtx.close()
    }
  }

  private resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
    const ratio = fromRate / toRate
    const outputLength = Math.round(input.length / ratio)
    const output = new Float32Array(outputLength)
    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i * ratio
      const low = Math.floor(srcIndex)
      const high = Math.min(low + 1, input.length - 1)
      const frac = srcIndex - low
      output[i] = input[low] * (1 - frac) + input[high] * frac
    }
    return output
  }

  private encodeWav(samples: Float32Array, sampleRate: number, numChannels: number): Blob {
    const bitsPerSample = 16
    const bytesPerSample = bitsPerSample / 8
    const dataLength = samples.length * bytesPerSample
    const buffer = new ArrayBuffer(44 + dataLength)
    const view = new DataView(buffer)

    // RIFF header
    this.writeString(view, 0, "RIFF")
    view.setUint32(4, 36 + dataLength, true)
    this.writeString(view, 8, "WAVE")

    // fmt chunk
    this.writeString(view, 12, "fmt ")
    view.setUint32(16, 16, true) // chunk size
    view.setUint16(20, 1, true) // PCM format
    view.setUint16(22, numChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * numChannels * bytesPerSample, true)
    view.setUint16(32, numChannels * bytesPerSample, true)
    view.setUint16(34, bitsPerSample, true)

    // data chunk
    this.writeString(view, 36, "data")
    view.setUint32(40, dataLength, true)

    // Write PCM samples (float32 -> int16)
    let offset = 44
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]))
      const val = s < 0 ? s * 0x8000 : s * 0x7FFF
      view.setInt16(offset, val, true)
      offset += 2
    }

    return new Blob([buffer], { type: "audio/wav" })
  }

  private writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  // ─── Private: Hallucination Filter ──────────────────────────────────

  private isHallucination(text: string): boolean {
    const lower = text.toLowerCase().trim()

    // Known Whisper hallucination outputs
    const HALLUCINATIONS = [
      "you", "thank you", "thanks for watching", "subscribe",
      "like and subscribe", "bye", "the end", "thank you for watching",
      "thanks", "i'm going to", "so", "um", "uh",
      "[BLANK_AUDIO]",
    ]
    if (HALLUCINATIONS.includes(lower)) return true

    // Starts with bracket or paren — "(music)", "[silence]", etc.
    if (lower.startsWith("(") || lower.startsWith("[")) return true

    // Check for repeated word pattern: "you you you"
    const words = lower.split(/\s+/).filter(Boolean)
    if (words.length >= 2) {
      const unique = new Set(words)
      if (unique.size === 1) return true
      if (words.length >= 4) {
        const counts = new Map<string, number>()
        for (const w of words) counts.set(w, (counts.get(w) || 0) + 1)
        const maxCount = Math.max(...counts.values())
        if (maxCount / words.length > 0.7) return true
      }
    }

    return false
  }

  // ─── Private: Utilities ─────────────────────────────────────────────

  private getSupportedMimeType(): string {
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
      "audio/wav",
    ]
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type
    }
    return "audio/webm"
  }

  private setStatus(status: SpeechStatus): void {
    this.status = status
    this.options.onStatusChange?.(status)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms))
  }
}
