"use client"

/**
 * Pomodoro focus timer.
 *
 * Floating widget that can be toggled from Settings → Look & feel. Three
 * phases cycle automatically: Focus (25m) → Short break (5m) → Focus
 * (25m) → … every 4 focus blocks, a Long break (15m).
 *
 * When a focus block completes, a session is logged for stats. The user
 * can pause / skip at any time.
 *
 * Lives separately from the per-task timer (TaskTimerWidget) because
 * the use cases are different — Pomodoro is a system for structuring
 * any work, the task timer measures one specific task.
 */

import { useEffect, useState, useRef } from "react"
import {
  Play,
  Pause,
  SkipForward,
  Coffee,
  Brain,
  X,
  Settings as SettingsIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { logPomodoroSession } from "@/lib/actions/pomodoro-actions"
import { usePreferences } from "@/lib/hooks/use-preferences"

type Phase = "focus" | "short_break" | "long_break"

const DEFAULTS: Record<Phase, number> = {
  focus: 25 * 60,
  short_break: 5 * 60,
  long_break: 15 * 60,
}

const PHASE_LABEL: Record<Phase, string> = {
  focus: "Focus",
  short_break: "Short break",
  long_break: "Long break",
}

export function PomodoroWidget() {
  const { preferences, updatePreference } = usePreferences()
  const visible = preferences.pomodoroVisible !== false
  const [phase, setPhase] = useState<Phase>("focus")
  const [remaining, setRemaining] = useState<number>(DEFAULTS.focus)
  const [running, setRunning] = useState(false)
  const [completedFocusBlocks, setCompletedFocusBlocks] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const lastTickRef = useRef<number>(0)

  // Tick once per second when running. Use a delta against lastTickRef so
  // background tabs don't drift the timer too far.
  useEffect(() => {
    if (!running) return
    lastTickRef.current = Date.now()
    const interval = window.setInterval(() => {
      const now = Date.now()
      const delta = Math.floor((now - lastTickRef.current) / 1000)
      lastTickRef.current += delta * 1000
      setRemaining((r) => {
        const next = r - delta
        if (next <= 0) {
          // Phase complete — log + advance
          void handlePhaseComplete(phase, DEFAULTS[phase])
          return 0
        }
        return next
      })
    }, 250)
    return () => window.clearInterval(interval)
  }, [running, phase])

  async function handlePhaseComplete(donePhase: Phase, fullDuration: number) {
    setRunning(false)
    // Log only completed focus blocks (breaks aren't worth statting).
    if (donePhase === "focus") {
      const nextCount = completedFocusBlocks + 1
      setCompletedFocusBlocks(nextCount)
      await logPomodoroSession({
        kind: "focus",
        durationSec: fullDuration,
        completed: true,
      }).catch(() => undefined)
      // Every 4 focus blocks earns a long break.
      const nextPhase: Phase = nextCount % 4 === 0 ? "long_break" : "short_break"
      setPhase(nextPhase)
      setRemaining(DEFAULTS[nextPhase])
    } else {
      setPhase("focus")
      setRemaining(DEFAULTS.focus)
    }
    // Soft beep — frequency picked to be audible but not jarring.
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g)
      g.connect(ctx.destination)
      o.frequency.value = donePhase === "focus" ? 660 : 440
      g.gain.setValueAtTime(0.15, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
      o.start()
      o.stop(ctx.currentTime + 0.6)
    } catch {
      // Browsers may block audio without a user gesture; that's fine
    }
  }

  function skip() {
    void handlePhaseComplete(phase, DEFAULTS[phase] - remaining)
  }

  function toggle() {
    setRunning((r) => !r)
  }

  if (!visible) return null

  const total = DEFAULTS[phase]
  const progress = 1 - remaining / total

  return (
    <div className="fixed bottom-20 left-4 z-30 select-none">
      <div className="flex items-center gap-1.5 rounded-full border border-border/40 bg-card/80 backdrop-blur-md p-1.5 shadow-lg">
        <div className="relative size-10 shrink-0">
          <svg viewBox="0 0 36 36" className="size-10 -rotate-90">
            <circle
              cx={18}
              cy={18}
              r={14}
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              opacity={0.15}
            />
            <circle
              cx={18}
              cy={18}
              r={14}
              fill="none"
              stroke={phase === "focus" ? "#a78bfa" : "#6ee7b7"}
              strokeWidth={3}
              strokeDasharray={Math.PI * 28}
              strokeDashoffset={Math.PI * 28 * (1 - progress)}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 0.4s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            {phase === "focus" ? (
              <Brain className="size-4 text-primary" />
            ) : (
              <Coffee className="size-4 text-emerald-400" />
            )}
          </div>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium">
            {PHASE_LABEL[phase]}
            {phase === "focus" && completedFocusBlocks > 0 && (
              <span className="ml-1 opacity-70">· {completedFocusBlocks}</span>
            )}
          </span>
          <span className="font-mono text-sm tabular-nums">
            {format(remaining)}
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="size-7 p-0"
          onClick={toggle}
          aria-label={running ? "Pause" : "Start"}
        >
          {running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="size-7 p-0"
          onClick={skip}
          aria-label="Skip phase"
        >
          <SkipForward className="size-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="size-7 p-0"
          onClick={() => setShowSettings((s) => !s)}
          aria-label="Settings"
        >
          <SettingsIcon className="size-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="size-7 p-0 text-muted-foreground hover:text-foreground"
          onClick={() => updatePreference("pomodoroVisible", false)}
          aria-label="Hide widget"
        >
          <X className="size-3.5" />
        </Button>
      </div>
      {showSettings && (
        <div className="mt-2 ml-1 rounded-md border border-border/40 bg-card/90 backdrop-blur p-2 text-[10px] text-muted-foreground/80 leading-relaxed shadow-lg max-w-[220px]">
          25 / 5 / 15 minutes. After 4 focus blocks you earn a long break.
          Re-enable from Settings → Look & feel if you hide it.
        </div>
      )}
    </div>
  )
}

function format(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`
}
