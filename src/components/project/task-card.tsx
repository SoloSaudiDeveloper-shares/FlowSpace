"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Trash2, Calendar, Flag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { deleteTask } from "@/lib/actions/task-actions"
import type { tasks } from "@/lib/db/schema"

type Task = typeof tasks.$inferSelect

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  high: { label: "High", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  medium: { label: "Medium", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  low: { label: "Low", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  none: { label: "", color: "" },
}

interface TaskCardProps {
  task: Task
  onClick: () => void
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: "task", task } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const priority = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.none

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-start gap-2 rounded-lg border bg-card p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <button
        className="mt-0.5 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4 text-muted-foreground" />
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${task.isCompleted ? "line-through text-muted-foreground" : ""}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {task.priority !== "none" && (
            <Badge variant="outline" className={`text-xs px-1.5 py-0 ${priority.color}`}>
              <Flag className="size-3 mr-1" />
              {priority.label}
            </Badge>
          )}
          {task.dueDate && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="size-3" />
              {new Date(task.dueDate).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        onClick={(e) => {
          e.stopPropagation()
          deleteTask(task.id, task.projectId)
        }}
      >
        <Trash2 className="size-3" />
      </Button>
    </div>
  )
}
