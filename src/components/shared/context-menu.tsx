"use client"

import { useEffect, useRef, useState } from "react"

export interface ContextMenuItem {
  label: string
  icon?: React.ComponentType<{ className?: string }>
  onClick: () => void
  variant?: "default" | "destructive"
  disabled?: boolean
  /** Optional right-side hint text (kbd shortcut, status, time, etc.) */
  hint?: string
  /** Optional left-side color swatch (small filled circle) */
  swatchColor?: string
}

export interface ContextMenuSeparator {
  separator: true
}

/** Read-only info header — renders title + optional subtitle, not clickable. */
export interface ContextMenuHeader {
  header: true
  title: string
  subtitle?: string
  icon?: React.ComponentType<{ className?: string }>
}

/** Horizontal row of color swatches — pick one to invoke a setter. */
export interface ContextMenuColorRow {
  colors: true
  options: Array<{ value: string; label?: string }>
  selected?: string
  onPick: (value: string) => void
}

export type ContextMenuEntry =
  | ContextMenuItem
  | ContextMenuSeparator
  | ContextMenuHeader
  | ContextMenuColorRow

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
          if ("header" in item) {
            const HIcon = item.icon
            return (
              <div key={i} className="px-3 pt-1.5 pb-1.5 select-none cursor-default">
                <div className="flex items-center gap-2 text-foreground/90">
                  {HIcon && <HIcon className="size-3.5 shrink-0 text-muted-foreground" />}
                  <span className="font-medium truncate">{item.title}</span>
                </div>
                {item.subtitle && (
                  <div className="text-[11px] text-muted-foreground/80 truncate ml-[1.375rem]">
                    {item.subtitle}
                  </div>
                )}
              </div>
            )
          }
          if ("colors" in item) {
            return (
              <div key={i} className="px-3 py-1.5 flex items-center gap-1.5">
                {item.options.map((c) => {
                  const isSelected = item.selected === c.value
                  return (
                    <button
                      key={c.value}
                      type="button"
                      title={c.label ?? c.value}
                      onClick={() => {
                        onClose()
                        item.onPick(c.value)
                      }}
                      className={`size-5 rounded-full ring-offset-popover transition-transform hover:scale-110 ${
                        isSelected ? "ring-2 ring-offset-2 ring-foreground/80" : "ring-1 ring-border"
                      }`}
                      style={{ background: c.value }}
                      aria-label={`Set color ${c.label ?? c.value}`}
                    />
                  )
                })}
                {item.selected && (
                  <button
                    type="button"
                    title="Clear color"
                    onClick={() => { onClose(); item.onPick("") }}
                    className="size-5 rounded-full border border-dashed border-muted-foreground/40 flex items-center justify-center text-[10px] text-muted-foreground hover:bg-accent"
                  >
                    ×
                  </button>
                )}
              </div>
            )
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
              {item.swatchColor && (
                <span className="size-3 rounded-full shrink-0 ring-1 ring-border" style={{ background: item.swatchColor }} />
              )}
              {Icon && !item.swatchColor && <Icon className="size-3.5 shrink-0 text-muted-foreground" />}
              <span className="flex-1 truncate">{item.label}</span>
              {item.hint && (
                <span className="text-[10px] text-muted-foreground/60 tabular-nums uppercase tracking-wider ml-2 shrink-0">
                  {item.hint}
                </span>
              )}
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
