"use client"

/**
 * Pending Imports inbox.
 *
 * When the bot receives a message that matches the FlowSpace AI-import
 * format, the webhook stashes it in `pending_imports` rather than
 * mutating the workspace. This dialog is where the user reviews them.
 *
 * Layout: left column lists pending items (click to select); right column
 * shows the parsed preview of the selected one (project/page header,
 * tasks, notes, warnings) plus Approve + Dismiss buttons.
 *
 * Approval calls `approvePendingImport` → which runs the same parser +
 * `importFromAI` action the in-app paste dialog uses. The whole workspace
 * stays consistent regardless of where the markdown arrived from.
 */

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Inbox,
  Check,
  X,
  Sparkles,
  Loader2,
  AlertTriangle,
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
  Send,
} from "lucide-react"
import { toast } from "sonner"
import {
  getMyPendingImports,
  approvePendingImport,
  dismissPendingImport,
  type PendingImport,
} from "@/lib/actions/pending-imports-actions"
import {
  parseAIImport,
  type ParsedImport,
  type ImportElementType,
} from "@/lib/import/ai-import-parser"

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

const SOURCE_LABEL: Record<PendingImport["source"], { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  telegram: { label: "via Telegram", icon: Send },
  email:    { label: "via email",    icon: FileText },
  api:      { label: "via API",      icon: Sparkles },
}

export function PendingImportsDialog({
  open,
  onOpenChange,
  onChanged,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onChanged?: () => void
}) {
  const router = useRouter()
  const [items, setItems] = useState<PendingImport[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    void refresh()
  }, [open])

  async function refresh() {
    try {
      const next = await getMyPendingImports()
      setItems(next)
      if (next.length > 0 && !next.find((n) => n.id === selectedId)) {
        setSelectedId(next[0].id)
      } else if (next.length === 0) {
        setSelectedId(null)
      }
    } catch {
      // ignore — UI will simply show empty
    }
  }

  const selected = items.find((i) => i.id === selectedId)
  const parsed = useMemo<ParsedImport | null>(
    () => (selected ? parseAIImport(selected.payload) : null),
    [selected],
  )

  async function handleApprove() {
    if (!selected) return
    setBusy(true)
    try {
      const r = await approvePendingImport(selected.id)
      if (r.ok) {
        toast.success(`Created — opening…`)
        const href = TYPE_META[(parsed?.type ?? "project") as ImportElementType].href(r.elementId)
        await refresh()
        onChanged?.()
        onOpenChange(false)
        router.push(href)
      } else {
        toast.error(r.error)
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleDismiss() {
    if (!selected) return
    if (!confirm("Dismiss this pending import? The payload is discarded.")) return
    setBusy(true)
    try {
      await dismissPendingImport(selected.id)
      toast.success("Dismissed")
      await refresh()
      onChanged?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Inbox className="size-4 text-primary" />
            Pending imports
            {items.length > 0 && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/15 px-1.5 py-0.5 rounded-full">
                {items.length} waiting
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Structured payloads received from your bot. Nothing has been
            created yet — preview each one, then approve to land it in your
            workspace or dismiss to discard.
          </DialogDescription>
        </DialogHeader>

        {items.length === 0 ? (
          <EmptyState onClose={() => onOpenChange(false)} />
        ) : (
          <div className="grid grid-cols-[260px_1fr] gap-4 min-h-0 flex-1">
            {/* ── List column ─────────────────────────────────────── */}
            <div className="border-r border-border/40 -ml-2 pl-2 overflow-y-auto">
              <div className="space-y-1">
                {items.map((it) => {
                  const SourceIcon = SOURCE_LABEL[it.source].icon
                  const active = it.id === selectedId
                  return (
                    <button
                      key={it.id}
                      onClick={() => setSelectedId(it.id)}
                      className={`w-full text-left p-2.5 rounded-md transition-colors ${
                        active
                          ? "bg-primary/10 border border-primary/40"
                          : "hover:bg-accent border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <SourceIcon className="size-2.5" />
                        {SOURCE_LABEL[it.source].label}
                        <span className="ml-auto">{relativeTime(it.createdAt)}</span>
                      </div>
                      <p className="text-sm font-medium mt-1 truncate">
                        {it.parsedSummary ?? "Untitled"}
                      </p>
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate font-mono">
                        {it.payload.slice(0, 80)}…
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Preview column ──────────────────────────────────── */}
            <div className="overflow-y-auto">
              {parsed ? (
                <Preview parsed={parsed} />
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  Couldn&apos;t parse the payload. You can still dismiss it.
                </div>
              )}
            </div>
          </div>
        )}

        {selected && (
          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button variant="ghost" onClick={handleDismiss} disabled={busy}>
              <X className="size-3.5 mr-1.5" />
              Dismiss
            </Button>
            <Button onClick={handleApprove} disabled={!parsed || busy}>
              {busy ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Check className="size-3.5 mr-1.5" />}
              {busy ? "Creating…" : "Approve & create"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Preview pane ─────────────────────────────────────────────────────────

import { PRIORITY_BY_VALUE as PRIORITY_META } from "@/lib/priority"

function Preview({ parsed }: { parsed: ParsedImport }) {
  const meta = TYPE_META[parsed.type]
  const Icon = meta.icon
  return (
    <div className="space-y-4 text-sm pr-1">
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

      <div className="flex flex-wrap gap-1.5">
        {parsed.status && <Pill label={parsed.status} />}
        {parsed.dueDate && <Pill icon={CalendarClock} label={`Due ${parsed.dueDate}`} />}
        {parsed.tags.map((t) => (
          <Pill key={t} icon={Tag} label={t} />
        ))}
      </div>

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
                  {t.isCompleted ? <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" /> : <Circle className="size-3.5 text-muted-foreground shrink-0" />}
                  <span className={`flex-1 truncate ${t.isCompleted ? "line-through text-muted-foreground" : ""}`}>{t.title}</span>
                  {t.priority !== "none" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shrink-0" style={{ background: `${p.color}25`, color: p.color }}>
                      {t.priority === "urgent" || t.priority === "high" ? <Flame className="size-2.5" /> : null}
                      {p.label}
                    </span>
                  )}
                  {t.dueDate && <span className="text-[10px] text-muted-foreground shrink-0">{t.dueDate}</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {parsed.notes && (
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Notes</div>
          <div className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed line-clamp-8">{parsed.notes}</div>
        </div>
      )}

      {parsed.warnings.length > 0 && (
        <div className="px-3 py-2 rounded-md border border-amber-500/40 bg-amber-500/5">
          <div className="text-[11px] font-medium text-amber-200/90 flex items-center gap-1.5 mb-1">
            <AlertTriangle className="size-3" />
            {parsed.warnings.length} warning{parsed.warnings.length === 1 ? "" : "s"}
          </div>
          <ul className="text-[11px] text-amber-200/70 space-y-0.5 list-disc pl-4">
            {parsed.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

function Pill({ icon: Icon, label }: { icon?: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] capitalize border border-border text-muted-foreground bg-muted/40">
      {Icon && <Icon className="size-3" />}
      {label}
    </span>
  )
}

function EmptyState({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
      <div className="size-14 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
        <Inbox className="size-6" />
      </div>
      <p className="text-sm font-medium">No pending imports</p>
      <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
        Paste FlowSpace AI-import markdown to your Telegram bot and it will
        land here for review. Use the &ldquo;Copy AI prompt&rdquo; in the
        home page&apos;s &ldquo;Import from AI&rdquo; dialog to grab a
        ready-to-feed instruction for Claude/ChatGPT.
      </p>
      <Button variant="ghost" onClick={onClose}>Close</Button>
    </div>
  )
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const sec = Math.max(0, (Date.now() - then) / 1000)
  if (sec < 60) return "just now"
  if (sec < 3600) return `${Math.floor(sec / 60)}m`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`
  return `${Math.floor(sec / 86400)}d`
}
