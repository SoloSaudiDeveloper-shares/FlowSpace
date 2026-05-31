"use client"

/**
 * Collapsible cheat-sheet for FlowSpace's import/markdown format.
 *
 * Reused by "Import from AI" and Email IN. Gives the user everything they
 * (or an AI) need to produce markdown FlowSpace recognizes:
 *   - the token legend
 *   - a full worked example using every field (one-click copy)
 *   - the "AI prompt" you paste into ChatGPT/Claude so it outputs the
 *     correct format (one-click copy)
 */

import { useState } from "react"
import { FileCode, Copy, Check, Sparkles } from "lucide-react"
import { AI_PROMPT_TEMPLATE } from "@/lib/import/ai-import-parser"

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

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          })
          .catch(() => undefined)
      }}
      className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[11px] hover:bg-accent/40 transition-colors shrink-0"
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? "Copied" : label}
    </button>
  )
}

export function MarkdownFormatGuide({
  defaultOpen = false,
  className = "",
}: {
  defaultOpen?: boolean
  className?: string
}) {
  return (
    <details
      open={defaultOpen}
      className={`group rounded-lg border border-border/60 bg-card/40 text-sm ${className}`}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 font-medium select-none hover:bg-accent/30 rounded-lg">
        <FileCode className="size-4 text-primary" />
        Markdown format guide
        <span className="ml-auto text-xs text-muted-foreground group-open:hidden">show</span>
        <span className="ml-auto text-xs text-muted-foreground hidden group-open:inline">hide</span>
      </summary>

      <div className="px-3 pb-3 space-y-4 max-h-[60vh] overflow-y-auto">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Write text in this format and FlowSpace turns it into a structured
          element. It works in <strong>Import from AI</strong> and when you{" "}
          <strong>email it in</strong> (a plain email still becomes a simple
          to-do).
        </p>

        {/* Full worked example */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Full example
            </span>
            <CopyButton text={FULL_EXAMPLE} label="Copy example" />
          </div>
          <pre className="overflow-x-auto rounded-md bg-muted/60 p-3 text-[11px] leading-relaxed font-mono whitespace-pre">
{FULL_EXAMPLE}
          </pre>
        </div>

        {/* Token legend */}
        <ul className="space-y-1">
          {LEGEND.map((l) => (
            <li key={l.token} className="flex gap-2 text-xs">
              <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                {l.token}
              </code>
              <span className="text-muted-foreground leading-relaxed">{l.meaning}</span>
            </li>
          ))}
        </ul>

        {/* AI prompt — the "give this to ChatGPT/Claude" shortcut */}
        <div className="space-y-1.5 rounded-md border border-primary/20 bg-primary/5 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-primary/90">
              <Sparkles className="size-3.5" />
              AI prompt — covers everything
            </span>
            <CopyButton text={AI_PROMPT_TEMPLATE} label="Copy prompt" />
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Paste this into ChatGPT / Claude after a brain-dump and it will
            output markdown in exactly this format — ready to paste into the
            importer or email in.
          </p>
        </div>
      </div>
    </details>
  )
}
