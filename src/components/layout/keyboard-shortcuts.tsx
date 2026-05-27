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
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const shortcuts: Shortcut[] = [
    // Navigation
    { keys: ["Ctrl", "K"], label: "Open command palette", category: "Navigation", action: () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true })) } },
    { keys: ["Shift", "?"], label: "Show keyboard shortcuts", category: "Navigation" },
    { keys: ["Alt", "H"], label: "Go to home", category: "Navigation", action: () => router.push("/") },
    { keys: ["Alt", "R"], label: "Go to reminders", category: "Navigation", action: () => router.push("/reminders") },

    // Task actions
    { keys: ["Ctrl", "Enter"], label: "Submit / confirm", category: "Tasks" },
    { keys: ["Escape"], label: "Close dialog / cancel", category: "Tasks" },

    // Editor
    { keys: ["Ctrl", "B"], label: "Bold text", category: "Editor" },
    { keys: ["Ctrl", "I"], label: "Italic text", category: "Editor" },
    { keys: ["Ctrl", "U"], label: "Underline text", category: "Editor" },
    { keys: ["Ctrl", "Shift", "X"], label: "Strikethrough", category: "Editor" },
    { keys: ["Ctrl", "Z"], label: "Undo", category: "Editor" },
    { keys: ["Ctrl", "Shift", "Z"], label: "Redo", category: "Editor" },

    // General
    { keys: ["Ctrl", "S"], label: "Save (auto-saves)", category: "General" },
    { keys: ["/"], label: "Slash command (in editor)", category: "General" },
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
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Press <Kbd>Shift</Kbd> + <Kbd>?</Kbd> anywhere to show this overlay
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
