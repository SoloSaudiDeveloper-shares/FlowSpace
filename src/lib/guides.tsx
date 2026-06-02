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
 *
 * Content is localized: call `useGuides()` (a hook) to get the guides built
 * with the active locale's strings. The `icon`, `id`, and any literal code /
 * syntax tokens stay untranslated; everything user-visible flows through
 * `t("guides.<id>.<key>")`.
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
import { useT } from "@/lib/hooks/use-i18n"

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

// ─── The guides (localized via useGuides) ───────────────────────────────

/**
 * Build the full guide registry with the active locale's strings.
 *
 * Returns both the keyed record (`guides`) for direct lookup and the ordered
 * `list` used by the Help hub. Prose flows through `t("guides.<id>.<key>")`;
 * the code blocks and example constants stay literal.
 */
export function useGuides(): { guides: Record<GuideId, GuideMeta>; list: GuideMeta[] } {
  const { t } = useT()

  const guides: Record<GuideId, GuideMeta> = {
    apiTokens: {
      id: "apiTokens",
      label: t("guides.apiTokens.label"),
      blurb: t("guides.apiTokens.blurb"),
      icon: KeyRound,
      steps: [
        {
          title: t("guides.apiTokens.step1.title"),
          body: <p>{t("guides.apiTokens.step1.p1")}</p>,
        },
        {
          title: t("guides.apiTokens.step2.title"),
          body: (
            <p>
              {t("guides.apiTokens.step2.p1a")}{" "}
              <code className="px-1 py-0.5 bg-muted/60 rounded">cron-importer</code>
              {t("guides.apiTokens.step2.p1b")}{" "}
              <code className="px-1 py-0.5 bg-muted/60 rounded">flws_…</code>{" "}
              {t("guides.apiTokens.step2.p1c")}
            </p>
          ),
        },
        {
          title: t("guides.apiTokens.step3.title"),
          body: (
            <p>
              {t("guides.apiTokens.step3.p1a")}{" "}
              <code className="px-1 py-0.5 bg-muted/60 rounded">Authorization: Bearer</code>{" "}
              {t("guides.apiTokens.step3.p1b")}
            </p>
          ),
          code: `curl -X POST ${ORIGIN}/api/clip \\
  -H "Authorization: Bearer flws_your_token_here" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Saved from my script","url":"https://example.com"}'`,
        },
        {
          title: t("guides.apiTokens.step4.title"),
          body: <p>{t("guides.apiTokens.step4.p1")}</p>,
        },
      ],
    },

    markdownFormat: {
      id: "markdownFormat",
      label: t("guides.markdownFormat.label"),
      blurb: t("guides.markdownFormat.blurb"),
      icon: FileCode,
      steps: [
        {
          title: t("guides.markdownFormat.step1.title"),
          body: <p>{t("guides.markdownFormat.step1.p1")}</p>,
        },
        {
          title: t("guides.markdownFormat.step2.title"),
          body: <p>{t("guides.markdownFormat.step2.p1")}</p>,
          code: FULL_MARKDOWN_EXAMPLE,
        },
        {
          title: t("guides.markdownFormat.step3.title"),
          body: (
            <ul className="space-y-1.5">
              <Cheat code="# Type: Title" desc={t("guides.markdownFormat.step3.typeTitle")} />
              <Cheat code="Status:" desc={t("guides.markdownFormat.step3.status")} />
              <Cheat code="Due: YYYY-MM-DD" desc={t("guides.markdownFormat.step3.due")} />
              <Cheat code="Tags: a, b, c" desc={t("guides.markdownFormat.step3.tags")} />
              <Cheat code="## Tasks" desc={t("guides.markdownFormat.step3.tasks")} />
              <Cheat code="- [ ] / - [x]" desc={t("guides.markdownFormat.step3.checkbox")} />
              <Cheat code="  - [ ] (indent)" desc={t("guides.markdownFormat.step3.indent")} />
              <Cheat code="  Checklist: Name" desc={t("guides.markdownFormat.step3.checklist")} />
              <Cheat code="~30m / ~2h" desc={t("guides.markdownFormat.step3.estimate")} />
              <Cheat code="(high)" desc={t("guides.markdownFormat.step3.priority")} />
              <Cheat code="@YYYY-MM-DD" desc={t("guides.markdownFormat.step3.taskDue")} />
              <Cheat code="## Notes" desc={t("guides.markdownFormat.step3.notes")} />
            </ul>
          ),
        },
        {
          title: t("guides.markdownFormat.step4.title"),
          body: <p>{t("guides.markdownFormat.step4.p1")}</p>,
          code: AI_PROMPT_TEMPLATE,
        },
        {
          title: t("guides.markdownFormat.step5.title"),
          body: (
            <ul className="space-y-2">
              <Row title={t("guides.markdownFormat.step5.row1.title")}>
                {t("guides.markdownFormat.step5.row1.a")}{" "}
                <code>#</code> {t("guides.markdownFormat.step5.row1.b")}
              </Row>
              <Row title={t("guides.markdownFormat.step5.row2.title")}>
                {t("guides.markdownFormat.step5.row2.a")}{" "}
                <code># Page: Title</code> {t("guides.markdownFormat.step5.row2.b")}{" "}
                <code># Project:</code> {t("guides.markdownFormat.step5.row2.c")}{" "}
                <code>## Tasks</code>
                {t("guides.markdownFormat.step5.row2.d")}
              </Row>
              <Row title={t("guides.markdownFormat.step5.row3.title")}>
                {t("guides.markdownFormat.step5.row3.a")}{" "}
                <code>- [ ]</code> {t("guides.markdownFormat.step5.row3.b")}{" "}
                <code>## Tasks</code> (<code>- task</code>,{" "}
                <code>* task</code>, <code>1. task</code>){" "}
                {t("guides.markdownFormat.step5.row3.c")}{" "}
                <code>- [ ]</code> {t("guides.markdownFormat.step5.row3.d")}
              </Row>
            </ul>
          ),
        },
      ],
    },

    telegramBot: {
      id: "telegramBot",
      label: t("guides.telegramBot.label"),
      blurb: t("guides.telegramBot.blurb"),
      icon: Bot,
      steps: [
        {
          title: t("guides.telegramBot.step1.title"),
          body: (
            <div className="space-y-2.5">
              <p>{t("guides.telegramBot.step1.p1")}</p>
              <div className="grid grid-cols-1 gap-y-1.5">
                <Cheat code="!high" desc={t("guides.telegramBot.step1.priority")} />
                <Cheat code="@2026-06-15" desc={t("guides.telegramBot.step1.due")} />
                <Cheat code="@tomorrow" desc={t("guides.telegramBot.step1.relative")} />
                <Cheat code="#release" desc={t("guides.telegramBot.step1.tag")} />
              </div>
              <p className="text-muted-foreground/70">
                <strong className="text-foreground/80">{t("guides.telegramBot.step1.exampleLabel")}</strong>{" "}
                <code className="text-primary">ship v1 @2026-06-15 !high #release</code>{" "}
                {t("guides.telegramBot.step1.exampleResultA")}{" "}
                <em>&ldquo;ship v1&rdquo;</em>
                {t("guides.telegramBot.step1.exampleResultB")}{" "}
                <code>#release</code>.
              </p>
            </div>
          ),
        },
        {
          title: t("guides.telegramBot.step2.title"),
          body: (
            <div className="grid grid-cols-1 gap-y-1.5">
              <Cheat code="<text>" desc={t("guides.telegramBot.step2.text")} />
              <Cheat code="/tasks" desc={t("guides.telegramBot.step2.tasks")} />
              <Cheat code="/deadlines 7" desc={t("guides.telegramBot.step2.deadlines")} />
              <Cheat code="/projects" desc={t("guides.telegramBot.step2.projects")} />
              <Cheat code="/lists" desc={t("guides.telegramBot.step2.lists")} />
              <Cheat code="/add buy milk" desc={t("guides.telegramBot.step2.add")} />
              <Cheat code='/todo "Work" review PRs' desc={t("guides.telegramBot.step2.todo")} />
              <Cheat code="/task NorthStar Ship v1" desc={t("guides.telegramBot.step2.task")} />
              <Cheat code="/done a1b2c3d4" desc={t("guides.telegramBot.step2.done")} />
              <Cheat code="/help" desc={t("guides.telegramBot.step2.help")} />
            </div>
          ),
        },
        {
          title: t("guides.telegramBot.step3.title"),
          body: <p>{t("guides.telegramBot.step3.p1")}</p>,
          code: `# Project: NorthStar
Status: active
Due: 2026-07-15

## Tasks
- [ ] (high) Extract toolkit components
- [ ] @2026-06-15 Stage toolkits in Hub`,
        },
        {
          title: t("guides.telegramBot.step4.title"),
          body: (
            <ul className="space-y-2">
              <Row title={t("guides.telegramBot.step4.row1.title")}>
                {t("guides.telegramBot.step4.row1.body")}
              </Row>
              <Row title={t("guides.telegramBot.step4.row2.title")}>
                <code>/tasks</code>, <code>/deadlines</code>,{" "}
                <code>/projects</code>, <code>/lists</code>{" "}
                {t("guides.telegramBot.step4.row2.body")}
              </Row>
              <Row title={t("guides.telegramBot.step4.row3.title")}>
                <code>/done &lt;id-prefix&gt;</code>{" "}
                {t("guides.telegramBot.step4.row3.body")}
              </Row>
              <Row title={t("guides.telegramBot.step4.row4.title")}>
                {t("guides.telegramBot.step4.row4.body")}
              </Row>
              <Row title={t("guides.telegramBot.step4.row5.title")}>
                {t("guides.telegramBot.step4.row5.body")}
              </Row>
            </ul>
          ),
        },
      ],
    },

    customFields: {
      id: "customFields",
      label: t("guides.customFields.label"),
      blurb: t("guides.customFields.blurb"),
      icon: Settings2,
      steps: [
        {
          title: t("guides.customFields.step1.title"),
          body: <p>{t("guides.customFields.step1.p1")}</p>,
        },
        {
          title: t("guides.customFields.step2.title"),
          body: (
            <ul className="space-y-1.5">
              <Row title={t("guides.customFields.step2.row1.title")}>{t("guides.customFields.step2.row1.body")}</Row>
              <Row title={t("guides.customFields.step2.row2.title")}>{t("guides.customFields.step2.row2.body")}</Row>
              <Row title={t("guides.customFields.step2.row3.title")}>{t("guides.customFields.step2.row3.body")}</Row>
              <Row title={t("guides.customFields.step2.row4.title")}>{t("guides.customFields.step2.row4.body")}</Row>
              <Row title={t("guides.customFields.step2.row5.title")}>{t("guides.customFields.step2.row5.body")}</Row>
              <Row title={t("guides.customFields.step2.row6.title")}>{t("guides.customFields.step2.row6.body")}</Row>
              <Row title={t("guides.customFields.step2.row7.title")}>{t("guides.customFields.step2.row7.body")}</Row>
            </ul>
          ),
        },
        {
          title: t("guides.customFields.step3.title"),
          body: (
            <p>
              {t("guides.customFields.step3.p1a")}{" "}
              <strong className="text-foreground/80">{t("guides.customFields.step3.scopeAll")}</strong>
              {t("guides.customFields.step3.p1b")}{" "}
              <strong className="text-foreground/80">{t("guides.customFields.step3.scopeType")}</strong>{" "}
              {t("guides.customFields.step3.p1c")}{" "}
              <strong className="text-foreground/80">{t("guides.customFields.step3.scopeProject")}</strong>
              {t("guides.customFields.step3.p1d")}
            </p>
          ),
        },
      ],
    },

    calendarSync: {
      id: "calendarSync",
      label: t("guides.calendarSync.label"),
      blurb: t("guides.calendarSync.blurb"),
      icon: Calendar,
      steps: [
        {
          title: t("guides.calendarSync.step1.title"),
          body: (
            <p>
              {t("guides.calendarSync.step1.p1a")}{" "}
              <strong>{t("guides.calendarSync.step1.dateWord")}</strong>{" "}
              {t("guides.calendarSync.step1.p1b")}{" "}
              <strong>{t("guides.calendarSync.step1.allDayWord")}</strong>
              {t("guides.calendarSync.step1.p1c")}
            </p>
          ),
        },
        {
          title: t("guides.calendarSync.step2.title"),
          body: (
            <ul className="space-y-1.5">
              <Row title={t("guides.calendarSync.step2.row1.title")}>{t("guides.calendarSync.step2.row1.body")}</Row>
              <Row title={t("guides.calendarSync.step2.row2.title")}>{t("guides.calendarSync.step2.row2.body")}</Row>
              <Row title={t("guides.calendarSync.step2.row3.title")}>{t("guides.calendarSync.step2.row3.body")}</Row>
              <Row title={t("guides.calendarSync.step2.row4.title")}>{t("guides.calendarSync.step2.row4.body")}</Row>
            </ul>
          ),
        },
        {
          title: t("guides.calendarSync.step3.title"),
          body: (
            <p>
              {t("guides.calendarSync.step3.p1a")}{" "}
              <strong>{t("guides.calendarSync.step3.dueDateWord")}</strong>{" "}
              {t("guides.calendarSync.step3.p1b")}{" "}
              <strong>{t("guides.calendarSync.step3.syncNowWord")}</strong>{" "}
              {t("guides.calendarSync.step3.p1c")}
            </p>
          ),
        },
        {
          title: t("guides.calendarSync.step4.title"),
          body: <p>{t("guides.calendarSync.step4.p1")}</p>,
        },
      ],
    },

    aiResponseLength: {
      id: "aiResponseLength",
      label: t("guides.aiResponseLength.label"),
      blurb: t("guides.aiResponseLength.blurb"),
      icon: Gauge,
      steps: [
        {
          title: t("guides.aiResponseLength.step1.title"),
          body: (
            <p>
              {t("guides.aiResponseLength.step1.p1a")}{" "}
              <strong>{t("guides.aiResponseLength.step1.threeQuarters")}</strong>
              {t("guides.aiResponseLength.step1.p1b")}{" "}
              <strong>{t("guides.aiResponseLength.step1.maxLength")}</strong>{" "}
              {t("guides.aiResponseLength.step1.p1c")}
            </p>
          ),
        },
        {
          title: t("guides.aiResponseLength.step2.title"),
          body: (
            <p>
              {t("guides.aiResponseLength.step2.p1a")}{" "}
              <strong>Gemini 2.5 Flash</strong>
              {t("guides.aiResponseLength.step2.p1b")}
            </p>
          ),
        },
        {
          title: t("guides.aiResponseLength.step3.title"),
          body: (
            <ul className="space-y-1.5">
              <Row title={t("guides.aiResponseLength.step3.row1.title")}>{t("guides.aiResponseLength.step3.row1.body")}</Row>
              <Row title={t("guides.aiResponseLength.step3.row2.title")}>{t("guides.aiResponseLength.step3.row2.body")}</Row>
              <Row title={t("guides.aiResponseLength.step3.row3.title")}>{t("guides.aiResponseLength.step3.row3.body")}</Row>
              <Row title={t("guides.aiResponseLength.step3.row4.title")}>{t("guides.aiResponseLength.step3.row4.body")}</Row>
            </ul>
          ),
        },
        {
          title: t("guides.aiResponseLength.step4.title"),
          body: (
            <p>
              {t("guides.aiResponseLength.step4.p1a")}{" "}
              <strong>{t("guides.aiResponseLength.step4.raiseWord")}</strong>
              {t("guides.aiResponseLength.step4.p1b")}{" "}
              <strong>{t("guides.aiResponseLength.step4.lowerWord")}</strong>
              {t("guides.aiResponseLength.step4.p1c")}
            </p>
          ),
        },
      ],
    },

    serverEvents: {
      id: "serverEvents",
      label: t("guides.serverEvents.label"),
      blurb: t("guides.serverEvents.blurb"),
      icon: Activity,
      steps: [
        {
          title: t("guides.serverEvents.step1.title"),
          body: (
            <p>
              {t("guides.serverEvents.step1.p1a")}{" "}
              <strong>{t("guides.serverEvents.step1.whenWord")}</strong>{" "}
              {t("guides.serverEvents.step1.p1b")}{" "}
              <strong>{t("guides.serverEvents.step1.whatWord")}</strong>{" "}
              {t("guides.serverEvents.step1.p1c")}{" "}
              <strong>{t("guides.serverEvents.step1.whoWord")}</strong>{" "}
              {t("guides.serverEvents.step1.p1d")}
            </p>
          ),
        },
        {
          title: t("guides.serverEvents.step2.title"),
          body: (
            <ul className="space-y-1.5">
              <Row title="server_start / server_stop">{t("guides.serverEvents.step2.row1.body")}</Row>
              <Row title="backup_completed / backup_failed">{t("guides.serverEvents.step2.row2.body")}</Row>
              <Row title="user_login / user_logout">{t("guides.serverEvents.step2.row3.body")}</Row>
              <Row title="user_created">{t("guides.serverEvents.step2.row4.body")}</Row>
              <Row title="permission_changed">{t("guides.serverEvents.step2.row5.body")}</Row>
              <Row title="error / warning">{t("guides.serverEvents.step2.row6.body")}</Row>
            </ul>
          ),
        },
      ],
    },

    quickAdd: {
      id: "quickAdd",
      label: t("guides.quickAdd.label"),
      blurb: t("guides.quickAdd.blurb"),
      icon: Keyboard,
      steps: [
        {
          title: t("guides.quickAdd.step1.title"),
          body: (
            <p>
              {t("guides.quickAdd.step1.p1a")}{" "}
              <code className="px-1 py-0.5 bg-muted/60 rounded">c</code>{" "}
              {t("guides.quickAdd.step1.p1b")}{" "}
              <strong>{t("guides.quickAdd.step1.addTaskWord")}</strong>{" "}
              {t("guides.quickAdd.step1.p1c")}
            </p>
          ),
        },
        {
          title: t("guides.quickAdd.step2.title"),
          body: (
            <ul className="space-y-1.5">
              <Row title={t("guides.quickAdd.step2.row1.title")}>
                <code className="px-1 py-0.5 bg-muted/60 rounded">#urgent</code>{" "}
                <code className="px-1 py-0.5 bg-muted/60 rounded">#high</code>{" "}
                <code className="px-1 py-0.5 bg-muted/60 rounded">#medium</code>{" "}
                <code className="px-1 py-0.5 bg-muted/60 rounded">#low</code>
              </Row>
              <Row title={t("guides.quickAdd.step2.row2.title")}>
                <code className="px-1 py-0.5 bg-muted/60 rounded">today</code>,{" "}
                <code className="px-1 py-0.5 bg-muted/60 rounded">tomorrow</code>,{" "}
                <code className="px-1 py-0.5 bg-muted/60 rounded">next week</code>,{" "}
                {t("guides.quickAdd.step2.row2.a")}{" "}
                <code className="px-1 py-0.5 bg-muted/60 rounded">fri</code>
                {t("guides.quickAdd.step2.row2.b")}{" "}
                <code className="px-1 py-0.5 bg-muted/60 rounded">2026-06-10</code>
              </Row>
              <Row title={t("guides.quickAdd.step2.row3.title")}>
                <code className="px-1 py-0.5 bg-muted/60 rounded">Submit report fri #high</code>{" "}
                {t("guides.quickAdd.step2.row3.body")}
              </Row>
            </ul>
          ),
        },
        {
          title: t("guides.quickAdd.step3.title"),
          body: (
            <div className="space-y-1.5">
              <Cheat code="1 – 6" desc={t("guides.quickAdd.step3.views")} />
              <Cheat code="c" desc={t("guides.quickAdd.step3.quickAdd")} />
              <Cheat code="/" desc={t("guides.quickAdd.step3.search")} />
              <Cheat code="f" desc={t("guides.quickAdd.step3.filter")} />
              <Cheat code="j / k" desc={t("guides.quickAdd.step3.move")} />
              <Cheat code="Enter / e" desc={t("guides.quickAdd.step3.openTask")} />
              <Cheat code="Space" desc={t("guides.quickAdd.step3.toggleComplete")} />
              <p className="pt-1 text-muted-foreground">
                {t("guides.quickAdd.step3.note")}
              </p>
            </div>
          ),
        },
      ],
    },
  }

  // Ordered list for the Help → Guides hub (matches the legacy GUIDE_LIST order).
  const list: GuideMeta[] = [
    guides.markdownFormat,
    guides.quickAdd,
    guides.telegramBot,
    guides.calendarSync,
    guides.customFields,
    guides.aiResponseLength,
    guides.apiTokens,
    guides.serverEvents,
  ]

  return { guides, list }
}
