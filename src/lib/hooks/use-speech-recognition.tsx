"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react"
import type { SpeechRecognizer, SpeechStatus, SpeechEngine, SpeechError, WebAISpeechModelId } from "@/lib/speech/types"
import { WEBAI_SPEECH_MODELS } from "@/lib/speech/types"
import { createRecognizer, DEFAULT_ENGINE, getAvailableEngines } from "@/lib/speech/speech-factory"

// ─── Context ──────────────────────────────────────────────────────────

interface SpeechContextValue {
  /** Current recognizer status */
  status: SpeechStatus
  /** Whether currently listening */
  isListening: boolean
  /** Latest interim (partial) transcript */
  interimText: string
  /** Full transcript accumulated during the session */
  transcript: string
  /** Any error that occurred */
  error: SpeechError | null
  /** Currently active engine */
  engine: SpeechEngine
  /** Currently selected speech model (WebAI only) */
  speechModel: WebAISpeechModelId
  /** Available engines with support status */
  availableEngines: ReturnType<typeof getAvailableEngines>
  /** ID of the SpeechButton instance that is currently listening */
  activeButtonId: string | null
  /** Initialize the recognizer (downloads model) */
  init: () => Promise<void>
  /** Start listening (pass a button ID to scope results) */
  startListening: (buttonId?: string) => Promise<void>
  /** Stop listening */
  stopListening: () => Promise<void>
  /** Toggle listening on/off (pass a button ID to scope results) */
  toggleListening: (buttonId?: string) => Promise<void>
  /** Clear the transcript */
  clearTranscript: () => void
  /** Switch to a different engine */
  switchEngine: (engine: SpeechEngine) => void
  /** Switch the WebAI speech model */
  switchModel: (modelId: WebAISpeechModelId) => void
  /** Model loading progress (0-100, -1 if unknown) */
  loadProgress: number
  /** Unload the speech model from memory */
  unloadModel: () => void
}

const SpeechContext = createContext<SpeechContextValue>({
  status: "idle",
  isListening: false,
  interimText: "",
  transcript: "",
  error: null,
  engine: DEFAULT_ENGINE,
  speechModel: "whisper-base",
  availableEngines: [],
  activeButtonId: null,
  init: async () => {},
  startListening: async () => {},
  stopListening: async () => {},
  toggleListening: async () => {},
  clearTranscript: () => {},
  switchEngine: () => {},
  switchModel: () => {},
  loadProgress: -1,
  unloadModel: () => {},
})

// ─── Provider ─────────────────────────────────────────────────────────

export function SpeechProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SpeechStatus>("idle")
  const [isListening, setIsListening] = useState(false)
  const [interimText, setInterimText] = useState("")
  const [transcript, setTranscript] = useState("")
  const [error, setError] = useState<SpeechError | null>(null)
  const [engine, setEngine] = useState<SpeechEngine>(DEFAULT_ENGINE)
  const [speechModel, setSpeechModel] = useState<WebAISpeechModelId>("whisper-base")
  const [loadProgress, setLoadProgress] = useState(-1)
  const [activeButtonId, setActiveButtonId] = useState<string | null>(null)

  const recognizerRef = useRef<SpeechRecognizer | null>(null)

  // Compute available engines only after mount to avoid SSR/client hydration mismatch
  const [availableEngines, setAvailableEngines] = useState<ReturnType<typeof getAvailableEngines>>([])
  useEffect(() => {
    setAvailableEngines(getAvailableEngines())
  }, [])

  // Create recognizer with callbacks
  const buildRecognizer = useCallback(
    (eng: SpeechEngine, modelId?: WebAISpeechModelId): SpeechRecognizer => {
      return createRecognizer(
        {
          language: "en",
          modelId,
          onInterim: (text) => {
            setInterimText(text)
          },
          onResult: (text) => {
            setTranscript((prev) => (prev ? `${prev} ${text}` : text))
            setInterimText("")
          },
          onError: (err) => {
            setError(err)
            setIsListening(false)
          },
          onStatusChange: (s) => {
            setStatus(s)
            if (s === "loading") setLoadProgress(0)
            if (s === "ready") setLoadProgress(100)
            if (s === "listening") setIsListening(true)
            if (s === "error") setIsListening(false)
          },
          onDownloadProgress: (pct) => {
            if (pct >= 0) setLoadProgress(Math.round(pct))
          },
        },
        eng,
      )
    },
    [],
  )

  // Initialize the recognizer
  const init = useCallback(async () => {
    if (recognizerRef.current && status === "ready") return
    if (!recognizerRef.current) {
      recognizerRef.current = buildRecognizer(engine, speechModel)
    }
    try {
      await recognizerRef.current.init()
    } catch {
      // Error already handled via onError callback
    }
  }, [engine, speechModel, status, buildRecognizer])

  // Start listening
  const startListening = useCallback(async (buttonId?: string) => {
    setError(null)
    setActiveButtonId(buttonId ?? null)
    if (!recognizerRef.current) {
      recognizerRef.current = buildRecognizer(engine, speechModel)
    }
    try {
      if (recognizerRef.current.getStatus() === "idle") {
        await recognizerRef.current.init()
      }
      await recognizerRef.current.start()
    } catch {
      // Error already handled via onError callback
    }
  }, [engine, speechModel, buildRecognizer])

  // Stop listening
  const stopListening = useCallback(async () => {
    if (recognizerRef.current) {
      await recognizerRef.current.stop()
    }
    setIsListening(false)
    setActiveButtonId(null)
  }, [])

  // Toggle
  const toggleListening = useCallback(async (buttonId?: string) => {
    if (isListening) {
      await stopListening()
    } else {
      await startListening(buttonId)
    }
  }, [isListening, startListening, stopListening])

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setTranscript("")
    setInterimText("")
  }, [])

  // Switch engine
  const switchEngine = useCallback(
    (newEngine: SpeechEngine) => {
      if (newEngine === engine) return
      if (recognizerRef.current) {
        recognizerRef.current.dispose()
        recognizerRef.current = null
      }
      setEngine(newEngine)
      setStatus("idle")
      setIsListening(false)
      setInterimText("")
      setError(null)
      setLoadProgress(-1)
    },
    [engine],
  )

  // Switch speech model (WebAI only)
  const switchModel = useCallback(
    (modelId: WebAISpeechModelId) => {
      if (modelId === speechModel) return
      if (recognizerRef.current) {
        recognizerRef.current.dispose()
        recognizerRef.current = null
      }
      setSpeechModel(modelId)
      setStatus("idle")
      setIsListening(false)
      setInterimText("")
      setError(null)
      setLoadProgress(-1)
    },
    [speechModel],
  )

  // Unload the speech model from memory
  const unloadModel = useCallback(() => {
    if (recognizerRef.current) {
      if (isListening) {
        recognizerRef.current.stop()
      }
      recognizerRef.current.dispose()
      recognizerRef.current = null
    }
    setStatus("idle")
    setIsListening(false)
    setInterimText("")
    setError(null)
    setLoadProgress(-1)
    setActiveButtonId(null)
  }, [isListening])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognizerRef.current) {
        recognizerRef.current.dispose()
      }
    }
  }, [])

  return (
    <SpeechContext.Provider
      value={{
        status,
        isListening,
        interimText,
        transcript,
        error,
        engine,
        speechModel,
        availableEngines,
        activeButtonId,
        init,
        startListening,
        stopListening,
        toggleListening,
        clearTranscript,
        switchEngine,
        switchModel,
        loadProgress,
        unloadModel,
      }}
    >
      {children}
    </SpeechContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────

export function useSpeechRecognition() {
  return useContext(SpeechContext)
}
