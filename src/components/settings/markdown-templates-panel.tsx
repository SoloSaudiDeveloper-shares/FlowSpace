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

const TEMPLATES: Template[] = [
  {
    slug: "sprint-kickoff",
    title: "Sprint kickoff",
    description:
      "Two-week sprint with goals, capacity check-in, first slate of tasks. Paste into the importer to spin up a fresh project board.",
    body: `# Sprint 24 — Two-week kickoff

> One paragraph about the sprint's theme — what we're trying to learn,
> ship, or unblock. Keep it short; you'll forget the rest anyway.

## Goals
- [ ] Goal 1 — measurable, single sentence
- [ ] Goal 2 — measurable, single sentence
- [ ] Goal 3 — measurable, single sentence

## Tasks
- [ ] Kickoff meeting !high @today
- [ ] Spec writeup @tomorrow #docs
- [ ] Implement feature A !high #release
- [ ] Implement feature B
- [ ] Code review pass !medium #review
- [ ] Demo to stakeholders @next-week
- [ ] Retrospective notes
`,
  },
  {
    slug: "content-calendar",
    title: "Content calendar (weekly)",
    description:
      "Plan out a week of content — blog, social, email — with due dates and channel tags.",
    body: `# Content week — May 27

## Goals
- [ ] Publish 1 long-form post
- [ ] 5 social posts (1/day weekdays)
- [ ] 1 newsletter

## Tasks
- [ ] Blog: "Title here" !high @2026-05-29 #blog
- [ ] Outline + research @today #blog
- [ ] First draft @tomorrow #blog
- [ ] Edit pass #blog
- [ ] Twitter thread @2026-05-28 #social
- [ ] LinkedIn post @2026-05-29 #social
- [ ] Newsletter draft @2026-05-30 #email
- [ ] Newsletter send @2026-05-31 !urgent #email
`,
  },
  {
    slug: "okr-review",
    title: "Quarterly OKR review",
    description:
      "Structured review of last quarter's OKRs + drafting next quarter's. Used as a project so each OKR can have its own task list.",
    body: `# Q2 2026 — OKR review

> 90-minute review session. Score each KR 0.0–1.0, write a one-line
> learning per objective, draft next quarter's objectives.

## Tasks
- [ ] Review O1: <objective> — score each KR !high
- [ ] Review O2: <objective> — score each KR !high
- [ ] Review O3: <objective> — score each KR !high
- [ ] Cross-cut: what surprised us this quarter? #retro
- [ ] Cross-cut: what slipped + why? #retro
- [ ] Cross-cut: what should we stop doing? #retro
- [ ] Draft Q3 objectives !urgent @next-week
- [ ] Stakeholder review of drafts
- [ ] Publish final Q3 OKRs
`,
  },
  {
    slug: "weekly-1on1",
    title: "Weekly 1:1 agenda",
    description:
      "Recurring agenda for a 1:1 with a teammate. Reuse weekly — copy + change the date.",
    body: `# 1:1 with <name> — 2026-05-29

## Quick check-in
- [ ] Energy level / blockers
- [ ] Anything off your plate I can take?

## Their topics
- [ ]
- [ ]

## My topics
- [ ]
- [ ]

## Follow-ups (from last week)
- [ ]

## Actions out of this 1:1
- [ ] @today
- [ ] @tomorrow
`,
  },
  {
    slug: "design-review",
    title: "Design review",
    description:
      "Pre-review prep + the review itself + post-review action items. Useful for committed-to-decision design reviews.",
    body: `# Design review — <project name>

## Pre-review (owner)
- [ ] Lock the brief — what are we deciding? !high
- [ ] Build the option set (3+ alternatives) #design
- [ ] Annotate trade-offs per option #design
- [ ] Send agenda 24h before

## Review session
- [ ] Walk through the brief (5 min)
- [ ] Each option, no Q (15 min)
- [ ] Open Q&A (20 min)
- [ ] Vote / decide (10 min)

## Post-review
- [ ] Write the decision doc !urgent @tomorrow #docs
- [ ] Update related projects
- [ ] Schedule kickoff for the chosen direction
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
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 px-3 py-3 text-left hover:bg-accent/30 transition-colors"
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
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1.5 shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            handleCopy()
          }}
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </button>

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
