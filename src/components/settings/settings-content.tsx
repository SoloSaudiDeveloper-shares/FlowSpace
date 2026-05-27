"use client"

import { useState, useCallback, useEffect } from "react"
import {
  Download,
  FileJson,
  FileSpreadsheet,
  Database,
  Palette,
  Info,
  Keyboard,
  BarChart2,
  Check,
  RotateCcw,
  Type,
  Mic,
  Shield,
  Globe,
  Loader2,
  Sparkles,
  Volume2,
  Brain,
  Search,
  Trash2,
  MessageSquareText,
  Settings2,
  ChevronRight,
  Play,
  ScanEye,
  PanelLeft,
  Clock as ClockIcon,
  Eye,
  EyeOff,
  Rss,
  UserPlus,
  Lock,
  KeyRound as KeyIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  usePreferences,
  DEFAULT_PREFERENCES,
  FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  ACCENT_COLORS,
  RADIUS_OPTIONS,
  GANTT_TOOLTIP_FIELDS,
  SIDEBAR_SECTION_LABELS,
  type FontFamily,
  type FontSize,
  type AccentColor,
  type BorderRadius,
  type GanttTooltipField,
  type SidebarSectionKey,
} from "@/lib/hooks/use-preferences"
import { useSpeechRecognition } from "@/lib/hooks/use-speech-recognition"
import { WEBAI_SPEECH_MODELS } from "@/lib/speech/types"
import { useAI } from "@/lib/hooks/use-ai"
import { useAuth } from "@/lib/hooks/use-auth"
import { aiManager } from "@/lib/ai/ai-manager"
import {
  AI_LLM_MODELS,
  AI_EMBEDDINGS_MODELS,
  AI_VISION_MODELS,
} from "@/lib/ai/types"
import { CustomFieldsSettings } from "@/components/settings/custom-fields-settings"
import { AIProviderSection } from "@/components/settings/ai-provider-section"
import { AccountSection } from "@/components/settings/account-section"

export function SettingsContent() {
  const [exporting, setExporting] = useState(false)
  const [promptsDialogOpen, setPromptsDialogOpen] = useState(false)
  const { preferences, updatePreference, resetPreferences } = usePreferences()
  const speech = useSpeechRecognition()
  const ai = useAI()
  const [ttsVoices, setTtsVoices] = useState<SpeechSynthesisVoice[]>([])
  const [ttsTesting, setTtsTesting] = useState(false)
  const { user } = useAuth()
  const isOwner = user?.role === "owner"
  const [signupsEnabled, setSignupsEnabledLocal] = useState<boolean | null>(null)
  const [signupsSaving, setSignupsSaving] = useState(false)
  // Session duration is stored in ms server-side; UI works in minutes.
  const [sessionMinutes, setSessionMinutes] = useState<number | null>(null)
  const [sessionSaving, setSessionSaving] = useState(false)

  // Load admin settings once for owners
  useEffect(() => {
    if (!isOwner) return
    import("@/lib/actions/server-settings-actions").then((mod) => {
      mod.getSignupsEnabled().then(setSignupsEnabledLocal).catch(() => setSignupsEnabledLocal(false))
      mod.getSessionDurationMs().then((ms) => setSessionMinutes(Math.round(ms / 60_000))).catch(() => setSessionMinutes(7 * 24 * 60))
    })
  }, [isOwner])

  async function toggleSignups() {
    if (!isOwner || signupsEnabled === null) return
    setSignupsSaving(true)
    try {
      const { setSignupsEnabled } = await import("@/lib/actions/server-settings-actions")
      await setSignupsEnabled(!signupsEnabled)
      setSignupsEnabledLocal(!signupsEnabled)
      toast.success(!signupsEnabled ? "Signups opened" : "Signups closed")
    } catch {
      toast.error("Failed to update signups setting")
    } finally {
      setSignupsSaving(false)
    }
  }

  async function saveSessionDuration() {
    if (!isOwner || sessionMinutes === null) return
    setSessionSaving(true)
    try {
      const { setSessionDurationMs } = await import("@/lib/actions/server-settings-actions")
      await setSessionDurationMs(sessionMinutes * 60_000)
      toast.success(`Sessions now last ${formatDuration(sessionMinutes)}`)
    } catch {
      toast.error("Failed to update session duration")
    } finally {
      setSessionSaving(false)
    }
  }

  // Load browser TTS voices (they may load async)
  useEffect(() => {
    function loadVoices() {
      const voices = aiManager.getVoices()
      if (voices.length > 0) setTtsVoices(voices)
    }
    loadVoices()
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.addEventListener("voiceschanged", loadVoices)
      return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices)
    }
  }, [])

  async function handleExport(type: string, format: string) {
    setExporting(true)
    try {
      const res = await fetch(`/api/export?type=${type}&format=${format}`)
      if (!res.ok) throw new Error("Export failed")

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download =
        type === "all"
          ? "flowspace-full-export.json"
          : `flowspace-${type}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("Export downloaded")
    } catch {
      toast.error("Export failed")
    } finally {
      setExporting(false)
    }
  }

  function toggleTooltipField(field: GanttTooltipField) {
    const current = preferences.ganttTooltipFields
    const next = current.includes(field)
      ? current.filter((f) => f !== field)
      : [...current, field]
    updatePreference("ganttTooltipFields", next)
  }

  const hasChanges = JSON.stringify(preferences) !== JSON.stringify(DEFAULT_PREFERENCES)

  function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`
    if (minutes < 1440) {
      const h = Math.round(minutes / 60 * 10) / 10
      return `${h} hour${h === 1 ? "" : "s"}`
    }
    const d = Math.round(minutes / 1440 * 10) / 10
    return `${d} day${d === 1 ? "" : "s"}`
  }
  const SESSION_PRESETS = [
    { label: "3 minutes", min: 3 },
    { label: "1 hour", min: 60 },
    { label: "1 day", min: 1440 },
    { label: "7 days (default)", min: 7 * 1440 },
    { label: "30 days", min: 30 * 1440 },
  ]

  // ── Settings navigation (in-page anchor links) ──────────────────
  const SETTINGS_NAV: { id: string; label: string; icon: React.ComponentType<{ className?: string }>; ownerOnly?: boolean }[] = [
    { id: "account",        label: "Account",          icon: KeyIcon },
    { id: "workspace",      label: "Workspace",        icon: Shield,       ownerOnly: true },
    { id: "data-export",    label: "Data export",      icon: Database },
    { id: "custom-fields",  label: "Custom fields",    icon: Settings2 },
    { id: "appearance",     label: "Appearance",       icon: Palette },
    { id: "sidebar",        label: "Sidebar",          icon: PanelLeft },
    { id: "clock",          label: "Clock",            icon: ClockIcon },
    { id: "feed-ticker",    label: "Feed ticker",      icon: Rss },
    { id: "gantt",          label: "Gantt chart",      icon: BarChart2 },
    { id: "speech",         label: "Speech",           icon: Mic },
    { id: "ai",             label: "AI features",      icon: Sparkles },
    { id: "shortcuts",      label: "Shortcuts",        icon: Keyboard },
    { id: "about",          label: "About",            icon: Info },
  ]

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="flex">
      {/* ─── Sticky section nav, sidebar-style — md+ only ───────────── */}
      <nav
        className="sticky top-0 self-start hidden md:flex flex-col gap-0.5 w-52 shrink-0 border-r border-border/40 bg-card/30 max-h-screen overflow-y-auto p-3"
        aria-label="Settings sections"
      >
        <div className="px-2 pb-2 pt-1 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium flex items-center gap-1.5">
          <Settings2 className="size-3" />
          Settings
        </div>
        {SETTINGS_NAV.filter((s) => !s.ownerOnly || isOwner).map((s) => {
          const Icon = s.icon
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollToSection(s.id)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors text-left"
            >
              <Icon className="size-3.5 shrink-0" />
              <span className="truncate">{s.label}</span>
            </button>
          )
        })}
      </nav>

      {/* ─── Main content ───────────────────────────────────────────── */}
      <div className="flex-1 space-y-10 min-w-0 p-6 max-w-3xl">
      {/* ─── Account (everyone) ────────────────────────────────────── */}
      <section id="account" className="scroll-mt-4">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <KeyIcon className="size-4" />
          Account
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Your personal sign-in details.
        </p>
        <AccountSection />
      </section>

      {/* ─── Workspace (owner only) ────────────────────────────────── */}
      {isOwner && (
        <section id="workspace" className="scroll-mt-4">
          <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
            <Shield className="size-4" />
            Workspace administration
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Visible to workspace owners only. Controls who can join.
          </p>
          <div className="px-4 py-3 rounded-lg border bg-card">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {signupsEnabled ? <UserPlus className="size-3.5 text-emerald-500" /> : <Lock className="size-3.5 text-muted-foreground" />}
                  <span className="text-sm font-medium">Allow new account signups</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {signupsEnabled === null
                    ? "Loading…"
                    : signupsEnabled
                      ? "Anyone visiting the login page can create their own private workspace."
                      : "The login page only shows Sign in. New signups are blocked."}
                </p>
              </div>
              <button
                type="button"
                onClick={toggleSignups}
                disabled={signupsEnabled === null || signupsSaving}
                role="switch"
                aria-checked={signupsEnabled ?? false}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors disabled:opacity-50 ${
                  signupsEnabled ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`inline-block size-5 rounded-full bg-background shadow transform transition-transform ${
                    signupsEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Session duration */}
          <div className="px-4 py-3 rounded-lg border bg-card mt-3">
            <div className="flex items-center gap-2 mb-1">
              <ClockIcon className="size-3.5" />
              <span className="text-sm font-medium">Session length</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              How long users stay signed in after logging in. Applies to new
              logins only — existing sessions keep their original expiry.
              {sessionMinutes !== null && (
                <span className="ml-1 text-foreground/80">
                  Currently <strong>{formatDuration(sessionMinutes)}</strong>.
                </span>
              )}
            </p>
            <div className="space-y-3">
              <input
                type="range"
                min={1}
                max={30 * 1440}
                step={1}
                value={sessionMinutes ?? 7 * 1440}
                onChange={(e) => setSessionMinutes(parseInt(e.target.value, 10))}
                onMouseUp={saveSessionDuration}
                onTouchEnd={saveSessionDuration}
                disabled={sessionMinutes === null || sessionSaving}
                className="w-full"
              />
              <div className="flex flex-wrap gap-1.5">
                {SESSION_PRESETS.map((p) => {
                  const active = sessionMinutes === p.min
                  return (
                    <button
                      key={p.min}
                      type="button"
                      onClick={() => { setSessionMinutes(p.min); setTimeout(saveSessionDuration, 0) }}
                      disabled={sessionMinutes === null || sessionSaving}
                      className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-input hover:bg-accent"
                      }`}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── Data Export ───────────────────────────────────────────── */}
      <section id="data-export" className="scroll-mt-4">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <Database className="size-4" />
          Data Export
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Export your data for backup or migration purposes.
        </p>
        <div className="space-y-3">
          <div className="flex items-center justify-between px-4 py-3 rounded-lg border bg-card">
            <div>
              <p className="text-sm font-medium">Full Backup</p>
              <p className="text-xs text-muted-foreground">
                Export all elements, tasks, todos, and processes as JSON
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={exporting}
              onClick={() => handleExport("all", "json")}
            >
              <Download className="size-3.5 mr-1.5" />
              Export JSON
            </Button>
          </div>

          <div className="flex items-center justify-between px-4 py-3 rounded-lg border bg-card">
            <div>
              <p className="text-sm font-medium">Elements</p>
              <p className="text-xs text-muted-foreground">
                Export all elements (projects, pages, canvases, etc.)
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={exporting}
                onClick={() => handleExport("elements", "json")}
              >
                <FileJson className="size-3.5 mr-1.5" />
                JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={exporting}
                onClick={() => handleExport("elements", "csv")}
              >
                <FileSpreadsheet className="size-3.5 mr-1.5" />
                CSV
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Custom Fields ───────────────────────────────────────── */}
      <section id="custom-fields" className="scroll-mt-4">
        <CustomFieldsSettings />
      </section>

      {/* ─── Appearance ───────────────────────────────────────────── */}
      <section id="appearance" className="scroll-mt-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Palette className="size-4" />
            Appearance
          </h2>
          {hasChanges && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => {
                resetPreferences()
                toast.success("Preferences reset to defaults")
              }}
            >
              <RotateCcw className="size-3 mr-1.5" />
              Reset all
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Customize the look and feel of FlowSpace. Theme (dark/light) is toggled via the sidebar footer.
        </p>

        {/* Font Family */}
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Type className="size-3.5 text-muted-foreground" />
            Font Family
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {FONT_OPTIONS.map((font) => {
              const isActive = preferences.fontFamily === font.value
              return (
                <button
                  key={font.value}
                  onClick={() => updatePreference("fontFamily", font.value as FontFamily)}
                  className={`relative text-left px-4 py-3 rounded-lg border-2 transition-all hover:border-primary/50 ${
                    isActive
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent/30"
                  }`}
                >
                  {isActive && (
                    <div className="absolute top-2 right-2 size-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="size-3 text-primary-foreground" />
                    </div>
                  )}
                  <p className="text-sm font-semibold">{font.label}</p>
                  <p className="text-xs text-muted-foreground mb-2">{font.description}</p>
                  <p
                    className="text-xs text-muted-foreground/60 truncate"
                    style={{
                      fontFamily:
                        font.value === "geist"
                          ? "var(--font-geist-sans), system-ui"
                          : font.value === "inter"
                            ? "var(--font-inter), 'Inter', system-ui"
                            : font.value === "jakarta"
                              ? "var(--font-jakarta), 'Plus Jakarta Sans', system-ui"
                              : "var(--font-dm-sans), 'DM Sans', system-ui",
                    }}
                  >
                    {font.preview}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Font Size */}
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-3">Font Size</h3>
          <div className="flex gap-2">
            {FONT_SIZE_OPTIONS.map((opt) => {
              const isActive = preferences.fontSize === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => updatePreference("fontSize", opt.value as FontSize)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                    isActive
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border text-muted-foreground hover:border-primary/50 hover:bg-accent/30"
                  }`}
                >
                  <span style={{ fontSize: opt.size }}>Aa</span>
                  <span className="text-xs">{opt.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Accent Color */}
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-3">Accent Color</h3>
          <div className="flex items-center gap-3 flex-wrap">
            {ACCENT_COLORS.map((color) => {
              const isActive = preferences.accentColor === color.value
              return (
                <button
                  key={color.value}
                  onClick={() => updatePreference("accentColor", color.value as AccentColor)}
                  className="group flex flex-col items-center gap-1.5"
                  title={color.label}
                >
                  <div
                    className={`size-8 rounded-full transition-all ring-offset-background ${
                      isActive
                        ? "ring-2 ring-offset-2 ring-foreground scale-110"
                        : "hover:scale-110 hover:ring-2 hover:ring-offset-2 hover:ring-muted-foreground/50"
                    }`}
                    style={{ backgroundColor: color.hex }}
                  >
                    {isActive && (
                      <div className="w-full h-full flex items-center justify-center">
                        <Check className="size-4 text-white drop-shadow-sm" />
                      </div>
                    )}
                  </div>
                  <span className={`text-[10px] ${isActive ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                    {color.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Border Radius */}
        <div>
          <h3 className="text-sm font-medium mb-3">Border Radius</h3>
          <div className="flex items-center gap-3">
            {RADIUS_OPTIONS.map((opt) => {
              const isActive = preferences.borderRadius === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => updatePreference("borderRadius", opt.value as BorderRadius)}
                  className={`flex flex-col items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                    isActive
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-accent/30"
                  }`}
                >
                  <div
                    className="size-10 border-2 border-foreground/30 bg-muted/50"
                    style={{ borderRadius: `${opt.px}px` }}
                  />
                  <span className={`text-[11px] ${isActive ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                    {opt.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─── Sidebar ──────────────────────────────────────────────── */}
      <section id="sidebar" className="scroll-mt-4">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <PanelLeft className="size-4" />
          Sidebar
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Choose which categories appear in the sidebar. Drag-to-reorder is
          available directly in the sidebar itself.
        </p>
        <div className="px-4 py-3 rounded-lg border bg-card">
          <h3 className="text-sm font-medium mb-3">Visible categories</h3>
          <div className="space-y-1">
            {(Object.keys(SIDEBAR_SECTION_LABELS) as SidebarSectionKey[]).map((key) => {
              const visible = preferences.sidebarVisible?.[key] !== false
              return (
                <label
                  key={key}
                  className="flex items-center gap-3 py-1.5 px-2 rounded-md cursor-pointer hover:bg-accent/30 transition-colors"
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={visible}
                    onClick={() => {
                      const next = { ...(preferences.sidebarVisible ?? {}) }
                      next[key] = !visible
                      updatePreference("sidebarVisible", next as typeof preferences.sidebarVisible)
                    }}
                    className={`size-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      visible
                        ? "bg-primary border-primary"
                        : "border-muted-foreground/30 hover:border-primary"
                    }`}
                  >
                    {visible && <Check className="size-3 text-primary-foreground" />}
                  </button>
                  {visible
                    ? <Eye className="size-3.5 text-muted-foreground" />
                    : <EyeOff className="size-3.5 text-muted-foreground/50" />}
                  <span className="text-sm">{SIDEBAR_SECTION_LABELS[key]}</span>
                </label>
              )
            })}
          </div>
          <div className="mt-3 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                updatePreference("sidebarVisible", DEFAULT_PREFERENCES.sidebarVisible)
                updatePreference("sidebarOrder", DEFAULT_PREFERENCES.sidebarOrder)
                toast.success("Sidebar layout reset")
              }}
            >
              <RotateCcw className="size-3.5 mr-1.5" />
              Reset sidebar layout
            </Button>
          </div>
        </div>

        {/* Rename labels */}
        <div className="px-4 py-3 rounded-lg border bg-card mt-3">
          <h3 className="text-sm font-medium mb-3">Custom category names</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Rename a category to whatever fits your workflow. Leave blank to
            use the default.
          </p>
          <div className="space-y-2">
            {(Object.keys(SIDEBAR_SECTION_LABELS) as SidebarSectionKey[]).map((key) => {
              const defaultLabel = SIDEBAR_SECTION_LABELS[key]
              const value = preferences.sidebarLabels?.[key] ?? ""
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-24 shrink-0 truncate">
                    {defaultLabel}
                  </span>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => {
                      const next = { ...(preferences.sidebarLabels ?? {}) }
                      const v = e.target.value
                      if (v.trim()) next[key] = v
                      else delete next[key]
                      updatePreference("sidebarLabels", next)
                    }}
                    placeholder={defaultLabel}
                    className="flex-1 h-8 rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              )
            })}
          </div>
          {Object.keys(preferences.sidebarLabels ?? {}).length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  updatePreference("sidebarLabels", {})
                  toast.success("Custom names cleared")
                }}
              >
                <RotateCcw className="size-3.5 mr-1.5" />
                Reset all names
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* ─── Clock ────────────────────────────────────────────────── */}
      <section id="clock" className="scroll-mt-4">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <ClockIcon className="size-4" />
          Clock
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Customize the clock displayed in the top corner of every page.
        </p>
        <div className="px-4 py-3 rounded-lg border bg-card space-y-3">
          {([
            { key: "show",        label: "Show clock in top bar" },
            { key: "format24",    label: "Use 24-hour time" },
            { key: "showSeconds", label: "Show seconds" },
            { key: "showDate",    label: "Show date" },
          ] as const).map((row) => {
            const checked = preferences.clock?.[row.key] ?? true
            return (
              <label
                key={row.key}
                className="flex items-center gap-3 py-1.5 px-2 rounded-md cursor-pointer hover:bg-accent/30 transition-colors"
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => {
                    const next = { ...(preferences.clock ?? DEFAULT_PREFERENCES.clock) }
                    next[row.key] = !checked
                    updatePreference("clock", next)
                  }}
                  className={`size-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    checked
                      ? "bg-primary border-primary"
                      : "border-muted-foreground/30 hover:border-primary"
                  }`}
                >
                  {checked && <Check className="size-3 text-primary-foreground" />}
                </button>
                <span className="text-sm">{row.label}</span>
              </label>
            )
          })}
          <div className="pt-3 border-t">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Second timezone label (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. UTC, America/Los_Angeles"
              value={preferences.clock?.secondTimezoneLabel ?? ""}
              onChange={(e) => {
                const next = { ...(preferences.clock ?? DEFAULT_PREFERENCES.clock) }
                next.secondTimezoneLabel = e.target.value
                updatePreference("clock", next)
              }}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Uses IANA timezone names. Leave empty to show only your local time.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Feed Ticker ──────────────────────────────────────────── */}
      <section id="feed-ticker" className="scroll-mt-4">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <Rss className="size-4" />
          Feed Ticker
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Horizontal scrolling news bar that surfaces the latest activity across
          your workspace.
        </p>
        <div className="px-4 py-3 rounded-lg border bg-card space-y-3">
          {/* Show toggle */}
          <label className="flex items-center gap-3 py-1.5 px-2 rounded-md cursor-pointer hover:bg-accent/30 transition-colors">
            <button
              type="button"
              role="checkbox"
              aria-checked={preferences.feedTicker?.show !== false}
              onClick={() => {
                const next = { ...(preferences.feedTicker ?? DEFAULT_PREFERENCES.feedTicker) }
                next.show = !(preferences.feedTicker?.show !== false)
                updatePreference("feedTicker", next)
              }}
              className={`size-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                preferences.feedTicker?.show !== false
                  ? "bg-primary border-primary"
                  : "border-muted-foreground/30 hover:border-primary"
              }`}
            >
              {preferences.feedTicker?.show !== false && <Check className="size-3 text-primary-foreground" />}
            </button>
            <span className="text-sm">Show feed ticker</span>
          </label>

          {/* Position */}
          <div className="pt-1">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Position</label>
            <div className="flex gap-1.5">
              {(["top", "bottom"] as const).map((p) => {
                const active = (preferences.feedTicker?.position ?? "top") === p
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      const next = { ...(preferences.feedTicker ?? DEFAULT_PREFERENCES.feedTicker) }
                      next.position = p
                      updatePreference("feedTicker", next)
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${
                      active ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-accent"
                    }`}
                  >
                    {p === "top" ? "Top of page" : "Bottom of page"}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Direction */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Direction</label>
            <div className="flex gap-1.5">
              {([
                { v: "rtl" as const, label: "Right → Left", hint: "Items enter from the right" },
                { v: "ltr" as const, label: "Left → Right", hint: "Items enter from the left" },
              ]).map((d) => {
                const active = (preferences.feedTicker?.direction ?? "rtl") === d.v
                return (
                  <button
                    key={d.v}
                    type="button"
                    title={d.hint}
                    onClick={() => {
                      const next = { ...(preferences.feedTicker ?? DEFAULT_PREFERENCES.feedTicker) }
                      next.direction = d.v
                      updatePreference("feedTicker", next)
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${
                      active ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-accent"
                    }`}
                  >
                    {d.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Speed */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Speed: one full loop in {preferences.feedTicker?.speedSec ?? 90}s
            </label>
            <input
              type="range"
              min={30}
              max={240}
              step={10}
              value={preferences.feedTicker?.speedSec ?? 90}
              onChange={(e) => {
                const next = { ...(preferences.feedTicker ?? DEFAULT_PREFERENCES.feedTicker) }
                next.speedSec = parseInt(e.target.value, 10)
                updatePreference("feedTicker", next)
              }}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground/60 mt-0.5">
              <span>Fast</span>
              <span>Slow</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Gantt Chart ──────────────────────────────────────────── */}
      <section id="gantt" className="scroll-mt-4">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <BarChart2 className="size-4" />
          Gantt Chart
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Configure what information appears in the Gantt chart hover tooltip.
        </p>

        <div className="px-4 py-3 rounded-lg border bg-card">
          <h3 className="text-sm font-medium mb-3">Tooltip Fields</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Select which fields to display when hovering over task bars in the Gantt view.
          </p>
          <div className="space-y-2">
            {GANTT_TOOLTIP_FIELDS.map((field) => {
              const isChecked = preferences.ganttTooltipFields.includes(field.value)
              return (
                <label
                  key={field.value}
                  className="flex items-center gap-3 py-1.5 px-2 rounded-md cursor-pointer hover:bg-accent/30 transition-colors"
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isChecked}
                    onClick={() => toggleTooltipField(field.value)}
                    className={`size-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      isChecked
                        ? "bg-primary border-primary"
                        : "border-muted-foreground/30 hover:border-primary"
                    }`}
                  >
                    {isChecked && <Check className="size-3 text-primary-foreground" />}
                  </button>
                  <span className="text-sm">{field.label}</span>
                </label>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─── Speech Recognition ─────────────────────────────────── */}
      <section id="speech" className="scroll-mt-4">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <Mic className="size-4" />
          Speech Recognition
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Voice input is available throughout FlowSpace. Choose your preferred speech engine.
        </p>

        <div className="space-y-3">
          {/* Global on/off toggle */}
          <div className="flex items-center justify-between px-4 py-3 rounded-lg border bg-card">
            <div>
              <p className="text-sm font-medium">Voice Input</p>
              <p className="text-xs text-muted-foreground">
                Show microphone buttons on text inputs across the app
              </p>
            </div>
            <button
              role="switch"
              aria-checked={preferences.speechEnabled}
              onClick={() => updatePreference("speechEnabled", !preferences.speechEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.speechEnabled ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`inline-block size-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  preferences.speechEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Engine selector */}
          <div className="px-4 py-3 rounded-lg border bg-card">
            <h3 className="text-sm font-medium mb-3">Engine</h3>
            <div className="space-y-2">
              {speech.availableEngines.map((eng) => {
                const isActive = speech.engine === eng.engine
                const isLocal = eng.engine === "webai"
                return (
                  <button
                    key={eng.engine}
                    disabled={!eng.supported}
                    onClick={() => speech.switchEngine(eng.engine)}
                    className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                      isActive
                        ? "border-primary bg-primary/5"
                        : eng.supported
                          ? "border-border hover:border-primary/50 hover:bg-accent/30"
                          : "border-border opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {isLocal ? (
                        <Shield className="size-3.5 text-green-500" />
                      ) : (
                        <Globe className="size-3.5 text-blue-400" />
                      )}
                      <span className="text-sm font-medium">{eng.name}</span>
                      {isActive && (
                        <div className="ml-auto size-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="size-3 text-primary-foreground" />
                        </div>
                      )}
                      {!eng.supported && (
                        <span className="ml-auto text-xs text-muted-foreground">Not supported</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground pl-5.5">
                      {isLocal
                        ? "Runs entirely in your browser via WebAI.js. Private, no data sent anywhere."
                        : "Uses your browser's built-in speech API. Fast and lightweight. Requires Chrome or Edge."}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Speech model selector (WebAI only) */}
          {speech.engine === "webai" && (
            <div className="px-4 py-3 rounded-lg border bg-card">
              <h3 className="text-sm font-medium mb-3">Speech Model</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Choose a speech recognition model. Smaller models are faster; larger models are more accurate.
              </p>
              <div className="space-y-2">
                {WEBAI_SPEECH_MODELS.map((model) => {
                  const isActive = speech.speechModel === model.id
                  return (
                    <button
                      key={model.id}
                      onClick={() => speech.switchModel(model.id)}
                      className={`w-full text-left px-4 py-2.5 rounded-lg border-2 transition-all ${
                        isActive
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50 hover:bg-accent/30"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{model.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{model.size}</span>
                          {isActive && (
                            <div className="size-5 rounded-full bg-primary flex items-center justify-center">
                              <Check className="size-3 text-primary-foreground" />
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Model status */}
          <div className="px-4 py-3 rounded-lg border bg-card">
            <h3 className="text-sm font-medium mb-2">Status</h3>
            <div className="flex items-center gap-2">
              <div
                className={`size-2.5 rounded-full ${
                  speech.status === "ready"
                    ? "bg-green-500"
                    : speech.status === "listening"
                      ? "bg-red-500 animate-pulse"
                      : speech.status === "loading"
                        ? "bg-yellow-500 animate-pulse"
                        : speech.status === "error"
                          ? "bg-red-500"
                          : "bg-muted-foreground/30"
                }`}
              />
              <span className="text-sm text-muted-foreground capitalize">
                {speech.status === "idle"
                  ? "Not initialized"
                  : speech.status === "loading"
                    ? "Downloading model..."
                    : speech.status}
              </span>
            </div>
            {(speech.status === "idle" || speech.status === "loading") && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 h-7 text-xs"
                disabled={speech.status === "loading"}
                onClick={async () => {
                  try {
                    await speech.init()
                    toast.success("Speech model loaded")
                  } catch {
                    toast.error("Failed to load speech model")
                  }
                }}
              >
                {speech.status === "loading" ? (
                  <Loader2 className="size-3 mr-1.5 animate-spin" />
                ) : (
                  <Mic className="size-3 mr-1.5" />
                )}
                {speech.status === "loading" ? "Loading..." : "Pre-load Model"}
              </Button>
            )}
            {speech.error && (
              <p className="text-xs text-destructive mt-2">{speech.error.message}</p>
            )}
          </div>
        </div>
      </section>

      {/* ─── AI Features (Ollama) ────────────────────────────────── */}
      <section id="ai" className="scroll-mt-4">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <Sparkles className="size-4" />
          AI Features
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Local AI powered by Ollama. Models run on your machine — no data leaves your network.
        </p>

        <div className="space-y-3">
          {/* Global AI toggle */}
          <div className="flex items-center justify-between px-4 py-3 rounded-lg border bg-card">
            <div>
              <p className="text-sm font-medium">Enable AI Features</p>
              <p className="text-xs text-muted-foreground">
                Text generation, semantic search, and more via Ollama
              </p>
            </div>
            <button
              role="switch"
              aria-checked={preferences.aiEnabled}
              onClick={() => updatePreference("aiEnabled", !preferences.aiEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.aiEnabled ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`inline-block size-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  preferences.aiEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {preferences.aiEnabled && (
            <>
              {/* ── Provider selector ─────────────────────────── */}
              <AIProviderSection />

              {/* Ollama Server Connection */}
              <div className="px-4 py-3 rounded-lg border bg-card">
                <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Globe className="size-3.5 text-muted-foreground" />
                  Ollama Server
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Connect to your Ollama instance. Install from ollama.com if not yet installed.
                </p>

                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="text"
                    value={preferences.ollamaUrl}
                    onChange={(e) => updatePreference("ollamaUrl", e.target.value)}
                    placeholder="http://localhost:11434"
                    className="flex-1 px-3 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={async () => {
                      try {
                        await ai.refreshConnection()
                        toast.success(ai.connected ? "Connected to Ollama" : "Cannot reach Ollama")
                      } catch {
                        toast.error("Connection failed")
                      }
                    }}
                  >
                    Test
                  </Button>
                </div>

                {/* Connection status */}
                <div className="flex items-center gap-2">
                  <div
                    className={`size-2.5 rounded-full ${
                      ai.connected ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                  <span className="text-sm text-muted-foreground">
                    {ai.connected
                      ? `Connected — ${ai.installedModels.length} model${ai.installedModels.length !== 1 ? "s" : ""} available`
                      : "Disconnected — start Ollama with: ollama serve"}
                  </span>
                </div>
              </div>

              {/* LLM Model */}
              <div className="px-4 py-3 rounded-lg border bg-card">
                <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Brain className="size-3.5 text-muted-foreground" />
                  Text Generation (LLM)
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Powers summarization, text expansion, grammar fixing, and writing assistance.
                </p>

                {/* Installed models */}
                {ai.installedModels.filter(m => !m.name.includes("embed")).length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-xs font-medium mb-2 text-muted-foreground">Installed Models</h4>
                    <div className="space-y-1.5">
                      {ai.installedModels
                        .filter(m => !m.name.includes("embed") && !m.name.includes("minilm"))
                        .map((model) => {
                          const isActive = preferences.aiLLMModel === model.name
                          return (
                            <button
                              key={model.name}
                              onClick={() => updatePreference("aiLLMModel", model.name)}
                              className={`w-full text-left px-3 py-2 rounded-lg border-2 transition-all ${
                                isActive
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-primary/50 hover:bg-accent/30"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="text-sm font-medium">{model.name}</span>
                                  <span className="text-xs text-muted-foreground ml-2">
                                    {model.parameterSize}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    {(model.size / 1_000_000_000).toFixed(1)} GB
                                  </span>
                                  <div className="size-2 rounded-full bg-green-500" />
                                  {isActive && (
                                    <div className="size-5 rounded-full bg-primary flex items-center justify-center">
                                      <Check className="size-3 text-primary-foreground" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </button>
                          )
                        })}
                    </div>
                  </div>
                )}

                {/* Recommended models to pull */}
                <h4 className="text-xs font-medium mb-2 text-muted-foreground">Recommended Models</h4>
                <div className="space-y-1.5">
                  {AI_LLM_MODELS.map((model) => {
                    const installed = ai.installedModels.some(
                      (m) => m.name === model.id || m.name === `${model.id}:latest` || m.name.startsWith(model.id.split(":")[0]),
                    )
                    const state = ai.modelStates.get(model.id)
                    const isPulling = state?.status === "downloading"
                    return (
                      <div
                        key={model.id}
                        className="flex items-center justify-between px-3 py-2 rounded-lg border"
                      >
                        <div>
                          <span className="text-sm font-medium">{model.name}</span>
                          <p className="text-xs text-muted-foreground">{model.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{model.size}</span>
                          {installed ? (
                            <div className="size-2 rounded-full bg-green-500" title="Installed" />
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs px-2"
                              disabled={isPulling || !ai.connected}
                              onClick={async () => {
                                try {
                                  await ai.pullModel(model.id)
                                  toast.success(`${model.name} pulled successfully`)
                                } catch {
                                  toast.error(`Failed to pull ${model.name}`)
                                }
                              }}
                            >
                              {isPulling ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <Download className="size-3" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Embeddings Model */}
              <div className="px-4 py-3 rounded-lg border bg-card">
                <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Search className="size-3.5 text-muted-foreground" />
                  Semantic Search (Embeddings)
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Find content by meaning, not just keywords.
                </p>
                <div className="space-y-1.5">
                  {AI_EMBEDDINGS_MODELS.map((model) => {
                    const installed = ai.installedModels.some(
                      (m) => m.name === model.id || m.name === `${model.id}:latest`,
                    )
                    const isActive = preferences.aiEmbeddingsModel === model.id
                    const state = ai.modelStates.get(model.id)
                    const isPulling = state?.status === "downloading"
                    return (
                      <div
                        key={model.id}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg border-2 transition-all ${
                          isActive
                            ? "border-primary bg-primary/5"
                            : "border-border"
                        }`}
                      >
                        <button
                          className="text-left flex-1"
                          onClick={() => updatePreference("aiEmbeddingsModel", model.id)}
                        >
                          <span className="text-sm font-medium">{model.name}</span>
                          <p className="text-xs text-muted-foreground">{model.description}</p>
                        </button>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{model.size}</span>
                          {installed ? (
                            <div className="size-2 rounded-full bg-green-500" title="Installed" />
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs px-2"
                              disabled={isPulling || !ai.connected}
                              onClick={async () => {
                                try {
                                  await ai.pullModel(model.id)
                                  toast.success(`${model.name} pulled successfully`)
                                } catch {
                                  toast.error(`Failed to pull ${model.name}`)
                                }
                              }}
                            >
                              {isPulling ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <Download className="size-3" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Vision Model */}
              <div className="px-4 py-3 rounded-lg border bg-card">
                <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <ScanEye className="size-3.5 text-muted-foreground" />
                  Vision (Image Understanding)
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Analyze and describe images using multimodal models like LLaVA.
                </p>

                {/* Installed vision-capable models */}
                {ai.installedModels.filter(m => m.name.includes("llava")).length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-xs font-medium mb-2 text-muted-foreground">Installed Models</h4>
                    <div className="space-y-1.5">
                      {ai.installedModels
                        .filter(m => m.name.includes("llava"))
                        .map((model) => {
                          const isActive = preferences.aiVisionModel === model.name
                          return (
                            <button
                              key={model.name}
                              onClick={() => updatePreference("aiVisionModel", model.name)}
                              className={`w-full text-left px-3 py-2 rounded-lg border-2 transition-all ${
                                isActive
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-primary/50 hover:bg-accent/30"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="text-sm font-medium">{model.name}</span>
                                  <span className="text-xs text-muted-foreground ml-2">
                                    {model.parameterSize}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    {(model.size / 1_000_000_000).toFixed(1)} GB
                                  </span>
                                  <div className="size-2 rounded-full bg-green-500" />
                                  {isActive && (
                                    <div className="size-5 rounded-full bg-primary flex items-center justify-center">
                                      <Check className="size-3 text-primary-foreground" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </button>
                          )
                        })}
                    </div>
                  </div>
                )}

                {/* Recommended vision models to pull */}
                <h4 className="text-xs font-medium mb-2 text-muted-foreground">Recommended Models</h4>
                <div className="space-y-1.5">
                  {AI_VISION_MODELS.map((model) => {
                    const installed = ai.installedModels.some(
                      (m) => m.name === model.id || m.name === `${model.id}:latest` || m.name.startsWith(model.id.split(":")[0]),
                    )
                    const state = ai.modelStates.get(model.id)
                    const isPulling = state?.status === "downloading"
                    return (
                      <div
                        key={model.id}
                        className="flex items-center justify-between px-3 py-2 rounded-lg border"
                      >
                        <div>
                          <span className="text-sm font-medium">{model.name}</span>
                          <p className="text-xs text-muted-foreground">{model.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{model.size}</span>
                          {installed ? (
                            <div className="size-2 rounded-full bg-green-500" title="Installed" />
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs px-2"
                              disabled={isPulling || !ai.connected}
                              onClick={async () => {
                                try {
                                  await ai.pullModel(model.id)
                                  toast.success(`${model.name} pulled successfully`)
                                } catch {
                                  toast.error(`Failed to pull ${model.name}`)
                                }
                              }}
                            >
                              {isPulling ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <Download className="size-3" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* AI Prompts — compact entry, opens dialog */}
              <button
                type="button"
                onClick={() => setPromptsDialogOpen(true)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <Settings2 className="size-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium">AI Prompts</p>
                    <p className="text-xs text-muted-foreground">
                      Customize system prompts for each AI action
                    </p>
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground shrink-0" />
              </button>

              {/* TTS — Browser Speech Synthesis */}
              <div className="px-4 py-3 rounded-lg border bg-card">
                <h3 className="text-sm font-medium mb-1 flex items-center gap-2">
                  <Volume2 className="size-3.5 text-muted-foreground" />
                  Text-to-Speech
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Uses your browser&apos;s built-in speech synthesis. Choose a voice below.
                </p>

                {ttsVoices.length > 0 ? (
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="tts-voice-select" className="text-xs font-medium text-muted-foreground mb-1 block">
                        Voice
                      </label>
                      <select
                        id="tts-voice-select"
                        value={preferences.aiTTSVoice}
                        onChange={(e) => updatePreference("aiTTSVoice", e.target.value)}
                        className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">System Default</option>
                        {ttsVoices.map((voice) => (
                          <option key={voice.voiceURI} value={voice.name}>
                            {voice.name} ({voice.lang})
                          </option>
                        ))}
                      </select>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={ttsTesting}
                      onClick={async () => {
                        setTtsTesting(true)
                        try {
                          await ai.speak({
                            text: "Hello! This is a test of FlowSpace text-to-speech.",
                            voice: preferences.aiTTSVoice || undefined,
                          })
                        } catch (err) {
                          toast.error("TTS test failed: " + (err instanceof Error ? err.message : "Unknown error"))
                        } finally {
                          setTtsTesting(false)
                        }
                      }}
                    >
                      <Play className="size-3 mr-1.5" />
                      {ttsTesting ? "Speaking..." : "Test Voice"}
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    No voices available. Your browser may not support speech synthesis.
                  </p>
                )}
              </div>

              {/* Manage installed models */}
              {ai.installedModels.length > 0 && (
                <div className="px-4 py-3 rounded-lg border bg-card">
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Database className="size-3.5 text-muted-foreground" />
                    Manage Models
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Models stored by Ollama on your machine.
                  </p>
                  <div className="space-y-1.5">
                    {ai.installedModels.map((model) => (
                      <div
                        key={model.name}
                        className="flex items-center justify-between px-3 py-2 rounded-md border"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{model.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {(model.size / 1_000_000_000).toFixed(1)} GB
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-destructive hover:text-destructive"
                          onClick={async () => {
                            try {
                              await ai.deleteOllamaModel(model.name)
                              toast.success(`${model.name} deleted`)
                            } catch {
                              toast.error(`Failed to delete ${model.name}`)
                            }
                          }}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ─── Keyboard Shortcuts ──────────────────────────────────── */}
      <section id="shortcuts" className="scroll-mt-4">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <Keyboard className="size-4" />
          Keyboard Shortcuts
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Press{" "}
          <kbd className="px-1.5 py-0.5 rounded border bg-muted text-xs font-mono">
            Shift
          </kbd>{" "}
          +{" "}
          <kbd className="px-1.5 py-0.5 rounded border bg-muted text-xs font-mono">
            ?
          </kbd>{" "}
          anywhere to view all available shortcuts.
        </p>
      </section>

      {/* ─── About ───────────────────────────────────────────────── */}
      <section id="about" className="scroll-mt-4">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <Info className="size-4" />
          About
        </h2>
        <div className="px-4 py-3 rounded-lg border bg-card space-y-1">
          <p className="text-sm font-medium">FlowSpace v1.0</p>
          <p className="text-xs text-muted-foreground">
            Personal productivity workspace combining project management,
            notes, canvases, todos, and process workflows.
          </p>
          <p className="text-xs text-muted-foreground">
            Built with Next.js, SQLite, and React Flow. All data is stored
            locally.
          </p>
        </div>
      </section>

      {/* ─── AI Prompts Dialog ──────────────────────────────────── */}
      <Dialog open={promptsDialogOpen} onOpenChange={setPromptsDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI Prompts</DialogTitle>
            <DialogDescription>
              Customize the system prompt for each AI action. Changes apply immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {Object.entries(DEFAULT_PREFERENCES.aiSystemPrompts).map(([key, defaultPrompt]) => {
              const currentPrompt = preferences.aiSystemPrompts?.[key] ?? defaultPrompt
              const isDefault = currentPrompt === defaultPrompt
              const label = key
                .replace(/_/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase())
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium">{label}</label>
                    {!isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-muted-foreground"
                        onClick={() => {
                          const updated = { ...(preferences.aiSystemPrompts ?? DEFAULT_PREFERENCES.aiSystemPrompts) }
                          updated[key] = defaultPrompt
                          updatePreference("aiSystemPrompts", updated)
                          toast.success(`"${label}" reset to default`)
                        }}
                      >
                        <RotateCcw className="size-3 mr-1" />
                        Reset
                      </Button>
                    )}
                  </div>
                  <textarea
                    rows={2}
                    value={currentPrompt}
                    onChange={(e) => {
                      const updated = { ...(preferences.aiSystemPrompts ?? DEFAULT_PREFERENCES.aiSystemPrompts) }
                      updated[key] = e.target.value
                      updatePreference("aiSystemPrompts", updated)
                    }}
                    className="w-full px-3 py-2 rounded-md border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
      </div>{/* /flex-1 main content */}
    </div>
  )
}
