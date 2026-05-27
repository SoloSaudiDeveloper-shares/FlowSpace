"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

/**
 * Global focus / task timer. Persists to localStorage so the countdown
 * survives reloads. Only ONE timer can be running at a time.
 *
 * Time math:
 *   - `startedAt` = epoch ms when the timer was last (re)started
 *   - `durationMs` = total length when it was set
 *   - `elapsedBeforePause` = accumulated ms from previous run segments
 *   - When paused: paused=true, pausedAt set; getRemaining freezes
 *   - On expiration the widget calls stop() and fires a toast (handled there).
 */
export interface TimerState {
  taskId: string | null
  label: string
  durationMs: number
  startedAt: number | null      // epoch ms of the current running segment
  paused: boolean
  pausedAt: number | null       // epoch ms when paused (for resume math)
  elapsedBeforePause: number    // ms accumulated from prior segments

  start: (opts: {
    label: string
    durationMs: number
    taskId?: string | null
  }) => void
  pause: () => void
  resume: () => void
  stop: () => void
  extend: (deltaMs: number) => void
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      taskId: null,
      label: "",
      durationMs: 0,
      startedAt: null,
      paused: false,
      pausedAt: null,
      elapsedBeforePause: 0,

      start: ({ label, durationMs, taskId = null }) =>
        set({
          taskId,
          label,
          durationMs,
          startedAt: Date.now(),
          paused: false,
          pausedAt: null,
          elapsedBeforePause: 0,
        }),

      pause: () => {
        const s = get()
        if (!s.startedAt || s.paused) return
        const segmentElapsed = Date.now() - s.startedAt
        set({
          paused: true,
          pausedAt: Date.now(),
          elapsedBeforePause: s.elapsedBeforePause + segmentElapsed,
          startedAt: null,
        })
      },

      resume: () => {
        const s = get()
        if (!s.paused) return
        set({
          paused: false,
          pausedAt: null,
          startedAt: Date.now(),
        })
      },

      stop: () =>
        set({
          taskId: null,
          label: "",
          durationMs: 0,
          startedAt: null,
          paused: false,
          pausedAt: null,
          elapsedBeforePause: 0,
        }),

      extend: (deltaMs) => set({ durationMs: get().durationMs + deltaMs }),
    }),
    {
      name: "flowspace.timer",
      storage: createJSONStorage(() => localStorage),
    }
  )
)

/** Total elapsed ms across all running segments (excluding paused time). */
export function getElapsedMs(s: TimerState): number {
  if (!s.startedAt && !s.paused) return 0
  if (s.paused) return s.elapsedBeforePause
  return s.elapsedBeforePause + (Date.now() - (s.startedAt ?? Date.now()))
}

/** Remaining ms (never negative). 0 means expired. */
export function getRemainingMs(s: TimerState): number {
  if (s.durationMs === 0) return 0
  return Math.max(0, s.durationMs - getElapsedMs(s))
}

/** True when a timer has been set up (running or paused). */
export function isTimerActive(s: TimerState): boolean {
  return s.durationMs > 0 && (s.startedAt !== null || s.paused)
}

export function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => n.toString().padStart(2, "0")
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`
  return `${pad(m)}:${pad(s)}`
}
