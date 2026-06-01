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
  BookOpen,
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
  Bot,
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
import { TelegramSection } from "@/components/settings/telegram-section"
import { LocaleSwitcher } from "@/components/settings/locale-switcher"
import { GuidesHub } from "@/components/settings/guides-hub"
import { SectionHelp } from "@/components/shared/section-help"
import { EmailInSection } from "@/components/settings/email-in-section"
import { CalendarSyncSection } from "@/components/settings/calendar-sync-section"
import { VoiceUsageCard } from "@/components/settings/voice-usage-card"
import { getTelegramFeatureEnabled } from "@/lib/actions/telegram-actions"
import { useT } from "@/lib/hooks/use-i18n"

/** Small sub-component so we can use the JSX-tag form on a dynamic icon. */
function DescriptionPanel({
  item,
}: {
  item: { icon: React.ComponentType<{ className?: string }>; label: string; description: string }
}) {
  const { t } = useT()
  const Icon = item.icon
  return (
    <aside
      className="sticky top-0 hidden xl:flex flex-col w-64 shrink-0 border-l border-border/40 bg-card/30 h-screen overflow-hidden"
      aria-label={t("settings.currentSection")}
    >
      {/* Inner scroll area — keeps the bg painting full-height even when
          content is short, while still allowing scroll for long copy. */}
      <div className="flex flex-col gap-3 p-5 overflow-y-auto">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
          {t("settings.currentSection")}
        </div>
        <div
          key={item.label}
          className="flex items-center gap-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-1 motion-safe:duration-300"
        >
          <Icon className="size-4 text-primary" />
          <span className="text-sm font-semibold">{item.label}</span>
        </div>
        <p
          key={item.description}
          className="text-xs text-muted-foreground leading-relaxed motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500"
        >
          {item.description}
        </p>
      </div>
    </aside>
  )
}

export function SettingsContent() {
  const { t } = useT()
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
  // Workspace name (owner-only). Empty string until first fetch.
  const [workspaceNameDraft, setWorkspaceNameDraft] = useState<string>("")
  const [workspaceNameSaving, setWorkspaceNameSaving] = useState(false)
  const [workspaceNameLoaded, setWorkspaceNameLoaded] = useState(false)
  // Telegram feature is gated on a workspace-wide admin toggle.
  const [telegramFeatureEnabled, setTelegramFeatureEnabled] = useState<boolean>(false)
  useEffect(() => {
    getTelegramFeatureEnabled().then(setTelegramFeatureEnabled).catch(() => setTelegramFeatureEnabled(false))
  }, [])

  // Load admin settings once for owners
  useEffect(() => {
    if (!isOwner) return
    import("@/lib/actions/server-settings-actions").then((mod) => {
      mod.getSignupsEnabled().then(setSignupsEnabledLocal).catch(() => setSignupsEnabledLocal(false))
      mod.getSessionDurationMs().then((ms) => setSessionMinutes(Math.round(ms / 60_000))).catch(() => setSessionMinutes(7 * 24 * 60))
      mod.getWorkspaceName().then((n) => { setWorkspaceNameDraft(n); setWorkspaceNameLoaded(true) }).catch(() => { setWorkspaceNameDraft("FlowSpace"); setWorkspaceNameLoaded(true) })
    })
  }, [isOwner])

  async function saveWorkspaceName() {
    if (!isOwner) return
    const trimmed = workspaceNameDraft.trim()
    if (!trimmed) {
      toast.error(t("settings.workspace.name.empty"))
      return
    }
    setWorkspaceNameSaving(true)
    try {
      const { setWorkspaceName } = await import("@/lib/actions/server-settings-actions")
      await setWorkspaceName(trimmed)
      // Notify in-tab listeners (sidebar) so they re-fetch without reload.
      window.dispatchEvent(new CustomEvent("flowspace:workspace-name-changed"))
      toast.success(t("settings.workspace.name.updated"))
    } catch {
      toast.error(t("settings.workspace.name.failed"))
    } finally {
      setWorkspaceNameSaving(false)
    }
  }

  async function toggleSignups() {
    if (!isOwner || signupsEnabled === null) return
    setSignupsSaving(true)
    try {
      const { setSignupsEnabled } = await import("@/lib/actions/server-settings-actions")
      await setSignupsEnabled(!signupsEnabled)
      setSignupsEnabledLocal(!signupsEnabled)
      toast.success(!signupsEnabled ? t("settings.workspace.signups.opened") : t("settings.workspace.signups.closed"))
    } catch {
      toast.error(t("settings.workspace.signups.failed"))
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
      toast.success(t("settings.workspace.session.saved").replace("{duration}", formatDuration(sessionMinutes)))
    } catch {
      toast.error(t("settings.workspace.session.failed"))
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
      toast.success(t("settings.export.downloaded"))
    } catch {
      toast.error(t("settings.export.failed"))
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
    { label: t("settings.workspace.session.preset.3min"), min: 3 },
    { label: t("settings.workspace.session.preset.1hour"), min: 60 },
    { label: t("settings.workspace.session.preset.1day"), min: 1440 },
    { label: t("settings.workspace.session.preset.7day"), min: 7 * 1440 },
    { label: t("settings.workspace.session.preset.30day"), min: 30 * 1440 },
  ]

  // ── Top-tab groups — each tab gathers a few related sub-sections ──
  type SettingsGroup =
    | "account"
    | "data"
    | "look"
    | "integrations"
    | "help"
  const SETTINGS_GROUPS: { id: SettingsGroup; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
    { id: "account",      label: t("settings.group.account.label"),      icon: KeyIcon,  description: t("settings.group.account.desc") },
    { id: "data",         label: t("settings.group.data.label"),         icon: Database, description: t("settings.group.data.desc") },
    { id: "look",         label: t("settings.group.look.label"),         icon: Palette,  description: t("settings.group.look.desc") },
    { id: "integrations", label: t("settings.group.integrations.label"), icon: Sparkles, description: t("settings.group.integrations.desc") },
    { id: "help",         label: t("settings.group.help.label"),         icon: Info,     description: t("settings.group.help.desc") },
  ]

  // ── Settings navigation (in-page anchor links within each tab) ──
  const SETTINGS_NAV: {
    id: string
    label: string
    icon: React.ComponentType<{ className?: string }>
    description: string
    ownerOnly?: boolean
    group: SettingsGroup
  }[] = [
    { id: "account",        label: t("settings.nav.account.label"),       icon: KeyIcon,    group: "account",      description: t("settings.nav.account.desc") },
    { id: "workspace",      label: t("settings.nav.workspace.label"),     icon: Shield,     group: "account", ownerOnly: true, description: t("settings.nav.workspace.desc") },
    { id: "data-export",    label: t("settings.nav.dataExport.label"),    icon: Database,   group: "data",         description: t("settings.nav.dataExport.desc") },
    { id: "custom-fields",  label: t("settings.nav.customFields.label"),  icon: Settings2,  group: "data",         description: t("settings.nav.customFields.desc") },
    { id: "appearance",     label: t("settings.nav.appearance.label"),    icon: Palette,    group: "look",         description: t("settings.nav.appearance.desc") },
    { id: "sidebar",        label: t("settings.nav.sidebar.label"),       icon: PanelLeft,  group: "look",         description: t("settings.nav.sidebar.desc") },
    { id: "clock",          label: t("settings.nav.clock.label"),         icon: ClockIcon,  group: "look",         description: t("settings.nav.clock.desc") },
    { id: "feed-ticker",    label: t("settings.nav.feedTicker.label"),    icon: Rss,        group: "look",         description: t("settings.nav.feedTicker.desc") },
    { id: "gantt",          label: t("settings.nav.gantt.label"),         icon: BarChart2,  group: "look",         description: t("settings.nav.gantt.desc") },
    { id: "speech",         label: t("settings.nav.speech.label"),        icon: Mic,        group: "integrations", description: t("settings.nav.speech.desc") },
    { id: "ai",             label: t("settings.nav.ai.label"),            icon: Sparkles,   group: "integrations", description: t("settings.nav.ai.desc") },
    { id: "telegram",       label: t("settings.nav.telegram.label"),      icon: Bot,        group: "integrations", description: t("settings.nav.telegram.desc") },
    { id: "email-in",       label: t("settings.nav.emailIn.label"),       icon: Mic,        group: "integrations", description: t("settings.nav.emailIn.desc") },
    { id: "calendar-sync",  label: t("settings.nav.calendarSync.label"),  icon: ClockIcon,  group: "integrations", description: t("settings.nav.calendarSync.desc") },
    { id: "language",       label: t("settings.nav.language.label"),      icon: Globe,      group: "look",         description: t("settings.nav.language.desc") },
    { id: "guides",         label: t("settings.nav.guides.label"),        icon: BookOpen,   group: "help",         description: t("settings.nav.guides.desc") },
    { id: "shortcuts",      label: t("settings.nav.shortcuts.label"),     icon: Keyboard,   group: "help",         description: t("settings.nav.shortcuts.desc") },
    { id: "about",          label: t("settings.nav.about.label"),         icon: Info,       group: "help",         description: t("settings.nav.about.desc") },
  ]

  // ── Active top-tab group — controls which sub-sections render ──
  const [activeGroup, setActiveGroup] = useState<SettingsGroup>("account")
  const groupSectionIds = new Set(
    SETTINGS_NAV.filter((s) => s.group === activeGroup && (!s.ownerOnly || isOwner)).map(
      (s) => s.id,
    ),
  )

  // Track which section is most-visible so we can fade the others out + highlight the matching nav item.
  const [activeSectionId, setActiveSectionId] = useState<string>(SETTINGS_NAV[0].id)

  // Hide sections that aren't part of the active top-tab group. Using
  // the `hidden` attribute (not CSS display:none) keeps the layout simple
  // and avoids interfering with smooth-scroll-into-view on tab switch.
  useEffect(() => {
    SETTINGS_NAV.forEach((s) => {
      const el = document.getElementById(s.id)
      if (!el) return
      const inGroup = s.group === activeGroup && (!s.ownerOnly || isOwner)
      el.toggleAttribute("hidden", !inGroup)
    })
    // Scroll to the first section of the new tab.
    const first = SETTINGS_NAV.find(
      (s) => s.group === activeGroup && (!s.ownerOnly || isOwner),
    )
    if (first) {
      setActiveSectionId(first.id)
      requestAnimationFrame(() => {
        document.getElementById(first.id)?.scrollIntoView({ behavior: "auto", block: "start" })
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroup, isOwner])

  useEffect(() => {
    const ids = SETTINGS_NAV.filter((s) => groupSectionIds.has(s.id)).map((s) => s.id)
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el)
    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]) setActiveSectionId(visible[0].target.id)
      },
      {
        // The "anchor zone" sits roughly in the upper third of the viewport.
        // A section counts as "active" when its top crosses into that band.
        rootMargin: "-15% 0px -60% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    )
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
    // SETTINGS_NAV is stable per render; we re-observe whenever the active
    // top-tab changes since the section set changes with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner, activeGroup])

  function scrollToSection(id: string) {
    setActiveSectionId(id)
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  // Deep-link support: open the right top-tab and scroll when arriving with a
  // #hash (e.g. /settings#guides from the sidebar Help icon, or
  // #calendar-sync from the Google Calendar callback).
  useEffect(() => {
    function applyHash() {
      const id = window.location.hash.replace(/^#/, "")
      if (!id) return
      const nav = SETTINGS_NAV.find((s) => s.id === id)
      if (!nav) return
      setActiveGroup(nav.group)
      setActiveSectionId(id)
      // Let the new tab's sections mount before scrolling to the target.
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "auto", block: "start" })
      }, 90)
    }
    applyHash()
    window.addEventListener("hashchange", applyHash)
    return () => window.removeEventListener("hashchange", applyHash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeNavItem =
    SETTINGS_NAV.find((s) => s.id === activeSectionId) ?? SETTINGS_NAV[0]

  // Toggle the .is-active class on the matching section so CSS can fade
  // the others out. Avoids editing every <section> JSX block.
  useEffect(() => {
    const sections = document.querySelectorAll(".settings-sections > section")
    sections.forEach((s) => s.classList.toggle("is-active", s.id === activeSectionId))
  }, [activeSectionId])

  return (
    // Settings panels are still English-only; render the whole body LTR so
    // its text and controls lay out correctly even when the app chrome is in
    // Arabic (RTL). The page title/sidebar around it stay RTL.
    <div className="flex flex-col" dir="ltr" data-active-section={activeSectionId} data-active-group={activeGroup}>
      {/* ─── Top tab bar — mirrors the admin page chrome ──────────────── */}
      <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 px-6">
        <div className="flex items-center gap-1 pt-3">
          {SETTINGS_GROUPS.map((g) => {
            const Icon = g.icon
            const isActive = activeGroup === g.id
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setActiveGroup(g.id)}
                aria-current={isActive ? "true" : undefined}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-md transition-colors border-b-2 -mb-px ${
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                }`}
              >
                <Icon className="size-3.5" />
                {g.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex">
      {/* ─── In-tab sub-section rail — md+ only ──────────────────────── */}
      <nav
        className="sticky top-12 self-start hidden md:flex flex-col gap-0.5 w-52 shrink-0 border-r border-border/40 bg-card/30 max-h-[calc(100vh-3rem)] overflow-y-auto p-3"
        aria-label="Settings sub-sections"
      >
        <div className="px-2 pb-2 pt-1 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium flex items-center gap-1.5">
          <Settings2 className="size-3" />
          {SETTINGS_GROUPS.find((g) => g.id === activeGroup)?.label}
        </div>
        {SETTINGS_NAV.filter(
          (s) => s.group === activeGroup && (!s.ownerOnly || isOwner),
        ).map((s) => {
          const Icon = s.icon
          const isActive = activeSectionId === s.id
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollToSection(s.id)}
              aria-current={isActive ? "true" : undefined}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors text-left ${
                isActive
                  ? "bg-primary/10 text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <Icon className={`size-3.5 shrink-0 ${isActive ? "text-primary" : ""}`} />
              <span className="truncate">{s.label}</span>
              {isActive && <ChevronRight className="size-3 ml-auto text-primary shrink-0" />}
            </button>
          )
        })}
      </nav>

      {/* ─── Main content ───────────────────────────────────────────── */}
      <div className="flex-1 space-y-10 min-w-0 p-6 max-w-3xl settings-sections">
      {/* ─── Account (everyone) ────────────────────────────────────── */}
      <section id="account" className="scroll-mt-4">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <KeyIcon className="size-4" />
          {t("settings.account.title")}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t("settings.account.subtitle")}
        </p>
        <AccountSection />
      </section>

      {/* ─── Workspace (owner only) ────────────────────────────────── */}
      {isOwner && (
        <section id="workspace" className="scroll-mt-4">
          <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
            <Shield className="size-4" />
            {t("settings.workspace.title")}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {t("settings.workspace.subtitle")}
          </p>
          {/* ── Workspace name (admin sets the bold prefix everyone sees) ── */}
          <div className="px-4 py-3 rounded-lg border bg-card mb-3">
            <div className="flex items-center gap-2 mb-1">
              <PanelLeft className="size-3.5" />
              <span className="text-sm font-medium">{t("settings.workspace.name.label")}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {t("settings.workspace.name.help")}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={workspaceNameDraft}
                onChange={(e) => setWorkspaceNameDraft(e.target.value)}
                disabled={!workspaceNameLoaded || workspaceNameSaving}
                maxLength={40}
                placeholder="FlowSpace"
                className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button
                onClick={saveWorkspaceName}
                disabled={!workspaceNameLoaded || workspaceNameSaving}
                size="sm"
              >
                {workspaceNameSaving ? (
                  <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Check className="size-3.5 mr-1.5" />
                )}
                {t("common.save")}
              </Button>
            </div>
          </div>
          <div className="px-4 py-3 rounded-lg border bg-card">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {signupsEnabled ? <UserPlus className="size-3.5 text-emerald-500" /> : <Lock className="size-3.5 text-muted-foreground" />}
                  <span className="text-sm font-medium">{t("settings.workspace.signups.label")}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {signupsEnabled === null
                    ? t("common.loading")
                    : signupsEnabled
                      ? t("settings.workspace.signups.on")
                      : t("settings.workspace.signups.off")}
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
              <span className="text-sm font-medium">{t("settings.workspace.session.label")}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {t("settings.workspace.session.help")}
              {sessionMinutes !== null && (
                <span className="ml-1 text-foreground/80">
                  {(() => {
                    const [a, b] = t("settings.workspace.session.current").split("{duration}")
                    return (
                      <>
                        {a}
                        <strong>{formatDuration(sessionMinutes)}</strong>
                        {b}
                      </>
                    )
                  })()}
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
          {t("settings.export.title")}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t("settings.export.subtitle")}
        </p>
        <div className="space-y-3">
          <div className="flex items-center justify-between px-4 py-3 rounded-lg border bg-card">
            <div>
              <p className="text-sm font-medium">{t("settings.export.full.title")}</p>
              <p className="text-xs text-muted-foreground">
                {t("settings.export.full.desc")}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={exporting}
              onClick={() => handleExport("all", "json")}
            >
              <Download className="size-3.5 mr-1.5" />
              {t("settings.export.full.button")}
            </Button>
          </div>

          <div className="flex items-center justify-between px-4 py-3 rounded-lg border bg-card">
            <div>
              <p className="text-sm font-medium">{t("settings.export.elements.title")}</p>
              <p className="text-xs text-muted-foreground">
                {t("settings.export.elements.desc")}
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
            {t("settings.appearance.title")}
          </h2>
          {hasChanges && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => {
                resetPreferences()
                toast.success(t("settings.appearance.resetToast"))
              }}
            >
              <RotateCcw className="size-3 mr-1.5" />
              {t("settings.appearance.resetAll")}
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          {t("settings.appearance.subtitle")}
        </p>

        {/* Font Family */}
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Type className="size-3.5 text-muted-foreground" />
            {t("settings.appearance.fontFamily")}
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
          <h3 className="text-sm font-medium mb-3">{t("settings.appearance.fontSize")}</h3>
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
          <h3 className="text-sm font-medium mb-3">{t("settings.appearance.accentColor")}</h3>
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

        {/* Right-click color palette */}
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-1">{t("settings.appearance.rightClick.title")}</h3>
          <p className="text-xs text-muted-foreground mb-3">
            {t("settings.appearance.rightClick.help")}
          </p>
          <RightClickPalettePicker />
        </div>

        {/* Notification badge */}
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-1">{t("settings.appearance.badge.title")}</h3>
          <p className="text-xs text-muted-foreground mb-3">
            {t("settings.appearance.badge.help")}
          </p>
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-card">
            <button
              role="switch"
              aria-checked={preferences.notificationBadgeEnabled !== false}
              onClick={() => updatePreference("notificationBadgeEnabled", !(preferences.notificationBadgeEnabled !== false))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.notificationBadgeEnabled !== false ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`inline-block size-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  preferences.notificationBadgeEnabled !== false ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span className="text-sm">{t("settings.appearance.badge.toggle")}</span>
          </div>
        </div>

        {/* Border Radius */}
        <div>
          <h3 className="text-sm font-medium mb-3">{t("settings.appearance.borderRadius")}</h3>
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
          {t("settings.sidebar.title")}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t("settings.sidebar.subtitle")}
        </p>
        <div className="px-4 py-3 rounded-lg border bg-card">
          <h3 className="text-sm font-medium mb-3">{t("settings.sidebar.visible")}</h3>
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
                toast.success(t("settings.sidebar.resetLayoutToast"))
              }}
            >
              <RotateCcw className="size-3.5 mr-1.5" />
              {t("settings.sidebar.resetLayout")}
            </Button>
          </div>
        </div>

        {/* Rename labels */}
        <div className="px-4 py-3 rounded-lg border bg-card mt-3">
          <h3 className="text-sm font-medium mb-3">{t("settings.sidebar.customNames")}</h3>
          <p className="text-xs text-muted-foreground mb-3">
            {t("settings.sidebar.customNamesHelp")}
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
                  toast.success(t("settings.sidebar.resetNamesToast"))
                }}
              >
                <RotateCcw className="size-3.5 mr-1.5" />
                {t("settings.sidebar.resetNames")}
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* ─── Clock ────────────────────────────────────────────────── */}
      <section id="clock" className="scroll-mt-4">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <ClockIcon className="size-4" />
          {t("settings.clock.title")}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t("settings.clock.subtitle")}
        </p>
        <div className="px-4 py-3 rounded-lg border bg-card space-y-3">
          {([
            { key: "show",        label: t("settings.clock.show") },
            { key: "format24",    label: t("settings.clock.format24") },
            { key: "showSeconds", label: t("settings.clock.showSeconds") },
            { key: "showDate",    label: t("settings.clock.showDate") },
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
              {t("settings.clock.tzLabel")}
            </label>
            <input
              type="text"
              placeholder={t("settings.clock.tzPlaceholder")}
              value={preferences.clock?.secondTimezoneLabel ?? ""}
              onChange={(e) => {
                const next = { ...(preferences.clock ?? DEFAULT_PREFERENCES.clock) }
                next.secondTimezoneLabel = e.target.value
                updatePreference("clock", next)
              }}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              {t("settings.clock.tzHelp")}
            </p>
          </div>
        </div>
      </section>

      {/* ─── Feed Ticker ──────────────────────────────────────────── */}
      <section id="feed-ticker" className="scroll-mt-4">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <Rss className="size-4" />
          {t("settings.ticker.title")}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t("settings.ticker.subtitle")}
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
            <span className="text-sm">{t("settings.ticker.show")}</span>
          </label>

          {/* Pinned vs floating */}
          <label className="flex items-center gap-3 py-1.5 px-2 rounded-md cursor-pointer hover:bg-accent/30 transition-colors">
            <button
              type="button"
              role="checkbox"
              aria-checked={preferences.feedTicker?.pinned !== false}
              onClick={() => {
                const next = { ...(preferences.feedTicker ?? DEFAULT_PREFERENCES.feedTicker) }
                next.pinned = !(preferences.feedTicker?.pinned !== false)
                updatePreference("feedTicker", next)
              }}
              className={`size-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                preferences.feedTicker?.pinned !== false
                  ? "bg-primary border-primary"
                  : "border-muted-foreground/30 hover:border-primary"
              }`}
            >
              {preferences.feedTicker?.pinned !== false && <Check className="size-3 text-primary-foreground" />}
            </button>
            <span className="text-sm flex-1">{t("settings.ticker.pinned")}</span>
            <span className="text-[10px] text-muted-foreground">
              {t("settings.ticker.floatHint")}
            </span>
          </label>

          {/* Position */}
          <div className="pt-1">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t("settings.ticker.position")}</label>
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
                    {p === "top" ? t("settings.ticker.position.top") : t("settings.ticker.position.bottom")}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Direction */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t("settings.ticker.direction")}</label>
            <div className="flex gap-1.5">
              {([
                { v: "rtl" as const, label: t("settings.ticker.direction.rtl"), hint: t("settings.ticker.direction.rtlHint") },
                { v: "ltr" as const, label: t("settings.ticker.direction.ltr"), hint: t("settings.ticker.direction.ltrHint") },
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
              {t("settings.ticker.speed").replace("{sec}", String(preferences.feedTicker?.speedSec ?? 90))}
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
              <span>{t("settings.ticker.speed.fast")}</span>
              <span>{t("settings.ticker.speed.slow")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Gantt Chart ──────────────────────────────────────────── */}
      <section id="gantt" className="scroll-mt-4">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <BarChart2 className="size-4" />
          {t("settings.gantt.title")}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t("settings.gantt.subtitle")}
        </p>

        <div className="px-4 py-3 rounded-lg border bg-card">
          <h3 className="text-sm font-medium mb-3">{t("settings.gantt.tooltipFields")}</h3>
          <p className="text-xs text-muted-foreground mb-3">
            {t("settings.gantt.tooltipHelp")}
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
          {t("settings.speech.title")}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t("settings.speech.subtitle")}
        </p>

        <div className="space-y-3">
          {/* Usage indicator — Groq has no balance endpoint, this is our
              local-side proxy for "how much have we sent today". */}
          <VoiceUsageCard />

          {/* Global on/off toggle */}
          <div className="flex items-center justify-between px-4 py-3 rounded-lg border bg-card">
            <div>
              <p className="text-sm font-medium">{t("settings.speech.voiceInput")}</p>
              <p className="text-xs text-muted-foreground">
                {t("settings.speech.voiceInputDesc")}
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

          {/* Streaming mode toggle — overrides engine selection when on */}
          <div className="flex items-center justify-between px-4 py-3 rounded-lg border bg-card">
            <div className="pr-4">
              <p className="text-sm font-medium flex items-center gap-1.5">
                {t("settings.speech.streaming")}
                <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">{t("settings.speech.streaming.badge")}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {t("settings.speech.streamingDesc")}
              </p>
            </div>
            <button
              role="switch"
              aria-checked={preferences.speechStreaming}
              onClick={() => updatePreference("speechStreaming", !preferences.speechStreaming)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                preferences.speechStreaming ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`inline-block size-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  preferences.speechStreaming ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Engine selector */}
          <div className="px-4 py-3 rounded-lg border bg-card">
            <h3 className="text-sm font-medium mb-3">{t("settings.speech.engine")}</h3>
            <div className="space-y-2">
              {speech.availableEngines.map((eng) => {
                const isActive = speech.engine === eng.engine
                const description =
                  eng.engine === "groq"
                    ? t("settings.speech.engine.groqDesc")
                    : eng.engine === "webai"
                      ? t("settings.speech.engine.webaiDesc")
                      : t("settings.speech.engine.webDesc")
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
                        <span className="ml-auto text-xs text-muted-foreground">{t("settings.speech.engine.notSupported")}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground pl-5.5">{description}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Groq API key — only shown when Groq engine is selected */}
          {speech.engine === "groq" && (
            <div className="px-4 py-3 rounded-lg border bg-card">
              <h3 className="text-sm font-medium mb-1">{t("settings.speech.groqKey")}</h3>
              <p className="text-xs text-muted-foreground mb-3">
                {(() => {
                  const [a, b] = t("settings.speech.groqKey.help").split("{link}")
                  return (
                    <>
                      {a}
                      <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="underline hover:text-foreground">
                        console.groq.com/keys
                      </a>
                      {b}
                    </>
                  )
                })()}
              </p>
              <input
                type="password"
                value={preferences.speechGroqApiKey}
                onChange={(e) => updatePreference("speechGroqApiKey", e.target.value)}
                placeholder="gsk_..."
                autoComplete="off"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm font-mono placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {preferences.speechGroqApiKey ? (
                <p className="text-[11px] text-emerald-500 mt-1.5 flex items-center gap-1">
                  <Check className="size-3" /> {t("settings.speech.groqKey.set")}
                </p>
              ) : (
                <p className="text-[11px] text-amber-500 mt-1.5">
                  {t("settings.speech.groqKey.unset")}
                </p>
              )}
            </div>
          )}

          {/* Speech model selector (WebAI only) */}
          {speech.engine === "webai" && (
            <div className="px-4 py-3 rounded-lg border bg-card">
              <h3 className="text-sm font-medium mb-3">{t("settings.speech.model")}</h3>
              <p className="text-xs text-muted-foreground mb-3">
                {t("settings.speech.modelHelp")}
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
            <h3 className="text-sm font-medium mb-2">{t("settings.speech.status")}</h3>
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
                  ? t("settings.speech.status.notInit")
                  : speech.status === "loading"
                    ? t("settings.speech.status.downloading")
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
                    toast.success(t("settings.speech.loaded"))
                  } catch {
                    toast.error(t("settings.speech.loadFailed"))
                  }
                }}
              >
                {speech.status === "loading" ? (
                  <Loader2 className="size-3 mr-1.5 animate-spin" />
                ) : (
                  <Mic className="size-3 mr-1.5" />
                )}
                {speech.status === "loading" ? t("settings.speech.loading") : t("settings.speech.preload")}
              </Button>
            )}
            {speech.error && (
              <p className="text-xs text-destructive mt-2">{speech.error.message}</p>
            )}
          </div>
        </div>
      </section>

      {/* ─── Telegram ──────────────────────────────────────────── */}
      <section id="telegram" className="scroll-mt-4">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <Bot className="size-4" />
          {t("settings.telegram.title")}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t("settings.telegram.subtitle")}
        </p>
        <TelegramSection featureEnabled={telegramFeatureEnabled} />
      </section>

      {/* ─── Email IN ─────────────────────────────────────────────── */}
      <section id="email-in" className="scroll-mt-4">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <Mic className="size-4" />
          {t("settings.emailIn.title")}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t("settings.emailIn.subtitle")}
        </p>
        <EmailInSection />
      </section>

      {/* ─── Google Calendar sync ────────────────────────────────── */}
      <section id="calendar-sync" className="scroll-mt-4">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <ClockIcon className="size-4" />
          {t("settings.calendar.title")}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t("settings.calendar.subtitle")}
        </p>
        <CalendarSyncSection />
      </section>

      {/* ─── AI Features (Ollama) ────────────────────────────────── */}
      <section id="ai" className="scroll-mt-4">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <Sparkles className="size-4" />
          {t("settings.ai.title")}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t("settings.ai.subtitle")}
        </p>

        <div className="space-y-3">
          {/* Global AI toggle */}
          <div className="flex items-center justify-between px-4 py-3 rounded-lg border bg-card">
            <div>
              <p className="text-sm font-medium">{t("settings.ai.enable")}</p>
              <p className="text-xs text-muted-foreground">
                {t("settings.ai.enableDesc")}
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
                  {t("settings.ai.ollamaServer")}
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  {t("settings.ai.ollamaServerHelp")}
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
                        toast.success(ai.connected ? t("settings.ai.connected") : t("settings.ai.cannotReach"))
                      } catch {
                        toast.error(t("settings.ai.connectionFailed"))
                      }
                    }}
                  >
                    {t("settings.ai.test")}
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
                      ? t(ai.installedModels.length === 1 ? "settings.ai.connectedModel" : "settings.ai.connectedModels")
                          .replace("{count}", String(ai.installedModels.length))
                      : t("settings.ai.disconnected")}
                  </span>
                </div>
              </div>

              {/* LLM Model */}
              <div className="px-4 py-3 rounded-lg border bg-card">
                <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Brain className="size-3.5 text-muted-foreground" />
                  {t("settings.ai.llm.title")}
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  {t("settings.ai.llm.help")}
                </p>

                {/* Installed models */}
                {ai.installedModels.filter(m => !m.name.includes("embed")).length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-xs font-medium mb-2 text-muted-foreground">{t("settings.ai.installedModels")}</h4>
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
                <h4 className="text-xs font-medium mb-2 text-muted-foreground">{t("settings.ai.recommendedModels")}</h4>
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
                            <div className="size-2 rounded-full bg-green-500" title={t("settings.ai.installed")} />
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs px-2"
                              disabled={isPulling || !ai.connected}
                              onClick={async () => {
                                try {
                                  await ai.pullModel(model.id)
                                  toast.success(t("settings.ai.pulled").replace("{name}", model.name))
                                } catch {
                                  toast.error(t("settings.ai.pullFailed").replace("{name}", model.name))
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
                  {t("settings.ai.embeddings.title")}
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  {t("settings.ai.embeddings.help")}
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
                            <div className="size-2 rounded-full bg-green-500" title={t("settings.ai.installed")} />
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs px-2"
                              disabled={isPulling || !ai.connected}
                              onClick={async () => {
                                try {
                                  await ai.pullModel(model.id)
                                  toast.success(t("settings.ai.pulled").replace("{name}", model.name))
                                } catch {
                                  toast.error(t("settings.ai.pullFailed").replace("{name}", model.name))
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
                  {t("settings.ai.vision.title")}
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  {t("settings.ai.vision.help")}
                </p>

                {/* Installed vision-capable models */}
                {ai.installedModels.filter(m => m.name.includes("llava")).length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-xs font-medium mb-2 text-muted-foreground">{t("settings.ai.installedModels")}</h4>
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
                <h4 className="text-xs font-medium mb-2 text-muted-foreground">{t("settings.ai.recommendedModels")}</h4>
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
                            <div className="size-2 rounded-full bg-green-500" title={t("settings.ai.installed")} />
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs px-2"
                              disabled={isPulling || !ai.connected}
                              onClick={async () => {
                                try {
                                  await ai.pullModel(model.id)
                                  toast.success(t("settings.ai.pulled").replace("{name}", model.name))
                                } catch {
                                  toast.error(t("settings.ai.pullFailed").replace("{name}", model.name))
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
                    <p className="text-sm font-medium">{t("settings.ai.prompts")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("settings.ai.promptsDesc")}
                    </p>
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground shrink-0" />
              </button>

              {/* Response length — editable max-token budgets per action */}
              <div className="px-4 py-3 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <Settings2 className="size-3.5 text-muted-foreground" />
                    {t("settings.ai.responseLength")}
                  </h3>
                  <SectionHelp guideId="aiResponseLength" className="ml-auto" />
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {t("settings.ai.responseLengthHelp")}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    ["one_line", t("settings.ai.budget.oneLine")],
                    ["short", t("settings.ai.budget.short")],
                    ["detailed", t("settings.ai.budget.detailed")],
                    ["other", t("settings.ai.budget.other")],
                  ] as const).map(([key, label]) => {
                    const budgets = preferences.aiTokenBudgets ?? DEFAULT_PREFERENCES.aiTokenBudgets
                    return (
                      <label key={key} className="text-xs">
                        <span className="block text-muted-foreground mb-1">{label}</span>
                        <input
                          type="number"
                          min={64}
                          max={32000}
                          step={64}
                          value={budgets[key]}
                          onChange={(e) => {
                            const n = Math.max(64, Math.min(32000, Math.round(Number(e.target.value) || 0)))
                            updatePreference("aiTokenBudgets", { ...budgets, [key]: n })
                          }}
                          className="w-full px-2.5 py-1.5 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* TTS — Browser Speech Synthesis */}
              <div className="px-4 py-3 rounded-lg border bg-card">
                <h3 className="text-sm font-medium mb-1 flex items-center gap-2">
                  <Volume2 className="size-3.5 text-muted-foreground" />
                  {t("settings.ai.tts.title")}
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  {t("settings.ai.tts.help")}
                </p>

                {ttsVoices.length > 0 ? (
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="tts-voice-select" className="text-xs font-medium text-muted-foreground mb-1 block">
                        {t("settings.ai.tts.voice")}
                      </label>
                      <select
                        id="tts-voice-select"
                        value={preferences.aiTTSVoice}
                        onChange={(e) => updatePreference("aiTTSVoice", e.target.value)}
                        className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">{t("settings.ai.tts.systemDefault")}</option>
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
                            text: t("settings.ai.tts.testText"),
                            voice: preferences.aiTTSVoice || undefined,
                          })
                        } catch (err) {
                          toast.error(t("settings.ai.tts.testFailed").replace("{error}", err instanceof Error ? err.message : t("settings.ai.tts.unknownError")))
                        } finally {
                          setTtsTesting(false)
                        }
                      }}
                    >
                      <Play className="size-3 mr-1.5" />
                      {ttsTesting ? t("settings.ai.tts.speaking") : t("settings.ai.tts.test")}
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    {t("settings.ai.tts.noVoices")}
                  </p>
                )}
              </div>

              {/* Manage installed models */}
              {ai.installedModels.length > 0 && (
                <div className="px-4 py-3 rounded-lg border bg-card">
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Database className="size-3.5 text-muted-foreground" />
                    {t("settings.ai.manageModels")}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    {t("settings.ai.manageModelsHelp")}
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
                              toast.success(t("settings.ai.modelDeleted").replace("{name}", model.name))
                            } catch {
                              toast.error(t("settings.ai.modelDeleteFailed").replace("{name}", model.name))
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

      {/* ─── Language + onboarding replay ────────────────────────── */}
      <section id="language" className="scroll-mt-4">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <Globe className="size-4" />
          {t("settings.language.title")}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t("settings.language.subtitle")}
        </p>
        <LocaleSwitcher />
      </section>

      {/* ─── Guides hub — every feature how-to in one place ──────── */}
      <section id="guides" className="scroll-mt-4">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <BookOpen className="size-4" />
          {t("settings.guides.title")}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t("settings.guides.subtitle")}
        </p>
        <GuidesHub />
      </section>

      {/* ─── Keyboard Shortcuts ──────────────────────────────────── */}
      <section id="shortcuts" className="scroll-mt-4">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <Keyboard className="size-4" />
          {t("settings.shortcuts.title")}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t("settings.shortcuts.subtitlePrefix")}{" "}
          <kbd className="px-1.5 py-0.5 rounded border bg-muted text-xs font-mono">
            Shift
          </kbd>{" "}
          +{" "}
          <kbd className="px-1.5 py-0.5 rounded border bg-muted text-xs font-mono">
            ?
          </kbd>{" "}
          {t("settings.shortcuts.subtitleSuffix")}
        </p>
      </section>

      {/* ─── About ───────────────────────────────────────────────── */}
      <section id="about" className="scroll-mt-4">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <Info className="size-4" />
          {t("settings.about.title")}
        </h2>
        <div className="px-4 py-3 rounded-lg border bg-card space-y-1">
          <p className="text-sm font-medium">{t("settings.about.version")}</p>
          <p className="text-xs text-muted-foreground">
            {t("settings.about.desc1")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("settings.about.desc2")}
          </p>
        </div>
      </section>

      {/* ─── AI Prompts Dialog ──────────────────────────────────── */}
      <Dialog open={promptsDialogOpen} onOpenChange={setPromptsDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("settings.ai.promptsDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("settings.ai.promptsDialog.desc")}
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
                          toast.success(t("settings.ai.promptReset").replace("{label}", label))
                        }}
                      >
                        <RotateCcw className="size-3 mr-1" />
                        {t("settings.bot.reset")}
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

      {/* ─── Description panel (xl+ only) ──────────────────────────── */}
      <DescriptionPanel item={activeNavItem} />
      </div>{/* /flex (in-tab rail + main + description) */}
    </div>
  )
}

/** Curates the right-click color palette + the platform default color.
 *
 *  Implementation notes:
 *  - The user's choice is saved per-user in DB-backed preferences. The
 *    sidebar's right-click handler reads `preferences.rightClickPalette`
 *    + `preferences.rightClickDefaultColor` to render the submenu and
 *    pre-select the default.
 *  - This widget never touches localStorage — `usePreferences` persists
 *    via the server action `saveMyPreferences`.
 *  - Predefined swatches come from a wider palette so the user has
 *    plenty to choose from. Toggling a swatch adds/removes it from the
 *    palette; clicking the "default" radio sets `rightClickDefaultColor`. */
function RightClickPalettePicker() {
  const { t } = useT()
  const { preferences, updatePreference } = usePreferences()
  const palette = preferences.rightClickPalette
  const defaultColor = preferences.rightClickDefaultColor

  // Wider swatch set users can pull from. Tuned for dark-mode readability.
  const ALL_SWATCHES: { hex: string; name: string }[] = [
    { hex: "#a78bfa", name: "Violet" },
    { hex: "#8b5cf6", name: "Purple" },
    { hex: "#60a5fa", name: "Blue" },
    { hex: "#3b82f6", name: "Indigo" },
    { hex: "#67e8f9", name: "Cyan" },
    { hex: "#14b8a6", name: "Teal" },
    { hex: "#6ee7b7", name: "Emerald" },
    { hex: "#10b981", name: "Green" },
    { hex: "#fbbf24", name: "Amber" },
    { hex: "#f97316", name: "Orange" },
    { hex: "#fb7185", name: "Rose" },
    { hex: "#f43f5e", name: "Crimson" },
    { hex: "#ec4899", name: "Pink" },
    { hex: "#94a3b8", name: "Slate" },
    { hex: "#737373", name: "Neutral" },
  ]

  function toggle(hex: string) {
    if (palette.includes(hex)) {
      // Removing — don't allow shrinking below 1.
      if (palette.length <= 1) return
      updatePreference("rightClickPalette", palette.filter((h) => h !== hex))
      // If we just removed the default, fall back to first remaining.
      if (defaultColor === hex) {
        const next = palette.filter((h) => h !== hex)[0]
        if (next) updatePreference("rightClickDefaultColor", next)
      }
    } else {
      updatePreference("rightClickPalette", [...palette, hex])
    }
  }

  function setDefault(hex: string) {
    if (!palette.includes(hex)) {
      updatePreference("rightClickPalette", [...palette, hex])
    }
    updatePreference("rightClickDefaultColor", hex)
  }

  return (
    <div className="px-4 py-3 rounded-lg border bg-card space-y-3">
      <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
        {ALL_SWATCHES.map((s) => {
          const enabled = palette.includes(s.hex)
          const isDefault = defaultColor === s.hex
          return (
            <button
              key={s.hex}
              type="button"
              onClick={() => toggle(s.hex)}
              onDoubleClick={() => setDefault(s.hex)}
              title={t("settings.palette.tooltip").replace("{name}", s.name)}
              className={`group relative flex flex-col items-center gap-1 p-1.5 rounded-md transition-all ${
                enabled ? "bg-accent/40" : "opacity-30 hover:opacity-60"
              }`}
            >
              <div
                className="size-7 rounded-full ring-offset-background flex items-center justify-center transition-transform group-hover:scale-105"
                style={{
                  background: s.hex,
                  boxShadow: isDefault ? `0 0 0 2px hsl(var(--background)), 0 0 0 4px ${s.hex}` : undefined,
                }}
              >
                {isDefault && <span className="text-[9px] font-bold text-white drop-shadow-md">★</span>}
              </div>
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{s.name}</span>
            </button>
          )
        })}
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {t("settings.palette.help").replace("{count}", String(palette.length))}
      </p>
    </div>
  )
}
