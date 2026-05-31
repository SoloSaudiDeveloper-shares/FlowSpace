"use client"

/**
 * Small "How do I use this?" corner link for a feature section header.
 *
 * Drop <SectionHelp guideId="..." /> into a section's header row (it floats
 * to the right via ml-auto). Clicking opens the matching guide from the
 * registry in a GuideDialog popup. This is the canonical way to surface help
 * next to a feature — NOT a big inline button or a wall of text.
 */

import { useState } from "react"
import { HelpCircle } from "lucide-react"
import { GuideDialog } from "@/components/shared/guide-dialog"
import { GUIDES, type GuideId } from "@/lib/guides"

export function SectionHelp({
  guideId,
  label = "How do I use this?",
  className = "",
}: {
  guideId: GuideId
  /** Override the link text (e.g. "Markdown format guide"). */
  label?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const guide = GUIDES[guideId]
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors ${className}`}
      >
        <HelpCircle className="size-3.5" />
        {label}
      </button>
      <GuideDialog
        open={open}
        onOpenChange={setOpen}
        subject={guide.label}
        steps={guide.steps}
      />
    </>
  )
}
