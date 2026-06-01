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
import { useT } from "@/lib/hooks/use-i18n"

interface Template {
  slug: string
  /** Translation keys for the card title + "when to use" blurb. */
  titleKey: string
  descKey: string
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
    titleKey: "settings.md.tpl.sprint.title",
    descKey: "settings.md.tpl.sprint.desc",
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
    titleKey: "settings.md.tpl.content.title",
    descKey: "settings.md.tpl.content.desc",
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
    titleKey: "settings.md.tpl.okr.title",
    descKey: "settings.md.tpl.okr.desc",
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
    titleKey: "settings.md.tpl.oneOnOne.title",
    descKey: "settings.md.tpl.oneOnOne.desc",
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
    titleKey: "settings.md.tpl.design.title",
    descKey: "settings.md.tpl.design.desc",
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
  const { t } = useT()
  // The intro carries a {link} token; split around it so the /templates link
  // renders as a real anchor.
  const intro = t("settings.md.intro")
  const [introBefore, introAfter] = intro.split("{link}")
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-md border border-primary/30 bg-primary/5">
        <FileCode className="size-3.5 text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-primary/90 leading-relaxed">
          {introBefore}
          <a href="/templates" className="underline underline-offset-2 hover:text-foreground">
            /templates
          </a>
          {introAfter}
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
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard
      .writeText(template.body)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
        toast.success(t("settings.md.copiedToast").replace("{title}", t(template.titleKey)))
      })
      .catch(() => toast.error(t("settings.md.copyFailed")))
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
            <p className="text-sm font-medium">{t(template.titleKey)}</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
              {t(template.descKey)}
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
          {copied ? t("settings.md.copied") : t("settings.md.copy")}
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
              {t("settings.md.browseSaved")}
            </a>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={handleCopy}
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              {copied ? t("settings.md.copied") : t("settings.md.copyMarkdown")}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
