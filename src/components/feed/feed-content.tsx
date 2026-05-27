"use client"

import { useState, useMemo, useCallback, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { markEventRead, pinEvent, unpinEvent } from "@/lib/actions/feed-actions"
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

  // ─── Render ─────────────────────────────────────────────────────────

  return (
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
                  onMarkRead={handleMarkRead}
                  onPin={handlePin}
                  onOpenRelated={handleOpenRelated}
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
                onMarkRead={handleMarkRead}
                onPin={handlePin}
                onOpenRelated={handleOpenRelated}
              />
            ))}
          </div>
        ))
      )}
    </div>
  )
}

// ─── Feed Card ──────────────────────────────────────────────────────────

function FeedCard({
  event,
  currentUserId,
  isPinned,
  onMarkRead,
  onPin,
  onOpenRelated,
}: {
  event: any
  currentUserId: string | null
  isPinned: boolean
  onMarkRead: (id: string) => void
  onPin: (id: string) => void
  onOpenRelated: (ev: any) => void
}) {
  const ev = event.event
  const actorName = event.actorDisplayName ?? "System"
  const IconComponent = EVENT_ICON_MAP[ev.type] ?? Activity
  const isSystem = !event.actorDisplayName

  return (
    <div className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow group">
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
            {ev.priority && ev.priority !== "normal" && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[ev.priority] ?? ""}`}
              >
                {ev.priority}
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
    </div>
  )
}
