"use client"

/**
 * Service-worker registration + install banner.
 *
 * On mount: register `/sw.js` (silently no-op when unsupported).
 * When the browser fires `beforeinstallprompt`, we capture the event,
 * then surface a small floating banner offering "Install". Dismissed
 * banners stay dismissed for the rest of the session.
 *
 * Banner does not appear in standalone display mode (i.e. when the app
 * is already installed).
 */

import { useEffect, useState } from "react"
import { Download, X, Sparkles } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function PWABootstrap() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(
    null,
  )
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Register SW
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => undefined)
    }

    function handleBeforeInstall(e: Event) {
      e.preventDefault()
      setPromptEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstall)
    return () =>
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall)
  }, [])

  if (!promptEvent || dismissed) return null
  // Don't pop the banner inside the installed app.
  if (typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-sm rounded-lg border border-primary/30 bg-card/95 backdrop-blur-sm shadow-xl p-3 animate-in slide-in-from-bottom-2 fade-in-0">
      <div className="flex items-start gap-2">
        <div className="size-8 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
          <Sparkles className="size-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Install FlowSpace</p>
          <p className="text-xs text-muted-foreground leading-snug mt-0.5">
            Add to your home screen — opens like a real app, works offline.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="size-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center shrink-0"
          aria-label="Dismiss"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-1.5 mt-3">
        <button
          type="button"
          onClick={async () => {
            await promptEvent.prompt()
            const choice = await promptEvent.userChoice.catch(() => null)
            setPromptEvent(null)
            if (choice?.outcome !== "accepted") setDismissed(true)
          }}
          className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
        >
          <Download className="size-3" />
          Install
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="h-7 px-3 rounded-md text-xs text-muted-foreground hover:text-foreground"
        >
          Not now
        </button>
      </div>
    </div>
  )
}
