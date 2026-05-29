"use client"

import { useEffect, useState } from "react"
import {
  GripVertical,
  Clock as ClockIcon,
  Eye,
  EyeOff,
  CalendarDays,
  Hourglass,
  Move,
  Palette,
  Sparkles,
  Layers,
  RotateCcw,
  Check,
} from "lucide-react"
import { usePreferences, DEFAULT_PREFERENCES, type ClockDateFormat, type ClockMode } from "@/lib/hooks/use-preferences"
import { useDraggableWidget } from "@/lib/hooks/use-draggable-widget"
import { useLongPress } from "@/lib/hooks/use-long-press"
import {
  ContextMenu,
  useContextMenu,
  type ContextMenuEntry,
} from "@/components/shared/context-menu"

const CLOCK_COLORS = [
  { value: "#ffffff", label: "Default" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Violet" },
  { value: "#f43f5e", label: "Rose" },
  { value: "#10b981", label: "Green" },
  { value: "#f97316", label: "Orange" },
  { value: "#14b8a6", label: "Teal" },
]

const DATE_FORMAT_LABELS: Record<ClockDateFormat, string> = {
  short: "Short — Wed 27 May",
  long: "Long — Wednesday, May 27 2026",
  iso: "ISO — 2026-05-27",
  weekday: "Weekday only — Wednesday",
}

/**
 * Live clock pinned to a viewport corner (top-right by default). Draggable —
 * grab anywhere on the chip to reposition; position persists per-browser.
 * Right-click to access color, format, mode, and visibility options.
 */
export function TopbarClock() {
  const { preferences, updatePreference } = usePreferences()
  const clock = { ...DEFAULT_PREFERENCES.clock, ...preferences.clock }
  const [now, setNow] = useState<Date | null>(null)
  const drag = useDraggableWidget({
    storageKey: "clock",
    defaultCorner: "top-right",
  })
  const ctx = useContextMenu()

  // Hydrate after mount + tick. Analog mode with seconds redraws every 1s, otherwise per-minute is fine.
  useEffect(() => {
    setNow(new Date())
    const tickMs = clock.showSeconds || clock.mode === "analog" ? 1000 : 30_000
    const t = setInterval(() => setNow(new Date()), tickMs)
    return () => clearInterval(t)
  }, [clock.showSeconds, clock.mode])

  function update(patch: Partial<typeof clock>) {
    updatePreference("clock", { ...clock, ...patch })
  }

  function handleContextMenu(e: React.MouseEvent) {
    if (!now) return
    const timeNow = formatTime(now, clock.format24, clock.showSeconds)
    const colorRow: ContextMenuEntry = {
      colors: true,
      options: CLOCK_COLORS,
      selected: clock.accentColor,
      onPick: (val) => update({ accentColor: val || undefined }),
    }
    const items: ContextMenuEntry[] = [
      { header: true, title: "Clock", subtitle: timeNow, icon: ClockIcon },
      { separator: true },
      colorRow,
      { separator: true },
      {
        label: clock.format24 ? "Switch to 12-hour" : "Switch to 24-hour",
        icon: ClockIcon,
        hint: clock.format24 ? "24h" : "12h",
        onClick: () => update({ format24: !clock.format24 }),
      },
      {
        label: clock.showSeconds ? "Hide seconds" : "Show seconds",
        icon: Hourglass,
        onClick: () => update({ showSeconds: !clock.showSeconds }),
      },
      {
        label: clock.showDate ? "Hide date" : "Show date",
        icon: CalendarDays,
        onClick: () => update({ showDate: !clock.showDate }),
      },
      { separator: true },
      // Date format — flat list with checkmarks
      ...(Object.entries(DATE_FORMAT_LABELS).map(([key, label]) => ({
        label,
        icon: clock.dateFormat === key ? Check : CalendarDays,
        disabled: !clock.showDate,
        onClick: () => update({ dateFormat: key as ClockDateFormat }),
      })) as ContextMenuEntry[]),
      { separator: true },
      // Mode toggle
      {
        label: clock.mode === "analog" ? "Switch to digital" : "Switch to analog face",
        icon: clock.mode === "analog" ? Sparkles : Layers,
        hint: clock.mode === "analog" ? "analog" : "digital",
        onClick: () => update({ mode: clock.mode === "analog" ? "digital" : "analog" }),
      },
      { separator: true },
      {
        label: "Reset position",
        icon: Move,
        onClick: () => drag.resetPosition(),
      },
      {
        label: "Hide clock",
        icon: EyeOff,
        variant: "destructive" as const,
        onClick: () => update({ show: false }),
      },
    ]
    ctx.open(e, items)
  }

  if (!clock.show || !now) return null

  const accent = clock.accentColor || undefined
  const timeStr = formatTime(now, clock.format24, clock.showSeconds)
  const dateStr = clock.showDate ? formatDate(now, clock.dateFormat ?? "short") : null
  const altStr = clock.secondTimezoneLabel
    ? formatInTimezone(now, clock.secondTimezoneLabel, clock.format24, clock.showSeconds)
    : null

  // Long-press → same context menu as right-click. The hook synthesises
  // a React.PointerEvent so we cast it to MouseEvent-shape for
  // handleContextMenu which only reads clientX/clientY + preventDefault.
  const longPress = useLongPress((e) => {
    handleContextMenu(e as unknown as React.MouseEvent)
  }, 500)

  // Common wrapper for drag + context menu
  const wrapperCls = `z-30 select-none flex flex-col items-end gap-1 ${
    drag.isDragging ? "cursor-grabbing" : "cursor-grab"
  }`

  if (clock.mode === "analog") {
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
          className={wrapperCls}
          aria-label="Current time (drag to reposition, long-press for options)"
          data-slot="topbar-clock"
        >
          <div className="group inline-flex items-center gap-2 rounded-full border border-border/30 bg-background/50 backdrop-blur-md p-1 md:p-1.5 hover:bg-background/80 hover:border-border/60 transition-all">
            <AnalogFace date={now} accent={accent} showSeconds={clock.showSeconds} />
            {/* Date chip hidden on phones to keep the analog widget small. */}
            {dateStr && (
              <span className="hidden md:inline-flex pr-2 text-[10px] font-medium text-muted-foreground/80 uppercase tracking-wider">
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
        {ctx.menu && <ContextMenu x={ctx.menu.x} y={ctx.menu.y} items={ctx.menu.items} onClose={ctx.close} />}
      </>
    )
  }

  return (
    <>
      <div
        ref={drag.containerRef}
        style={drag.style}
        onPointerDown={drag.onPointerDown}
        onContextMenu={handleContextMenu}
        className={wrapperCls}
        aria-label="Current time (drag to reposition, right-click for options)"
        data-slot="topbar-clock"
      >
        <div className="group inline-flex items-stretch gap-0 rounded-lg border border-border/30 bg-background/50 backdrop-blur-md supports-[backdrop-filter]:bg-background/30 shadow-[0_1px_2px_rgb(0_0_0/0.04)] overflow-hidden transition-[background,border-color,box-shadow] duration-300 hover:bg-background/80 hover:border-border/60 hover:shadow-[0_4px_16px_-4px_rgb(0_0_0/0.15)]">
          {/* Drag-grip — hidden on phones; we use long-press there. */}
          <span className="hidden md:flex items-center px-1.5 text-muted-foreground/30 group-hover:text-muted-foreground/70 transition-colors" title="Drag to move, right-click for options">
            <GripVertical className="size-3" />
          </span>
          <span
            className="flex items-center px-2 md:pr-2.5 md:pl-0 py-1 font-mono text-xs md:text-sm tabular-nums leading-none tracking-tight"
            style={accent ? { color: accent } : undefined}
          >
            {timeStr}
          </span>
          {/* Date chip — hidden on phones to save real estate. Toggleable on tablets+. */}
          {dateStr && (
            <span className="hidden md:flex items-center px-2.5 py-1 text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider border-l border-border/30">
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
      {ctx.menu && <ContextMenu x={ctx.menu.x} y={ctx.menu.y} items={ctx.menu.items} onClose={ctx.close} />}
    </>
  )
}

/** ─── Analog clock face ─────────────────────────────────────────────────
 * 44×44 SVG: 12 tick marks (4 chunky cardinal, 8 thin), hour + minute hands,
 * optional second hand. Accent color is applied to the hour hand and the
 * center pin so the user's color choice is visible.
 */
function AnalogFace({
  date,
  accent,
  showSeconds,
}: {
  date: Date
  accent?: string
  showSeconds: boolean
}) {
  const h = date.getHours() % 12
  const m = date.getMinutes()
  const s = date.getSeconds()
  // Angles in degrees (0 = up). Minutes contribute to hour angle for smoothness.
  const hourDeg = h * 30 + m * 0.5
  const minDeg = m * 6 + s * 0.1
  const secDeg = s * 6
  const hand = (deg: number, length: number, width: number, color: string, opacity = 1) => {
    const rad = ((deg - 90) * Math.PI) / 180
    const x2 = 22 + Math.cos(rad) * length
    const y2 = 22 + Math.sin(rad) * length
    return (
      <line
        x1={22}
        y1={22}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        opacity={opacity}
      />
    )
  }
  const ticks = []
  for (let i = 0; i < 12; i++) {
    const deg = i * 30
    const rad = ((deg - 90) * Math.PI) / 180
    const isCardinal = i % 3 === 0
    const r1 = isCardinal ? 16 : 18
    const r2 = 20
    ticks.push(
      <line
        key={i}
        x1={22 + Math.cos(rad) * r1}
        y1={22 + Math.sin(rad) * r1}
        x2={22 + Math.cos(rad) * r2}
        y2={22 + Math.sin(rad) * r2}
        stroke="currentColor"
        strokeWidth={isCardinal ? 1.6 : 0.9}
        strokeLinecap="round"
        opacity={isCardinal ? 0.7 : 0.35}
      />
    )
  }
  const hourColor = accent || "currentColor"
  const minColor = "currentColor"
  return (
    <svg viewBox="0 0 44 44" className="size-8 md:size-11 shrink-0 text-foreground">
      {/* face ring */}
      <circle cx={22} cy={22} r={20.5} fill="none" stroke="currentColor" strokeWidth={0.8} opacity={0.25} />
      {ticks}
      {hand(hourDeg, 10, 2.2, hourColor)}
      {hand(minDeg, 14, 1.4, minColor, 0.85)}
      {showSeconds && hand(secDeg, 16, 0.7, hourColor, 0.7)}
      <circle cx={22} cy={22} r={1.6} fill={hourColor} />
    </svg>
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

function formatDate(d: Date, mode: ClockDateFormat): string {
  switch (mode) {
    case "long":
      return d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    case "iso":
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    case "weekday":
      return d.toLocaleDateString(undefined, { weekday: "long" })
    case "short":
    default: {
      const weekday = d.toLocaleDateString(undefined, { weekday: "short" })
      const day = d.getDate()
      const month = d.toLocaleDateString(undefined, { month: "short" })
      return `${weekday} ${day} ${month}`
    }
  }
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
