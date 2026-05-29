"use client"

/**
 * First-run guided tour.
 *
 * Walks the new user through the seven things that make FlowSpace
 * itself (sidebar groups, command palette, right-click everywhere, the
 * feed ticker, the floating clock, settings, and your bot). Each step
 * highlights a real DOM element (via data-tour="…" attribute) by
 * darkening everything else and pointing a callout at it.
 *
 * The tour:
 *  - shows once per user (tracked in preferences.onboardingCompletedAt)
 *  - can be replayed any time from Settings → Help → "Replay tour"
 *  - is dismissable mid-flight (X button); dismissal counts as
 *    "completed" so we don't nag
 *
 * The component is rendered globally; it self-mounts after a 1500ms
 * delay (so first-run users get a moment to look around) and self-
 * unmounts when finished/dismissed.
 */

import { useEffect, useMemo, useState } from "react"
import { X, ArrowRight, ArrowLeft, Sparkles, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePreferences } from "@/lib/hooks/use-preferences"

interface TourStep {
  selector: string
  title: string
  body: string
  /** Side to position the callout relative to the highlighted element. */
  side?: "top" | "right" | "bottom" | "left"
  /** Center the callout in the viewport instead of attaching to a node
   *  (used for intro/outro steps). */
  center?: boolean
}

const STEPS: TourStep[] = [
  {
    selector: "[data-tour=intro]",
    center: true,
    title: "Welcome to FlowSpace 👋",
    body:
      "Let's spend 60 seconds on the seven things that make this feel like home. You can skip any time.",
  },
  {
    selector: "[data-slot=sidebar]",
    side: "right",
    title: "Your sidebar",
    body:
      "Every element type — projects, pages, canvases, todo lists, reminders, processes — lives in its own collapsible group. Right-click a group header to tint it, right-click an item for the full menu.",
  },
  {
    selector: "[data-slot=sidebar] input[placeholder*='Search'], [data-slot=sidebar] button[aria-label*='Search']",
    side: "right",
    title: "Command palette",
    body:
      "Press ⌘K (Ctrl+K on Windows) anywhere to jump to anything: an element, an action, a settings page. The fastest path to almost everything.",
  },
  {
    selector: "[data-slot=topbar-clock]",
    side: "left",
    title: "The floating clock",
    body:
      "Drag it anywhere. Right-click for colour, format, analog/digital, second timezone. Hide it from Settings if you don't need it.",
  },
  {
    selector: "header [aria-label*='Notifications'], [data-tour=notifications]",
    side: "bottom",
    title: "Your bell",
    body:
      "A single rose number summarising what needs your attention: unread notifications, pending imports from Telegram or Email, overdue tasks, overdue reminders. Click for the full list.",
  },
  {
    selector: "[data-tour=quick-capture], main",
    side: "bottom",
    title: "Right-click is your friend",
    body:
      "Right-click on the page background, on sidebar items, on feed entries, on tasks. We added a lot of context menus — the platform feels much smaller once you know they're there.",
  },
  {
    selector: "[data-tour=intro]",
    center: true,
    title: "You're set 🎉",
    body:
      "Settings → Help has a Replay tour button if you ever want to see this again. Now go build something.",
  },
]

const TOUR_DELAY_MS = 1500

export function OnboardingTour() {
  const { preferences, updatePreference } = usePreferences()
  const [open, setOpen] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)
  const [target, setTarget] = useState<{
    rect: DOMRect
    centered: boolean
  } | null>(null)

  // Decide whether to open at all.
  useEffect(() => {
    const seen = preferences.onboardingCompletedAt
    if (seen) return
    const t = window.setTimeout(() => setOpen(true), TOUR_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [preferences.onboardingCompletedAt])

  // Recompute target position when the step or viewport changes.
  const step = STEPS[stepIdx]
  useEffect(() => {
    if (!open || !step) return
    function compute() {
      if (step.center) {
        setTarget({
          rect: new DOMRect(
            window.innerWidth / 2 - 200,
            window.innerHeight / 2 - 60,
            400,
            120,
          ),
          centered: true,
        })
        return
      }
      const el = document.querySelector(step.selector) as HTMLElement | null
      if (!el) {
        setTarget(null)
        return
      }
      const rect = el.getBoundingClientRect()
      setTarget({ rect, centered: false })
    }
    compute()
    window.addEventListener("resize", compute)
    window.addEventListener("scroll", compute, true)
    const interval = window.setInterval(compute, 500)
    return () => {
      window.removeEventListener("resize", compute)
      window.removeEventListener("scroll", compute, true)
      window.clearInterval(interval)
    }
  }, [open, step])

  const finish = useMemo(
    () => () => {
      setOpen(false)
      updatePreference("onboardingCompletedAt", new Date().toISOString())
    },
    [updatePreference],
  )

  if (!open || !step) return null

  const isLast = stepIdx === STEPS.length - 1
  const isFirst = stepIdx === 0

  const calloutPosition = computeCalloutPosition(target, step.side ?? "bottom")

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Dimmer with cut-out around the highlighted element. The
          highlighted element itself stays visually unobstructed because
          we draw a transparent hole over its bounding rect. */}
      <div className="absolute inset-0 pointer-events-auto" onClick={finish}>
        <svg
          className="absolute inset-0 w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <defs>
            <mask id="tour-mask">
              <rect width="100%" height="100%" fill="white" />
              {target && !target.centered && (
                <rect
                  x={Math.max(0, target.rect.left - 8)}
                  y={Math.max(0, target.rect.top - 8)}
                  width={target.rect.width + 16}
                  height={target.rect.height + 16}
                  rx={10}
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.75)"
            mask="url(#tour-mask)"
          />
        </svg>
        {/* Highlight ring */}
        {target && !target.centered && (
          <div
            className="absolute pointer-events-none rounded-[10px] ring-2 ring-primary/80 shadow-[0_0_0_4px_rgba(167,139,250,0.25)]"
            style={{
              left: target.rect.left - 8,
              top: target.rect.top - 8,
              width: target.rect.width + 16,
              height: target.rect.height + 16,
              transition: "all 0.25s ease",
            }}
          />
        )}
      </div>

      {/* Callout */}
      <div
        className="absolute pointer-events-auto rounded-xl border border-primary/30 bg-card shadow-2xl p-4 max-w-sm animate-in fade-in-0 slide-in-from-bottom-1 duration-200"
        style={calloutPosition}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium">
              Step {stepIdx + 1} of {STEPS.length}
            </span>
          </div>
          <button
            type="button"
            onClick={finish}
            className="size-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center"
            aria-label="Skip tour"
          >
            <X className="size-3.5" />
          </button>
        </div>
        <h3 className="text-base font-semibold mb-1.5">{step.title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
          {step.body}
        </p>
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
            disabled={isFirst}
          >
            <ArrowLeft className="size-3" />
            Back
          </Button>
          <div className="flex items-center gap-0.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`size-1.5 rounded-full transition-colors ${
                  i === stepIdx
                    ? "bg-primary w-3"
                    : i < stepIdx
                    ? "bg-primary/40"
                    : "bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>
          {isLast ? (
            <Button size="sm" className="h-7 text-xs gap-1.5" onClick={finish}>
              <Check className="size-3" />
              Done
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1))}
            >
              Next
              <ArrowRight className="size-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function computeCalloutPosition(
  target: { rect: DOMRect; centered: boolean } | null,
  side: "top" | "right" | "bottom" | "left",
): React.CSSProperties {
  if (!target) {
    return {
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
    }
  }
  if (target.centered) {
    return {
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
    }
  }
  const rect = target.rect
  const offset = 16
  const calloutWidth = 360
  const calloutHeight = 200
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1280
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 800
  let left = 0
  let top = 0
  switch (side) {
    case "right":
      left = rect.right + offset
      top = rect.top + rect.height / 2 - calloutHeight / 2
      break
    case "left":
      left = rect.left - calloutWidth - offset
      top = rect.top + rect.height / 2 - calloutHeight / 2
      break
    case "top":
      left = rect.left + rect.width / 2 - calloutWidth / 2
      top = rect.top - calloutHeight - offset
      break
    case "bottom":
    default:
      left = rect.left + rect.width / 2 - calloutWidth / 2
      top = rect.bottom + offset
      break
  }
  // Clamp to viewport
  left = Math.max(16, Math.min(viewportW - calloutWidth - 16, left))
  top = Math.max(16, Math.min(viewportH - calloutHeight - 16, top))
  return { left, top }
}
