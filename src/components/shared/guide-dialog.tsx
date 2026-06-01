"use client"

/**
 * Reusable, tour-style instructional popup.
 *
 * The same visual language as the first-run OnboardingTour (Sparkles badge,
 * "Step X of N", progress dots, Back / Next / Done) but presented as a
 * centered modal instead of a DOM spotlight. Use this ANYWHERE a feature
 * needs a "how do I use this?" explainer — don't inline walls of help text
 * into Settings panels.
 *
 * Usage:
 *   const [open, setOpen] = useState(false)
 *   <button onClick={() => setOpen(true)}>How do I use this?</button>
 *   <GuideDialog open={open} onOpenChange={setOpen} subject="API tokens" steps={[…]} />
 *
 * Each step is a { title, body, code? }. `body` is free-form ReactNode so a
 * step can include lists, inline <code>, links, etc. `code`, when present,
 * renders as a copy-able block (great for curl / config snippets).
 */

import { useState, type ReactNode } from "react"
import { Sparkles, ArrowLeft, ArrowRight, Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useT } from "@/lib/hooks/use-i18n"

export interface GuideStep {
  title: string
  body: ReactNode
  /** Optional code snippet shown in a monospace block with a copy button. */
  code?: string
}

function CodeBlock({ code }: { code: string }) {
  const { t } = useT()
  const [copied, setCopied] = useState(false)
  return (
    <div className="relative mt-3">
      <pre className="overflow-x-auto rounded-md bg-muted/60 p-3 pr-10 font-mono text-[11px] leading-relaxed whitespace-pre">
        {code}
      </pre>
      <button
        type="button"
        aria-label={t("guide.copy")}
        onClick={() => {
          navigator.clipboard.writeText(code).catch(() => undefined)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        className="absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  )
}

export function GuideDialog({
  open,
  onOpenChange,
  subject,
  steps,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** What the guide is about, e.g. "API tokens". Shown in the header. */
  subject: string
  steps: GuideStep[]
}) {
  const { t } = useT()
  const [idx, setIdx] = useState(0)

  // Always start at the first step when the dialog (re)opens. Adjusting state
  // during render (React's documented pattern) avoids an effect + the
  // cascading re-render it would cause.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setIdx(0)
  }

  if (steps.length === 0) return null
  const safeIdx = Math.min(idx, steps.length - 1)
  const step = steps[safeIdx]
  const isFirst = safeIdx === 0
  const isLast = safeIdx === steps.length - 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <div className="flex items-center gap-1.5 pr-10">
          <Sparkles className="size-3.5 text-primary shrink-0" />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium truncate">
            {subject}
          </span>
          <span className="ml-auto whitespace-nowrap text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">
            {t("guide.step").replace("{n}", String(safeIdx + 1)).replace("{total}", String(steps.length))}
          </span>
        </div>

        <DialogTitle className="text-base">{step.title}</DialogTitle>

        <div className="text-xs text-muted-foreground leading-relaxed space-y-2 max-h-[50vh] overflow-y-auto">
          {step.body}
          {step.code && <CodeBlock code={step.code} />}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={isFirst}
          >
            <ArrowLeft className="size-3" />
            {t("guide.back")}
          </Button>
          <div className="flex items-center gap-0.5">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`size-1.5 rounded-full transition-all ${
                  i === safeIdx
                    ? "bg-primary w-3"
                    : i < safeIdx
                      ? "bg-primary/40"
                      : "bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>
          {isLast ? (
            <Button
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => onOpenChange(false)}
            >
              <Check className="size-3" />
              {t("guide.done")}
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => setIdx((i) => Math.min(steps.length - 1, i + 1))}
            >
              {t("guide.next")}
              <ArrowRight className="size-3" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
