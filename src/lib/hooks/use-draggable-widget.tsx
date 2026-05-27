"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type WidgetCorner = "top-right" | "top-left" | "bottom-right" | "bottom-left"

interface StoredPosition {
  x: number
  y: number
}

interface UseDraggableWidgetOptions {
  /** Unique key for localStorage persistence. */
  storageKey: string
  /** Initial corner when no position is stored. Default: top-right. */
  defaultCorner?: WidgetCorner
  /** Margin from screen edges when computing the default corner position. */
  margin?: number
}

interface UseDraggableWidgetResult {
  /** Attach to the element's root. */
  containerRef: React.RefObject<HTMLDivElement | null>
  /** Pointer-down listener — attach to a drag handle (or container if whole-widget drag). */
  onPointerDown: (e: React.PointerEvent) => void
  /** Style for fixed positioning at current coords. */
  style: { position: "fixed"; left: number; top: number; touchAction: "none" }
  /** True while the user is dragging. */
  isDragging: boolean
  /** Programmatically reset to default corner. */
  resetPosition: () => void
}

/**
 * Headless draggable widget hook. Manages absolute position (left,top in px),
 * persists to localStorage under `flowspace.widget-pos.<storageKey>`, clamps
 * to viewport on resize, and provides pointer-drag wiring.
 *
 * Usage:
 *   const drag = useDraggableWidget({ storageKey: "clock", defaultCorner: "top-right" })
 *   <div ref={drag.containerRef} style={drag.style} onPointerDown={drag.onPointerDown}>
 *     ...
 *   </div>
 *
 * For widgets where only a sub-handle should drag, omit onPointerDown on the
 * container and put it on the handle instead.
 */
export function useDraggableWidget({
  storageKey,
  defaultCorner = "top-right",
  margin = 12,
}: UseDraggableWidgetOptions): UseDraggableWidgetResult {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<StoredPosition | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const fullKey = `flowspace.widget-pos.${storageKey}`

  // Compute default corner-anchored position once the element has measurable size.
  const computeDefault = useCallback((): StoredPosition => {
    const el = containerRef.current
    const w = el?.offsetWidth ?? 240
    const h = el?.offsetHeight ?? 60
    const vw = window.innerWidth
    const vh = window.innerHeight
    switch (defaultCorner) {
      case "top-left":
        return { x: margin, y: margin }
      case "top-right":
        return { x: Math.max(margin, vw - w - margin), y: margin }
      case "bottom-left":
        return { x: margin, y: Math.max(margin, vh - h - margin) }
      case "bottom-right":
      default:
        return { x: Math.max(margin, vw - w - margin), y: Math.max(margin, vh - h - margin) }
    }
  }, [defaultCorner, margin])

  // Hydrate position after mount (avoids SSR mismatch on coords).
  useEffect(() => {
    let next: StoredPosition | null = null
    try {
      const raw = window.localStorage.getItem(fullKey)
      if (raw) next = JSON.parse(raw) as StoredPosition
    } catch {}
    if (!next) next = computeDefault()
    // Clamp to viewport
    const el = containerRef.current
    const w = el?.offsetWidth ?? 240
    const h = el?.offsetHeight ?? 60
    next = {
      x: Math.max(0, Math.min(next.x, window.innerWidth - w)),
      y: Math.max(0, Math.min(next.y, window.innerHeight - h)),
    }
    setPos(next)
  }, [fullKey, computeDefault])

  // Re-clamp on window resize so widgets don't disappear off-screen
  useEffect(() => {
    if (!pos) return
    function onResize() {
      const el = containerRef.current
      if (!el) return
      const w = el.offsetWidth
      const h = el.offsetHeight
      setPos((prev) =>
        prev
          ? {
              x: Math.max(0, Math.min(prev.x, window.innerWidth - w)),
              y: Math.max(0, Math.min(prev.y, window.innerHeight - h)),
            }
          : prev
      )
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [pos])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Ignore drag if user is interacting with an input, button, or scrollable
      const t = e.target as HTMLElement
      if (t.closest("button, input, textarea, select, a, [data-no-drag]")) return
      if (e.button !== 0) return // left-click only

      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      setIsDragging(true)
      ;(e.target as Element).setPointerCapture?.(e.pointerId)

      function onMove(ev: PointerEvent) {
        const w = el!.offsetWidth
        const h = el!.offsetHeight
        const nx = Math.max(0, Math.min(ev.clientX - dragOffset.current.x, window.innerWidth - w))
        const ny = Math.max(0, Math.min(ev.clientY - dragOffset.current.y, window.innerHeight - h))
        setPos({ x: nx, y: ny })
      }
      function onUp() {
        setIsDragging(false)
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
        // Persist the final position
        setPos((p) => {
          if (p) {
            try {
              window.localStorage.setItem(fullKey, JSON.stringify(p))
            } catch {}
          }
          return p
        })
      }
      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
    },
    [fullKey]
  )

  const resetPosition = useCallback(() => {
    const next = computeDefault()
    setPos(next)
    try {
      window.localStorage.removeItem(fullKey)
    } catch {}
  }, [computeDefault, fullKey])

  // Until hydrated, render at the default corner via simple Tailwind classes —
  // but the consumer doesn't know that; we render absolutely positioned even
  // pre-hydration to avoid layout shift.
  const style = {
    position: "fixed" as const,
    left: pos?.x ?? 0,
    top: pos?.y ?? 0,
    touchAction: "none" as const,
  }

  return { containerRef, onPointerDown, style, isDragging, resetPosition }
}
