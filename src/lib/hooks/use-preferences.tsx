"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react"

// ─── Types ────────────────────────────────────────────────────────────────

export type FontFamily = "geist" | "inter" | "jakarta" | "dm-sans"
export type FontSize = "small" | "default" | "large"
export type AccentColor = "neutral" | "blue" | "violet" | "rose" | "green" | "orange" | "teal"
export type BorderRadius = "none" | "small" | "default" | "large" | "full"
export type GanttTooltipField = "status" | "priority" | "dates" | "completion"

// Sidebar section keys — match the group keys used in app-sidebar.tsx
export type SidebarSectionKey =
  | "favorites"
  | "projects"
  | "type:page"
  | "type:canvas"
  | "type:todo_list"
  | "type:reminder"
  | "type:process"
  | "platform"

export type ClockDateFormat = "short" | "long" | "iso" | "weekday"
export type ClockMode = "digital" | "analog"

export interface ClockPreferences {
  show: boolean
  format24: boolean
  showSeconds: boolean
  showDate: boolean
  secondTimezoneLabel: string  // empty = none; e.g. "UTC" or "America/Los_Angeles"
  /** Optional accent color for the time digits / clock face hand */
  accentColor?: string
  /** Display style for the date chip */
  dateFormat?: ClockDateFormat
  /** Digital pill or round analog face */
  mode?: ClockMode
}

export interface FeedTickerPreferences {
  show: boolean
  position: "top" | "bottom"
  direction: "ltr" | "rtl"
  speedSec: number   // time for one full loop (lower = faster)
  /** True (default) = stuck to top/bottom of viewport. False = floating
   * draggable + resizable widget anchored by `float`. */
  pinned: boolean
  /** Position + size used when `pinned` is false. Coordinates are absolute
   * pixels from the top-left of the viewport. Width/height in px. */
  float?: { x: number; y: number; w: number; h: number }
}

export interface Preferences {
  fontFamily: FontFamily
  fontSize: FontSize
  accentColor: AccentColor
  borderRadius: BorderRadius
  ganttTooltipFields: GanttTooltipField[]
  speechEnabled: boolean
  /** Groq API key for the cloud Whisper engine. Browser-only, never sent to
   * our server — same trust model as `aiOpenAIApiKey`. */
  speechGroqApiKey: string
  aiEnabled: boolean
  aiLLMModel: string
  aiTTSModel: string
  aiTTSVoice: string
  aiEmbeddingsModel: string
  aiVisionModel: string
  ollamaUrl: string
  /** Which AI transport to use. "ollama" hits the existing local client;
   * "openai-compat" routes through the generic OpenAI-style chat API. */
  aiProvider: "ollama" | "openai-compat"
  /** Base URL for the OpenAI-compatible endpoint, e.g.
   * https://api.openai.com/v1, https://generativelanguage.googleapis.com/v1beta/openai,
   * http://localhost:1234/v1 (LM Studio), http://localhost:11434/v1 (Ollama v1 shim). */
  aiOpenAIBaseUrl: string
  /** API key for the OpenAI-compat endpoint. Empty for local endpoints. */
  aiOpenAIApiKey: string
  /** Model name for the OpenAI-compat endpoint. */
  aiOpenAIModel: string
  aiSystemPrompts: Record<string, string>
  // Sidebar customisation
  sidebarVisible: Record<SidebarSectionKey, boolean>
  sidebarOrder: SidebarSectionKey[]
  /** User-renamed section labels. Empty / missing keys fall back to defaults. */
  sidebarLabels: Partial<Record<SidebarSectionKey, string>>
  /** User-picked accent color per section. Tints the section icon, count
   * badge, and a thin left edge when expanded. Empty = default neutral. */
  sidebarSectionColors: Partial<Record<SidebarSectionKey, string>>
  // Top-bar clock
  clock: ClockPreferences
  // Scrolling feed ticker
  feedTicker: FeedTickerPreferences
  /** Personal tagline shown in the sidebar header under the admin-set
   * workspace name. Empty = show the default "Workspace" placeholder. */
  workspaceSuffix: string
  /** Which home-dashboard sections this user wants visible. Missing keys
   * default to true. */
  homeSections: Partial<Record<HomeSectionKey, boolean>>
}

// Home dashboard sections — each one can be toggled on/off by the user.
export type HomeSectionKey =
  | "hero"
  | "kpi"
  | "pulse"
  | "today"
  | "activity"
  | "quickCapture"
  | "recent"

// ─── Defaults ─────────────────────────────────────────────────────────────

export const DEFAULT_PREFERENCES: Preferences = {
  fontFamily: "geist",
  fontSize: "default",
  accentColor: "neutral",
  borderRadius: "default",
  ganttTooltipFields: ["status", "priority", "dates", "completion"],
  speechEnabled: true,
  speechGroqApiKey: "",
  aiEnabled: false,
  aiLLMModel: "llama3.1:8b",
  aiTTSModel: "",
  aiTTSVoice: "",
  aiEmbeddingsModel: "nomic-embed-text",
  aiVisionModel: "llava:7b",
  ollamaUrl: "http://localhost:11434",
  aiProvider: "ollama",
  aiOpenAIBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  aiOpenAIApiKey: "",
  aiOpenAIModel: "gemini-2.5-flash",
  aiSystemPrompts: {
    summarize: "You are a concise summarizer. Provide a brief summary in 1-3 sentences.",
    expand: "You are a writing assistant. Expand the given text with more detail while keeping the same tone.",
    fix_grammar: "You are a proofreader. Fix grammar and spelling errors. Return only the corrected text, no explanations.",
    improve: "You are a writing assistant. Improve the clarity and flow of the text. Return only the improved text.",
    continue: "You are a writing assistant. Continue the text naturally, matching the style and tone. Write 2-3 more sentences.",
    generate_todos: "You are a task planner. Given a goal or description, generate a concise numbered list of actionable todo items (3-7 items). Return only the numbered list.",
  },
  sidebarVisible: {
    favorites: true,
    projects: true,
    "type:page": true,
    "type:canvas": true,
    "type:todo_list": true,
    "type:reminder": true,
    "type:process": true,
    platform: true,
  },
  sidebarOrder: [
    "favorites",
    "projects",
    "type:page",
    "type:canvas",
    "type:todo_list",
    "type:reminder",
    "type:process",
    "platform",
  ],
  sidebarLabels: {},
  sidebarSectionColors: {},
  clock: {
    show: true,
    format24: true,
    showSeconds: false,
    showDate: true,
    secondTimezoneLabel: "",
    accentColor: undefined,
    dateFormat: "short",
    mode: "digital",
  },
  feedTicker: {
    show: true,
    position: "top",
    direction: "rtl",   // common for news tickers: enters from the right
    speedSec: 90,
    pinned: true,
    float: undefined,
  },
  workspaceSuffix: "",
  homeSections: {
    hero: true,
    kpi: true,
    pulse: true,
    today: true,
    activity: true,
    quickCapture: true,
    recent: true,
  },
}

export const HOME_SECTION_LABELS: Record<HomeSectionKey, string> = {
  hero: "Greeting & quick actions",
  kpi: "KPI stat cards",
  pulse: "Project pulse (charts)",
  today: "Today & upcoming",
  activity: "Activity heatmap",
  quickCapture: "Quick capture",
  recent: "Recent items",
}

// Friendly labels for the sidebar sections (used in Settings UI)
export const SIDEBAR_SECTION_LABELS: Record<SidebarSectionKey, string> = {
  favorites: "Favorites",
  projects: "Projects",
  "type:page": "Pages",
  "type:canvas": "Canvases",
  "type:todo_list": "Todo Lists",
  "type:reminder": "Reminders",
  "type:process": "Processes",
  platform: "Platform",
}

// ─── Labels & metadata ───────────────────────────────────────────────────

export const FONT_OPTIONS: {
  value: FontFamily
  label: string
  description: string
  preview: string
}[] = [
  {
    value: "geist",
    label: "Geist",
    description: "Modern and minimal",
    preview: "The quick brown fox jumps over the lazy dog",
  },
  {
    value: "inter",
    label: "Inter",
    description: "Clean and highly readable",
    preview: "The quick brown fox jumps over the lazy dog",
  },
  {
    value: "jakarta",
    label: "Jakarta Sans",
    description: "Friendly and rounded",
    preview: "The quick brown fox jumps over the lazy dog",
  },
  {
    value: "dm-sans",
    label: "DM Sans",
    description: "Geometric and precise",
    preview: "The quick brown fox jumps over the lazy dog",
  },
]

export const FONT_CSS: Record<FontFamily, string> = {
  geist: "var(--font-geist-sans), 'Geist', system-ui, sans-serif",
  inter: "var(--font-inter), 'Inter', system-ui, sans-serif",
  jakarta: "var(--font-jakarta), 'Plus Jakarta Sans', system-ui, sans-serif",
  "dm-sans": "var(--font-dm-sans), 'DM Sans', system-ui, sans-serif",
}

export const FONT_SIZE_OPTIONS: { value: FontSize; label: string; size: string }[] = [
  { value: "small", label: "Small", size: "14px" },
  { value: "default", label: "Default", size: "16px" },
  { value: "large", label: "Large", size: "18px" },
]

export const ACCENT_COLORS: { value: AccentColor; label: string; hex: string }[] = [
  { value: "neutral", label: "Neutral", hex: "#737373" },
  { value: "blue", label: "Blue", hex: "#3b82f6" },
  { value: "violet", label: "Violet", hex: "#8b5cf6" },
  { value: "rose", label: "Rose", hex: "#f43f5e" },
  { value: "green", label: "Green", hex: "#10b981" },
  { value: "orange", label: "Orange", hex: "#f97316" },
  { value: "teal", label: "Teal", hex: "#14b8a6" },
]

export const RADIUS_OPTIONS: { value: BorderRadius; label: string; css: string; px: number }[] = [
  { value: "none", label: "None", css: "0rem", px: 0 },
  { value: "small", label: "Small", css: "0.25rem", px: 4 },
  { value: "default", label: "Default", css: "0.625rem", px: 10 },
  { value: "large", label: "Large", css: "1rem", px: 16 },
  { value: "full", label: "Full", css: "1.5rem", px: 24 },
]

export const GANTT_TOOLTIP_FIELDS: { value: GanttTooltipField; label: string }[] = [
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
  { value: "dates", label: "Date Range" },
  { value: "completion", label: "Completion" },
]

// ─── Context ──────────────────────────────────────────────────────────────

interface PreferencesContextValue {
  preferences: Preferences
  updatePreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void
  resetPreferences: () => void
}

const PreferencesContext = createContext<PreferencesContextValue>({
  preferences: DEFAULT_PREFERENCES,
  updatePreference: () => {},
  resetPreferences: () => {},
})

// ─── Provider ─────────────────────────────────────────────────────────────

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES)
  const [mounted, setMounted] = useState(false)
  // Track whether the user-specific snapshot has been fetched from the
  // server. We don't write to the server before that — otherwise we'd
  // immediately overwrite the saved prefs with whatever was hydrated
  // from defaults+cache.
  const [serverHydrated, setServerHydrated] = useState(false)

  /**
   * Apply small format migrations to a freshly-loaded prefs object so
   * older saved blobs still hydrate cleanly. Pure — returns a new value.
   */
  function migratePrefs(parsed: Partial<Preferences>): Partial<Preferences> {
    // Migrate WebAI.js model IDs → Ollama model IDs
    const webaiLLMs = [
      "smollm2-135m-instruct", "smollm2-360m-instruct",
      "gemma-3-270m-it", "gemma-3-270m-instruct",
    ]
    if (parsed.aiLLMModel && webaiLLMs.includes(parsed.aiLLMModel)) {
      parsed.aiLLMModel = "llama3.1:8b"
    }
    const webaiTTS = ["kokoro-tts", "kokoro-tts-82m"]
    if (parsed.aiTTSModel && webaiTTS.includes(parsed.aiTTSModel)) {
      parsed.aiTTSModel = ""
    }
    if (parsed.aiEmbeddingsModel === "all-minilm-l6-v2") {
      parsed.aiEmbeddingsModel = "nomic-embed-text"
    }
    const piperVoices = [
      "en_US-amy-medium", "en_US-danny-low", "en_US-lessac-medium",
      "en_GB-alan-medium", "en_GB-alba-medium",
    ]
    if (parsed.aiTTSVoice && piperVoices.includes(parsed.aiTTSVoice)) {
      parsed.aiTTSVoice = ""
    }
    if (!parsed.ollamaUrl) parsed.ollamaUrl = "http://localhost:11434"
    return parsed
  }

  // ── Phase 1: instant render from per-user localStorage cache.
  // ── Phase 2: pull the source-of-truth from the server, reconcile.
  // ── Phase 3: future changes write to BOTH cache + server (debounced).
  useEffect(() => {
    // Phase 1 — read the legacy global key OR a fresh per-user key.
    try {
      const stored = localStorage.getItem("flowspace-preferences")
      if (stored) {
        const parsed = migratePrefs(JSON.parse(stored))
        setPreferences((prev) => ({ ...prev, ...parsed }))
      }
    } catch {
      // ignore
    }
    setMounted(true)

    // Phase 2 — fetch the server copy. If it exists, it overrides cache.
    // If the user isn't signed in, the server returns null and we keep
    // whatever the cache provided.
    let cancelled = false
    import("@/lib/actions/preferences-actions").then(({ getMyPreferences }) => {
      getMyPreferences()
        .then((serverPrefs) => {
          if (cancelled) return
          if (serverPrefs && typeof serverPrefs === "object") {
            const merged = migratePrefs({ ...(serverPrefs as Partial<Preferences>) })
            setPreferences((prev) => ({ ...prev, ...merged }))
          }
          setServerHydrated(true)
        })
        .catch(() => {
          // network/auth error — keep local cache, do not push to server
          setServerHydrated(false)
        })
    })

    return () => { cancelled = true }
  }, [])

  // Apply preferences to DOM
  useEffect(() => {
    if (!mounted) return
    const root = document.documentElement

    // Font family
    root.style.setProperty("--font-sans", FONT_CSS[preferences.fontFamily])

    // Font size on html
    root.style.fontSize = FONT_SIZE_OPTIONS.find((o) => o.value === preferences.fontSize)?.size ?? "16px"

    // Border radius
    const radius = RADIUS_OPTIONS.find((o) => o.value === preferences.borderRadius)?.css ?? "0.625rem"
    root.style.setProperty("--radius", radius)

    // Accent color via data attribute (CSS handles the rest)
    root.dataset.accent = preferences.accentColor
  }, [preferences, mounted])

  // Persist — to localStorage immediately (instant on the next reload)
  // and to the server with a small debounce (so we don't fire a request
  // on every keystroke when typing in a label input).
  useEffect(() => {
    if (!mounted) return
    try {
      localStorage.setItem("flowspace-preferences", JSON.stringify(preferences))
    } catch {
      // ignore (e.g. private mode quota)
    }
    if (!serverHydrated) return // wait until we've reconciled with the server

    const t = window.setTimeout(() => {
      import("@/lib/actions/preferences-actions").then(({ saveMyPreferences }) => {
        saveMyPreferences(preferences).catch(() => {
          // Network blip — the next change will retry. Don't toast on
          // every save; would be noisy.
        })
      })
    }, 500)
    return () => window.clearTimeout(t)
  }, [preferences, mounted, serverHydrated])

  const updatePreference = useCallback(
    <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
      setPreferences((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES)
    try {
      localStorage.removeItem("flowspace-preferences")
    } catch {
      // ignore
    }
  }, [])

  return (
    <PreferencesContext.Provider value={{ preferences, updatePreference, resetPreferences }}>
      {children}
    </PreferencesContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function usePreferences() {
  return useContext(PreferencesContext)
}
