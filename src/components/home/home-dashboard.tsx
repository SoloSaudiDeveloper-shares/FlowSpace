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

import { useState, useMemo } from "react"
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
} from "lucide-react"
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
import { useAuth } from "@/lib/hooks/use-auth"
import {
  usePreferences,
  HOME_SECTION_LABELS,
  type HomeSectionKey,
} from "@/lib/hooks/use-preferences"
import { SpeechButton } from "@/components/shared/speech-button"
import { createElement } from "@/lib/actions/element-actions"
import type { DashboardSummary } from "@/lib/actions/dashboard-actions"
import type { Element, ElementType } from "@/lib/db/schema"

// ─── Visual constants ─────────────────────────────────────────────────────

/** Each element type gets an accent so the KPI row reads at a glance. */
const TYPE_META: Record<
  keyof DashboardSummary["counts"],
  {
    label: string
    icon: React.ComponentType<{ className?: string }>
    accent: string // hex
    href: string
  }
> = {
  project:   { label: "Projects",   icon: FolderKanban, accent: "#a78bfa", href: "/?type=project" },
  page:      { label: "Pages",      icon: FileText,     accent: "#60a5fa", href: "/?type=page" },
  canvas:    { label: "Canvases",   icon: Layout,       accent: "#67e8f9", href: "/?type=canvas" },
  todo_list: { label: "Todo lists", icon: ListTodo,     accent: "#fbbf24", href: "/?type=todo_list" },
  reminder:  { label: "Reminders",  icon: Bell,         accent: "#fb7185", href: "/?type=reminder" },
  process:   { label: "Processes",  icon: GitBranch,    accent: "#6ee7b7", href: "/?type=process" },
}

const PROJECT_STATUS_COLORS = {
  active:    "#a78bfa",
  planning:  "#60a5fa",
  paused:    "#fbbf24",
  completed: "#6ee7b7",
}

function greeting(name?: string | null) {
  const h = new Date().getHours()
  const part = h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"
  return name ? `${part}, ${name.split(" ")[0]}` : part
}

function isSectionVisible(prefs: Record<string, boolean | undefined>, key: HomeSectionKey): boolean {
  return prefs?.[key] !== false
}

// ─── Hero block ───────────────────────────────────────────────────────────

function HeroBlock({
  onCustomize,
}: {
  onCustomize: () => void
}) {
  const { workspaceName } = useWorkspaceName()
  const { user } = useAuth()
  const { preferences } = usePreferences()
  const suffix = preferences.workspaceSuffix
  return (
    <div className="flex items-end justify-between gap-4 pb-1">
      <div>
        <p className="text-sm text-muted-foreground">{greeting(user?.displayName)}</p>
        <h1 className="text-3xl font-bold tracking-tight mt-1">
          {workspaceName}
          {suffix && <span className="text-muted-foreground font-medium">: {suffix}</span>}
        </h1>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onCustomize}
        className="gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <Settings2 className="size-3.5" />
        Customize
      </Button>
    </div>
  )
}

// ─── KPI cards ────────────────────────────────────────────────────────────

function KpiRow({ counts }: { counts: DashboardSummary["counts"] }) {
  const router = useRouter()
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
              <div className="text-xs text-muted-foreground mt-1.5">{meta.label}</div>
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
  const total =
    projectStatus.active +
    projectStatus.planning +
    projectStatus.paused +
    projectStatus.completed

  const segments = [
    { label: "Active",    value: projectStatus.active,    color: PROJECT_STATUS_COLORS.active },
    { label: "Planning",  value: projectStatus.planning,  color: PROJECT_STATUS_COLORS.planning },
    { label: "Paused",    value: projectStatus.paused,    color: PROJECT_STATUS_COLORS.paused },
    { label: "Completed", value: projectStatus.completed, color: PROJECT_STATUS_COLORS.completed },
  ]

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="size-3.5 text-primary" />
          Project pulse
        </h2>
        <span className="text-xs text-muted-foreground">{total} project{total === 1 ? "" : "s"}</span>
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-5 items-center">
        {/* Donut + center label */}
        <div className="relative">
          <Donut segments={segments} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs text-muted-foreground">Overall</span>
            <span className="text-2xl font-bold tabular-nums">{avgProgress}%</span>
            <span className="text-[10px] text-muted-foreground">complete</span>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-1.5">
          {segments.map((s) => (
            <div key={s.label} className="flex items-center gap-2 text-xs">
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
        <Stat label="Open tasks"  value={taskTotals.open}    icon={Clock}        tone="muted" />
        <Stat label="Done"        value={taskTotals.done}    icon={CheckCircle2} tone="good" />
        <Stat label="Overdue"     value={taskTotals.overdue} icon={AlertCircle}  tone={taskTotals.overdue > 0 ? "bad" : "muted"} />
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
  const overdueCount = upcoming.filter((u) => u.overdue).length
  return (
    <div className="rounded-xl border bg-card p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Clock className="size-3.5 text-primary" />
          Today & upcoming
        </h2>
        {overdueCount > 0 && (
          <span className="text-[11px] font-medium text-rose-400 flex items-center gap-1">
            <AlertCircle className="size-3" />
            {overdueCount} overdue
          </span>
        )}
      </div>
      {upcoming.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          Nothing on the radar for the next 7 days. Quiet seas ahead.
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
                      in {item.projectTitle}
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
  const max = useMemo(() => Math.max(1, ...days.map((d) => d.count)), [days])
  const total = days.reduce((s, d) => s + d.count, 0)
  const activeDays = days.filter((d) => d.count > 0).length
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="size-3.5 text-primary" />
          Activity — last 30 days
        </h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {total} event{total === 1 ? "" : "s"} · {activeDays}/{days.length} days active
        </span>
      </div>
      <div className="flex items-end gap-1 h-20">
        {days.map((d) => {
          const intensity = d.count === 0 ? 0 : 0.2 + (d.count / max) * 0.8
          const h = d.count === 0 ? 4 : 6 + (d.count / max) * 70
          return (
            <div
              key={d.date}
              title={`${d.date} — ${d.count} event${d.count === 1 ? "" : "s"}`}
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
        <span>Today</span>
      </div>
    </div>
  )
}

// ─── Compact quick capture ────────────────────────────────────────────────

function QuickCaptureCompact() {
  const router = useRouter()
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
        Capture
      </h2>
      <div className="relative">
        <Input
          placeholder="What's on your mind?"
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
            tooltip="Speak"
          />
          {title.trim() && (
            <Button size="sm" variant="ghost" className="size-7 p-0 rounded-full" onClick={go} disabled={busy}>
              <ArrowUpRight className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mt-3">
        {(["project", "page", "canvas", "todo_list", "reminder", "process"] as ElementType[]).map((t) => {
          const m = TYPE_META[t as keyof typeof TYPE_META]
          const active = type === t
          return (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`px-2 py-0.5 text-[11px] rounded-full border transition-colors ${
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              style={
                active
                  ? { background: `${m.accent}20`, borderColor: `${m.accent}60` }
                  : { borderColor: "rgba(255,255,255,0.08)" }
              }
            >
              {m.label.toLowerCase()}
            </button>
          )
        })}
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
          Recent
        </button>
        <span className="text-muted-foreground/40">·</span>
        <button
          onClick={() => setTab("favorites")}
          className={`flex items-center gap-1.5 text-sm font-semibold transition-colors ${
            tab === "favorites" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Star className="size-3.5" />
          Favorites
        </button>
      </div>
      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          {tab === "recent" ? "Nothing recent yet." : "Star items from the sidebar to pin them here."}
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
          <DialogTitle>Customize home</DialogTitle>
          <DialogDescription>
            Toggle the panels you want on your home page. Hidden panels can be
            re-added any time.
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
                    {visible ? "Visible on home" : "Hidden"}
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
  const [customizing, setCustomizing] = useState(false)
  const { preferences } = usePreferences()
  const sections = preferences.homeSections ?? {}
  const show = (k: HomeSectionKey) => isSectionVisible(sections, k)

  return (
    <div className="space-y-5 animate-page-enter">
      {show("hero") && <HeroBlock onCustomize={() => setCustomizing(true)} />}
      {show("kpi") && <KpiRow counts={summary.counts} />}

      {(show("pulse") || show("today")) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {show("pulse") && (
            <div className="lg:col-span-2">
              <ProjectPulse
                projectStatus={summary.projectStatus}
                avgProgress={summary.avgProgress}
                taskTotals={summary.taskTotals}
              />
            </div>
          )}
          {show("today") && (
            <div className={show("pulse") ? "" : "lg:col-span-3"}>
              <TodayBlock upcoming={summary.upcoming} />
            </div>
          )}
        </div>
      )}

      {(show("activity") || show("quickCapture")) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {show("activity") && (
            <div className={show("quickCapture") ? "lg:col-span-2" : "lg:col-span-3"}>
              <ActivityHeatmap days={summary.activityByDay} />
            </div>
          )}
          {show("quickCapture") && (
            <div className={show("activity") ? "" : "lg:col-span-3"}>
              <QuickCaptureCompact />
            </div>
          )}
        </div>
      )}

      {show("recent") && <RecentRow recent={recent} favorites={favorites} />}

      <CustomizeDialog open={customizing} onOpenChange={setCustomizing} />
    </div>
  )
}
