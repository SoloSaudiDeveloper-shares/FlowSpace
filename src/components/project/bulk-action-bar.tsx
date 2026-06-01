"use client"

/**
 * Floating action bar for multi-select. Appears when tasks are selected in
 * the List view and applies an action to all of them at once: add one comment,
 * start/stop the timer, set priority/status/due, complete, or delete.
 */

import { useState } from "react"
import {
  X,
  MessageCircle,
  Play,
  Pause,
  Flag,
  Calendar,
  CheckCircle2,
  Trash2,
  ChevronDown,
  Send,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import {
  bulkUpdateTasks,
  bulkAddComment,
  bulkSetTimer,
  bulkDeleteTasks,
} from "@/lib/actions/task-actions"
import type { taskStatuses } from "@/lib/db/schema"

type TaskStatus = typeof taskStatuses.$inferSelect

const PRIORITIES = [
  { value: "urgent" as const, label: "Urgent", color: "#ef4444" },
  { value: "high" as const, label: "High", color: "#f97316" },
  { value: "medium" as const, label: "Medium", color: "#eab308" },
  { value: "low" as const, label: "Low", color: "#3b82f6" },
  { value: "none" as const, label: "None", color: "#94a3b8" },
]

function isoDate(offset: number) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

export function BulkActionBar({
  ids,
  projectId,
  statuses,
  onClear,
  onExit,
}: {
  ids: Set<string>
  projectId: string
  statuses: TaskStatus[]
  onClear: () => void
  onExit: () => void
}) {
  const taskIds = [...ids]
  const n = taskIds.length
  const [commenting, setCommenting] = useState(false)
  const [comment, setComment] = useState("")
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<void>, msg?: string) {
    setBusy(true)
    try {
      await fn()
      if (msg) toast.success(msg)
    } catch {
      toast.error("Bulk action failed")
    } finally {
      setBusy(false)
    }
  }

  async function sendComment() {
    if (!comment.trim()) return
    await run(() => bulkAddComment(taskIds, projectId, comment), `Comment added to ${n} task${n === 1 ? "" : "s"}`)
    setComment("")
    setCommenting(false)
  }

  const btn = "h-8 gap-1.5 text-xs"

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 rounded-xl border bg-popover px-2.5 py-1.5 shadow-2xl">
      {commenting ? (
        <div className="flex items-center gap-1.5">
          <Input
            autoFocus
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") sendComment(); if (e.key === "Escape") setCommenting(false) }}
            placeholder={`Comment on ${n} task${n === 1 ? "" : "s"}…`}
            className="h-8 w-64 text-sm"
          />
          <Button size="sm" className={btn} disabled={busy || !comment.trim()} onClick={sendComment}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setCommenting(false)}>Cancel</Button>
        </div>
      ) : (
        <>
          <span className="px-1.5 text-xs font-medium whitespace-nowrap">{n} selected</span>
          <div className="mx-0.5 h-5 w-px bg-border" />

          <Button size="sm" variant="ghost" className={btn} disabled={busy} onClick={() => setCommenting(true)}>
            <MessageCircle className="size-3.5" /> Comment
          </Button>
          <Button size="sm" variant="ghost" className={btn} disabled={busy}
            onClick={() => run(() => bulkSetTimer(taskIds, projectId, true), `Timer started on ${n}`)}>
            <Play className="size-3.5" /> Start
          </Button>
          <Button size="sm" variant="ghost" className={btn} disabled={busy}
            onClick={() => run(() => bulkSetTimer(taskIds, projectId, false), `Timer stopped on ${n}`)}>
            <Pause className="size-3.5" /> Stop
          </Button>

          {/* Priority */}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs hover:bg-accent" disabled={busy}>
              <Flag className="size-3.5" /> Priority <ChevronDown className="size-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {PRIORITIES.map((p) => (
                <DropdownMenuItem key={p.value} onClick={() => run(() => bulkUpdateTasks(taskIds, projectId, { priority: p.value }), `Priority set on ${n}`)}>
                  <Flag className="size-3 mr-2" style={{ color: p.color }} /> {p.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Move to status */}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs hover:bg-accent" disabled={busy}>
              Move <ChevronDown className="size-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {statuses.map((s) => (
                <DropdownMenuItem key={s.id} onClick={() => run(() => bulkUpdateTasks(taskIds, projectId, { statusId: s.id, isCompleted: !!s.isDoneState }), `Moved ${n} to ${s.name}`)}>
                  <span className="size-2.5 rounded-full mr-2" style={{ backgroundColor: s.color }} /> {s.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Due */}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs hover:bg-accent" disabled={busy}>
              <Calendar className="size-3.5" /> Due <ChevronDown className="size-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => run(() => bulkUpdateTasks(taskIds, projectId, { dueDate: isoDate(0) }), `Due date set on ${n}`)}>Today</DropdownMenuItem>
              <DropdownMenuItem onClick={() => run(() => bulkUpdateTasks(taskIds, projectId, { dueDate: isoDate(1) }), `Due date set on ${n}`)}>Tomorrow</DropdownMenuItem>
              <DropdownMenuItem onClick={() => run(() => bulkUpdateTasks(taskIds, projectId, { dueDate: isoDate(7) }), `Due date set on ${n}`)}>Next week</DropdownMenuItem>
              <DropdownMenuItem onClick={() => run(() => bulkUpdateTasks(taskIds, projectId, { dueDate: null }), `Due date cleared on ${n}`)}>Clear</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="sm" variant="ghost" className={btn} disabled={busy}
            onClick={() => run(() => bulkUpdateTasks(taskIds, projectId, { isCompleted: true }), `Completed ${n}`)}>
            <CheckCircle2 className="size-3.5" /> Done
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive hover:text-destructive gap-1.5" disabled={busy}
            onClick={() => {
              if (!confirm(`Delete ${n} task${n === 1 ? "" : "s"}? This cannot be undone.`)) return
              run(() => bulkDeleteTasks(taskIds, projectId), `Deleted ${n}`).then(onClear)
            }}>
            <Trash2 className="size-3.5" />
          </Button>

          <div className="mx-0.5 h-5 w-px bg-border" />
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onExit} title="Exit select mode">
            <X className="size-4" />
          </Button>
        </>
      )}
    </div>
  )
}
