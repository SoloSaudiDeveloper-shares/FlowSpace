"use client"

import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Flag, Calendar, ChevronDown, Trash2 } from "lucide-react"
import { updateTask, deleteTask } from "@/lib/actions/task-actions"
import type { tasks, taskStatuses } from "@/lib/db/schema"

type Task = typeof tasks.$inferSelect
type TaskStatus = typeof taskStatuses.$inferSelect

const PRIORITIES = [
  { value: "urgent" as const, label: "Urgent", color: "text-red-400" },
  { value: "high" as const, label: "High", color: "text-orange-400" },
  { value: "medium" as const, label: "Medium", color: "text-yellow-400" },
  { value: "low" as const, label: "Low", color: "text-blue-400" },
  { value: "none" as const, label: "None", color: "text-muted-foreground" },
]

interface TaskDetailSheetProps {
  task: Task | null
  statuses: TaskStatus[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TaskDetailSheet({
  task,
  statuses,
  open,
  onOpenChange,
}: TaskDetailSheetProps) {
  const [title, setTitle] = useState(task?.title ?? "")
  const [description, setDescription] = useState(task?.description ?? "")

  if (!task) return null

  const currentStatus = statuses.find((s) => s.id === task.statusId)

  function handleTitleBlur() {
    if (task && title !== task.title) {
      updateTask(task.id, task.projectId, { title: title || "Untitled" })
    }
  }

  function handleDescBlur() {
    if (task && description !== task.description) {
      updateTask(task.id, task.projectId, { description })
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="sr-only">Edit Task</SheetTitle>
          <SheetDescription className="sr-only">Edit task details</SheetDescription>
        </SheetHeader>
        <div className="space-y-6 py-4">
          {/* Title */}
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            className="text-lg font-semibold border-none px-0 focus-visible:ring-0 shadow-none"
            placeholder="Task title"
          />

          {/* Status */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-20">Status</span>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1 text-sm border hover:bg-accent">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: currentStatus?.color }}
                />
                {currentStatus?.name}
                <ChevronDown className="size-3 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {statuses.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() =>
                      updateTask(task.id, task.projectId, { statusId: s.id })
                    }
                  >
                    <span
                      className="size-2.5 rounded-full mr-2"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Priority */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-20">Priority</span>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1 text-sm border hover:bg-accent">
                <Flag className="size-3" />
                {PRIORITIES.find((p) => p.value === task.priority)?.label ?? "None"}
                <ChevronDown className="size-3 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {PRIORITIES.map((p) => (
                  <DropdownMenuItem
                    key={p.value}
                    onClick={() =>
                      updateTask(task.id, task.projectId, { priority: p.value })
                    }
                  >
                    <Flag className={`size-3 mr-2 ${p.color}`} />
                    {p.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Due Date */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-20">Due date</span>
            <Input
              type="date"
              value={task.dueDate?.split("T")[0] ?? ""}
              onChange={(e) =>
                updateTask(task.id, task.projectId, {
                  dueDate: e.target.value ? new Date(e.target.value).toISOString() : null,
                })
              }
              className="w-auto"
            />
          </div>

          {/* Description */}
          <div>
            <span className="text-sm text-muted-foreground mb-2 block">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleDescBlur}
              placeholder="Add a description..."
              className="w-full min-h-[120px] rounded-md border bg-transparent px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Delete */}
          <div className="pt-4 border-t">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                deleteTask(task.id, task.projectId)
                onOpenChange(false)
              }}
            >
              <Trash2 className="size-4 mr-2" />
              Delete task
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
