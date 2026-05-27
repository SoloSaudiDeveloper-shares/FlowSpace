"use client"

import { useEffect, useRef, useState } from "react"

export interface ContextMenuItem {
  label: string
  icon?: React.ComponentType<{ className?: string }>
  onClick: () => void
  variant?: "default" | "destructive"
  disabled?: boolean
}

export interface ContextMenuSeparator {
  separator: true
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuEntry[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handler)
    document.addEventListener("touchstart", handler)
    return () => {
      document.removeEventListener("mousedown", handler)
      document.removeEventListener("touchstart", handler)
    }
  }, [onClose])

  const menuWidth = 200
  const menuItemHeight = 34
  const estimatedHeight = items.length * menuItemHeight + 8
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 8)
  const adjustedY = Math.min(y, window.innerHeight - estimatedHeight - 8)

  return (
    <>
      <div className="fixed inset-0 z-[60]" onContextMenu={(e) => { e.preventDefault(); onClose() }} />
      <div
        ref={ref}
        className="fixed z-[61] min-w-[180px] bg-popover border rounded-lg shadow-lg py-1 text-sm"
        style={{ left: adjustedX, top: adjustedY }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {items.map((item, i) => {
          if ("separator" in item) {
            return <div key={i} className="my-1 border-t" />
          }
          const Icon = item.icon
          return (
            <button
              key={i}
              disabled={item.disabled}
              className={`flex items-center gap-2 w-full px-3 py-1.5 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                item.variant === "destructive"
                  ? "text-destructive hover:bg-destructive/10"
                  : "hover:bg-accent"
              }`}
              onClick={() => {
                onClose()
                item.onClick()
              }}
            >
              {Icon && <Icon className="size-3.5 shrink-0 text-muted-foreground" />}
              {item.label}
            </button>
          )
        })}
      </div>
    </>
  )
}

interface MenuState {
  x: number
  y: number
  items: ContextMenuEntry[]
}

export function useContextMenu() {
  const [menu, setMenu] = useState<MenuState | null>(null)

  function open(e: React.MouseEvent, items: ContextMenuEntry[]) {
    // Let the native context menu through on text inputs so copy/paste works
    const target = e.target as HTMLElement
    const tag = target.tagName
    if (
      tag === "INPUT" || tag === "TEXTAREA" ||
      target.isContentEditable ||
      target.closest("[contenteditable]")
    ) {
      return
    }
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, items })
  }

  function close() {
    setMenu(null)
  }

  return { menu, open, close }
}
