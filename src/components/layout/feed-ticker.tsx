"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Rss,
  X,
  ExternalLink,
  EyeOff,
  BellOff,
  Pin,
  PinOff,
  GripHorizontal,
  Flame,
  Minus,
  Circle,
} from "lucide-react"
import { toast } from "sonner"
import { usePreferences, DEFAULT_PREFERENCES } from "@/lib/hooks/use-preferences"
import { getGlobalFeed, setFeedEventPriority } from "@/lib/actions/feed-actions"
import {
  ContextMenu,
  useContextMenu,
  type ContextMenuEntry,
} from "@/components/shared/context-menu"

type Priority = "low" | "normal" | "high"

interface TickerItem {
  id: string
  type: string
  title: string
  summary: string | null
  subjectElementId: string | null
  priority: Priority
  createdAt: string
}

/**
 * Horizontal scrolling news-ticker bar reading from feed_events.
 *
 * Has two modes:
 *  - **Pinned** (default): sticks to the top or bottom of the viewport.
 *    Full content width, fixed height, classic news-bar.
 *  - **Floating**: a free-floating bar the user can drag and resize.
 *    Position/size persisted to preferences.feedTicker.float so it
 *    survives reloads. Drag handle on the left, resize handle at the
 *    bottom-right corner.
 *
 * Items scroll LTR or RTL, with the speed configurable. Right-clicking
 * an item opens a context menu including a "Set priority" group — the
 * priority changes the dot color on every place the event shows.
 */
export function FeedTicker() {
  const router = useRouter()
  const { preferences, updatePreference } = usePreferences()
  const cfg = preferences.feedTicker ?? DEFAULT_PREFERENCES.feedTicker
  const [items, setItems] = useState<TickerItem[]>([])
  const [dismissed, setDismissed] = useState(false)
  const ctx = useContextMenu()

  // Default floating rect — used the first time the user unpins.
  function defaultFloat() {
    if (typeof window === "undefined") return { x: 24, y: 24, w: 560, h: 36 }
    return {
      x: Math.max(24, Math.floor(window.innerWidth / 2 - 280)),
      y: 80,
      w: 560,
      h: 36,
    }
  }

  // Persist a partial change to the feedTicker preference. Always merge,
  // never replace, so we don't drop other settings when the user is just
  // dragging.
  function patchTicker(patch: Partial<typeof cfg>) {
    updatePreference("feedTicker", { ...cfg, ...patch })
  }

  // ── Fetch loop ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!cfg.show) return
    let cancelled = false
    async function load() {
      try {
        const rows = await getGlobalFeed({ limit: 30 })
        if (cancelled) return
        setItems(
          rows.map((r) => ({
            id: r.event.id,
            type: r.event.type,
            title: r.event.title,
            summary: r.event.summary,
            subjectElementId: r.event.subjectElementId,
            priority: (r.event.priority as Priority) ?? "normal",
            createdAt: r.event.createdAt,
          })),
        )
      } catch {
        // ignore — non-critical
      }
    }
    load()
    const t = setInterval(load, 120_000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [cfg.show])

  // Optimistically reflect a priority change locally, then persist.
  async function changePriority(eventId: string, priority: Priority) {
    setItems((prev) =>
      prev.map((it) => (it.id === eventId ? { ...it, priority } : it)),
    )
    try {
      await setFeedEventPriority(eventId, priority)
      toast.success(`Priority set to ${priority}`)
    } catch {
      toast.error("Couldn't change priority — you don't own this event")
      // revert by refetching
      const rows = await getGlobalFeed({ limit: 30 })
      setItems(
        rows.map((r) => ({
          id: r.event.id,
          type: r.event.type,
          title: r.event.title,
          summary: r.event.summary,
          subjectElementId: r.event.subjectElementId,
          priority: (r.event.priority as Priority) ?? "normal",
          createdAt: r.event.createdAt,
        })),
      )
    }
  }

  function openItemMenu(e: React.MouseEvent, item: TickerItem) {
    const entries: ContextMenuEntry[] = [
      {
        header: true,
        title: item.title,
        subtitle: [
          item.type.replace(/_/g, " "),
          relativeTime(item.createdAt),
        ].join(" · "),
        icon: Rss,
      },
      { separator: true },
      {
        label: "Open subject",
        icon: ExternalLink,
        onClick: () =>
          item.subjectElementId &&
          router.push(elementHref(item.subjectElementId, item.type)),
        disabled: !item.subjectElementId,
      },
      {
        label: "Open Feed page",
        icon: Rss,
        onClick: () => router.push("/feed"),
      },
      { separator: true },
      // Priority quick-set group — same colors used in the dot below.
      {
        label: "High priority",
        icon: Flame,
        onClick: () => changePriority(item.id, "high"),
      },
      {
        label: "Normal priority",
        icon: Circle,
        onClick: () => changePriority(item.id, "normal"),
      },
      {
        label: "Low priority",
        icon: Minus,
        onClick: () => changePriority(item.id, "low"),
      },
      { separator: true },
      {
        label: "Hide ticker for this session",
        icon: EyeOff,
        onClick: () => setDismissed(true),
      },
      {
        label: "Hide ticker permanently",
        icon: BellOff,
        onClick: () => patchTicker({ show: false }),
      },
    ]
    ctx.open(e, entries)
  }

  if (!cfg.show || dismissed) return null
  if (items.length === 0) return null

  // ── Render: pinned vs floating ───────────────────────────────────────
  if (cfg.pinned) {
    return (
      <PinnedTicker
        items={items}
        cfg={cfg}
        onUnpin={() =>
          patchTicker({ pinned: false, float: cfg.float ?? defaultFloat() })
        }
        onDismiss={() => setDismissed(true)}
        onItemMenu={openItemMenu}
        onItemClick={(item) =>
          item.subjectElementId &&
          router.push(elementHref(item.subjectElementId, item.type))
        }
        ctx={ctx}
      />
    )
  }

  return (
    <FloatingTicker
      items={items}
      cfg={cfg}
      float={cfg.float ?? defaultFloat()}
      onChangeFloat={(f) => patchTicker({ float: f })}
      onPin={() => patchTicker({ pinned: true })}
      onDismiss={() => setDismissed(true)}
      onItemMenu={openItemMenu}
      onItemClick={(item) =>
        item.subjectElementId &&
        router.push(elementHref(item.subjectElementId, item.type))
      }
      ctx={ctx}
    />
  )
}

// ─── Pinned: classic top/bottom sticky bar ─────────────────────────────────

function PinnedTicker({
  items,
  cfg,
  onUnpin,
  onDismiss,
  onItemMenu,
  onItemClick,
  ctx,
}: {
  items: TickerItem[]
  cfg: NonNullable<ReturnType<typeof usePreferences>["preferences"]["feedTicker"]>
  onUnpin: () => void
  onDismiss: () => void
  onItemMenu: (e: React.MouseEvent, item: TickerItem) => void
  onItemClick: (item: TickerItem) => void
  ctx: ReturnType<typeof useContextMenu>
}) {
  const loop = [...items, ...items]
  const animDir = cfg.direction === "rtl" ? "normal" : "reverse"
  const pos =
    cfg.position === "bottom"
      ? "sticky bottom-0 border-t order-last"
      : "sticky top-0 border-b"
  return (
    <div
      data-slot="feed-ticker"
      className={`relative ${pos} z-20 h-7 shrink-0 overflow-hidden bg-background/70 backdrop-blur-md border-border/40 group`}
    >
      <TickerLabel />
      <div
        className="flex items-center h-full whitespace-nowrap text-xs marquee-track"
        style={{
          animation: `marquee ${cfg.speedSec}s linear infinite`,
          animationDirection: animDir,
          paddingLeft: "5rem",
          paddingRight: "5rem",
        }}
      >
        {loop.map((item, i) => (
          <TickerEntry
            key={`${item.id}-${i}`}
            item={item}
            onClick={() => onItemClick(item)}
            onContextMenu={(e) => onItemMenu(e, item)}
          />
        ))}
      </div>
      <RightControls onUnpin={onUnpin} onDismiss={onDismiss} pinned />
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

// ─── Floating: draggable + resizable widget ────────────────────────────────

function FloatingTicker({
  items,
  cfg,
  float,
  onChangeFloat,
  onPin,
  onDismiss,
  onItemMenu,
  onItemClick,
  ctx,
}: {
  items: TickerItem[]
  cfg: NonNullable<ReturnType<typeof usePreferences>["preferences"]["feedTicker"]>
  float: { x: number; y: number; w: number; h: number }
  onChangeFloat: (f: { x: number; y: number; w: number; h: number }) => void
  onPin: () => void
  onDismiss: () => void
  onItemMenu: (e: React.MouseEvent, item: TickerItem) => void
  onItemClick: (item: TickerItem) => void
  ctx: ReturnType<typeof useContextMenu>
}) {
  // Local rect for smooth dragging — we only push to preferences on release
  // so we're not firing a debounced server write on every mousemove.
  const [rect, setRect] = useState(float)
  useEffect(() => setRect(float), [float.x, float.y, float.w, float.h])

  const dragStartRef = useRef<{ x: number; y: number; rect: typeof rect } | null>(
    null,
  )

  function onDragMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    e.preventDefault()
    dragStartRef.current = { x: e.clientX, y: e.clientY, rect }
    function move(ev: MouseEvent) {
      const start = dragStartRef.current
      if (!start) return
      const dx = ev.clientX - start.x
      const dy = ev.clientY - start.y
      const next = clampRect({ ...start.rect, x: start.rect.x + dx, y: start.rect.y + dy })
      setRect(next)
    }
    function up() {
      window.removeEventListener("mousemove", move)
      window.removeEventListener("mouseup", up)
      const start = dragStartRef.current
      dragStartRef.current = null
      if (start) onChangeFloat(clampRect(rectRef.current))
    }
    window.addEventListener("mousemove", move)
    window.addEventListener("mouseup", up)
  }

  function onResizeMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const start = { x: e.clientX, y: e.clientY, rect }
    function move(ev: MouseEvent) {
      const dw = ev.clientX - start.x
      const dh = ev.clientY - start.y
      const next = clampRect({
        ...start.rect,
        w: Math.max(220, start.rect.w + dw),
        h: Math.max(28, Math.min(120, start.rect.h + dh)),
      })
      setRect(next)
    }
    function up() {
      window.removeEventListener("mousemove", move)
      window.removeEventListener("mouseup", up)
      onChangeFloat(clampRect(rectRef.current))
    }
    window.addEventListener("mousemove", move)
    window.addEventListener("mouseup", up)
  }

  // Keep a ref of the live rect for mouse-up handlers (which can't close over
  // the most recent state update from inside the move callback).
  const rectRef = useRef(rect)
  useEffect(() => { rectRef.current = rect }, [rect])

  const loop = [...items, ...items]
  const animDir = cfg.direction === "rtl" ? "normal" : "reverse"

  return (
    <div
      data-slot="feed-ticker-floating"
      role="region"
      aria-label="Floating activity feed ticker"
      className="fixed z-40 rounded-xl border border-border/60 bg-background/80 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden group"
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
      }}
    >
      {/* Drag handle — full left edge */}
      <div
        onMouseDown={onDragMouseDown}
        onDoubleClick={onPin}
        title="Drag to move · Double-click to re-pin"
        className="absolute inset-y-0 left-0 z-10 w-7 flex items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-foreground bg-background/70 backdrop-blur border-r border-border/40"
      >
        <GripHorizontal className="size-3.5" />
      </div>

      {/* Ticker content */}
      <div
        className="flex items-center h-full whitespace-nowrap text-xs marquee-track"
        style={{
          animation: `marquee ${cfg.speedSec}s linear infinite`,
          animationDirection: animDir,
          paddingLeft: "2.25rem",
          paddingRight: "4rem",
        }}
      >
        {loop.map((item, i) => (
          <TickerEntry
            key={`${item.id}-${i}`}
            item={item}
            onClick={() => onItemClick(item)}
            onContextMenu={(e) => onItemMenu(e, item)}
          />
        ))}
      </div>

      {/* Right controls — pin + close */}
      <RightControls onUnpin={onPin} onDismiss={onDismiss} pinned={false} />

      {/* Resize handle, bottom-right corner */}
      <div
        onMouseDown={onResizeMouseDown}
        title="Drag to resize"
        className="absolute bottom-0 right-0 size-3 cursor-nwse-resize z-20"
        style={{
          background:
            "linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.25) 50%)",
        }}
      />

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

// ─── Shared sub-pieces ─────────────────────────────────────────────────────

function TickerLabel() {
  return (
    <div className="absolute inset-y-0 left-0 z-10 flex items-center gap-1.5 px-2.5 bg-background/90 backdrop-blur-md border-r border-border/40">
      <Rss className="size-3 text-muted-foreground" />
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        Feed
      </span>
    </div>
  )
}

function RightControls({
  onUnpin,
  onDismiss,
  pinned,
}: {
  onUnpin: () => void
  onDismiss: () => void
  pinned: boolean
}) {
  return (
    <div className="absolute inset-y-0 right-0 z-10 flex items-center bg-background/90 backdrop-blur-md border-l border-border/40 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        type="button"
        onClick={onUnpin}
        title={pinned ? "Unpin (make floating)" : "Pin back to top/bottom"}
        aria-label={pinned ? "Unpin ticker" : "Pin ticker"}
        className="flex items-center px-1.5 text-muted-foreground/60 hover:text-foreground transition-colors"
      >
        {pinned ? <PinOff className="size-3" /> : <Pin className="size-3" />}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        title="Hide for this session"
        aria-label="Hide feed ticker"
        className="flex items-center px-1.5 text-muted-foreground/60 hover:text-foreground transition-colors"
      >
        <X className="size-3" />
      </button>
    </div>
  )
}

// Color the dot by priority — same scheme used on /feed cards.
const PRIORITY_DOT: Record<Priority, string> = {
  low: "bg-muted-foreground/30 group-hover/item:bg-muted-foreground/60",
  normal: "bg-primary/60 group-hover/item:bg-primary",
  high: "bg-rose-500 group-hover/item:bg-rose-400 ring-2 ring-rose-500/20",
}

function TickerEntry({
  item,
  onClick,
  onContextMenu,
}: {
  item: TickerItem
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onContextMenu={onContextMenu}
      className="group/item inline-flex items-center gap-2 mr-8 px-2 py-0.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
      title="Click to open · Right-click for options"
    >
      <span className={`inline-block size-1.5 rounded-full transition-colors ${PRIORITY_DOT[item.priority]}`} />
      <span
        className={`font-medium ${item.priority === "high" ? "text-rose-300" : "text-foreground/90"}`}
      >
        {item.title}
      </span>
      {item.summary && (
        <span className="text-muted-foreground/70 truncate max-w-md">— {item.summary}</span>
      )}
      <span className="text-muted-foreground/40 text-[10px] uppercase tracking-wider">
        {relativeTime(item.createdAt)}
      </span>
    </button>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function clampRect(r: { x: number; y: number; w: number; h: number }) {
  if (typeof window === "undefined") return r
  // Always keep at least 60px of the bar visible on screen so the user
  // can grab it back if they drag it offscreen.
  const maxX = window.innerWidth - 60
  const maxY = window.innerHeight - 28
  return {
    x: Math.min(Math.max(r.x, -r.w + 60), maxX),
    y: Math.min(Math.max(r.y, 0), maxY),
    w: Math.min(Math.max(r.w, 220), window.innerWidth - 16),
    h: Math.min(Math.max(r.h, 28), 120),
  }
}

function elementHref(elementId: string, type: string): string {
  if (
    type.startsWith("task_") ||
    type.startsWith("comment_") ||
    type === "approval_requested" ||
    type === "approval_completed"
  ) {
    return `/projects/${elementId}`
  }
  if (type === "page_updated") return `/pages/${elementId}`
  if (type === "canvas_updated") return `/canvas/${elementId}`
  if (type === "reminder_triggered") return `/reminders`
  if (type === "process_step_completed") return `/process/${elementId}`
  return `/feed`
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diffSec = Math.max(0, (Date.now() - then) / 1000)
  if (diffSec < 60) return "just now"
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  return `${Math.floor(diffSec / 86400)}d ago`
}
