"use client"

/**
 * Settings → Speech → Voice usage card.
 *
 * Shows today's voice-transcription count + cumulative seconds, the
 * trailing 7-day total, and a tiny sparkline of the 7-day trend.
 *
 * Groq doesn't expose a balance endpoint — this is a local-side proxy
 * for how much we've billed against the API today. Same idea for
 * self-hosted Whisper: lets you see if a power user is hammering it.
 */

import { useEffect, useState } from "react"
import { Mic, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  getMyVoiceUsage,
  type VoiceUsageStats,
} from "@/lib/actions/voice-usage-actions"

function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem ? `${h}h ${rem}m` : `${h}h`
}

export function VoiceUsageCard() {
  const [stats, setStats] = useState<VoiceUsageStats | null>(null)
  const [loading, setLoading] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      setStats(await getMyVoiceUsage())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  if (!stats) {
    return (
      <div className="px-4 py-3 rounded-lg border bg-card">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const maxCount = Math.max(1, ...stats.trend.map((t) => t.count))
  return (
    <div className="px-4 py-3 rounded-lg border bg-card space-y-3">
      <div className="flex items-center gap-2">
        <Mic className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Voice usage</h3>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto h-6 px-2 text-[10px]"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Groq doesn't expose a balance endpoint. This counts what FlowSpace
        sent today — your real quota lives in the Groq dashboard.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Today" count={stats.todayCount} seconds={stats.todaySeconds} highlight />
        <Stat label="Last 7 days" count={stats.weekCount} seconds={stats.weekSeconds} />
      </div>

      {/* Sparkline (7 bars) */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium mb-1.5">
          7-day trend
        </p>
        <div className="flex items-end gap-1 h-12">
          {stats.trend.map((d) => {
            const h = (d.count / maxCount) * 100
            const isToday = d.date === stats.trend[stats.trend.length - 1].date
            return (
              <div
                key={d.date}
                className="flex-1 flex flex-col items-center gap-1"
                title={`${d.date}: ${d.count} transcription${d.count === 1 ? "" : "s"}`}
              >
                <div
                  className={`w-full rounded-sm transition-all ${
                    isToday ? "bg-primary" : "bg-primary/30"
                  }`}
                  style={{ height: `${Math.max(2, h)}%` }}
                />
                <span className="text-[9px] text-muted-foreground/70 tabular-nums">
                  {d.date.slice(8, 10)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Stat({
  label,
  count,
  seconds,
  highlight,
}: {
  label: string
  count: number
  seconds: number
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-md border px-3 py-2 ${
        highlight ? "border-primary/30 bg-primary/5" : "border-border/60"
      }`}
    >
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
        {label}
      </p>
      <p className="text-base font-semibold tabular-nums leading-tight mt-1">
        {count}{" "}
        <span className="text-[11px] font-normal text-muted-foreground">
          transcription{count === 1 ? "" : "s"}
        </span>
      </p>
      {seconds > 0 && (
        <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
          {formatSeconds(seconds)} audio
        </p>
      )}
    </div>
  )
}
