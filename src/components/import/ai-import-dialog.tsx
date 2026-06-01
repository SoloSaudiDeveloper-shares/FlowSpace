"use client"

/**
 * "Import from AI" — the user pastes Markdown produced by Claude/ChatGPT
 * in our format, sees a live preview of exactly what will be created,
 * and one click materializes it into a real element + tasks.
 *
 * The dialog has three modes:
 *  - empty:    welcome state with a "Copy AI prompt" button + paste area
 *  - parsed:   preview of what we'll create + warnings + Import button
 *  - imported: success state offering to open the new element
 *
 * We parse on the client for the live preview, then re-validate and
 * persist on the server.
 */

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { SectionHelp } from "@/components/shared/section-help"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Sparkles,
  Clipboard,
  Check,
  AlertTriangle,
  ArrowRight,
  FolderKanban,
  FileText,
  Layout,
  ListTodo,
  Bell,
  GitBranch,
  CheckCircle2,
  Circle,
  CalendarClock,
  Flame,
  Tag,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import {
  parseAIImport,
  AI_PROMPT_TEMPLATE,
  type ParsedImport,
  type ImportElementType,
} from "@/lib/import/ai-import-parser"
import { importFromAI } from "@/lib/actions/import-actions"
import { useT } from "@/lib/hooks/use-i18n"

const TYPE_META: Record<
  ImportElementType,
  { labelKey: string; icon: React.ComponentType<{ className?: string }>; color: string; href: (id: string) => string }
> = {
  project:  { labelKey: "misc.import.typeProject",  icon: FolderKanban, color: "#a78bfa", href: (id) => `/projects/${id}` },
  page:     { labelKey: "misc.import.typePage",     icon: FileText,     color: "#60a5fa", href: (id) => `/pages/${id}` },
  todo:     { labelKey: "misc.import.typeTodo",     icon: ListTodo,     color: "#fbbf24", href: (id) => `/todos/${id}` },
  canvas:   { labelKey: "misc.import.typeCanvas",   icon: Layout,       color: "#67e8f9", href: (id) => `/canvas/${id}` },
  reminder: { labelKey: "misc.import.typeReminder", icon: Bell,         color: "#fb7185", href: () => `/reminders` },
  process:  { labelKey: "misc.import.typeProcess",  icon: GitBranch,    color: "#6ee7b7", href: (id) => `/process/${id}` },
}

import { PRIORITY_BY_VALUE as PRIORITY_META } from "@/lib/priority"

export function AIImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { t } = useT()
  const router = useRouter()
  const [text, setText] = useState("")
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState<{ id: string; type: ImportElementType } | null>(null)
  const [promptCopied, setPromptCopied] = useState(false)

  const parsed = useMemo<ParsedImport | null>(() => {
    if (!text.trim()) return null
    return parseAIImport(text)
  }, [text])

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(AI_PROMPT_TEMPLATE)
      setPromptCopied(true)
      setTimeout(() => setPromptCopied(false), 1500)
      toast.success(t("misc.import.promptCopied"))
    } catch {
      toast.error(t("misc.import.copyError"))
    }
  }

  async function handleImport() {
    if (!parsed) return
    setImporting(true)
    try {
      const result = await importFromAI(parsed)
      if (result.ok) {
        toast.success(t("misc.import.imported").replace("{title}", parsed.title))
        setImported({ id: result.id, type: parsed.type })
      } else {
        toast.error(result.error)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("misc.import.importFailed"))
    } finally {
      setImporting(false)
    }
  }

  function close() {
    onOpenChange(false)
    // Reset on next open
    setTimeout(() => {
      setText("")
      setImported(null)
    }, 250)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : close())}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            {t("misc.import.title")}
          </DialogTitle>
          <DialogDescription>
            {t("misc.import.description")}
          </DialogDescription>
        </DialogHeader>

        {imported ? (
          <SuccessState
            type={imported.type}
            onOpen={() => {
              const href = TYPE_META[imported.type].href(imported.id)
              router.push(href)
              close()
            }}
            onAnother={() => {
              setImported(null)
              setText("")
            }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0 flex-1">
            {/* ── Paste area ─────────────────────────────────────── */}
            <div className="flex flex-col gap-2 min-h-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("misc.import.pasteMarkdown")}
                </span>
                <button
                  onClick={copyPrompt}
                  className="text-xs flex items-center gap-1 px-2 py-1 rounded-md border bg-card hover:bg-accent transition-colors"
                >
                  {promptCopied ? <Check className="size-3" /> : <Clipboard className="size-3" />}
                  {promptCopied ? t("misc.import.copied") : t("misc.import.copyPrompt")}
                </button>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`# Project: Trip planning
Status: planning
Due: 2026-07-15
Tags: travel, summer

## Tasks
- [ ] (high) Book flights
- [ ] @2026-06-20 Pick hotel
- [x] Check passport expiry

## Notes
Heading to Tokyo for two weeks…`}
                className="flex-1 min-h-[260px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
              <p className="text-[11px] text-muted-foreground leading-snug">
                {t("misc.import.tip")}
              </p>
              <SectionHelp guideId="markdownFormat" label={t("misc.import.markdownGuide")} />
            </div>

            {/* ── Preview ────────────────────────────────────────── */}
            <div className="flex flex-col gap-2 min-h-0">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("misc.import.preview")}
              </span>
              <div className="flex-1 min-h-[260px] rounded-md border border-border/60 bg-card/40 overflow-y-auto p-4">
                {parsed ? <Preview parsed={parsed} /> : <EmptyPreview />}
              </div>
            </div>
          </div>
        )}

        {!imported && (
          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button variant="ghost" onClick={close} disabled={importing}>
              {t("misc.import.cancel")}
            </Button>
            <Button onClick={handleImport} disabled={!parsed || importing}>
              {importing ? (
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              ) : (
                <ArrowRight className="size-3.5 mr-1.5" />
              )}
              {importing ? t("misc.import.importing") : t("misc.import.importButton")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Preview pane ───────────────────────────────────────────────────────

function Preview({ parsed }: { parsed: ParsedImport }) {
  const { t } = useT()
  const meta = TYPE_META[parsed.type]
  const Icon = meta.icon
  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-start gap-3">
        <div
          className="size-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${meta.color}1a`, color: meta.color }}
        >
          <Icon className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {t(meta.labelKey)}
          </div>
          <div className="text-base font-semibold truncate">{parsed.title}</div>
        </div>
      </div>

      {/* Metadata pills */}
      <div className="flex flex-wrap gap-1.5">
        {parsed.status && (
          <Pill label={parsed.status} tone="muted" />
        )}
        {parsed.dueDate && (
          <Pill icon={CalendarClock} label={t("misc.import.due").replace("{date}", parsed.dueDate)} tone="muted" />
        )}
        {parsed.tags.map((t) => (
          <Pill key={t} icon={Tag} label={t} tone="muted" />
        ))}
      </div>

      {/* Tasks */}
      {parsed.tasks.length > 0 && (
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
            {(parsed.tasks.length === 1 ? t("misc.import.taskCount") : t("misc.import.taskCountPlural")).replace("{count}", String(parsed.tasks.length))}
          </div>
          <div className="space-y-1">
            {parsed.tasks.map((task, i) => {
              const p = PRIORITY_META[task.priority]
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {task.isCompleted ? (
                    <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="size-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className={`flex-1 truncate ${task.isCompleted ? "line-through text-muted-foreground" : ""}`}>
                    {task.title}
                  </span>
                  {task.priority !== "none" && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shrink-0"
                      style={{ background: `${p.color}25`, color: p.color }}
                    >
                      {task.priority === "urgent" || task.priority === "high" ? <Flame className="size-2.5" /> : null}
                      {p.label}
                    </span>
                  )}
                  {task.dueDate && (
                    <span className="text-[10px] text-muted-foreground shrink-0">{task.dueDate}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Notes */}
      {parsed.notes && (
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
            {t("misc.import.notes")}
          </div>
          <div className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed line-clamp-6">
            {parsed.notes}
          </div>
        </div>
      )}

      {/* Warnings */}
      {parsed.warnings.length > 0 && (
        <div className="px-3 py-2 rounded-md border border-amber-500/40 bg-amber-500/5">
          <div className="text-[11px] font-medium text-amber-200/90 flex items-center gap-1.5 mb-1">
            <AlertTriangle className="size-3" />
            {(parsed.warnings.length === 1 ? t("misc.import.warningCount") : t("misc.import.warningCountPlural")).replace("{count}", String(parsed.warnings.length))}
          </div>
          <ul className="text-[11px] text-amber-200/70 space-y-0.5 list-disc pl-4">
            {parsed.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function EmptyPreview() {
  const { t } = useT()
  return (
    <div className="h-full flex flex-col items-center justify-center text-center text-xs text-muted-foreground gap-2">
      <Sparkles className="size-6 opacity-30" />
      <p>{t("misc.import.emptyPreview")}</p>
      <p className="opacity-60">{t("misc.import.emptyPreviewHint")} <code className="px-1 rounded bg-muted">{`# Project: Title`}</code>.</p>
    </div>
  )
}

function Pill({
  icon: Icon,
  label,
  tone,
}: {
  icon?: React.ComponentType<{ className?: string }>
  label: string
  tone: "muted"
}) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] capitalize border ${tone === "muted" ? "border-border text-muted-foreground bg-muted/40" : ""}`}>
      {Icon && <Icon className="size-3" />}
      {label}
    </span>
  )
}

// ─── Success state ──────────────────────────────────────────────────────

function SuccessState({
  type,
  onOpen,
  onAnother,
}: {
  type: ImportElementType
  onOpen: () => void
  onAnother: () => void
}) {
  const { t } = useT()
  const meta = TYPE_META[type]
  const typeLabel = t(meta.labelKey).toLowerCase()
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
      <div
        className="size-14 rounded-full flex items-center justify-center"
        style={{ background: `${meta.color}25`, color: meta.color }}
      >
        <CheckCircle2 className="size-7" />
      </div>
      <div>
        <p className="text-lg font-semibold">{t("misc.import.successTitle")}</p>
        <p className="text-sm text-muted-foreground">
          {t("misc.import.successBody").replace("{type}", typeLabel)}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onAnother}>
          {t("misc.import.importAnother")}
        </Button>
        <Button onClick={onOpen}>
          {t("misc.import.openType").replace("{type}", typeLabel)}
          <ArrowRight className="size-3.5 ml-1.5" />
        </Button>
      </div>
    </div>
  )
}
