/**
 * Collapsible cheat-sheet for FlowSpace's import/markdown format.
 *
 * The same format powers "Import from AI" and (now) Email IN's smart parsing,
 * so this guide is reused in both places. No interactivity beyond the native
 * <details> toggle, so it works as a plain (server-or-client) component.
 */

import { FileCode } from "lucide-react"

const EXAMPLE = `# Project: Launch plan
Status: active
Due: 2026-07-15
Tags: work, launch

## Tasks
- [ ] (high) @2026-06-20 Book the venue
- [ ] (medium) Send the invites
- [x] Confirm the budget

## Notes
Anything under Notes becomes the description.`

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
        <span className="ml-auto text-xs text-muted-foreground group-open:hidden">
          show
        </span>
        <span className="ml-auto text-xs text-muted-foreground hidden group-open:inline">
          hide
        </span>
      </summary>
      <div className="px-3 pb-3 space-y-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Write text in this format and FlowSpace turns it into a structured
          element. It works in <strong>Import from AI</strong> and when you{" "}
          <strong>email it in</strong> (a plain email still becomes a simple
          to-do).
        </p>
        <pre className="overflow-x-auto rounded-md bg-muted/60 p-3 text-[11px] leading-relaxed font-mono whitespace-pre">
{EXAMPLE}
        </pre>
        <ul className="space-y-1">
          {LEGEND.map((l) => (
            <li key={l.token} className="flex gap-2 text-xs">
              <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                {l.token}
              </code>
              <span className="text-muted-foreground leading-relaxed">
                {l.meaning}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}
