"use client"

import { useEffect, useRef, useState } from "react"
import {
  Play, Pause, Square, Plus, Timer, Pencil, Palette, Move, GripVertical,
} from "lucide-react"
import { toast } from "sonner"
import {
  useTimerStore,
  getRemainingMs,
  isTimerActive,
  formatRemaining,
  TIMER_COLOR_HEX,
  type TimerColor,
} from "@/lib/stores/use-timer-store"
import { useDraggableWidget } from "@/lib/hooks/use-draggable-widget"
import { useLongPress } from "@/lib/hooks/use-long-press"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  ContextMenu,
  useContextMenu,
  type ContextMenuEntry,
} from "@/components/shared/context-menu"

const PRESETS_MIN = [5, 15, 25, 45, 60]
const COLOR_OPTIONS: { value: TimerColor; label: string }[] = [
  { value: "neutral", label: "Neutral" },
  { value: "blue",    label: "Blue" },
  { value: "violet",  label: "Violet" },
  { value: "rose",    label: "Rose" },
  { value: "green",   label: "Green" },
  { value: "orange",  label: "Orange" },
  { value: "teal",    label: "Teal" },
]

/**
 * Floating focus-timer widget. Draggable to any corner — position persists.
 * Right-click for context menu (edit, change color, reset position, stop).
 * Mounted in the root layout so it follows the user across every page.
 */
export function TaskTimerWidget() {
  const timer = useTimerStore()
  const active = isTimerActive(timer)
  const [, force] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)
  const expiredRef = useRef(false)
  const drag = useDraggableWidget({
    storageKey: "timer",
    defaultCorner: "bottom-right",
  })
  const ctx = useContextMenu()

  // 1s tick while active and unpaused
  useEffect(() => {
    if (!active || timer.paused) return
    const t = setInterval(() => force((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [active, timer.paused])

  // Detect expiration
  useEffect(() => {
    if (!active) {
      expiredRef.current = false
      return
    }
    if (timer.paused) return
    const remaining = getRemainingMs(timer)
    if (remaining === 0 && !expiredRef.current) {
      expiredRef.current = true
      toast.success(`Timer done${timer.label ? ` — ${timer.label}` : ""}`, {
        description: "Take a break.",
        duration: 8000,
      })
      setTimeout(() => timer.stop(), 200)
    }
  })

  function handleContextMenu(e: React.MouseEvent) {
    const items: ContextMenuEntry[] = []
    if (active) {
      items.push({
        label: timer.paused ? "Resume" : "Pause",
        icon: timer.paused ? Play : Pause,
        onClick: () => (timer.paused ? timer.resume() : timer.pause()),
      })
      items.push({
        label: "Add 5 minutes",
        icon: Plus,
        onClick: () => timer.extend(5 * 60 * 1000),
      })
      items.push({ separator: true })
    }
    items.push({
      label: active ? "Edit / Restart…" : "Set up timer…",
      icon: Pencil,
      onClick: () => setPickerOpen(true),
    })
    items.push({ separator: true })
    // Color sub-items, flat
    for (const c of COLOR_OPTIONS) {
      items.push({
        label: `Color: ${c.label}${timer.accentColor === c.value ? "  ✓" : ""}`,
        icon: Palette,
        onClick: () => timer.setAccentColor(c.value),
      })
    }
    items.push({ separator: true })
    items.push({
      label: "Reset position",
      icon: Move,
      onClick: () => drag.resetPosition(),
    })
    if (active) {
      items.push({ separator: true })
      items.push({
        label: "Stop timer",
        icon: Square,
        variant: "destructive",
        onClick: () => timer.stop(),
      })
    }
    ctx.open(e, items)
  }

  const accent = TIMER_COLOR_HEX[timer.accentColor] ?? TIMER_COLOR_HEX.blue

  // Long-press → same context menu as right-click (mobile parity).
  const longPress = useLongPress((e) => {
    handleContextMenu(e as unknown as React.MouseEvent)
  }, 500)

  if (!active) {
    return (
      <>
        <div
          ref={drag.containerRef}
          onContextMenu={handleContextMenu}
          onPointerDown={longPress.onPointerDown}
          onPointerMove={longPress.onPointerMove}
          onPointerUp={longPress.onPointerUp}
          onPointerCancel={longPress.onPointerCancel}
          onPointerLeave={longPress.onPointerLeave}
          className="z-30 group/fab inline-flex items-stretch rounded-full border border-border/40 bg-card/70 backdrop-blur-md text-xs font-medium text-muted-foreground shadow-[0_2px_8px_-2px_rgb(0_0_0/0.1)] hover:bg-card hover:text-foreground hover:border-border hover:shadow-[0_8px_24px_-6px_rgb(0_0_0/0.18)] transition-[background,border-color,box-shadow] duration-300"
          data-slot="timer-widget-fab"
          style={{ ...drag.style, borderColor: `${accent}66` }}
        >
          {/* drag grip — visible on hover */}
          <span
            onPointerDown={drag.onPointerDown}
            className={`flex items-center pl-2 pr-0.5 opacity-0 group-hover/fab:opacity-60 hover:!opacity-100 transition-opacity ${
              drag.isDragging ? "cursor-grabbing opacity-100" : "cursor-grab"
            }`}
            title="Drag to move (right-click for options)"
            aria-label="Drag timer"
          >
            <GripVertical className="size-3" />
          </span>
          <button
            type="button"
            data-no-drag
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-1.5 pr-2 md:pr-3.5 pl-2 md:pl-1 py-2"
            aria-label="Start a focus timer"
          >
            <Timer className="size-3.5 transition-transform duration-500 group-hover/fab:rotate-180" style={{ color: accent }} />
            {/* Label drops on phones — the icon + tap target stay. */}
            <span className="hidden md:inline tracking-wide">Start timer</span>
          </button>
        </div>
        <TimerPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
        {ctx.menu && <ContextMenu x={ctx.menu.x} y={ctx.menu.y} items={ctx.menu.items} onClose={ctx.close} />}
      </>
    )
  }

  const remaining = getRemainingMs(timer)
  const pct = timer.durationMs === 0 ? 0 : (1 - remaining / timer.durationMs) * 100

  return (
    <>
      <div
        ref={drag.containerRef}
        style={drag.style}
        onPointerDown={(e) => {
          drag.onPointerDown(e)
          longPress.onPointerDown(e)
        }}
        onPointerMove={longPress.onPointerMove}
        onPointerUp={longPress.onPointerUp}
        onPointerCancel={longPress.onPointerCancel}
        onPointerLeave={longPress.onPointerLeave}
        onContextMenu={handleContextMenu}
        className={`z-30 w-44 sm:w-56 md:w-64 rounded-xl border bg-card/95 backdrop-blur-md shadow-[0_12px_32px_-12px_rgb(0_0_0/0.25)] overflow-hidden ring-1 ${
          drag.isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        data-slot="timer-widget"
      >
        <div
          className="absolute inset-0 pointer-events-none rounded-xl"
          style={{ borderColor: accent, boxShadow: `inset 0 0 0 1px ${accent}33` }}
        />
        {/* progress bar */}
        <div className="h-1 bg-muted/40">
          <div
            className="h-full transition-[width] duration-1000 ease-linear"
            style={{ width: `${pct}%`, background: accent }}
          />
        </div>
        <div className="px-3 py-2.5 relative">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span
              className="text-[11px] uppercase tracking-wider font-medium"
              style={{ color: accent }}
            >
              {timer.paused ? "Paused" : "Focus"}
            </span>
            <button
              type="button"
              data-no-drag
              onClick={timer.stop}
              className="p-1 -mr-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Stop timer"
              title="Stop"
            >
              <Square className="size-3.5" />
            </button>
          </div>
          <div className="font-mono text-2xl tabular-nums leading-none">
            {formatRemaining(remaining)}
          </div>
          {timer.label && (
            <div className="text-xs text-muted-foreground mt-1 truncate">
              {timer.label}
            </div>
          )}
          <div className="flex items-center gap-1 mt-2.5">
            {timer.paused ? (
              <button
                type="button"
                data-no-drag
                onClick={timer.resume}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium hover:opacity-90 transition-colors text-white"
                style={{ background: accent }}
              >
                <Play className="size-3" />
                Resume
              </button>
            ) : (
              <button
                type="button"
                data-no-drag
                onClick={timer.pause}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border text-xs font-medium hover:bg-accent transition-colors"
              >
                <Pause className="size-3" />
                Pause
              </button>
            )}
            <button
              type="button"
              data-no-drag
              onClick={() => timer.extend(5 * 60 * 1000)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Add 5 minutes"
            >
              <Plus className="size-3" />5m
            </button>
          </div>
        </div>
      </div>
      <TimerPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
      {ctx.menu && <ContextMenu x={ctx.menu.x} y={ctx.menu.y} items={ctx.menu.items} onClose={ctx.close} />}
    </>
  )
}

function TimerPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const start = useTimerStore((s) => s.start)
  const currentLabel = useTimerStore((s) => s.label)
  const [label, setLabel] = useState("")
  const [custom, setCustom] = useState("")

  // Pre-fill label with current timer's label when opening for edit
  useEffect(() => {
    if (open) setLabel(currentLabel || "")
  }, [open, currentLabel])

  function go(minutes: number) {
    if (minutes <= 0) return
    start({
      label: label.trim() || `${minutes}-minute focus`,
      durationMs: minutes * 60_000,
    })
    setLabel("")
    setCustom("")
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Timer className="size-4" />
            Start a focus timer
          </DialogTitle>
          <DialogDescription>
            Pick a duration. The countdown follows you everywhere — drag it to
            move; right-click for more options.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              What are you focusing on? (optional)
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Finish CCB submission package"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Duration
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS_MIN.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => go(m)}
                  className="inline-flex items-center px-3 py-1.5 rounded-md border border-input text-sm hover:bg-accent transition-colors"
                >
                  {m} min
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-end gap-2 pt-2 border-t">
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Custom (minutes)
              </label>
              <input
                type="number"
                min={1}
                max={240}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="e.g. 30"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                const n = parseInt(custom, 10)
                if (Number.isFinite(n) && n > 0) go(n)
              }}
              disabled={!custom || !(parseInt(custom, 10) > 0)}
              className="h-9 inline-flex items-center px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            >
              <Play className="size-3.5 mr-1" />
              Start
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
