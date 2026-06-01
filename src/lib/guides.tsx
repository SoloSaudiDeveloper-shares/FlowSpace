"use client"

/**
 * Central registry of feature "how do I use this?" guides.
 *
 * Each guide is a subject + a list of GuideSteps. Two consumers:
 *   1. <SectionHelp guideId> — a small corner "How do I use this?" link that
 *      sits in a feature's section header and opens the guide in a popup.
 *   2. Settings → Help → Guides — a hub listing every guide; clicking opens
 *      the same popup.
 *
 * Keeping the content here (not inline in each component) means the corner
 * link and the Help hub always show the exact same thing, and there's one
 * place to edit a guide.
 */

import type { ReactNode } from "react"
import {
  KeyRound,
  FileCode,
  Bot,
  Settings2,
  Calendar,
  Activity,
  Gauge,
  Keyboard,
} from "lucide-react"
import type { GuideStep } from "@/components/shared/guide-dialog"
import { AI_PROMPT_TEMPLATE } from "@/lib/import/ai-import-parser"

export type GuideId =
  | "apiTokens"
  | "markdownFormat"
  | "telegramBot"
  | "customFields"
  | "calendarSync"
  | "serverEvents"
  | "aiResponseLength"
  | "quickAdd"

export interface GuideMeta {
  id: GuideId
  /** Short label for the Help hub list + the popup header. */
  label: string
  /** One-line description for the Help hub list. */
  blurb: string
  icon: typeof KeyRound
  steps: GuideStep[]
}

// ─── Small inline helpers reused across guide bodies ────────────────────

function Cheat({ code, desc }: { code: string; desc: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-primary">
        {code}
      </code>
      <span className="text-muted-foreground">{desc}</span>
    </div>
  )
}

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li>
      <span className="font-medium text-foreground/85">{title}</span>{" "}
      <span className="text-muted-foreground">— {children}</span>
    </li>
  )
}

const ORIGIN =
  typeof window !== "undefined" ? window.location.origin : "https://your-domain"

const FULL_MARKDOWN_EXAMPLE = `# Project: Website relaunch
Status: active
Due: 2026-09-01
Tags: web, marketing, q3

## Tasks
- [ ] (urgent) @2026-07-01 Lock the brief with stakeholders
- [ ] (high) ~6h Design the homepage
  - [ ] Hero section
  - [x] Footer
  Checklist: Design review
  - [ ] Mobile layout checked
  - [x] Brand colours applied
- [ ] (medium) @2026-07-15 Build the components
- [x] Kickoff meeting

## Notes
Anything under Notes becomes the element's description.`

// ─── The guides ─────────────────────────────────────────────────────────

export const GUIDES: Record<GuideId, GuideMeta> = {
  apiTokens: {
    id: "apiTokens",
    label: "API tokens",
    blurb: "Let scripts and integrations act as you.",
    icon: KeyRound,
    steps: [
      {
        title: "What is an API token?",
        body: (
          <p>
            A token is a long-lived key that lets a script, cron job, or tool
            act as <strong>you</strong> — without your password. Anyone who has
            it can do anything you can, so treat it like a password and never
            paste it into a public place.
          </p>
        ),
      },
      {
        title: "Issue one",
        body: (
          <p>
            In the API-tokens section, give the token a name that says what
            it&apos;s for (e.g.{" "}
            <code className="px-1 py-0.5 bg-muted/60 rounded">cron-importer</code>
            ), pick an expiry, and hit <strong>Issue</strong>. You&apos;ll see
            the full <code className="px-1 py-0.5 bg-muted/60 rounded">flws_…</code>{" "}
            value <strong>once</strong> — copy it into your password manager or
            your script&apos;s secrets right away.
          </p>
        ),
      },
      {
        title: "Use it in a request",
        body: (
          <p>
            Send the token as an{" "}
            <code className="px-1 py-0.5 bg-muted/60 rounded">Authorization: Bearer</code>{" "}
            header on any API route that supports it. Here&apos;s the
            web-clipper endpoint, which drops a pending item into your bell:
          </p>
        ),
        code: `curl -X POST ${ORIGIN}/api/clip \\
  -H "Authorization: Bearer flws_your_token_here" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Saved from my script","url":"https://example.com"}'`,
      },
      {
        title: "Keep it safe — revoke anytime",
        body: (
          <p>
            If a token leaks, or you&apos;re done with a script, click the trash
            icon next to it. It stops working <strong>immediately</strong> — no
            other tokens are affected. Set a short expiry on tokens you only
            need briefly.
          </p>
        ),
      },
    ],
  },

  markdownFormat: {
    id: "markdownFormat",
    label: "Markdown format",
    blurb: "Turn plain text into projects, pages, and tasks.",
    icon: FileCode,
    steps: [
      {
        title: "Write once, import anywhere",
        body: (
          <p>
            Write text in this format and FlowSpace turns it into a structured
            element. It works in <strong>Import from AI</strong> and when you{" "}
            <strong>email it in</strong> — and a plain email still becomes a
            simple to-do. The next steps show a full example, what each token
            means, and a ready-made AI prompt.
          </p>
        ),
      },
      {
        title: "Full example",
        body: (
          <p>
            This uses every field. Copy it, tweak the values, and import — or
            just use it as a reference.
          </p>
        ),
        code: FULL_MARKDOWN_EXAMPLE,
      },
      {
        title: "Token legend",
        body: (
          <ul className="space-y-1.5">
            <Cheat code="# Type: Title" desc="Required first line. Type = Project, Page, Todo, Canvas, Reminder, Process." />
            <Cheat code="Status:" desc="planning · active · paused · completed (projects)." />
            <Cheat code="Due: YYYY-MM-DD" desc="Optional due date (ISO)." />
            <Cheat code="Tags: a, b, c" desc="Optional, comma-separated." />
            <Cheat code="## Tasks" desc="Starts the task list (## Steps in a Process)." />
            <Cheat code="- [ ] / - [x]" desc="An open / completed task." />
            <Cheat code="  - [ ] (indent)" desc="Indent 2 spaces → a subtask of the task above." />
            <Cheat code="  Checklist: Name" desc="Indented → a checklist; indented - [ ] lines below are its items." />
            <Cheat code="~30m / ~2h" desc="Optional time estimate on a task (~1h30m too)." />
            <Cheat code="(high)" desc="Priority: urgent · high · medium · low." />
            <Cheat code="@YYYY-MM-DD" desc="Due date on a single task." />
            <Cheat code="## Notes" desc="Free text → the element's description." />
          </ul>
        ),
      },
      {
        title: "Let AI write it for you",
        body: (
          <p>
            Paste this prompt into ChatGPT / Claude after a brain-dump and it
            will output markdown in exactly this format — ready to paste into
            the importer or email in.
          </p>
        ),
        code: AI_PROMPT_TEMPLATE,
      },
      {
        title: "Tips & limits",
        body: (
          <ul className="space-y-2">
            <Row title="One element per import">
              each import builds a single element — exactly one{" "}
              <code>#</code> header line. If your notes cover several projects,
              do them one at a time, or paste each block separately.
            </Row>
            <Row title="Want a plain page, not a task list?">
              start with <code># Page: Title</code> instead of{" "}
              <code># Project:</code> — everything below the header becomes the
              page body (skip <code>## Tasks</code>).
            </Row>
            <Row title="Forgot the boxes? It still works">
              if a model drops the <code>- [ ]</code> boxes, plain bullets
              under <code>## Tasks</code> (<code>- task</code>,{" "}
              <code>* task</code>, <code>1. task</code>) are still imported as
              open tasks — but the <code>- [ ]</code> form is the reliable one.
            </Row>
          </ul>
        ),
      },
    ],
  },

  telegramBot: {
    id: "telegramBot",
    label: "Telegram bot",
    blurb: "Capture and query your work from chat.",
    icon: Bot,
    steps: [
      {
        title: "Smart capture — inline syntax",
        body: (
          <div className="space-y-2.5">
            <p>
              Text the bot anything and it becomes a todo. Sprinkle these tokens
              anywhere in the message — the bot pulls them out and tells you
              what it captured.
            </p>
            <div className="grid grid-cols-1 gap-y-1.5">
              <Cheat code="!high" desc="Set priority (urgent/high/medium/low)" />
              <Cheat code="@2026-06-15" desc="Set ISO due date" />
              <Cheat code="@tomorrow" desc="Or @today / @tomorrow / @next-week" />
              <Cheat code="#release" desc="Add a tag (alphanumeric + dashes)" />
            </div>
            <p className="text-muted-foreground/70">
              <strong className="text-foreground/80">Example:</strong>{" "}
              <code className="text-primary">ship v1 @2026-06-15 !high #release</code>{" "}
              → title <em>&ldquo;ship v1&rdquo;</em>, due 2026-06-15, priority
              high, tag <code>#release</code>.
            </p>
          </div>
        ),
      },
      {
        title: "Commands",
        body: (
          <div className="grid grid-cols-1 gap-y-1.5">
            <Cheat code="<text>" desc="Capture as todo (smart syntax)" />
            <Cheat code="/tasks" desc="Open tasks across projects" />
            <Cheat code="/deadlines 7" desc="Due in the next N days" />
            <Cheat code="/projects" desc="Projects + completion %" />
            <Cheat code="/lists" desc="Your todo lists" />
            <Cheat code="/add buy milk" desc="Quick add to default" />
            <Cheat code='/todo "Work" review PRs' desc="Add to a specific list" />
            <Cheat code="/task NorthStar Ship v1" desc="New task in a project" />
            <Cheat code="/done a1b2c3d4" desc="Mark a task/todo done" />
            <Cheat code="/help" desc="Full command list" />
          </div>
        ),
      },
      {
        title: "Paste-from-AI inbox",
        body: (
          <p>
            Brainstorm with Claude or ChatGPT, ask them to output in FlowSpace
            format, then paste the markdown to your bot. FlowSpace recognises
            the structure and <strong>queues it for your approval</strong>{" "}
            instead of acting immediately — review it on the home page and click
            Approve. Grab the ready-made prompt from the home page →
            &ldquo;Import from AI&rdquo; → &ldquo;Copy AI prompt&rdquo;.
          </p>
        ),
        code: `# Project: NorthStar
Status: active
Due: 2026-07-15

## Tasks
- [ ] (high) Extract toolkit components
- [ ] @2026-06-15 Stage toolkits in Hub`,
      },
      {
        title: "What you can do",
        body: (
          <ul className="space-y-2">
            <Row title="Capture ideas on the go">
              text the bot anything — it becomes a todo in your chosen list.
            </Row>
            <Row title="Query your work from anywhere">
              <code>/tasks</code>, <code>/deadlines</code>,{" "}
              <code>/projects</code>, <code>/lists</code> — live read-only
              summaries.
            </Row>
            <Row title="Mark things done">
              <code>/done &lt;id-prefix&gt;</code> — first 4 chars of the ID
              shown after each task are enough.
            </Row>
            <Row title="Push a whole project structure">
              paste FlowSpace markdown; it queues for your approval.
            </Row>
            <Row title="Choose where captures land">
              set the target list in the Telegram section.
            </Row>
          </ul>
        ),
      },
    ],
  },

  customFields: {
    id: "customFields",
    label: "Custom fields",
    blurb: "Add your own metadata to elements and tasks.",
    icon: Settings2,
    steps: [
      {
        title: "What are custom fields?",
        body: (
          <p>
            Extra columns you bolt onto your elements or tasks — anything that
            isn&apos;t already built in. Estimated hours, client name, repo URL,
            confidence rating, a checkbox for &ldquo;ready for review&rdquo;.
            Once you define a field it shows up on the task detail sheet (or
            element panel) for whichever element types you scoped it to.
          </p>
        ),
      },
      {
        title: "The field types",
        body: (
          <ul className="space-y-1.5">
            <Row title="Text / Long text">free-form strings.</Row>
            <Row title="Number">integers or decimals, e.g. an estimate.</Row>
            <Row title="Date">review date, kickoff, etc.</Row>
            <Row title="Checkbox">a yes/no flag.</Row>
            <Row title="Select / Multi-select">fixed options (add them after creating).</Row>
            <Row title="URL / Email">typed input with validation.</Row>
            <Row title="Rating">1–5 stars.</Row>
          </ul>
        ),
      },
      {
        title: "Scope — where a field shows up",
        body: (
          <p>
            When you create a field you choose its scope:{" "}
            <strong className="text-foreground/80">All elements</strong>,{" "}
            <strong className="text-foreground/80">a specific element type</strong>{" "}
            (only Projects, only Tasks…), or{" "}
            <strong className="text-foreground/80">a single project</strong>. The
            field then appears on the detail panel of everything that matches.
          </p>
        ),
      },
    ],
  },

  calendarSync: {
    id: "calendarSync",
    label: "Calendar sync",
    blurb: "Push due dates to Google Calendar.",
    icon: Calendar,
    steps: [
      {
        title: "What gets synced",
        body: (
          <p>
            Once connected, FlowSpace pushes anything with a <strong>date</strong>{" "}
            to your Google Calendar as an <strong>all-day event</strong>:
          </p>
        ),
      },
      {
        title: "The four sources",
        body: (
          <ul className="space-y-1.5">
            <Row title="Tasks">any task with a due date.</Row>
            <Row title="To-dos">to-do items with a due date.</Row>
            <Row title="Reminders">the reminder&apos;s date/time.</Row>
            <Row title="Project deadlines">a project&apos;s own due date.</Row>
          </ul>
        ),
      },
      {
        title: "How to make one show up",
        body: (
          <p>
            Create a task and give it a <strong>due date</strong> (or add a
            reminder, or set a project&apos;s due date). Within ~5 minutes it
            appears in Google Calendar — or hit <strong>Sync now</strong> in the
            Calendar sync section to push immediately and see the count.
          </p>
        ),
      },
      {
        title: "One-way + cleanup",
        body: (
          <p>
            Sync is one-way (FlowSpace → Google). Editing the event in Google
            won&apos;t change FlowSpace. Remove the due date or delete the item
            and the matching event disappears on the next sync. Open Google
            Calendar on your phone or the web to see them.
          </p>
        ),
      },
    ],
  },

  aiResponseLength: {
    id: "aiResponseLength",
    label: "AI response length",
    blurb: "Control how long AI answers can get (max tokens).",
    icon: Gauge,
    steps: [
      {
        title: "What is “max tokens”?",
        body: (
          <p>
            A token is a chunk of text — roughly{" "}
            <strong>¾ of a word</strong> (so ~1,000 tokens ≈ 750 words). The
            number is the <strong>maximum length</strong> an AI answer is
            allowed to reach. Raise it for longer answers, lower it to keep
            things short and fast.
          </p>
        ),
      },
      {
        title: "Why the defaults are generous",
        body: (
          <p>
            Some models (e.g. <strong>Gemini 2.5 Flash</strong>) spend hidden
            &ldquo;thinking&rdquo; tokens that count against this same cap. If
            the budget is too small, thinking eats it and the visible answer
            gets cut off mid-sentence. The defaults leave plenty of room. A
            simpler local model just stops at the natural end, so a high
            ceiling does no harm.
          </p>
        ),
      },
      {
        title: "The four fields",
        body: (
          <ul className="space-y-1.5">
            <Row title="Summarize · One line">a single-sentence summary (default 1024).</Row>
            <Row title="Summarize · Short">3–5 bullet points (default 2048).</Row>
            <Row title="Summarize · Detailed">one or two full paragraphs (default 4096).</Row>
            <Row title="Other actions">expand, improve, continue, generate to-dos (default 2048).</Row>
          </ul>
        ),
      },
      {
        title: "Tuning tips",
        body: (
          <p>
            If a summary still comes out truncated, <strong>raise</strong> that
            field. If answers are longer or slower than you want,{" "}
            <strong>lower</strong> it. Changes apply to the next AI action —
            no reload needed.
          </p>
        ),
      },
    ],
  },

  serverEvents: {
    id: "serverEvents",
    label: "Server events",
    blurb: "The admin audit log explained.",
    icon: Activity,
    steps: [
      {
        title: "What are server events?",
        body: (
          <p>
            The audit log of everything important the server did. Each entry
            records <strong>when</strong> something happened,{" "}
            <strong>what</strong> happened, and <strong>who</strong> triggered
            it. Use it to debug issues, spot suspicious activity, or confirm a
            deploy succeeded.
          </p>
        ),
      },
      {
        title: "Event types you'll see",
        body: (
          <ul className="space-y-1.5">
            <Row title="server_start / server_stop">container booted or shut down. After a deploy you should see a fresh start.</Row>
            <Row title="backup_completed / backup_failed">scheduled backups. Red = investigate.</Row>
            <Row title="user_login / user_logout">session activity, for security review.</Row>
            <Row title="user_created">new signup. Cross-check the Users tab.</Row>
            <Row title="permission_changed">admin or role flips. High-impact.</Row>
            <Row title="error / warning">server-side problems logged for investigation.</Row>
          </ul>
        ),
      },
    ],
  },

  quickAdd: {
    id: "quickAdd",
    label: "Quick add & shortcuts",
    blurb: "Type tasks in plain language; drive the board with the keyboard.",
    icon: Keyboard,
    steps: [
      {
        title: "Quick add with natural language",
        body: (
          <p>
            Press <code className="px-1 py-0.5 bg-muted/60 rounded">c</code> anywhere
            in a project to open the quick-add bar, then type the task the way
            you&apos;d say it. FlowSpace pulls out the due date and priority and
            files the rest as the title. It also works in the inline{" "}
            <strong>Add task</strong> boxes on the List and Board.
          </p>
        ),
      },
      {
        title: "What it understands",
        body: (
          <ul className="space-y-1.5">
            <Row title="Priority">
              <code className="px-1 py-0.5 bg-muted/60 rounded">#urgent</code>{" "}
              <code className="px-1 py-0.5 bg-muted/60 rounded">#high</code>{" "}
              <code className="px-1 py-0.5 bg-muted/60 rounded">#medium</code>{" "}
              <code className="px-1 py-0.5 bg-muted/60 rounded">#low</code>
            </Row>
            <Row title="When">
              <code className="px-1 py-0.5 bg-muted/60 rounded">today</code>,{" "}
              <code className="px-1 py-0.5 bg-muted/60 rounded">tomorrow</code>,{" "}
              <code className="px-1 py-0.5 bg-muted/60 rounded">next week</code>,
              a weekday like <code className="px-1 py-0.5 bg-muted/60 rounded">fri</code>,
              or an exact date <code className="px-1 py-0.5 bg-muted/60 rounded">2026-06-10</code>
            </Row>
            <Row title="Example">
              <code className="px-1 py-0.5 bg-muted/60 rounded">Submit report fri #high</code>{" "}
              → a high-priority task &ldquo;Submit report&rdquo; due this Friday
            </Row>
          </ul>
        ),
      },
      {
        title: "Keyboard shortcuts",
        body: (
          <div className="space-y-1.5">
            <Cheat code="1 – 6" desc="switch view (Overview, List, Board, Calendar, Gantt, Table)" />
            <Cheat code="c" desc="open quick-add" />
            <Cheat code="/" desc="search" />
            <Cheat code="f" desc="toggle the filter bar" />
            <Cheat code="j / k" desc="move the cursor down / up the List (↓ / ↑ also work)" />
            <Cheat code="Enter / e" desc="open the task under the cursor" />
            <Cheat code="Space" desc="mark the task under the cursor complete / incomplete" />
            <p className="pt-1 text-muted-foreground">
              Shortcuts pause whenever you&apos;re typing in a field, so they
              never get in the way.
            </p>
          </div>
        ),
      },
    ],
  },
}

/** Ordered list for the Help → Guides hub. */
export const GUIDE_LIST: GuideMeta[] = [
  GUIDES.markdownFormat,
  GUIDES.quickAdd,
  GUIDES.telegramBot,
  GUIDES.calendarSync,
  GUIDES.customFields,
  GUIDES.aiResponseLength,
  GUIDES.apiTokens,
  GUIDES.serverEvents,
]
