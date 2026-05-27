"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react"
import { aiManager, type OllamaInstalledModel } from "@/lib/ai/ai-manager"
import type {
  AIModelState,
  LLMGenerateOptions,
  LLMGenerateResult,
  TTSOptions,
  TTSResult,
  EmbeddingsOptions,
  EmbeddingsResult,
} from "@/lib/ai/types"
import { usePreferences } from "./use-preferences"

// ─── Context ─────────────────────────────────────────────────────────────

interface AIContextValue {
  /** Whether AI features are enabled */
  enabled: boolean
  /** Whether Ollama is connected */
  connected: boolean
  /** Installed models from Ollama */
  installedModels: OllamaInstalledModel[]
  /** Model states for all loaded models */
  modelStates: Map<string, AIModelState>
  /** Generate text with the configured LLM */
  generateText: (options: LLMGenerateOptions) => Promise<LLMGenerateResult>
  /** Analyze an image using the configured vision model */
  analyzeImage: (imageBase64: string, prompt: string) => Promise<{ text: string }>
  /** Speak text with browser SpeechSynthesis */
  speak: (options: TTSOptions) => Promise<TTSResult>
  /** Generate embeddings */
  embed: (options: EmbeddingsOptions) => Promise<EmbeddingsResult>
  /** Pre-load (or pull) a specific model */
  preloadModel: (modelId: string, capability: "tts" | "llm" | "embeddings" | "vision") => Promise<void>
  /** Dispose a specific model state */
  disposeModel: (modelId: string) => void
  /** Dispose all model states */
  disposeAll: () => void
  /** Stop playing TTS */
  stopSpeaking: () => void
  /** Whether TTS is currently playing */
  isSpeaking: boolean
  /** Refresh connection and model list */
  refreshConnection: () => Promise<void>
  /** Pull a new model from Ollama registry */
  pullModel: (modelId: string) => Promise<void>
  /** Delete a model from Ollama */
  deleteOllamaModel: (modelId: string) => Promise<void>
}

const AIContext = createContext<AIContextValue>({
  enabled: false,
  connected: false,
  installedModels: [],
  modelStates: new Map(),
  generateText: async () => ({ text: "" }),
  analyzeImage: async () => ({ text: "" }),
  speak: async () => ({ audioUrl: "", duration: 0 }),
  embed: async () => ({ embeddings: [], dimensions: 0 }),
  preloadModel: async () => {},
  disposeModel: () => {},
  disposeAll: () => {},
  stopSpeaking: () => {},
  isSpeaking: false,
  refreshConnection: async () => {},
  pullModel: async () => {},
  deleteOllamaModel: async () => {},
})

// ─── Provider ────────────────────────────────────────────────────────────

export function AIProvider({ children }: { children: ReactNode }) {
  const { preferences } = usePreferences()
  const enabled = preferences.aiEnabled ?? false
  const llmModel = preferences.aiLLMModel ?? "llama3.1:8b"
  const embeddingsModel = preferences.aiEmbeddingsModel ?? "nomic-embed-text"
  const visionModel = preferences.aiVisionModel ?? "llava:7b"
  const ollamaUrl = preferences.ollamaUrl ?? "http://localhost:11434"

  const [modelStates, setModelStates] = useState<Map<string, AIModelState>>(new Map())
  const [connected, setConnected] = useState(false)
  const [installedModels, setInstalledModels] = useState<OllamaInstalledModel[]>([])
  const [isSpeaking, setIsSpeaking] = useState(false)

  // Subscribe to model state changes
  useEffect(() => {
    const unsub = aiManager.subscribe((states) => {
      setModelStates(new Map(states))
    })
    return unsub
  }, [])

  // Sync Ollama URL and check connection when settings change
  useEffect(() => {
    if (!enabled) return

    aiManager.setOllamaUrl(ollamaUrl)
    aiManager.checkConnection().then((ok) => {
      setConnected(ok)
      setInstalledModels([...aiManager.installedModels])
    })
  }, [enabled, ollamaUrl])

  const refreshConnection = useCallback(async () => {
    aiManager.setOllamaUrl(ollamaUrl)
    const ok = await aiManager.checkConnection()
    setConnected(ok)
    setInstalledModels([...aiManager.installedModels])
  }, [ollamaUrl])

  const generateText = useCallback(
    async (options: LLMGenerateOptions): Promise<LLMGenerateResult> => {
      return aiManager.generateText(llmModel, options)
    },
    [llmModel],
  )

  const analyzeImage = useCallback(
    async (imageBase64: string, prompt: string): Promise<{ text: string }> => {
      return aiManager.analyzeImage(visionModel, imageBase64, prompt)
    },
    [visionModel],
  )

  const speak = useCallback(
    async (options: TTSOptions): Promise<TTSResult> => {
      setIsSpeaking(true)
      try {
        const result = await aiManager.speak("", options)
        return result
      } finally {
        setIsSpeaking(false)
      }
    },
    [],
  )

  const stopSpeaking = useCallback(() => {
    aiManager.stopSpeaking()
    setIsSpeaking(false)
  }, [])

  const embed = useCallback(
    async (options: EmbeddingsOptions): Promise<EmbeddingsResult> => {
      return aiManager.embed(embeddingsModel, options)
    },
    [embeddingsModel],
  )

  const preloadModel = useCallback(
    async (modelId: string, capability: "tts" | "llm" | "embeddings" | "vision") => {
      await aiManager.initModel(modelId, capability)
      setInstalledModels([...aiManager.installedModels])
    },
    [],
  )

  const pullModel = useCallback(async (modelId: string) => {
    await aiManager.pullModel(modelId)
    setInstalledModels([...aiManager.installedModels])
  }, [])

  const deleteOllamaModel = useCallback(async (modelId: string) => {
    await aiManager.deleteModel(modelId)
    setInstalledModels([...aiManager.installedModels])
  }, [])

  const disposeModel = useCallback((modelId: string) => {
    aiManager.disposeModel(modelId)
  }, [])

  const disposeAll = useCallback(() => {
    aiManager.disposeAll()
  }, [])

  return (
    <AIContext.Provider
      value={{
        enabled,
        connected,
        installedModels,
        modelStates,
        generateText,
        analyzeImage,
        speak,
        embed,
        preloadModel,
        disposeModel,
        disposeAll,
        stopSpeaking,
        isSpeaking,
        refreshConnection,
        pullModel,
        deleteOllamaModel,
      }}
    >
      {children}
    </AIContext.Provider>
  )
}

// ─── Hook ────────────────────────────────────────────────────────────────

export function useAI() {
  return useContext(AIContext)
}
