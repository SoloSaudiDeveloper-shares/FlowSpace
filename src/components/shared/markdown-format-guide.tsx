"use client"

/**
 * Instructional popup for FlowSpace's import/markdown format.
 *
 * Reused by "Import from AI" and Email IN. Rendered as a single trigger
 * button that opens a tour-style GuideDialog (NOT an inline wall of text):
 *   - what the format is for
 *   - a full worked example using every field (one-click copy)
 *   - the token legend
 *   - the "AI prompt" you paste into ChatGPT/Claude so it outputs the
 *     correct format (one-click copy)
 */

import { useState } from "react"
import { FileCode } from "lucide-react"
import { AI_PROMPT_TEMPLATE } from "@/lib/import/ai-import-parser"
import { GuideDialog, type GuideStep } from "@/components/shared/guide-dialog"

const FULL_EXAMPLE = `# Project: Website relaunch
Status: active
Due: 2026-09-01
Tags: web, marketing, q3

## Tasks
- [ ] (urgent) @2026-07-01 Lock the brief with stakeholders
- [ ] (high) Design the homepage
- [ ] (medium) @2026-07-15 Build the components
- [ ] Write the launch copy
- [x] Kickoff meeting

## Notes
Anything under Notes becomes the element's description.
Multiple paragraphs are fine, and so are
- bullet lists.`

const LEGEND: { token: string; meaning: string }[] = [
  { token: "# Type: Title", meaning: "Required first line. Type = Project, Page, Todo, Canvas, Reminder, or Process." },
  { token: "Status:", meaning: "planning · active · paused · completed (projects only)." },
  { token: "Due: YYYY-MM-DD", meaning: "Optional due date (ISO format)." },
  { token: "Tags: a, b, c", meaning: "Optional, comma-separated." },
  { token: "## Tasks", meaning: "Starts the task list (use ## Steps inside a Process)." },
  { token: "- [ ] / - [x]", meaning: "An open / completed task." },
  { token: "(high)", meaning: "Optional priority: urgent · high · medium · low." },
  { token: "@YYYY-MM-DD", meaning: "Optional due date on a single task." },
  { token: "## Notes", meaning: "Free text — becomes the element's description." },
]

const STEPS: GuideStep[] = [
  {
    title: "Write once, import anywhere",
    body: (
      <p>
        Write text in this format and FlowSpace turns it into a structured
        element. It works in <strong>Import from AI</strong> and when you{" "}
        <strong>email it in</strong> — and a plain email still becomes a simple
        to-do. The next steps show a full example, what each token means, and a
        ready-made AI prompt.
      </p>
    ),
  },
  {
    title: "Full example",
    body: (
      <p>
        This uses every field. Copy it, tweak the values, and import — or just
        use it as a reference.
      </p>
    ),
    code: FULL_EXAMPLE,
  },
  {
    title: "Token legend",
    body: (
      <ul className="space-y-1.5">
        {LEGEND.map((l) => (
          <li key={l.token} className="flex gap-2">
            <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
              {l.token}
            </code>
            <span className="leading-relaxed">{l.meaning}</span>
          </li>
        ))}
      </ul>
    ),
  },
  {
    title: "Let AI write it for you",
    body: (
      <p>
        Paste this prompt into ChatGPT / Claude after a brain-dump and it will
        output markdown in exactly this format — ready to paste into the
        importer or email in.
      </p>
    ),
    code: AI_PROMPT_TEMPLATE,
  },
]

export function MarkdownFormatGuide({
  className = "",
}: {
  /** @deprecated kept for call-site compatibility; no longer used. */
  defaultOpen?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex w-full items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-sm font-medium hover:bg-accent/30 transition-colors ${className}`}
      >
        <FileCode className="size-4 text-primary" />
        Markdown format guide
        <span className="ml-auto text-xs text-muted-foreground">open</span>
      </button>
      <GuideDialog
        open={open}
        onOpenChange={setOpen}
        subject="Markdown format"
        steps={STEPS}
      />
    </>
  )
}
