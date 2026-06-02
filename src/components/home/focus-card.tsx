"use client"

/**
 * AI "what to work on today" card for the home dashboard.
 *
 * Calls getFocusSuggestion() which asks the user's configured AI provider to
 * rank their open tasks by deadline + priority and return the top few with a
 * one-line reason. Loads once on mount; a refresh button re-asks. Degrades
 * gracefully when no AI provider is configured or there's nothing to do.
 */

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, RefreshCw, ArrowUpRight, Settings2, CheckCircle2, AlertCircle } from "lucide-react"
import { getFocusSuggestion, type FocusSuggestion } from "@/lib/actions/dashboard-actions"

export function FocusCard() {
  const router = useRouter()
  const [state, setState] = useState<FocusSuggestion | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setState(await getFocusSuggestion())
    } catch {
      setState({ status: "error" })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="rounded-xl border bg-card p-5 relative overflow-hidden">
      {/* subtle gradient halo */}
      <div
        className="absolute inset-0 opacity-60 pointer-events-none"
        style={{ background: "radial-gradient(circle at top right, #a78bfa14, transparent 55%)" }}
      />
      <div className="relative flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="size-3.5 text-primary" />
          Focus for today
        </h2>
        <button
          onClick={load}
          disabled={loading}
          className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          title="Regenerate"
          aria-label="Regenerate suggestions"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="relative">
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 rounded-lg bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : state?.status === "ok" ? (
          <div className="space-y-1.5">
            {state.items.map((item, i) => (
              <button
                key={i}
                onClick={() => item.href && router.push(item.href)}
                disabled={!item.href}
                className="group w-full flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-accent transition-colors disabled:cursor-default"
              >
                <span className="mt-0.5 size-5 shrink-0 rounded-full bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center tabular-nums">
                  {i + 1}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">{item.title}</span>
                  {item.why && (
                    <span className="block text-xs text-muted-foreground mt-0.5">{item.why}</span>
                  )}
                </span>
                {item.href && (
                  <ArrowUpRight className="size-3.5 shrink-0 mt-1 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
            ))}
          </div>
        ) : state?.status === "empty" ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CheckCircle2 className="size-7 text-emerald-400 mb-2" />
            <p className="text-sm">You're all clear — no open tasks right now.</p>
          </div>
        ) : state?.status === "no_ai" ? (
          <button
            onClick={() => router.push("/settings#ai")}
            className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-3 text-left hover:bg-accent transition-colors"
          >
            <Settings2 className="size-4 text-muted-foreground shrink-0" />
            <span className="flex-1 text-sm text-muted-foreground">
              Connect an AI provider in Settings to get a daily focus suggestion.
            </span>
            <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertCircle className="size-6 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Couldn't generate a suggestion.</p>
            <button onClick={load} className="text-xs text-primary mt-1 hover:underline">
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
