"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  GripVertical,
  Trash2,
  Calendar,
  Flag,
  CheckSquare,
  Square,
  Copy,
  FileText,
  Clock,
  GitBranch,
  ListChecks,
  Paperclip,
  Link2,
  MessageCircle,
  Repeat,
} from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { deleteTask, updateTask, duplicateTask } from "@/lib/actions/task-actions"
import type { tasks, taskLabels } from "@/lib/db/schema"
import { ContextMenu, useContextMenu, type ContextMenuEntry } from "@/components/shared/context-menu"
import { TaskMetaPopover, type MetaKind } from "./task-meta-popover"

type Task = typeof tasks.$inferSelect
type TaskLabel = typeof taskLabels.$inferSelect

const PRIORITY_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  urgent: { label: "Urgent", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: "#ef4444" },
  high: { label: "High", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: "#f97316" },
  medium: { label: "Medium", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: "#eab308" },
  low: { label: "Low", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: "#3b82f6" },
  none: { label: "", color: "", icon: "#94a3b8" },
}

function formatTimeShort(seconds: number) {
  if (seconds === 0) return null
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h${m > 0 ? ` ${m}m` : ""}`
  return `${m}m`
}

interface TaskCardProps {
  task: Task
  onClick: () => void
  labels?: TaskLabel[]
  subtaskCount?: number
  subtaskDoneCount?: number
  checklistTotal?: number
  checklistDone?: number
  attachmentCount?: number
  dependencyCount?: number
  commentCount?: number
  selectMode?: boolean
  selected?: boolean
  onToggleSelect?: (taskId: string) => void
}

export function TaskCard({
  task,
  onClick,
  labels = [],
  subtaskCount = 0,
  subtaskDoneCount = 0,
  checklistTotal = 0,
  checklistDone = 0,
  attachmentCount = 0,
  dependencyCount = 0,
  commentCount = 0,
  selectMode = false,
  selected = false,
  onToggleSelect,
}: TaskCardProps) {
  const [popover, setPopover] = useState<{ kind: MetaKind; x: number; y: number } | null>(null)
  function openPopover(kind: MetaKind, e: React.MouseEvent) {
    e.stopPropagation()
    setPopover({ kind, x: e.clientX, y: e.clientY })
  }
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: "task", task } })
  const { menu: ctxMenu, open: openCtx, close: closeCtx } = useContextMenu()

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const priority = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.none
  const timeStr = formatTimeShort(task.timeTracked ?? 0)
  const hasDescription = !!task.description?.trim()

  function handleContextMenu(e: React.MouseEvent) {
    const items: ContextMenuEntry[] = [
      {
        label: "Edit",
        onClick: onClick,
      },
      {
        label: task.isCompleted ? "Mark Incomplete" : "Mark Complete",
        icon: task.isCompleted ? Square : CheckSquare,
        onClick: () => updateTask(task.id, task.projectId, { isCompleted: !task.isCompleted }),
      },
      {
        label: "Duplicate",
        icon: Copy,
        onClick: () => duplicateTask(task.id, task.projectId),
      },
      { separator: true },
      {
        label: "Delete",
        icon: Trash2,
        variant: "destructive",
        onClick: () => deleteTask(task.id, task.projectId),
      },
    ]
    openCtx(e, items)
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`group flex items-start gap-2 rounded-lg border bg-card p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
          selected ? "ring-2 ring-primary bg-primary/5" : ""
        }`}
        onClick={() => (selectMode ? onToggleSelect?.(task.id) : onClick())}
        onContextMenu={handleContextMenu}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") (selectMode ? onToggleSelect?.(task.id) : onClick()) }}
        aria-label={`Task: ${task.title}${task.isCompleted ? " (completed)" : ""}`}
      >
        {selectMode ? (
          <button
            className="mt-0.5 shrink-0"
            onClick={(e) => { e.stopPropagation(); onToggleSelect?.(task.id) }}
            aria-label={selected ? "Deselect" : "Select"}
          >
            {selected ? (
              <CheckSquare className="size-4 text-primary" />
            ) : (
              <Square className="size-4 text-muted-foreground/50" />
            )}
          </button>
        ) : (
          <button
            className="mt-0.5 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4 text-muted-foreground" />
          </button>
        )}

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-start gap-1.5">
            <div
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                updateTask(task.id, task.projectId, { isCompleted: !task.isCompleted })
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.stopPropagation()
                  updateTask(task.id, task.projectId, { isCompleted: !task.isCompleted })
                }
              }}
              className="mt-0.5 shrink-0"
              aria-label={task.isCompleted ? "Mark incomplete" : "Mark complete"}
            >
              {task.isCompleted ? (
                <CheckSquare className="size-3.5 text-primary" />
              ) : (
                <Square className="size-3.5 text-muted-foreground hover:text-foreground" />
              )}
            </div>
            <p className={`text-sm font-medium leading-tight ${task.isCompleted ? "line-through text-muted-foreground" : ""}`}>
              {task.title}
            </p>
          </div>

          {/* Labels */}
          {labels.length > 0 && (
            <div className="flex items-center gap-1 mt-2 flex-wrap">
              {labels.map((label) => (
                <span
                  key={label.id}
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: `${label.color}20`,
                    color: label.color,
                  }}
                >
                  {label.name}
                </span>
              ))}
            </div>
          )}

          {/* Bottom indicators row */}
          <div className="flex items-center gap-2.5 mt-2 flex-wrap">
            {task.priority !== "none" && (
              <Flag className="size-3" style={{ color: priority.icon }} aria-label={`Priority: ${priority.label}`} />
            )}

            {task.dueDate && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Calendar className="size-3" />
                {new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            )}

            {hasDescription && (
              <FileText className="size-3 text-muted-foreground" aria-label="Has description" />
            )}

            {task.repeatRule && (
              <Repeat className="size-3 text-muted-foreground" aria-label="Repeats" />
            )}

            {subtaskCount > 0 && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <GitBranch className="size-3" />
                {subtaskDoneCount}/{subtaskCount}
              </span>
            )}

            {checklistTotal > 0 && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <ListChecks className="size-3" />
                {checklistDone}/{checklistTotal}
              </span>
            )}

            {timeStr && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="size-3" />
                {timeStr}
              </span>
            )}

            {/* Clickable meta badges — open a popover without opening the task. */}
            {attachmentCount > 0 && (
              <button
                onClick={(e) => openPopover("attachments", e)}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                title="Attachments"
              >
                <Paperclip className="size-3" />
                {attachmentCount}
              </button>
            )}
            {dependencyCount > 0 && (
              <button
                onClick={(e) => openPopover("dependencies", e)}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                title="Dependencies"
              >
                <Link2 className="size-3" />
                {dependencyCount}
              </button>
            )}
            {commentCount > 0 && (
              <button
                onClick={(e) => openPopover("comments", e)}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                title="Comments"
              >
                <MessageCircle className="size-3" />
                {commentCount}
              </button>
            )}
          </div>
        </div>
      </div>

      {popover && (
        <TaskMetaPopover
          kind={popover.kind}
          taskId={task.id}
          projectId={task.projectId}
          x={popover.x}
          y={popover.y}
          onClose={() => setPopover(null)}
        />
      )}

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxMenu.items}
          onClose={closeCtx}
        />
      )}
    </>
  )
}
