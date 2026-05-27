"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Rss, X, ExternalLink, EyeOff, BellOff } from "lucide-react"
import { usePreferences, DEFAULT_PREFERENCES } from "@/lib/hooks/use-preferences"
import { getGlobalFeed } from "@/lib/actions/feed-actions"
import {
  ContextMenu,
  useContextMenu,
  type ContextMenuEntry,
} from "@/components/shared/context-menu"

interface TickerItem {
  id: string
  type: string
  title: string
  summary: string | null
  subjectElementId: string | null
  createdAt: string
}

/**
 * Horizontal scrolling news-ticker bar reading from feed_events. Fixed at the
 * top OR bottom of the viewport (configurable). Scrolls LTR or RTL, speed
 * configurable. Hidden gracefully when there's nothing to show.
 *
 * Two copies of the items are rendered in a row so the CSS `translateX(-50%)`
 * loop is seamless. Pauses on hover so users can read.
 */
export function FeedTicker() {
  const router = useRouter()
  const { preferences, updatePreference } = usePreferences()
  const cfg = preferences.feedTicker ?? {
    show: true, position: "top" as const, direction: "rtl" as const, speedSec: 90,
  }
  const [items, setItems] = useState<TickerItem[]>([])
  const [dismissed, setDismissed] = useState(false)
  const ctx = useContextMenu()

  function openItemMenu(e: React.MouseEvent, item: TickerItem) {
    const items: ContextMenuEntry[] = [
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
        onClick: () => item.subjectElementId && router.push(elementHref(item.subjectElementId, item.type)),
        disabled: !item.subjectElementId,
      },
      {
        label: "Open Feed page",
        icon: Rss,
        onClick: () => router.push("/feed"),
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
        onClick: () => {
          const next = { ...(preferences.feedTicker ?? DEFAULT_PREFERENCES.feedTicker) }
          next.show = false
          updatePreference("feedTicker", next)
        },
      },
    ]
    ctx.open(e, items)
  }

  // Fetch on mount + refresh every 2 min
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
            createdAt: r.event.createdAt,
          }))
        )
      } catch {
        // ignore — non-critical
      }
    }
    load()
    const t = setInterval(load, 120_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [cfg.show])

  if (!cfg.show || dismissed) return null
  if (items.length === 0) return null

  // Render the items twice for seamless loop
  const loop = [...items, ...items]
  // animation-direction `normal` = translateX(0) → -50% (content moves left → RTL feel)
  // animation-direction `reverse` = -50% → 0 (content moves right → LTR feel)
  const animDir = cfg.direction === "rtl" ? "normal" : "reverse"
  // sticky to the appropriate edge of the SidebarInset content area
  const pos =
    cfg.position === "bottom"
      ? "sticky bottom-0 border-t order-last"
      : "sticky top-0 border-b"

  return (
    <div
      data-slot="feed-ticker"
      className={`relative ${pos} z-20 h-7 shrink-0 overflow-hidden bg-background/70 backdrop-blur-md border-border/40 group`}
    >
      <div className="absolute inset-y-0 left-0 z-10 flex items-center gap-1.5 px-2.5 bg-background/90 backdrop-blur-md border-r border-border/40">
        <Rss className="size-3 text-muted-foreground" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Feed</span>
      </div>
      <div
        className="flex items-center h-full whitespace-nowrap text-xs marquee-track"
        style={{
          animation: `marquee ${cfg.speedSec}s linear infinite`,
          animationDirection: animDir,
          paddingLeft: "5rem",  // clear the "Feed" label
          paddingRight: "2.5rem",
        }}
      >
        {loop.map((item, i) => (
          <button
            key={`${item.id}-${i}`}
            type="button"
            onClick={() => item.subjectElementId && router.push(elementHref(item.subjectElementId, item.type))}
            onContextMenu={(e) => openItemMenu(e, item)}
            className="group/item inline-flex items-center gap-2 mr-8 px-2 py-0.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
            title="Click to open · Right-click for options"
          >
            <span className="inline-block size-1.5 rounded-full bg-primary/60 group-hover/item:bg-primary transition-colors" />
            <span className="font-medium text-foreground/90">{item.title}</span>
            {item.summary && <span className="text-muted-foreground/70 truncate max-w-md">— {item.summary}</span>}
            <span className="text-muted-foreground/40 text-[10px] uppercase tracking-wider">{relativeTime(item.createdAt)}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="absolute inset-y-0 right-0 z-10 flex items-center px-2 bg-background/90 backdrop-blur-md border-l border-border/40 text-muted-foreground/60 hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
        title="Hide for this session"
        aria-label="Hide feed ticker"
      >
        <X className="size-3" />
      </button>
      {ctx.menu && <ContextMenu x={ctx.menu.x} y={ctx.menu.y} items={ctx.menu.items} onClose={ctx.close} />}
    </div>
  )
}

// Best-guess routing: subjectElementId points to an element; we can't infer
// the element type without a lookup, so route to /projects/:id and let the
// page redirect if it's actually a page/canvas/etc.
function elementHref(elementId: string, type: string): string {
  if (type.startsWith("task_") || type.startsWith("comment_") || type === "approval_requested" || type === "approval_completed") {
    return `/projects/${elementId}` // most task events have subjectElementId = project
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
