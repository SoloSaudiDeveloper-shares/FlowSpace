"use client"

import { useState } from "react"
import { CloudCog, Server, Check, X, Loader2, Eye, EyeOff, ExternalLink } from "lucide-react"
import { usePreferences } from "@/lib/hooks/use-preferences"
import { openaiPing, OPENAI_COMPAT_PRESETS } from "@/lib/ai/openai-client"
import { toast } from "sonner"

/**
 * Configures which AI backend the app talks to.
 * - "ollama": existing local-only path (unchanged behaviour)
 * - "openai-compat": any OpenAI Chat Completions–compatible endpoint
 *   — OpenAI, Gemini (compat layer), LM Studio, Ollama v1 shim, custom.
 *
 * Stored in user preferences (browser localStorage). A note warns the user
 * that API keys live in their browser; anyone with access to this device
 * could read them. For shared machines, sign out.
 */
export function AIProviderSection() {
  const { preferences, updatePreference } = usePreferences()
  const provider = preferences.aiProvider ?? "ollama"
  const baseUrl = preferences.aiOpenAIBaseUrl ?? ""
  const apiKey = preferences.aiOpenAIApiKey ?? ""
  const model = preferences.aiOpenAIModel ?? ""

  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [pingResult, setPingResult] = useState<"ok" | "fail" | null>(null)
  const [pingMessage, setPingMessage] = useState<string>("")

  function applyPreset(presetId: string) {
    const preset = OPENAI_COMPAT_PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    if (preset.baseUrl) updatePreference("aiOpenAIBaseUrl", preset.baseUrl)
    if (preset.modelHint && !preset.modelHint.startsWith("<"))
      updatePreference("aiOpenAIModel", preset.modelHint)
    if (!preset.needsKey) updatePreference("aiOpenAIApiKey", "")
  }

  async function testConnection() {
    setTesting(true)
    setPingResult(null)
    try {
      const res = await openaiPing({ baseUrl, apiKey, model })
      if (res.ok) {
        setPingResult("ok")
        setPingMessage(
          res.models && res.models.length
            ? `Connected. Saw ${res.models.length} models${model && res.models.includes(model) ? ` (including "${model}")` : ""}.`
            : "Connected. Endpoint reachable."
        )
        toast.success("AI connection OK")
      } else {
        setPingResult("fail")
        setPingMessage(res.error)
        toast.error("AI connection failed")
      }
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="px-4 py-3 rounded-lg border bg-card space-y-3">
      <h3 className="text-sm font-medium flex items-center gap-2">
        <CloudCog className="size-3.5 text-muted-foreground" />
        AI Provider
      </h3>
      <p className="text-xs text-muted-foreground">
        Pick a transport. Local-only (Ollama) keeps every prompt on your
        machine. The OpenAI-compatible option talks to any endpoint that
        speaks the OpenAI Chat Completions wire format — works with OpenAI,
        Gemini (compat layer), LM Studio, your own llama.cpp / vLLM
        server, and Ollama's own /v1 shim.
      </p>

      {/* Provider switch */}
      <div className="flex p-0.5 rounded-lg bg-muted/50 text-sm">
        {(["ollama", "openai-compat"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => updatePreference("aiProvider", p)}
            className={`flex-1 py-1.5 rounded-md font-medium transition-colors flex items-center justify-center gap-1.5 ${
              provider === p
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p === "ollama" ? <Server className="size-3.5" /> : <CloudCog className="size-3.5" />}
            {p === "ollama" ? "Local Ollama" : "OpenAI-compatible"}
          </button>
        ))}
      </div>

      {provider === "openai-compat" && (
        <div className="space-y-3 pt-2">
          {/* Preset picker */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Quick presets
            </label>
            <div className="flex flex-wrap gap-1.5">
              {OPENAI_COMPAT_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className="px-2.5 py-1 rounded-md text-xs border border-input hover:bg-accent transition-colors"
                  title={p.helpUrl ? `Help: ${p.helpUrl}` : undefined}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Base URL */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">
              Base URL
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => updatePreference("aiOpenAIBaseUrl", e.target.value)}
              placeholder="https://api.openai.com/v1"
              spellCheck={false}
              className="w-full h-9 rounded-md border border-input bg-background px-2.5 text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-[10px] text-muted-foreground">
              Either with or without trailing /v1 — both work.
            </p>
          </div>

          {/* API key */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">
              API key
              <span className="ml-1.5 text-muted-foreground/60">(blank for local endpoints)</span>
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => updatePreference("aiOpenAIApiKey", e.target.value)}
                placeholder="sk-… / AIza… / etc."
                autoComplete="off"
                spellCheck={false}
                className="w-full h-9 rounded-md border border-input bg-background px-2.5 pr-9 text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground"
              >
                {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-amber-300/90">
              ⚠️ Stored in your browser. Anyone with access to this device can read it.
              For shared machines: sign out when you're done.
            </p>
          </div>

          {/* Model */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">
              Model
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => updatePreference("aiOpenAIModel", e.target.value)}
              placeholder="gpt-4o-mini, gemini-2.5-flash, llama3.1:8b, etc."
              spellCheck={false}
              className="w-full h-9 rounded-md border border-input bg-background px-2.5 text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* Test button + result */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={testConnection}
              disabled={testing || !baseUrl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-input text-xs hover:bg-accent disabled:opacity-50"
            >
              {testing ? <Loader2 className="size-3.5 animate-spin" /> : <CloudCog className="size-3.5" />}
              {testing ? "Testing…" : "Test connection"}
            </button>
            {pingResult === "ok" && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                <Check className="size-3.5" />
                {pingMessage}
              </span>
            )}
            {pingResult === "fail" && (
              <span className="inline-flex items-center gap-1 text-xs text-rose-400 truncate" title={pingMessage}>
                <X className="size-3.5" />
                {pingMessage.slice(0, 60)}
              </span>
            )}
          </div>

          {/* Provider-specific help link */}
          <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 pt-1">
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
              <ExternalLink className="size-3" /> OpenAI key
            </a>
            <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
              <ExternalLink className="size-3" /> Gemini key (free tier)
            </a>
            <a href="https://ollama.com/download" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
              <ExternalLink className="size-3" /> Install Ollama
            </a>
            <a href="https://lmstudio.ai" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
              <ExternalLink className="size-3" /> LM Studio
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
