"use client"

/**
 * useLongPress — fires `callback` after the user holds a touch/pointer
 * down for `ms` milliseconds on the wrapped element.
 *
 * Returns props you spread onto the element. The handlers cancel as
 * soon as the user moves their finger > 8px (so a scroll / drag won't
 * accidentally trigger the menu).
 *
 * Designed as the mobile counterpart to right-click context menus.
 * The callback receives the original PointerEvent so the caller can
 * read clientX/clientY for positioning a menu.
 *
 *   const long = useLongPress((e) => openMenu(e), 500)
 *   return <div {...long}>…</div>
 */

import { useCallback, useRef } from "react"

export function useLongPress(
  callback: (e: React.PointerEvent) => void,
  ms = 500,
) {
  const timer = useRef<number | null>(null)
  const startX = useRef(0)
  const startY = useRef(0)
  const firedRef = useRef(false)

  const cancel = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only respond to primary touch — ignore mouse (which has right-click)
      // and ignore stylus barrel buttons (button !== 0).
      if (e.pointerType === "mouse") return
      firedRef.current = false
      startX.current = e.clientX
      startY.current = e.clientY
      cancel()
      // Snapshot the event because React reuses synthetic events; we'd
      // see null clientX by the time the timeout fires otherwise.
      const snapshot = {
        ...e,
        clientX: e.clientX,
        clientY: e.clientY,
        preventDefault: () => e.preventDefault?.(),
        stopPropagation: () => e.stopPropagation?.(),
      } as unknown as React.PointerEvent
      timer.current = window.setTimeout(() => {
        firedRef.current = true
        callback(snapshot)
      }, ms)
    },
    [callback, ms, cancel],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (timer.current === null) return
      const dx = e.clientX - startX.current
      const dy = e.clientY - startY.current
      if (dx * dx + dy * dy > 64) cancel() // > 8px movement
    },
    [cancel],
  )

  const onPointerUp = useCallback(() => cancel(), [cancel])
  const onPointerCancel = useCallback(() => cancel(), [cancel])
  const onPointerLeave = useCallback(() => cancel(), [cancel])

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onPointerLeave }
}
