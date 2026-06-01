"use client"

/**
 * Customize the bot's reply messages.
 *
 * Each "moment" (greeting, capture confirmation, task done, etc.) ships
 * with a default reply. Users can override any of them here — type the
 * new body in the textarea and click Save. Click Reset to drop back to
 * default.
 *
 * Variables: each template advertises which `{{vars}}` it can use. We
 * show a chip for each so users can click to insert into the textarea
 * without having to remember the exact name.
 *
 * Overrides are stored in the user-preferences blob under `botReplies`
 * keyed by slug. The server-side render reads from there.
 */

import { useState } from "react"
import { Bot, Sparkles, RotateCcw, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { usePreferences } from "@/lib/hooks/use-preferences"
import { useT } from "@/lib/hooks/use-i18n"

// Mirror of the defaults from src/lib/telegram/replies.ts. We duplicate
// here so the editor is fully client-side — no extra round-trip to fetch
// "what's the default body" because the user's about to edit it anyway.
interface ReplyTemplate {
  slug:
    | "greeting"
    | "capture_added"
    | "task_done"
    | "todo_done"
    | "voice_received"
    | "unknown"
  /** Translation keys for the human-facing label + description. */
  labelKey: string
  descKey: string
  variables: { name: string; description: string; example: string }[]
  default: string
}

const TEMPLATES: ReplyTemplate[] = [
  {
    slug: "greeting",
    labelKey: "settings.bot.tpl.greeting.label",
    descKey: "settings.bot.tpl.greeting.desc",
    variables: [],
    default:
      "👋 You're connected to FlowSpace.\n\nSend me text and I'll capture it as a todo item.\nSlash commands let you do more — try /help.",
  },
  {
    slug: "capture_added",
    labelKey: "settings.bot.tpl.captureAdded.label",
    descKey: "settings.bot.tpl.captureAdded.desc",
    variables: [
      { name: "list", description: "List name", example: "Inbox" },
      {
        name: "detail",
        description: "Smart-capture summary (or empty)",
        example: "\n· captured: priority *high*",
      },
    ],
    default: "✅ Added to *{{list}}*{{detail}}",
  },
  {
    slug: "task_done",
    labelKey: "settings.bot.tpl.taskDone.label",
    descKey: "settings.bot.tpl.taskDone.desc",
    variables: [{ name: "title", description: "Task title", example: "Ship v1" }],
    default: "✅ Marked task done: *{{title}}*",
  },
  {
    slug: "todo_done",
    labelKey: "settings.bot.tpl.todoDone.label",
    descKey: "settings.bot.tpl.todoDone.desc",
    variables: [{ name: "title", description: "Item title", example: "Buy milk" }],
    default: "✅ Marked done: *{{title}}*",
  },
  {
    slug: "voice_received",
    labelKey: "settings.bot.tpl.voiceReceived.label",
    descKey: "settings.bot.tpl.voiceReceived.desc",
    variables: [],
    default: "🎙 Got your voice note. Transcribing…",
  },
  {
    slug: "unknown",
    labelKey: "settings.bot.tpl.unknown.label",
    descKey: "settings.bot.tpl.unknown.desc",
    variables: [{ name: "command", description: "What they typed", example: "/foo" }],
    default: "Unknown command `{{command}}`. Try /help.",
  },
]

export function BotReplyTemplatesPanel() {
  const { t } = useT()
  const { preferences, updatePreference } = usePreferences()
  const overrides = preferences.botReplies ?? {}

  function setOverride(slug: ReplyTemplate["slug"], body: string) {
    const next = { ...overrides }
    if (body.trim().length === 0) {
      delete next[slug]
    } else {
      next[slug] = body
    }
    updatePreference("botReplies", next)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-md border border-violet-500/30 bg-violet-500/5">
        <Sparkles className="size-3.5 text-violet-400 shrink-0 mt-0.5" />
        <div className="text-xs text-violet-200/90 leading-relaxed">
          {t("settings.bot.intro")}
        </div>
      </div>

      <div className="space-y-2.5">
        {TEMPLATES.map((tpl) => {
          const value = overrides[tpl.slug] ?? ""
          const isOverridden = value.length > 0
          return (
            <ReplyEditor
              key={tpl.slug}
              template={tpl}
              value={isOverridden ? value : ""}
              isOverridden={isOverridden}
              onSave={(body) => {
                setOverride(tpl.slug, body)
                toast.success(
                  body.trim().length === 0
                    ? t("settings.bot.resetToast").replace("{label}", t(tpl.labelKey))
                    : t("settings.bot.savedToast").replace("{label}", t(tpl.labelKey)),
                )
              }}
              onReset={() => {
                setOverride(tpl.slug, "")
                toast.success(t("settings.bot.resetToast").replace("{label}", t(tpl.labelKey)))
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

function ReplyEditor({
  template,
  value,
  isOverridden,
  onSave,
  onReset,
}: {
  template: ReplyTemplate
  value: string
  isOverridden: boolean
  onSave: (body: string) => void
  onReset: () => void
}) {
  const { t } = useT()
  // Local state lets the user type freely before committing.
  const [draft, setDraft] = useState<string>(value || template.default)
  const [touched, setTouched] = useState(false)
  const dirty = touched && draft !== (value || template.default)

  return (
    <div className="rounded-lg border border-border/60 bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Bot className="size-3.5 text-muted-foreground" />
          <p className="text-sm font-medium">{t(template.labelKey)}</p>
          {isOverridden && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-violet-500/15 text-violet-300">
              {t("settings.bot.custom")}
            </span>
          )}
        </div>
        {isOverridden && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => {
              setDraft(template.default)
              setTouched(false)
              onReset()
            }}
          >
            <RotateCcw className="size-3" />
            {t("settings.bot.reset")}
          </Button>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">{t(template.descKey)}</p>

      {template.variables.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mr-1">
            {t("settings.bot.variables")}
          </span>
          {template.variables.map((v) => (
            <button
              key={v.name}
              type="button"
              onClick={() => {
                const insert = `{{${v.name}}}`
                setDraft((d) => `${d}${d.endsWith(" ") || d.length === 0 ? "" : ""}${insert}`)
                setTouched(true)
              }}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[10px] bg-muted/50 hover:bg-muted text-foreground/80 transition-colors"
              title={`${v.description} — e.g. ${v.example}`}
            >
              {`{{${v.name}}}`}
            </button>
          ))}
        </div>
      )}

      <textarea
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          setTouched(true)
        }}
        rows={Math.max(2, Math.min(8, draft.split("\n").length))}
        spellCheck={false}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono leading-relaxed placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
        placeholder={template.default}
      />

      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-muted-foreground/70">
          {dirty
            ? t("settings.bot.unsaved")
            : isOverridden
            ? t("settings.bot.usingCustom")
            : t("settings.bot.usingDefault")}
        </p>
        <Button
          variant={dirty ? "default" : "secondary"}
          size="sm"
          className="h-7 text-xs gap-1.5"
          disabled={!dirty}
          onClick={() => {
            // If the user typed the default verbatim, treat as "no override".
            const body = draft.trim() === template.default.trim() ? "" : draft
            onSave(body)
            setTouched(false)
          }}
        >
          <Check className="size-3" />
          {t("settings.bot.save")}
        </Button>
      </div>
    </div>
  )
}
