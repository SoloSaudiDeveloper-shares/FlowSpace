"use client"

/**
 * Drag-to-resize handle for the left sidebar.
 *
 * The shadcn Sidebar is fixed-width via the `--sidebar-width` CSS variable set
 * inline on the `[data-slot="sidebar-wrapper"]` element. This component:
 *   1. applies the user's persisted width to that variable, and
 *   2. renders a thin grabbable strip on the sidebar's right edge that the
 *      user can drag left/right to change the width (persisted on release).
 */

import { useEffect, useRef, useState } from "react"
import { usePreferences } from "@/lib/hooks/use-preferences"
import { useSidebar } from "@/components/ui/sidebar"

const MIN_WIDTH = 200
const MAX_WIDTH = 460

function applyWidth(px: number) {
  if (typeof document === "undefined") return
  const wrapper = document.querySelector<HTMLElement>('[data-slot="sidebar-wrapper"]')
  wrapper?.style.setProperty("--sidebar-width", `${px}px`)
}

export function SidebarResizer() {
  const { preferences, updatePreference } = usePreferences()
  const { state, isMobile } = useSidebar()
  const [dragging, setDragging] = useState(false)
  const widthRef = useRef(preferences.sidebarWidth || 256)

  // Apply the saved width whenever it changes (load, or edited elsewhere).
  useEffect(() => {
    const w = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, preferences.sidebarWidth || 256))
    widthRef.current = w
    applyWidth(w)
  }, [preferences.sidebarWidth])

  useEffect(() => {
    if (!dragging) return
    function onMove(e: PointerEvent) {
      const w = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(e.clientX)))
      widthRef.current = w
      applyWidth(w) // live preview, no state churn
    }
    function onUp() {
      setDragging(false)
      updatePreference("sidebarWidth", widthRef.current) // persist once
    }
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp, { once: true })
    return () => {
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
  }, [dragging, updatePreference])

  // No handle when the sidebar is collapsed to icons or in mobile off-canvas
  // mode (its right edge isn't at --sidebar-width then).
  if (isMobile || state === "collapsed") return null

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      title="Drag to resize"
      onPointerDown={(e) => { e.preventDefault(); setDragging(true) }}
      onDoubleClick={() => { applyWidth(256); updatePreference("sidebarWidth", 256) }}
      className="group/resizer fixed inset-y-0 z-30 hidden md:block w-2 -translate-x-1/2 cursor-col-resize touch-none"
      style={{ left: "var(--sidebar-width)" }}
    >
      {/* Visible hairline that thickens on hover/drag. */}
      <span
        className={`absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-border transition-all group-hover/resizer:w-0.5 group-hover/resizer:bg-primary ${
          dragging ? "w-0.5 bg-primary" : ""
        }`}
      />
    </div>
  )
}
