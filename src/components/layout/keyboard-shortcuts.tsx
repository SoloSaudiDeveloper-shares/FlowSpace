"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Keyboard } from "lucide-react"
import { useT } from "@/lib/hooks/use-i18n"

type Shortcut = {
  keys: string[]
  label: string
  category: string
  action?: () => void
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded border bg-muted text-[11px] font-mono font-medium text-muted-foreground">
      {children}
    </kbd>
  )
}

export function KeyboardShortcuts() {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const catNavigation = t("misc.shortcuts.cat.navigation")
  const catTasks = t("misc.shortcuts.cat.tasks")
  const catEditor = t("misc.shortcuts.cat.editor")
  const catGeneral = t("misc.shortcuts.cat.general")

  const shortcuts: Shortcut[] = [
    // Navigation
    { keys: ["Ctrl", "K"], label: t("misc.shortcuts.openPalette"), category: catNavigation, action: () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true })) } },
    { keys: ["Shift", "?"], label: t("misc.shortcuts.showShortcuts"), category: catNavigation },
    { keys: ["Alt", "H"], label: t("misc.shortcuts.goHome"), category: catNavigation, action: () => router.push("/") },
    { keys: ["Alt", "R"], label: t("misc.shortcuts.goReminders"), category: catNavigation, action: () => router.push("/reminders") },

    // Task actions
    { keys: ["Ctrl", "Enter"], label: t("misc.shortcuts.submit"), category: catTasks },
    { keys: ["Escape"], label: t("misc.shortcuts.closeDialog"), category: catTasks },

    // Editor
    { keys: ["Ctrl", "B"], label: t("misc.shortcuts.bold"), category: catEditor },
    { keys: ["Ctrl", "I"], label: t("misc.shortcuts.italic"), category: catEditor },
    { keys: ["Ctrl", "U"], label: t("misc.shortcuts.underline"), category: catEditor },
    { keys: ["Ctrl", "Shift", "X"], label: t("misc.shortcuts.strikethrough"), category: catEditor },
    { keys: ["Ctrl", "Z"], label: t("misc.shortcuts.undo"), category: catEditor },
    { keys: ["Ctrl", "Shift", "Z"], label: t("misc.shortcuts.redo"), category: catEditor },

    // General
    { keys: ["Ctrl", "S"], label: t("misc.shortcuts.save"), category: catGeneral },
    { keys: ["/"], label: t("misc.shortcuts.slash"), category: catGeneral },
  ]

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger in text inputs
    const target = e.target as HTMLElement
    const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable

    // Shift+? — show shortcuts overlay
    if (e.key === "?" && e.shiftKey && !isInput) {
      e.preventDefault()
      setOpen(true)
      return
    }

    // Alt+H — go home
    if (e.key === "h" && e.altKey && !isInput) {
      e.preventDefault()
      router.push("/")
      return
    }

    // Alt+R — go to reminders
    if (e.key === "r" && e.altKey && !isInput) {
      e.preventDefault()
      router.push("/reminders")
      return
    }
  }, [router])

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  const categories = [...new Set(shortcuts.map((s) => s.category))]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg max-h-[70vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="size-5" />
            {t("misc.shortcuts.title")}
          </DialogTitle>
          <DialogDescription>
            {(() => {
              const parts = t("misc.shortcuts.help").split(/(\{shift\}|\{question\})/)
              return parts.map((part, i) =>
                part === "{shift}" ? <Kbd key={i}>Shift</Kbd> :
                part === "{question}" ? <Kbd key={i}>?</Kbd> :
                <span key={i}>{part}</span>
              )
            })()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {categories.map((category) => (
            <div key={category}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {category}
              </h3>
              <div className="space-y-1">
                {shortcuts
                  .filter((s) => s.category === category)
                  .map((shortcut, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-accent/50"
                    >
                      <span className="text-sm">{shortcut.label}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, j) => (
                          <span key={j} className="flex items-center gap-0.5">
                            {j > 0 && <span className="text-xs text-muted-foreground mx-0.5">+</span>}
                            <Kbd>{key}</Kbd>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
