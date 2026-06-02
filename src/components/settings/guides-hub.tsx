"use client"

/**
 * Settings → Help → Guides hub.
 *
 * Lists every feature guide from the registry; clicking one opens it in the
 * same GuideDialog popup that the in-feature "How do I use this?" corner links
 * use. One source of truth, two entry points.
 */

import { useState } from "react"
import { ChevronRight } from "lucide-react"
import { GuideDialog } from "@/components/shared/guide-dialog"
import { useGuides, type GuideId } from "@/lib/guides"

export function GuidesHub() {
  const { guides, list } = useGuides()
  const [openId, setOpenId] = useState<GuideId | null>(null)
  const active = openId ? guides[openId] : null
  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2">
        {list.map((g) => {
          const Icon = g.icon
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setOpenId(g.id)}
              className="flex items-start gap-3 rounded-lg border bg-card px-3 py-2.5 text-left hover:bg-accent/30 transition-colors"
            >
              <span className="size-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{g.label}</span>
                <span className="block text-[11px] text-muted-foreground leading-snug">
                  {g.blurb}
                </span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground/50 shrink-0 mt-1" />
            </button>
          )
        })}
      </div>
      {active && (
        <GuideDialog
          open={!!openId}
          onOpenChange={(o) => {
            if (!o) setOpenId(null)
          }}
          subject={active.label}
          steps={active.steps}
        />
      )}
    </>
  )
}
