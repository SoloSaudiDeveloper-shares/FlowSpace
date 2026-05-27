"use client"

import { useEffect, useRef, useState } from "react"
import { Play, Pause, Square, Plus, Timer } from "lucide-react"
import { toast } from "sonner"
import {
  useTimerStore,
  getRemainingMs,
  isTimerActive,
  formatRemaining,
} from "@/lib/stores/use-timer-store"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

const PRESETS_MIN = [5, 15, 25, 45, 60]

/**
 * Floating focus-timer widget pinned to the bottom-right corner. Visible on
 * every page (mounted in the root layout). When no timer is active, shows a
 * small "+" button that opens a dialog to start one. When active, expands
 * into a countdown card with pause/resume/stop controls.
 */
export function TaskTimerWidget() {
  const timer = useTimerStore()
  const active = isTimerActive(timer)
  const [, force] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)
  const expiredRef = useRef(false)

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
      // Stop after a short delay so the user can read the toast
      setTimeout(() => timer.stop(), 200)
    }
  })

  if (!active) {
    return (
      <>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="group fixed bottom-4 right-4 z-30 inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/70 backdrop-blur-md px-3.5 py-2 text-xs font-medium text-muted-foreground shadow-[0_2px_8px_-2px_rgb(0_0_0/0.1)] hover:bg-card hover:text-foreground hover:border-border hover:shadow-[0_8px_24px_-6px_rgb(0_0_0/0.18)] hover:-translate-y-0.5 transition-all duration-300"
          aria-label="Start a focus timer"
          data-slot="timer-widget-fab"
        >
          <Timer className="size-3.5 transition-transform duration-500 group-hover:rotate-180" />
          <span className="tracking-wide">Start timer</span>
        </button>
        <TimerPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
      </>
    )
  }

  const remaining = getRemainingMs(timer)
  const pct = timer.durationMs === 0 ? 0 : (1 - remaining / timer.durationMs) * 100

  return (
    <div
      className="fixed bottom-4 right-4 z-30 w-64 rounded-xl border border-border/50 bg-card/95 backdrop-blur-md shadow-[0_12px_32px_-12px_rgb(0_0_0/0.25)] overflow-hidden ring-1 ring-primary/10"
      data-slot="timer-widget"
    >
      {/* progress bar */}
      <div className="h-1 bg-muted/40">
        <div
          className="h-full bg-primary transition-[width] duration-1000 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="px-3 py-2.5">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {timer.paused ? "Paused" : "Focus"}
          </span>
          <button
            type="button"
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
              onClick={timer.resume}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              <Play className="size-3" />
              Resume
            </button>
          ) : (
            <button
              type="button"
              onClick={timer.pause}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border text-xs font-medium hover:bg-accent transition-colors"
            >
              <Pause className="size-3" />
              Pause
            </button>
          )}
          <button
            type="button"
            onClick={() => timer.extend(5 * 60 * 1000)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Add 5 minutes"
          >
            <Plus className="size-3" />5m
          </button>
        </div>
      </div>
    </div>
  )
}

function TimerPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const start = useTimerStore((s) => s.start)
  const [label, setLabel] = useState("")
  const [custom, setCustom] = useState("")

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
            Pick a duration. The countdown follows you everywhere in the app.
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
