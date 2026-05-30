"use client"

/**
 * Settings → Help → Markdown templates.
 *
 * Ready-to-paste markdown blueprints for common project shapes
 * (sprint, content calendar, OKR review, 1:1 weekly, design review).
 *
 * Each card:
 *   - title + short "when to use this" description
 *   - the markdown body, expandable
 *   - "Copy markdown" — copies the body to the clipboard, ready to
 *     paste into the home-page "Paste markdown to import" composer or
 *     a Telegram bot message
 *   - "Open the importer" — links to the AI-import spec page
 *
 * The templates here mirror the existing AI-import format
 * (docs/AI_IMPORT_FORMAT.md) so the parser already understands them.
 */

import { useState } from "react"
import { Copy, Check, ChevronDown, FileCode, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface Template {
  slug: string
  title: string
  description: string
  body: string
}

// NOTE: these bodies MUST match the AI-import parser (src/lib/import/
// ai-import-parser.ts): header is `# <Type>: <Title>`, priority is
// `(high)` in parens, dates are ISO `@YYYY-MM-DD`, tags go on a `Tags:`
// line, and only `## Tasks` / `## Notes` are recognized sections. Earlier
// versions used `!high` / `@today` / `#tag` and a header with no Type,
// which the parser rejected (it returned null — "didn't recognize it").
const TEMPLATES: Template[] = [
  {
    slug: "sprint-kickoff",
    title: "Sprint kickoff",
    description:
      "Two-week sprint with goals + the first slate of tasks. Paste into the importer to spin up a fresh project board.",
    body: `# Project: Sprint kickoff
Status: active
Tags: sprint, planning

## Tasks
- [ ] (high) Kickoff meeting
- [ ] Spec writeup
- [ ] (high) Implement feature A
- [ ] Implement feature B
- [ ] (medium) Code review pass
- [ ] Demo to stakeholders
- [ ] Retrospective notes

## Notes
Two-week sprint. One paragraph about the theme — what we're trying to
learn, ship, or unblock.

Goals:
- Goal 1 — measurable, single sentence
- Goal 2 — measurable, single sentence
- Goal 3 — measurable, single sentence
`,
  },
  {
    slug: "content-calendar",
    title: "Content calendar (weekly)",
    description:
      "Plan a week of content — blog, social, email — as a project board.",
    body: `# Project: Content calendar (weekly)
Status: active
Tags: content, marketing

## Tasks
- [ ] (high) Blog: "Title here"
- [ ] Outline + research
- [ ] First draft
- [ ] Edit pass
- [ ] Twitter thread
- [ ] LinkedIn post
- [ ] Newsletter draft
- [ ] (urgent) Newsletter send

## Notes
Plan a week of content. Goals: 1 long-form post, 5 social posts
(1/weekday), 1 newsletter.
`,
  },
  {
    slug: "okr-review",
    title: "Quarterly OKR review",
    description:
      "Structured review of last quarter's OKRs + drafting next quarter's, as a project so each step is a task.",
    body: `# Project: Quarterly OKR review
Status: active
Tags: okr, review

## Tasks
- [ ] (high) Review O1: <objective> — score each KR
- [ ] (high) Review O2: <objective> — score each KR
- [ ] (high) Review O3: <objective> — score each KR
- [ ] Cross-cut: what surprised us this quarter?
- [ ] Cross-cut: what slipped + why?
- [ ] Cross-cut: what should we stop doing?
- [ ] (urgent) Draft next quarter's objectives
- [ ] Stakeholder review of drafts
- [ ] Publish final OKRs

## Notes
90-minute review session. Score each KR 0.0–1.0, write a one-line
learning per objective, draft next quarter's objectives.
`,
  },
  {
    slug: "weekly-1on1",
    title: "Weekly 1:1 agenda",
    description:
      "Recurring agenda for a 1:1 with a teammate. Reuse weekly.",
    body: `# Project: Weekly 1:1 agenda
Status: active
Tags: 1on1

## Tasks
- [ ] Energy level / blockers
- [ ] Anything off your plate I can take?
- [ ] Their topic 1
- [ ] Their topic 2
- [ ] My topic 1
- [ ] My topic 2
- [ ] Follow-ups from last week
- [ ] Actions out of this 1:1

## Notes
Recurring 1:1 agenda. Reuse weekly — copy and adjust.
`,
  },
  {
    slug: "design-review",
    title: "Design review",
    description:
      "Pre-review prep + the review itself + post-review action items.",
    body: `# Project: Design review
Status: active
Tags: design, review

## Tasks
- [ ] (high) Lock the brief — what are we deciding?
- [ ] Build the option set (3+ alternatives)
- [ ] Annotate trade-offs per option
- [ ] Send agenda 24h before
- [ ] Walk through the brief (5 min)
- [ ] Each option, no questions (15 min)
- [ ] Open Q&A (20 min)
- [ ] Vote / decide (10 min)
- [ ] (urgent) Write the decision doc
- [ ] Update related projects
- [ ] Schedule kickoff for the chosen direction

## Notes
Pre-review prep + the review session itself + post-review action items.
`,
  },
]

export function MarkdownTemplatesPanel() {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-md border border-primary/30 bg-primary/5">
        <FileCode className="size-3.5 text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-primary/90 leading-relaxed">
          Ready-to-paste blueprints. Copy one, paste it into the
          home-page <strong>Paste markdown to import</strong> composer
          (or text it to your Telegram bot), and FlowSpace turns it into
          a project board with tasks, priorities, due dates, and tags.
          See{" "}
          <a href="/templates" className="underline underline-offset-2 hover:text-foreground">
            /templates
          </a>{" "}
          for saved templates.
        </div>
      </div>

      <div className="space-y-2">
        {TEMPLATES.map((t) => (
          <TemplateCard key={t.slug} template={t} />
        ))}
      </div>
    </div>
  )
}

function TemplateCard({ template }: { template: Template }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard
      .writeText(template.body)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
        toast.success(`Copied "${template.title}" markdown`)
      })
      .catch(() => toast.error("Couldn't copy. Try the textarea below."))
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
      {/* Header row — a div (not a button) so the Copy button can live
          inside without nesting <button> in <button> (invalid HTML /
          hydration error). The expand toggle is its own button. */}
      <div className="w-full flex items-start gap-3 px-3 py-3 hover:bg-accent/30 transition-colors">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-start gap-3 flex-1 min-w-0 text-left"
          aria-expanded={open}
        >
          <ChevronDown
            className={`size-4 text-muted-foreground shrink-0 mt-0.5 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{template.title}</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
              {template.description}
            </p>
          </div>
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1.5 shrink-0"
          onClick={handleCopy}
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>

      {open && (
        <div className="border-t bg-background/40">
          <pre className="text-[11px] font-mono leading-relaxed text-foreground/85 px-3 py-3 overflow-x-auto whitespace-pre-wrap">
            {template.body}
          </pre>
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-border/40">
            <a
              href="/templates"
              className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <ExternalLink className="size-3" />
              Browse saved templates
            </a>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={handleCopy}
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              {copied ? "Copied" : "Copy markdown"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
