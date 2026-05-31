"use client"

/**
 * Small click-anchored popover for a task card's attachment / dependency /
 * comment badges. Fetches the items on open and renders them inline so you can
 * (e.g.) download an attachment without opening the whole task.
 */

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Download, File, X, Link2, MessageCircle, Paperclip } from "lucide-react"
import {
  getTaskAttachments,
  getTaskDependencies,
  getTasksByProject,
} from "@/lib/actions/task-actions"
import { getTaskComments } from "@/lib/actions/comment-actions"

export type MetaKind = "attachments" | "dependencies" | "comments"

const TITLE: Record<MetaKind, string> = {
  attachments: "Attachments",
  dependencies: "Dependencies",
  comments: "Comments",
}
const ICON: Record<MetaKind, typeof Paperclip> = {
  attachments: Paperclip,
  dependencies: Link2,
  comments: MessageCircle,
}
const DEP_LABEL: Record<string, string> = {
  blocks: "Blocks",
  blocked_by: "Blocked by",
  relates_to: "Relates to",
}

type Attachment = { id: string; fileName: string; fileSize: number }
type Dependency = { id: string; dependsOnTaskId: string; type: string }
type Comment = { id: string; content: string; createdAt: string }

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

export function TaskMetaPopover({
  kind,
  taskId,
  projectId,
  x,
  y,
  onClose,
}: {
  kind: MetaKind
  taskId: string
  projectId: string
  x: number
  y: number
  onClose: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [deps, setDeps] = useState<Dependency[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [titles, setTitles] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (kind === "attachments") {
        const a = (await getTaskAttachments(taskId)) as Attachment[]
        if (!cancelled) setAttachments(a)
      } else if (kind === "dependencies") {
        const [d, all] = await Promise.all([
          getTaskDependencies(taskId),
          getTasksByProject(projectId),
        ])
        if (!cancelled) {
          setDeps(d as Dependency[])
          setTitles(Object.fromEntries(all.map((t) => [t.id, t.title])))
        }
      } else {
        const c = (await getTaskComments(taskId)) as Comment[]
        if (!cancelled) setComments(c)
      }
      if (!cancelled) setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [kind, taskId, projectId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  if (typeof document === "undefined") return null

  const W = 288
  const left = Math.max(8, Math.min(x, window.innerWidth - W - 8))
  const top = Math.min(y, window.innerHeight - 260)
  const Icon = ICON[kind]

  const empty =
    (kind === "attachments" && attachments.length === 0) ||
    (kind === "dependencies" && deps.length === 0) ||
    (kind === "comments" && comments.length === 0)

  return createPortal(
    <>
      <div className="fixed inset-0 z-[90]" onClick={onClose} />
      <div
        className="fixed z-[91] w-72 max-h-64 overflow-y-auto rounded-lg border bg-popover shadow-xl text-sm"
        style={{ left, top }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-2.5 py-2 border-b sticky top-0 bg-popover">
          <span className="flex items-center gap-1.5 text-xs font-medium">
            <Icon className="size-3.5 text-muted-foreground" />
            {TITLE[kind]}
          </span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X className="size-3.5" />
          </button>
        </div>

        <div className="p-1">
          {loading ? (
            <p className="text-xs text-muted-foreground px-2 py-3">Loading…</p>
          ) : empty ? (
            <p className="text-xs text-muted-foreground px-2 py-3">Nothing here yet.</p>
          ) : kind === "attachments" ? (
            attachments.map((a) => (
              <a
                key={a.id}
                href={`/api/attachments/${a.id}`}
                download={a.fileName}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/50"
              >
                <File className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-xs">{a.fileName}</span>
                  <span className="block text-[10px] text-muted-foreground">{fmtSize(a.fileSize)}</span>
                </span>
                <Download className="size-3.5 shrink-0 text-muted-foreground" />
              </a>
            ))
          ) : kind === "dependencies" ? (
            deps.map((d) => (
              <div key={d.id} className="px-2 py-1.5 text-xs">
                <span className="text-muted-foreground">{DEP_LABEL[d.type] ?? d.type}: </span>
                <span className="truncate">{titles[d.dependsOnTaskId] ?? "Unknown task"}</span>
              </div>
            ))
          ) : (
            comments.map((c) => (
              <div key={c.id} className="px-2 py-1.5 border-b last:border-b-0">
                <p className="text-[10px] text-muted-foreground">
                  {new Date(c.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
                <p className="text-xs whitespace-pre-wrap mt-0.5">{c.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}
