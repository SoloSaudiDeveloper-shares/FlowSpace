"use client"

/**
 * Project-manager home dashboard.
 *
 * One server-rendered page composed of small client widgets. The goal is
 * that within ~2 seconds of opening Home, a PM can answer:
 *   - "How much have I got on?" (KPI row)
 *   - "What's slipping?" (Today block — overdue front and centre)
 *   - "How are projects tracking?" (Project pulse — donut + avg progress)
 *   - "Am I active?" (Activity heatmap — 30-day pulse)
 *
 * Each block is independently hideable from a "Customize" sheet so the
 * page can be tailored per user. Visibility is stored in
 * `preferences.homeSections` (db-backed via use-preferences).
 *
 * Charts are pure SVG to keep the bundle light — no recharts dependency.
 */

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  FolderKanban,
  FileText,
  Layout,
  ListTodo,
  Bell,
  GitBranch,
  AlertCircle,
  CheckCircle2,
  Clock,
  Star,
  ArrowUpRight,
  Settings2,
  EyeOff,
  Sparkles,
  TrendingUp,
  Mic,
  GripVertical,
} from "lucide-react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useWorkspaceName } from "@/lib/hooks/use-workspace-name"
import { useT } from "@/lib/hooks/use-i18n"
import { useAuth } from "@/lib/hooks/use-auth"
import {
  usePreferences,
  HOME_SECTION_LABELS,
  HOME_DRAGGABLE_ORDER,
  type HomeSectionKey,
} from "@/lib/hooks/use-preferences"
import { FocusCard } from "@/components/home/focus-card"
import { SpeechButton } from "@/components/shared/speech-button"
import { FileIngestDropzone } from "@/components/shared/file-ingest-dropzone"
import { createElement } from "@/lib/actions/element-actions"
import type { DashboardSummary } from "@/lib/actions/dashboard-actions"
import type { Element, ElementType } from "@/lib/db/schema"
import { AIImportDialog } from "@/components/import/ai-import-dialog"
import { PendingImportsDialog } from "@/components/inbox/pending-imports-dialog"
import { getMyPendingImportCount } from "@/lib/actions/pending-imports-actions"
import { Inbox } from "lucide-react"

// ─── Visual constants ─────────────────────────────────────────────────────

/** Each element type gets an accent so the KPI row reads at a glance. */
const TYPE_META: Record<
  keyof DashboardSummary["counts"],
  {
    labelKey: string
    icon: React.ComponentType<{ className?: string }>
    accent: string // hex
    href: string
  }
> = {
  project:   { labelKey: "home.type.projects",  icon: FolderKanban, accent: "#a78bfa", href: "/?type=project" },
  page:      { labelKey: "home.type.pages",     icon: FileText,     accent: "#60a5fa", href: "/?type=page" },
  canvas:    { labelKey: "home.type.canvases",  icon: Layout,       accent: "#67e8f9", href: "/?type=canvas" },
  todo_list: { labelKey: "home.type.todoLists", icon: ListTodo,     accent: "#fbbf24", href: "/?type=todo_list" },
  reminder:  { labelKey: "home.type.reminders", icon: Bell,         accent: "#fb7185", href: "/?type=reminder" },
  process:   { labelKey: "home.type.processes", icon: GitBranch,    accent: "#6ee7b7", href: "/?type=process" },
}

const PROJECT_STATUS_COLORS = {
  active:    "#a78bfa",
  planning:  "#60a5fa",
  paused:    "#fbbf24",
  completed: "#6ee7b7",
}

/** Returns the dict key for the time-of-day greeting. */
function greetingKey() {
  const h = new Date().getHours()
  return h < 5 ? "home.greeting.late" : h < 12 ? "home.greeting.morning" : h < 18 ? "home.greeting.afternoon" : "home.greeting.evening"
}

function isSectionVisible(prefs: Record<string, boolean | undefined>, key: HomeSectionKey): boolean {
  return prefs?.[key] !== false
}

// ─── Hero block ───────────────────────────────────────────────────────────

function HeroBlock({
  onCustomize,
  onImport,
}: {
  onCustomize: () => void
  onImport: () => void
}) {
  const { t } = useT()
  const { workspaceName } = useWorkspaceName()
  const { user } = useAuth()
  const { preferences } = usePreferences()
  const suffix = preferences.workspaceSuffix
  const firstName = user?.displayName?.split(" ")[0]
  const greetingText = firstName
    ? `${t(greetingKey())}, ${firstName}`
    : t(greetingKey())
  return (
    <div className="flex items-end justify-between gap-4 pb-1">
      <div>
        <p className="text-sm text-muted-foreground">{greetingText}</p>
        <h1 className="text-3xl font-bold tracking-tight mt-1">
          {workspaceName}
          {suffix && <span className="text-muted-foreground font-medium">: {suffix}</span>}
        </h1>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onImport}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <Sparkles className="size-3.5" />
          {t("home.hero.importFromAi")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCustomize}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <Settings2 className="size-3.5" />
          {t("home.hero.customize")}
        </Button>
      </div>
    </div>
  )
}

// ─── KPI cards ────────────────────────────────────────────────────────────

function KpiRow({ counts }: { counts: DashboardSummary["counts"] }) {
  const router = useRouter()
  const { t } = useT()
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {(Object.keys(TYPE_META) as (keyof typeof TYPE_META)[]).map((key) => {
        const meta = TYPE_META[key]
        const Icon = meta.icon
        const c = counts[key]
        const isNew = c.new7d > 0
        return (
          <button
            key={key}
            onClick={() => router.push(meta.href)}
            className="group relative overflow-hidden text-left rounded-xl border bg-card p-4 transition-all hover:border-foreground/20 hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5"
            style={{ borderColor: `${meta.accent}30` }}
          >
            {/* gradient halo on hover */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={{
                background: `radial-gradient(circle at top right, ${meta.accent}18, transparent 60%)`,
              }}
            />
            <div className="relative flex items-start justify-between mb-3">
              <div
                className="size-9 rounded-lg flex items-center justify-center"
                style={{ background: `${meta.accent}1a`, color: meta.accent }}
              >
                <Icon className="size-4" />
              </div>
              {isNew && (
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                  style={{ background: `${meta.accent}25`, color: meta.accent }}
                >
                  <TrendingUp className="size-2.5" />
                  +{c.new7d}
                </span>
              )}
            </div>
            <div className="relative">
              <div className="text-2xl font-bold tabular-nums leading-none">{c.total}</div>
              <div className="text-xs text-muted-foreground mt-1.5">{t(meta.labelKey)}</div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ─── Project pulse (donut + avg progress) ─────────────────────────────────

function Donut({
  segments,
  size = 140,
  thickness = 14,
}: {
  segments: { label: string; value: number; color: string }[]
  size?: number
  thickness?: number
}) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  const r = size / 2 - thickness
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.08}
        strokeWidth={thickness}
      />
      {total > 0 &&
        segments.map((seg, i) => {
          const len = (seg.value / total) * c
          const dash = `${len} ${c - len}`
          const node = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={thickness}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            >
              <title>{`${seg.label}: ${seg.value}`}</title>
            </circle>
          )
          offset += len
          return node
        })}
    </svg>
  )
}

function ProjectPulse({
  projectStatus,
  avgProgress,
  taskTotals,
}: {
  projectStatus: DashboardSummary["projectStatus"]
  avgProgress: number
  taskTotals: DashboardSummary["taskTotals"]
}) {
  const { t } = useT()
  const total =
    projectStatus.active +
    projectStatus.planning +
    projectStatus.paused +
    projectStatus.completed

  const segments = [
    { key: "active",    label: t("home.pulse.status.active"),    value: projectStatus.active,    color: PROJECT_STATUS_COLORS.active },
    { key: "planning",  label: t("home.pulse.status.planning"),  value: projectStatus.planning,  color: PROJECT_STATUS_COLORS.planning },
    { key: "paused",    label: t("home.pulse.status.paused"),    value: projectStatus.paused,    color: PROJECT_STATUS_COLORS.paused },
    { key: "completed", label: t("home.pulse.status.completed"), value: projectStatus.completed, color: PROJECT_STATUS_COLORS.completed },
  ]

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="size-3.5 text-primary" />
          {t("home.pulse.title")}
        </h2>
        <span className="text-xs text-muted-foreground">
          {t(total === 1 ? "home.pulse.projectCount" : "home.pulse.projectCountP").replace("{n}", String(total))}
        </span>
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-5 items-center">
        {/* Donut + center label */}
        <div className="relative">
          <Donut segments={segments} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs text-muted-foreground">{t("home.pulse.overall")}</span>
            <span className="text-2xl font-bold tabular-nums">{avgProgress}%</span>
            <span className="text-[10px] text-muted-foreground">{t("home.pulse.complete")}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-1.5">
          {segments.map((s) => (
            <div key={s.key} className="flex items-center gap-2 text-xs">
              <span
                className="size-2.5 rounded-sm shrink-0"
                style={{ background: s.color }}
              />
              <span className="text-muted-foreground flex-1">{s.label}</span>
              <span className="tabular-nums font-medium">{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Task stats row */}
      <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-border/60">
        <Stat label={t("home.pulse.stat.openTasks")} value={taskTotals.open}    icon={Clock}        tone="muted" />
        <Stat label={t("home.pulse.stat.done")}      value={taskTotals.done}    icon={CheckCircle2} tone="good" />
        <Stat label={t("home.pulse.stat.overdue")}   value={taskTotals.overdue} icon={AlertCircle}  tone={taskTotals.overdue > 0 ? "bad" : "muted"} />
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  tone: "good" | "bad" | "muted"
}) {
  const colorClass =
    tone === "good" ? "text-emerald-400" : tone === "bad" ? "text-rose-400" : "text-muted-foreground"
  return (
    <div className="text-center">
      <div className={`flex items-center justify-center gap-1.5 ${colorClass}`}>
        <Icon className="size-3.5" />
        <span className="text-xl font-bold tabular-nums">{value}</span>
      </div>
      <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  )
}

// ─── Today / upcoming ─────────────────────────────────────────────────────

function TodayBlock({ upcoming }: { upcoming: DashboardSummary["upcoming"] }) {
  const router = useRouter()
  const { t } = useT()
  const overdueCount = upcoming.filter((u) => u.overdue).length
  return (
    <div className="rounded-xl border bg-card p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Clock className="size-3.5 text-primary" />
          {t("home.today.title")}
        </h2>
        {overdueCount > 0 && (
          <span className="text-[11px] font-medium text-rose-400 flex items-center gap-1">
            <AlertCircle className="size-3" />
            {t("home.today.overdue").replace("{n}", String(overdueCount))}
          </span>
        )}
      </div>
      {upcoming.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          {t("home.today.empty")}
        </p>
      ) : (
        <div className="space-y-1 -mx-1 flex-1">
          {upcoming.map((item) => {
            const due = new Date(item.dueAt)
            const dateLabel = due.toLocaleDateString(undefined, { month: "short", day: "numeric" })
            const Icon = item.type === "reminder" ? Bell : CheckCircle2
            return (
              <button
                key={`${item.type}-${item.id}`}
                onClick={() => router.push(item.href)}
                className="group w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent text-left"
              >
                <Icon
                  className={`size-3.5 shrink-0 ${
                    item.overdue ? "text-rose-400" : "text-muted-foreground"
                  }`}
                />
                <span className="flex-1 min-w-0">
                  <span className="block truncate">{item.title}</span>
                  {item.projectTitle && (
                    <span className="block text-[10px] text-muted-foreground/70 truncate">
                      {t("home.today.inProject").replace("{project}", item.projectTitle)}
                    </span>
                  )}
                </span>
                <span
                  className={`text-[11px] shrink-0 tabular-nums ${
                    item.overdue ? "text-rose-400 font-medium" : "text-muted-foreground"
                  }`}
                >
                  {dateLabel}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Activity heatmap (30-day) ────────────────────────────────────────────

function ActivityHeatmap({ days }: { days: { date: string; count: number }[] }) {
  const { t } = useT()
  const max = useMemo(() => Math.max(1, ...days.map((d) => d.count)), [days])
  const total = days.reduce((s, d) => s + d.count, 0)
  const activeDays = days.filter((d) => d.count > 0).length
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="size-3.5 text-primary" />
          {t("home.activity.title")}
        </h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {t(total === 1 ? "home.activity.summary" : "home.activity.summaryP")
            .replace("{events}", String(total))
            .replace("{active}", String(activeDays))
            .replace("{total}", String(days.length))}
        </span>
      </div>
      <div className="flex items-end gap-1 h-20">
        {days.map((d) => {
          const intensity = d.count === 0 ? 0 : 0.2 + (d.count / max) * 0.8
          const h = d.count === 0 ? 4 : 6 + (d.count / max) * 70
          return (
            <div
              key={d.date}
              title={t(d.count === 1 ? "home.activity.dayTooltip" : "home.activity.dayTooltipP")
                .replace("{date}", d.date)
                .replace("{n}", String(d.count))}
              className="flex-1 rounded-sm transition-colors hover:bg-primary"
              style={{
                height: `${h}px`,
                background:
                  d.count === 0
                    ? "rgba(255,255,255,0.05)"
                    : `rgba(167, 139, 250, ${intensity})`,
              }}
            />
          )
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground/70 mt-2">
        <span>{days[0]?.date.slice(5)}</span>
        <span>{t("home.activity.today")}</span>
      </div>
    </div>
  )
}

// ─── Compact quick capture ────────────────────────────────────────────────

function QuickCaptureCompact() {
  const router = useRouter()
  const { t } = useT()
  const [title, setTitle] = useState("")
  const [type, setType] = useState<ElementType>("project")
  const [busy, setBusy] = useState(false)

  async function go() {
    if (!title.trim() || busy) return
    setBusy(true)
    try {
      const r = await createElement(type, title.trim())
      const href =
        r.type === "project" ? `/projects/${r.id}`
        : r.type === "page" ? `/pages/${r.id}`
        : r.type === "canvas" ? `/canvas/${r.id}`
        : r.type === "todo_list" ? `/todos/${r.id}`
        : r.type === "process" ? `/process/${r.id}`
        : "/reminders"
      setTitle("")
      router.push(href)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Sparkles className="size-3.5 text-primary" />
        {t("home.capture.title")}
      </h2>
      <div className="relative">
        <Input
          placeholder={t("home.capture.placeholder")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") go() }}
          className="pr-20"
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          <SpeechButton
            onTranscript={(t) => setTitle((p) => p ? `${p} ${t}` : t)}
            size="sm"
            showPulse
            tooltip={t("home.capture.speakTip")}
            preferAccuracy
          />
          {title.trim() && (
            <Button size="sm" variant="ghost" className="size-7 p-0 rounded-full" onClick={go} disabled={busy}>
              <ArrowUpRight className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mt-3">
        {(["project", "page", "canvas", "todo_list", "reminder", "process"] as ElementType[]).map((et) => {
          const m = TYPE_META[et as keyof typeof TYPE_META]
          const active = type === et
          return (
            <button
              key={et}
              onClick={() => setType(et)}
              className={`px-2 py-0.5 text-[11px] rounded-full border transition-colors ${
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              style={
                active
                  ? { background: `${m.accent}20`, borderColor: `${m.accent}60` }
                  : { borderColor: "rgba(255,255,255,0.08)" }
              }
            >
              {t(m.labelKey)}
            </button>
          )
        })}
      </div>

      {/* File-ingest dropzone — drop a PDF/CSV/MD → becomes a Page. */}
      <div className="mt-4">
        <FileIngestDropzone />
      </div>
    </div>
  )
}

// ─── Recent / favorites slim row ──────────────────────────────────────────

function RecentRow({
  recent,
  favorites,
}: {
  recent: Element[]
  favorites: Element[]
}) {
  const router = useRouter()
  const { t } = useT()
  const [tab, setTab] = useState<"recent" | "favorites">("recent")
  const list = tab === "recent" ? recent.slice(0, 8) : favorites.slice(0, 8)
  const TypeIcons: Record<ElementType, React.ComponentType<{ className?: string }>> = {
    project: FolderKanban, page: FileText, canvas: Layout,
    todo_list: ListTodo, reminder: Bell, process: GitBranch,
  }
  function getHref(el: Element) {
    switch (el.type) {
      case "project": return `/projects/${el.id}`
      case "page": return `/pages/${el.id}`
      case "canvas": return `/canvas/${el.id}`
      case "todo_list": return `/todos/${el.id}`
      case "process": return `/process/${el.id}`
      case "reminder": return `/reminders`
      default: return "/"
    }
  }
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setTab("recent")}
          className={`flex items-center gap-1.5 text-sm font-semibold transition-colors ${
            tab === "recent" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock className="size-3.5" />
          {t("home.recent.tab.recent")}
        </button>
        <span className="text-muted-foreground/40">·</span>
        <button
          onClick={() => setTab("favorites")}
          className={`flex items-center gap-1.5 text-sm font-semibold transition-colors ${
            tab === "favorites" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Star className="size-3.5" />
          {t("home.recent.tab.favorites")}
        </button>
      </div>
      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          {tab === "recent" ? t("home.recent.empty.recent") : t("home.recent.empty.favorites")}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {list.map((el) => {
            const Icon = TypeIcons[el.type]
            return (
              <button
                key={el.id}
                onClick={() => router.push(getHref(el))}
                className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent text-left"
              >
                <span
                  className="size-6 rounded-md flex items-center justify-center shrink-0"
                  style={{
                    background: `${el.color ?? "#737373"}20`,
                    color: el.color ?? "currentColor",
                  }}
                >
                  <Icon className="size-3" />
                </span>
                <span className="truncate flex-1">{el.title}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Customize sheet (toggle sections on/off) ─────────────────────────────

function CustomizeDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { t } = useT()
  const { preferences, updatePreference } = usePreferences()
  const sections = preferences.homeSections ?? {}
  function toggle(key: HomeSectionKey) {
    const next = { ...(preferences.homeSections ?? {}) }
    next[key] = sections[key] === false ? true : false
    updatePreference("homeSections", next)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("home.customize.title")}</DialogTitle>
          <DialogDescription>
            {t("home.customize.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          {(Object.keys(HOME_SECTION_LABELS) as HomeSectionKey[]).map((k) => {
            const visible = isSectionVisible(sections, k)
            return (
              <button
                key={k}
                onClick={() => toggle(k)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg border-2 text-left transition-colors ${
                  visible
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-card hover:border-primary/30"
                }`}
              >
                <div>
                  <p className="text-sm font-medium">{HOME_SECTION_LABELS[k]}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {visible ? t("home.customize.visible") : t("home.customize.hidden")}
                  </p>
                </div>
                {visible ? (
                  <CheckCircle2 className="size-4 text-primary" />
                ) : (
                  <EyeOff className="size-4 text-muted-foreground" />
                )}
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Draggable card wrapper ───────────────────────────────────────────────

/** Wraps a dashboard block so it can be dragged to reorder. A grip handle
 *  fades in on hover (top-left corner), mirroring the sidebar's drag affordance. */
function SortableBlock({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 20 : undefined,
    position: "relative",
  }
  return (
    <div ref={setNodeRef} style={style} className="group/card">
      <button
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1 z-20 cursor-grab active:cursor-grabbing opacity-0 group-hover/card:opacity-70 hover:!opacity-100 p-1 rounded-md bg-card border shadow-sm transition-opacity"
        title="Drag to reorder"
        aria-label="Drag card"
      >
        <GripVertical className="size-3.5 text-muted-foreground" />
      </button>
      {children}
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────

export function HomeDashboard({
  summary,
  recent,
  favorites,
}: {
  summary: DashboardSummary
  recent: Element[]
  favorites: Element[]
}) {
  const { t } = useT()
  const [customizing, setCustomizing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [inboxOpen, setInboxOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const { preferences, updatePreference } = usePreferences()
  const sections = preferences.homeSections ?? {}
  const show = (k: HomeSectionKey) => isSectionVisible(sections, k)

  // ── Draggable card order ──────────────────────────────────────────────
  // Gate dnd-kit until after hydration (it generates incrementing aria IDs
  // that mismatch between SSR and CSR).
  const [dndReady, setDndReady] = useState(false)
  useEffect(() => setDndReady(true), [])
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  // Full order = stored order, sanitised to known keys, with any missing
  // appended in default order (so a newly-added card still shows up).
  const fullOrder: HomeSectionKey[] = (() => {
    const stored = (preferences.homeSectionOrder ?? HOME_DRAGGABLE_ORDER).filter(
      (k): k is HomeSectionKey => HOME_DRAGGABLE_ORDER.includes(k as HomeSectionKey),
    )
    for (const k of HOME_DRAGGABLE_ORDER) if (!stored.includes(k)) stored.push(k)
    return stored
  })()
  const visibleOrder = fullOrder.filter((k) => show(k))

  function handleCardDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = fullOrder.indexOf(active.id as HomeSectionKey)
    const to = fullOrder.indexOf(over.id as HomeSectionKey)
    if (from === -1 || to === -1) return
    updatePreference("homeSectionOrder", arrayMove(fullOrder, from, to))
  }

  function renderBlock(key: HomeSectionKey): React.ReactNode {
    switch (key) {
      case "kpi": return <KpiRow counts={summary.counts} />
      case "aiFocus": return <FocusCard />
      case "pulse":
        return (
          <ProjectPulse
            projectStatus={summary.projectStatus}
            avgProgress={summary.avgProgress}
            taskTotals={summary.taskTotals}
          />
        )
      case "today": return <TodayBlock upcoming={summary.upcoming} />
      case "activity": return <ActivityHeatmap days={summary.activityByDay} />
      case "quickCapture": return <QuickCaptureCompact />
      case "recent": return <RecentRow recent={recent} favorites={favorites} />
      default: return null
    }
  }

  // Poll for pending imports so a fresh Telegram payload shows up without
  // a manual refresh. 30s feels live enough without spamming the server.
  useEffect(() => {
    let cancelled = false
    async function tick() {
      try {
        const n = await getMyPendingImportCount()
        if (!cancelled) setPendingCount(n)
      } catch {
        /* ignore */
      }
    }
    void tick()
    const t = window.setInterval(tick, 30_000)
    return () => { cancelled = true; window.clearInterval(t) }
  }, [])

  return (
    <div className="space-y-5 animate-page-enter">
      {show("hero") && (
        <HeroBlock
          onCustomize={() => setCustomizing(true)}
          onImport={() => setImporting(true)}
        />
      )}

      {/* Pending imports banner — only shows when there are unresolved
          payloads from the Telegram bot waiting for human approval. */}
      {pendingCount > 0 && (
        <button
          onClick={() => setInboxOpen(true)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-primary/40 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent hover:from-primary/15 transition-colors text-left group"
        >
          <div className="size-9 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0">
            <Inbox className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {t(pendingCount === 1 ? "home.pending.title" : "home.pending.titleP").replace("{n}", String(pendingCount))}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("home.pending.desc")}
            </p>
          </div>
          <span className="text-xs text-primary font-medium group-hover:translate-x-0.5 transition-transform">
            {t("home.pending.review")}
          </span>
        </button>
      )}

      {/* Draggable dashboard cards — reorder by dragging the grip handle.
          Order persists in preferences.homeSectionOrder. */}
      {dndReady ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCardDragEnd}>
          <SortableContext items={visibleOrder} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {visibleOrder.map((key) => (
                <SortableBlock key={key} id={key}>
                  {renderBlock(key)}
                </SortableBlock>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="space-y-4">
          {visibleOrder.map((key) => (
            <div key={key}>{renderBlock(key)}</div>
          ))}
        </div>
      )}

      <CustomizeDialog open={customizing} onOpenChange={setCustomizing} />
      <AIImportDialog open={importing} onOpenChange={setImporting} />
      <PendingImportsDialog
        open={inboxOpen}
        onOpenChange={setInboxOpen}
        onChanged={async () => {
          // Update the count when the inbox dialog changes anything.
          try { setPendingCount(await getMyPendingImportCount()) } catch {}
        }}
      />
    </div>
  )
}
