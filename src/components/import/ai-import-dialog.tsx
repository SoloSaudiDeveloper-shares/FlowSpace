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
import { MarkdownFormatGuide } from "@/components/shared/markdown-format-guide"
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

const TYPE_META: Record<
  ImportElementType,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string; href: (id: string) => string }
> = {
  project:  { label: "Project",   icon: FolderKanban, color: "#a78bfa", href: (id) => `/projects/${id}` },
  page:     { label: "Page",      icon: FileText,     color: "#60a5fa", href: (id) => `/pages/${id}` },
  todo:     { label: "Todo list", icon: ListTodo,     color: "#fbbf24", href: (id) => `/todos/${id}` },
  canvas:   { label: "Canvas",    icon: Layout,       color: "#67e8f9", href: (id) => `/canvas/${id}` },
  reminder: { label: "Reminder",  icon: Bell,         color: "#fb7185", href: () => `/reminders` },
  process:  { label: "Process",   icon: GitBranch,    color: "#6ee7b7", href: (id) => `/process/${id}` },
}

const PRIORITY_META: Record<string, { color: string; label: string }> = {
  urgent: { color: "#ef4444", label: "Urgent" },
  high:   { color: "#f97316", label: "High" },
  medium: { color: "#eab308", label: "Medium" },
  low:    { color: "#3b82f6", label: "Low" },
  none:   { color: "#94a3b8", label: "" },
}

export function AIImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
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
      toast.success("Prompt copied — paste it into Claude or ChatGPT")
    } catch {
      toast.error("Couldn't copy. Select the prompt text manually.")
    }
  }

  async function handleImport() {
    if (!parsed) return
    setImporting(true)
    try {
      const result = await importFromAI(parsed)
      if (result.ok) {
        toast.success(`Imported "${parsed.title}"`)
        setImported({ id: result.id, type: parsed.type })
      } else {
        toast.error(result.error)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed")
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
            Import from AI
          </DialogTitle>
          <DialogDescription>
            Brainstorm with Claude or ChatGPT, then paste their structured output here.
            FlowSpace creates the project, tasks, and notes automatically.
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
                  Paste markdown
                </span>
                <button
                  onClick={copyPrompt}
                  className="text-xs flex items-center gap-1 px-2 py-1 rounded-md border bg-card hover:bg-accent transition-colors"
                >
                  {promptCopied ? <Check className="size-3" /> : <Clipboard className="size-3" />}
                  {promptCopied ? "Copied" : "Copy AI prompt"}
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
                Tip: hit <strong>&ldquo;Copy AI prompt&rdquo;</strong> above, paste it into Claude/ChatGPT after your brainstorm — they&apos;ll output exactly what you need to paste back here.
              </p>
              <MarkdownFormatGuide />
            </div>

            {/* ── Preview ────────────────────────────────────────── */}
            <div className="flex flex-col gap-2 min-h-0">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Preview
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
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!parsed || importing}>
              {importing ? (
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              ) : (
                <ArrowRight className="size-3.5 mr-1.5" />
              )}
              {importing ? "Importing…" : "Import"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Preview pane ───────────────────────────────────────────────────────

function Preview({ parsed }: { parsed: ParsedImport }) {
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
            {meta.label}
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
          <Pill icon={CalendarClock} label={`Due ${parsed.dueDate}`} tone="muted" />
        )}
        {parsed.tags.map((t) => (
          <Pill key={t} icon={Tag} label={t} tone="muted" />
        ))}
      </div>

      {/* Tasks */}
      {parsed.tasks.length > 0 && (
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
            {parsed.tasks.length} task{parsed.tasks.length === 1 ? "" : "s"}
          </div>
          <div className="space-y-1">
            {parsed.tasks.map((t, i) => {
              const p = PRIORITY_META[t.priority]
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {t.isCompleted ? (
                    <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="size-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className={`flex-1 truncate ${t.isCompleted ? "line-through text-muted-foreground" : ""}`}>
                    {t.title}
                  </span>
                  {t.priority !== "none" && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shrink-0"
                      style={{ background: `${p.color}25`, color: p.color }}
                    >
                      {t.priority === "urgent" || t.priority === "high" ? <Flame className="size-2.5" /> : null}
                      {p.label}
                    </span>
                  )}
                  {t.dueDate && (
                    <span className="text-[10px] text-muted-foreground shrink-0">{t.dueDate}</span>
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
            Notes
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
            {parsed.warnings.length} warning{parsed.warnings.length === 1 ? "" : "s"}
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
  return (
    <div className="h-full flex flex-col items-center justify-center text-center text-xs text-muted-foreground gap-2">
      <Sparkles className="size-6 opacity-30" />
      <p>Paste FlowSpace-format markdown to see a preview.</p>
      <p className="opacity-60">First line must look like <code className="px-1 rounded bg-muted">{`# Project: Title`}</code>.</p>
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
  const meta = TYPE_META[type]
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
      <div
        className="size-14 rounded-full flex items-center justify-center"
        style={{ background: `${meta.color}25`, color: meta.color }}
      >
        <CheckCircle2 className="size-7" />
      </div>
      <div>
        <p className="text-lg font-semibold">Imported</p>
        <p className="text-sm text-muted-foreground">
          Your new {meta.label.toLowerCase()} is ready in your workspace.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onAnother}>
          Import another
        </Button>
        <Button onClick={onOpen}>
          Open {meta.label.toLowerCase()}
          <ArrowRight className="size-3.5 ml-1.5" />
        </Button>
      </div>
    </div>
  )
}
