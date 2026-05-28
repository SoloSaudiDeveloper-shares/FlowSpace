"use client"

import { useState, useMemo, useCallback, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  markEventRead,
  pinEvent,
  unpinEvent,
  setFeedEventPriority,
  createFeedEvent,
} from "@/lib/actions/feed-actions"
import {
  ContextMenu,
  useContextMenu,
  type ContextMenuEntry,
} from "@/components/shared/context-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Plus,
  CheckCircle,
  UserPlus,
  MessageSquare,
  FileText,
  Layout,
  ShieldCheck,
  Zap,
  HardDrive,
  Lock,
  Activity,
  Pin,
  PinOff,
  Eye,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Rss,
  Filter,
  Flame,
  Minus,
  Circle,
  Send,
  Info,
  Sparkles,
  Bot,
  Globe,
} from "lucide-react"

// ─── Types ──────────────────────────────────────────────────────────────

interface FeedContentProps {
  events: any[]
  currentUserId: string | null
  mode: "global" | "personal" | "admin" | "project" | "element" | "team"
  subscriptions?: any[]
  pinnedEvents?: any[]
}

type EventType =
  | "task_created" | "task_completed" | "task_assigned"
  | "comment_added" | "page_updated" | "canvas_updated"
  | "approval_requested" | "automation_fired"
  | "backup_completed" | "user_joined" | "permission_changed"

type PriorityFilter = "all" | "high" | "normal" | "low"
type SourceFilter = "all" | "manual" | "system" | "automation"

// ─── Event Type Config ──────────────────────────────────────────────────

const EVENT_TYPE_FILTERS = [
  { key: "tasks", label: "Tasks", types: ["task_created", "task_completed", "task_assigned", "task_updated", "task_overdue"] },
  { key: "comments", label: "Comments", types: ["comment_added", "comment_mention"] },
  { key: "pages", label: "Pages", types: ["page_updated"] },
  { key: "canvas", label: "Canvas", types: ["canvas_updated"] },
  { key: "approvals", label: "Approvals", types: ["approval_requested", "approval_completed"] },
  { key: "automation", label: "Automation", types: ["automation_fired"] },
  { key: "system", label: "System", types: ["backup_completed", "backup_failed", "user_joined", "permission_changed", "reminder_triggered"] },
] as const

const EVENT_ICON_MAP: Record<string, typeof Activity> = {
  task_created: Plus,
  task_completed: CheckCircle,
  task_assigned: UserPlus,
  comment_added: MessageSquare,
  comment_mention: MessageSquare,
  page_updated: FileText,
  canvas_updated: Layout,
  approval_requested: ShieldCheck,
  approval_completed: ShieldCheck,
  automation_fired: Zap,
  backup_completed: HardDrive,
  backup_failed: HardDrive,
  user_joined: UserPlus,
  permission_changed: Lock,
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  normal: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
}

const SOURCE_COLORS: Record<string, string> = {
  manual: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  system: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  automation: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  form: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  api: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
}

const AVATAR_COLORS = [
  "bg-red-500", "bg-blue-500", "bg-green-500", "bg-purple-500",
  "bg-amber-500", "bg-cyan-500", "bg-pink-500", "bg-indigo-500",
]

// ─── Helpers ────────────────────────────────────────────────────────────

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay === 1) {
    return `Yesterday at ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function getDayLabel(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const eventDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.floor((today.getTime() - eventDay.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

function groupEventsByDay(events: any[]): Map<string, any[]> {
  const groups = new Map<string, any[]>()
  for (const ev of events) {
    const label = getDayLabel(ev.event.createdAt)
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(ev)
  }
  return groups
}

// ─── Component ──────────────────────────────────────────────────────────

export function FeedContent({
  events,
  currentUserId,
  mode,
  subscriptions,
  pinnedEvents,
}: FeedContentProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Filter state
  const [activeTypeFilters, setActiveTypeFilters] = useState<Set<string>>(new Set())
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all")
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all")
  const [pinnedExpanded, setPinnedExpanded] = useState(true)
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(
    () => new Set(pinnedEvents?.map((p) => p.event.id) ?? [])
  )

  // Toggle event type filter chip
  const toggleTypeFilter = useCallback((key: string) => {
    setActiveTypeFilters((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      // Type filter
      if (activeTypeFilters.size > 0) {
        const matchesAny = Array.from(activeTypeFilters).some((key) => {
          const filterDef = EVENT_TYPE_FILTERS.find((f) => f.key === key)
          return filterDef ? (filterDef.types as readonly string[]).includes(ev.event.type) : false
        })
        if (!matchesAny) return false
      }
      // Priority filter
      if (priorityFilter !== "all" && ev.event.priority !== priorityFilter) return false
      // Source filter
      if (sourceFilter !== "all" && ev.event.sourceType !== sourceFilter) return false
      return true
    })
  }, [events, activeTypeFilters, priorityFilter, sourceFilter])

  const groupedEvents = useMemo(() => groupEventsByDay(filteredEvents), [filteredEvents])

  // Actions
  const handleMarkRead = useCallback(
    (eventId: string) => {
      if (!currentUserId) return
      startTransition(async () => {
        try {
          await markEventRead(currentUserId, eventId)
          toast.success("Marked as read")
        } catch {
          toast.error("Failed to mark as read")
        }
      })
    },
    [currentUserId]
  )

  const handlePin = useCallback(
    (eventId: string) => {
      if (!currentUserId) return
      const alreadyPinned = pinnedIds.has(eventId)
      startTransition(async () => {
        try {
          if (alreadyPinned) {
            await unpinEvent(currentUserId, eventId)
            setPinnedIds((prev) => {
              const next = new Set(prev)
              next.delete(eventId)
              return next
            })
            toast.success("Unpinned")
          } else {
            await pinEvent(currentUserId, eventId)
            setPinnedIds((prev) => new Set(prev).add(eventId))
            toast.success("Pinned")
          }
        } catch {
          toast.error("Failed to update pin")
        }
      })
    },
    [currentUserId, pinnedIds]
  )

  const handleOpenRelated = useCallback(
    (ev: any) => {
      if (ev.event.subjectElementId) {
        router.push(`/pages/${ev.event.subjectElementId}`)
      } else if (ev.event.projectId) {
        router.push(`/projects/${ev.event.projectId}`)
      }
    },
    [router]
  )

  // Local copy of priorities so right-click changes reflect instantly while
  // the server roundtrip happens. Keyed by event id.
  const [priorityOverrides, setPriorityOverrides] = useState<Record<string, string>>({})
  const handleSetPriority = useCallback(
    async (eventId: string, priority: "low" | "normal" | "high") => {
      setPriorityOverrides((p) => ({ ...p, [eventId]: priority }))
      try {
        await setFeedEventPriority(eventId, priority)
        toast.success(`Priority set to ${priority}`)
      } catch {
        toast.error("Couldn't change priority — you don't own this event")
        setPriorityOverrides((p) => {
          const next = { ...p }
          delete next[eventId]
          return next
        })
      }
    },
    [],
  )

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0 overflow-y-auto">
      <div className="mx-auto max-w-3xl p-6 space-y-4">
      {/* Filters */}
      <div className="space-y-3">
        {/* Type filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="size-3.5 text-muted-foreground shrink-0" />
          {EVENT_TYPE_FILTERS.map((filter) => (
            <button
              key={filter.key}
              onClick={() => toggleTypeFilter(filter.key)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                activeTypeFilters.has(filter.key)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Priority + Source filters */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Priority:</span>
            {(["all", "high", "normal", "low"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`px-2 py-1 rounded transition-colors capitalize ${
                  priorityFilter === p
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Source:</span>
            {(["all", "manual", "system", "automation"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSourceFilter(s)}
                className={`px-2 py-1 rounded transition-colors capitalize ${
                  sourceFilter === s
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pinned section (personal mode) */}
      {mode === "personal" && pinnedEvents && pinnedEvents.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <button
            onClick={() => setPinnedExpanded((v) => !v)}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-medium bg-muted/50 hover:bg-muted transition-colors"
          >
            {pinnedExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            <Pin className="size-3.5 text-primary" />
            <span>Pinned</span>
            <span className="text-muted-foreground">({pinnedEvents.length})</span>
          </button>
          {pinnedExpanded && (
            <div className="divide-y">
              {pinnedEvents.map((item) => (
                <FeedCard
                  key={`pinned-${item.event.id}`}
                  event={item}
                  currentUserId={currentUserId}
                  isPinned={true}
                  priorityOverride={priorityOverrides[item.event.id]}
                  onMarkRead={handleMarkRead}
                  onPin={handlePin}
                  onOpenRelated={handleOpenRelated}
                  onSetPriority={handleSetPriority}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Feed stream grouped by day */}
      {filteredEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Rss className="size-10 mb-3 opacity-40" />
          <p className="text-sm font-medium">No feed events yet</p>
          <p className="text-xs mt-1">Activity will appear here as it happens.</p>
        </div>
      ) : (
        Array.from(groupedEvents.entries()).map(([dayLabel, dayEvents]) => (
          <div key={dayLabel} className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">
              {dayLabel}
            </h3>
            {dayEvents.map((ev) => (
              <FeedCard
                key={ev.event.id}
                event={ev}
                currentUserId={currentUserId}
                isPinned={pinnedIds.has(ev.event.id)}
                priorityOverride={priorityOverrides[ev.event.id]}
                onMarkRead={handleMarkRead}
                onPin={handlePin}
                onOpenRelated={handleOpenRelated}
                onSetPriority={handleSetPriority}
              />
            ))}
          </div>
        ))
      )}
      </div>
      </div>
      <FeedSidePanel onPosted={() => router.refresh()} />
    </div>
  )
}

// ─── Side panel: docs + quick-post composer ───────────────────────────────

function FeedSidePanel({ onPosted }: { onPosted: () => void }) {
  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal")
  const [posting, setPosting] = useState(false)

  async function post() {
    const t = title.trim()
    if (!t) return
    setPosting(true)
    try {
      await createFeedEvent({
        type: "comment_added", // closest fit for a manual note
        title: t,
        summary: summary.trim() || undefined,
        priority,
        sourceType: "manual",
        visibility: "workspace",
      })
      setTitle("")
      setSummary("")
      setPriority("normal")
      toast.success("Posted to feed")
      onPosted()
    } catch {
      toast.error("Couldn't post — please try again")
    } finally {
      setPosting(false)
    }
  }

  return (
    <aside
      className="hidden xl:flex flex-col w-72 shrink-0 border-l border-border/40 bg-card/30 h-full overflow-hidden"
      aria-label="Feed documentation and quick post"
    >
      <div className="flex flex-col gap-5 p-5 overflow-y-auto">
        {/* ── Quick post ─────────────────────────────────────────── */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium mb-2">
            Post to feed
          </div>
          <div className="space-y-2">
            <Input
              placeholder="What's the headline?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && title.trim()) post()
              }}
              maxLength={80}
              className="h-9 text-sm"
            />
            <textarea
              placeholder="Optional detail…"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              maxLength={240}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
            {/* Priority picker */}
            <div className="flex items-center gap-1">
              {(["low", "normal", "high"] as const).map((p) => {
                const active = priority === p
                const Icon = p === "high" ? Flame : p === "low" ? Minus : Circle
                const tone =
                  p === "high"
                    ? active
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/50"
                      : "text-rose-400 border-border hover:bg-rose-500/10"
                    : p === "low"
                    ? active
                      ? "bg-muted text-foreground border-border"
                      : "text-muted-foreground border-border hover:bg-muted/50"
                    : active
                    ? "bg-primary/20 text-primary border-primary/50"
                    : "text-muted-foreground border-border hover:bg-accent"
                return (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md border text-[11px] capitalize transition-colors ${tone}`}
                  >
                    <Icon className="size-3" />
                    {p}
                  </button>
                )
              })}
            </div>
            <Button
              size="sm"
              className="w-full"
              disabled={!title.trim() || posting}
              onClick={post}
            >
              <Send className="size-3 mr-1.5" />
              {posting ? "Posting…" : "Post to feed"}
            </Button>
          </div>
        </div>

        {/* ── About the feed ─────────────────────────────────────── */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium mb-2">
            About the feed
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            The feed is your workspace&apos;s activity stream. Anything
            interesting that happens — tasks completing, comments landing,
            approvals firing, automations running — turns into a feed event.
            They show up here, in the scrolling ticker, and the home
            dashboard&apos;s heatmap.
          </p>
        </div>

        {/* ── Sources ────────────────────────────────────────────── */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium mb-2">
            Where items come from
          </div>
          <ul className="space-y-2 text-xs">
            <SourceRow
              icon={Sparkles}
              title="System events"
              desc="Tasks, comments, page edits — generated automatically as you work in projects."
            />
            <SourceRow
              icon={Bot}
              title="Automations"
              desc="Triggers you set up under Platform → Automations publish here when they fire."
            />
            <SourceRow
              icon={FileText}
              title="Form submissions"
              desc="External forms (Platform → Forms) push a feed event with each submission."
            />
            <SourceRow
              icon={Send}
              title="Manual posts"
              desc="Use the composer above to drop a note for the team. Right-click on any item in your projects to also push it to the feed."
            />
            <SourceRow
              icon={Globe}
              title="API"
              desc="Programmatic events from integrations land here too."
            />
          </ul>
        </div>

        {/* ── Tips ──────────────────────────────────────────────── */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium mb-2 flex items-center gap-1.5">
            <Info className="size-3" />
            Tips
          </div>
          <ul className="space-y-1.5 text-xs text-muted-foreground leading-relaxed list-disc pl-4">
            <li>
              <strong className="text-foreground">Right-click</strong> any item
              (here, in the ticker, on the home dashboard) to change its
              priority. High items get a rose dot and float up.
            </li>
            <li>
              <strong className="text-foreground">Pin</strong> items you want to
              keep visible — they get their own section at the top.
            </li>
            <li>
              <strong className="text-foreground">Drag the ticker.</strong>{" "}
              Unpin it from the ticker&apos;s pin icon (top-right) to float it
              anywhere on screen, then drag the left edge to move and the
              bottom-right corner to resize.
            </li>
          </ul>
        </div>
      </div>
    </aside>
  )
}

function SourceRow({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  desc: string
}) {
  return (
    <li className="flex items-start gap-2">
      <div className="size-7 rounded-md bg-muted/60 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="size-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-foreground font-medium">{title}</p>
        <p className="text-muted-foreground leading-snug">{desc}</p>
      </div>
    </li>
  )
}

// ─── Feed Card ──────────────────────────────────────────────────────────

function FeedCard({
  event,
  currentUserId,
  isPinned,
  priorityOverride,
  onMarkRead,
  onPin,
  onOpenRelated,
  onSetPriority,
}: {
  event: any
  currentUserId: string | null
  isPinned: boolean
  priorityOverride?: string
  onMarkRead: (id: string) => void
  onPin: (id: string) => void
  onOpenRelated: (ev: any) => void
  onSetPriority: (id: string, p: "low" | "normal" | "high") => void
}) {
  const ev = event.event
  const actorName = event.actorDisplayName ?? "System"
  const IconComponent = EVENT_ICON_MAP[ev.type] ?? Activity
  const isSystem = !event.actorDisplayName
  const ctx = useContextMenu()
  const effectivePriority = (priorityOverride ?? ev.priority ?? "normal") as
    | "low"
    | "normal"
    | "high"

  function openMenu(e: React.MouseEvent) {
    const entries: ContextMenuEntry[] = [
      {
        header: true,
        title: ev.title,
        subtitle: ev.type.replace(/_/g, " "),
        icon: IconComponent,
      },
      { separator: true },
      {
        label: isPinned ? "Unpin" : "Pin",
        icon: isPinned ? PinOff : Pin,
        onClick: () => onPin(ev.id),
      },
      {
        label: "Mark as read",
        icon: Eye,
        onClick: () => onMarkRead(ev.id),
      },
      {
        label: "Open related",
        icon: ExternalLink,
        onClick: () => onOpenRelated(event),
        disabled: !(ev.subjectElementId || ev.projectId),
      },
      { separator: true },
      {
        label: "High priority",
        icon: Flame,
        onClick: () => onSetPriority(ev.id, "high"),
      },
      {
        label: "Normal priority",
        icon: Circle,
        onClick: () => onSetPriority(ev.id, "normal"),
      },
      {
        label: "Low priority",
        icon: Minus,
        onClick: () => onSetPriority(ev.id, "low"),
      },
    ]
    ctx.open(e, entries)
  }

  // Border accent + subtle background by priority. Keeps it scannable
  // without being garish — high uses rose, low fades out, normal is neutral.
  const priorityBorder =
    effectivePriority === "high"
      ? "border-rose-500/40"
      : effectivePriority === "low"
      ? "border-border/40 opacity-80"
      : "border-border"
  const priorityBg =
    effectivePriority === "high" ? "bg-rose-500/[0.04]" : "bg-card"

  return (
    <div
      onContextMenu={openMenu}
      className={`${priorityBg} border ${priorityBorder} rounded-lg p-4 hover:shadow-md transition-all group`}
      title="Right-click for priority & actions"
    >
      <div className="flex items-start gap-3">
        {/* Left: Avatar or system icon */}
        <div className="shrink-0 mt-0.5">
          {isSystem ? (
            <div className="size-8 rounded-full bg-muted flex items-center justify-center">
              <IconComponent className="size-4 text-muted-foreground" />
            </div>
          ) : (
            <div
              className={`size-8 rounded-full flex items-center justify-center text-white text-xs font-medium ${getAvatarColor(actorName)}`}
            >
              {getInitials(actorName)}
            </div>
          )}
        </div>

        {/* Center: Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm">
            <span className="font-semibold">{ev.title}</span>
          </p>
          {ev.summary && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ev.summary}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
            <span>{formatRelativeTime(ev.createdAt)}</span>
            {ev.projectId && (
              <>
                <span className="text-muted-foreground/40">-</span>
                <span className="truncate max-w-[150px]">Project</span>
              </>
            )}
            {ev.subjectElementId && (
              <>
                <span className="text-muted-foreground/40">-</span>
                <span className="truncate max-w-[150px]">Element</span>
              </>
            )}
          </div>

          {/* Metadata chips */}
          <div className="flex items-center gap-1.5 mt-2">
            {effectivePriority !== "normal" && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1 ${PRIORITY_COLORS[effectivePriority] ?? ""}`}
              >
                {effectivePriority === "high" ? (
                  <Flame className="size-2.5" />
                ) : (
                  <Minus className="size-2.5" />
                )}
                {effectivePriority}
              </span>
            )}
            {ev.sourceType && ev.sourceType !== "system" && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SOURCE_COLORS[ev.sourceType] ?? ""}`}
              >
                {ev.sourceType}
              </span>
            )}
          </div>
        </div>

        {/* Right: Quick actions */}
        <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {currentUserId && (
            <>
              <button
                onClick={() => onPin(ev.id)}
                className="p-1.5 rounded-md hover:bg-muted transition-colors"
                title={isPinned ? "Unpin" : "Pin"}
              >
                {isPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
              </button>
              <button
                onClick={() => onMarkRead(ev.id)}
                className="p-1.5 rounded-md hover:bg-muted transition-colors"
                title="Mark as read"
              >
                <Eye className="size-3.5" />
              </button>
            </>
          )}
          {(ev.subjectElementId || ev.projectId) && (
            <button
              onClick={() => onOpenRelated(event)}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
              title="Open related item"
            >
              <ExternalLink className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      {ctx.menu && (
        <ContextMenu
          x={ctx.menu.x}
          y={ctx.menu.y}
          items={ctx.menu.items}
          onClose={ctx.close}
        />
      )}
    </div>
  )
}
