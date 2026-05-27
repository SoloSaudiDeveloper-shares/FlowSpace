"use client"

import { useEffect, useState } from "react"
import { GripVertical } from "lucide-react"
import { usePreferences } from "@/lib/hooks/use-preferences"
import { useDraggableWidget } from "@/lib/hooks/use-draggable-widget"

/**
 * Live clock pinned to a viewport corner (top-right by default). Draggable —
 * grab anywhere on the chip to reposition; position persists per-browser.
 * Reads format prefs from `usePreferences().clock`. Updates every second when
 * seconds are shown, every minute otherwise.
 */
export function TopbarClock() {
  const { preferences } = usePreferences()
  const clock = preferences.clock ?? {
    show: true,
    format24: true,
    showSeconds: false,
    showDate: true,
    secondTimezoneLabel: "",
  }
  const [now, setNow] = useState<Date | null>(null)
  const drag = useDraggableWidget({
    storageKey: "clock",
    defaultCorner: "top-right",
  })

  // Hydrate after mount so we don't ship SSR-mismatched time
  useEffect(() => {
    setNow(new Date())
    const tickMs = clock.showSeconds ? 1000 : 30_000
    const t = setInterval(() => setNow(new Date()), tickMs)
    return () => clearInterval(t)
  }, [clock.showSeconds])

  if (!clock.show || !now) return null

  const timeStr = formatTime(now, clock.format24, clock.showSeconds)
  const dateStr = clock.showDate ? formatDate(now) : null
  const altStr = clock.secondTimezoneLabel
    ? formatInTimezone(now, clock.secondTimezoneLabel, clock.format24, clock.showSeconds)
    : null

  return (
    <div
      ref={drag.containerRef}
      style={drag.style}
      onPointerDown={drag.onPointerDown}
      className={`z-30 select-none flex flex-col items-end gap-1 ${
        drag.isDragging ? "cursor-grabbing" : "cursor-grab"
      }`}
      aria-label="Current time (drag to reposition)"
      data-slot="topbar-clock"
    >
      <div className="group inline-flex items-stretch gap-0 rounded-lg border border-border/30 bg-background/50 backdrop-blur-md supports-[backdrop-filter]:bg-background/30 shadow-[0_1px_2px_rgb(0_0_0/0.04)] overflow-hidden transition-[background,border-color,box-shadow] duration-300 hover:bg-background/80 hover:border-border/60 hover:shadow-[0_4px_16px_-4px_rgb(0_0_0/0.15)]">
        <span className="flex items-center px-1.5 text-muted-foreground/30 group-hover:text-muted-foreground/70 transition-colors" title="Drag to move">
          <GripVertical className="size-3" />
        </span>
        <span className="flex items-center pr-2.5 py-1 font-mono text-sm tabular-nums leading-none tracking-tight">{timeStr}</span>
        {dateStr && (
          <span className="flex items-center px-2.5 py-1 text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider border-l border-border/30">
            {dateStr}
          </span>
        )}
      </div>
      {altStr && (
        <div className="inline-flex items-center gap-1.5 rounded-md bg-background/30 px-2 py-0.5 backdrop-blur text-[10px] text-muted-foreground/70 uppercase tracking-wider">
          <span className="font-mono tabular-nums normal-case tracking-tight text-muted-foreground">{altStr.time}</span>
          <span>{altStr.label}</span>
        </div>
      )}
    </div>
  )
}

function pad(n: number) {
  return n.toString().padStart(2, "0")
}

function formatTime(d: Date, format24: boolean, withSeconds: boolean): string {
  let h = d.getHours()
  const m = pad(d.getMinutes())
  const s = pad(d.getSeconds())
  let suffix = ""
  if (!format24) {
    suffix = h >= 12 ? " PM" : " AM"
    h = h % 12
    if (h === 0) h = 12
  }
  const hh = format24 ? pad(h) : String(h)
  return withSeconds ? `${hh}:${m}:${s}${suffix}` : `${hh}:${m}${suffix}`
}

function formatDate(d: Date): string {
  const weekday = d.toLocaleDateString(undefined, { weekday: "short" })
  const day = d.getDate()
  const month = d.toLocaleDateString(undefined, { month: "short" })
  return `${weekday} ${day} ${month}`
}

function formatInTimezone(
  d: Date,
  tz: string,
  format24: boolean,
  withSeconds: boolean,
): { time: string; label: string } | null {
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      second: withSeconds ? "2-digit" : undefined,
      hour12: !format24,
      timeZoneName: "short",
    }).formatToParts(d)
    const hour = parts.find((p) => p.type === "hour")?.value ?? ""
    const minute = parts.find((p) => p.type === "minute")?.value ?? ""
    const second = parts.find((p) => p.type === "second")?.value
    const dayPeriod = parts.find((p) => p.type === "dayPeriod")?.value
    const zone = parts.find((p) => p.type === "timeZoneName")?.value ?? tz
    const time =
      `${hour}:${minute}` +
      (withSeconds && second ? `:${second}` : "") +
      (dayPeriod ? ` ${dayPeriod}` : "")
    return { time, label: zone }
  } catch {
    return null
  }
}
