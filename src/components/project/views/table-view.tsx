"use client"

import { useState } from "react"
import { Plus, Flag, ChevronDown, ChevronRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { SpeechButton } from "@/components/shared/speech-button"
import { createTask, updateTask } from "@/lib/actions/task-actions"
import { PRIORITY_TEXT_CLASS as PRIORITY_COLORS } from "@/lib/priority"
import { TaskDetailSheet } from "../task-detail-sheet"
import type { tasks, taskStatuses } from "@/lib/db/schema"

type Task = typeof tasks.$inferSelect
type TaskStatus = typeof taskStatuses.$inferSelect

// This view shows an em-dash for "none" in the Priority column \u2014 kept local.
const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "\u2014",
}

const INDENT_PX = 20

// ─── Task tree helpers ──────────────────────────────────────────────────────

type TaskNode = Task & { children: TaskNode[]; depth: number }

function buildTaskTree(tasks: Task[]): TaskNode[] {
  const taskMap = new Map<string, TaskNode>()
  const roots: TaskNode[] = []

  for (const t of tasks) {
    taskMap.set(t.id, { ...t, children: [], depth: 0 })
  }

  for (const t of tasks) {
    const node = taskMap.get(t.id)!
    if (t.parentTaskId && taskMap.has(t.parentTaskId)) {
      const parent = taskMap.get(t.parentTaskId)!
      node.depth = parent.depth + 1
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

function flattenTree(nodes: TaskNode[], expanded: Set<string>): TaskNode[] {
  const result: TaskNode[] = []
  function walk(list: TaskNode[]) {
    for (const node of list) {
      result.push(node)
      if (node.children.length > 0 && expanded.has(node.id)) {
        walk(node.children)
      }
    }
  }
  walk(nodes)
  return result
}

// ─── Component ────────────────────────────────────────────────────────────

interface TableViewProps {
  projectId: string
  statuses: TaskStatus[]
  tasks: Task[]
}

export function TableView({ projectId, statuses, tasks }: TableViewProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [newTitle, setNewTitle] = useState("")

  // Tree state — all parents expanded by default
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const parentIds = new Set<string>()
    for (const t of tasks) {
      if (tasks.some((c) => c.parentTaskId === t.id)) {
        parentIds.add(t.id)
      }
    }
    return parentIds
  })

  function toggleExpanded(taskId: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  const statusMap = Object.fromEntries(statuses.map((s) => [s.id, s]))
  const defaultStatusId = statuses[0]?.id

  const tree = buildTaskTree([...tasks].sort((a, b) => a.sortOrder - b.sortOrder))
  const visibleTasks = flattenTree(tree, expanded)

  async function handleAdd() {
    if (!newTitle.trim() || !defaultStatusId) return
    await createTask(projectId, defaultStatusId, newTitle.trim())
    setNewTitle("")
    setIsAdding(false)
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/30 sticky top-0 z-10">
            <th className="w-8 px-3 py-2 text-left text-xs font-medium text-muted-foreground">#</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Name</th>
            <th className="w-36 px-3 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
            <th className="w-32 px-3 py-2 text-left text-xs font-medium text-muted-foreground">Due Date</th>
            <th className="w-28 px-3 py-2 text-left text-xs font-medium text-muted-foreground">Priority</th>
          </tr>
        </thead>
        <tbody>
          {visibleTasks.map((task, i) => {
            const status = statusMap[task.statusId]
            const dueDate = task.dueDate ? new Date(task.dueDate) : null
            const isOverdue = dueDate && dueDate < new Date() && !task.isCompleted
            const priorityColor = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.none
            const hasChildren = task.children.length > 0
            const isExpanded = expanded.has(task.id)
            const isSubtask = task.depth > 0

            return (
              <tr
                key={task.id}
                className="border-b hover:bg-accent/30 cursor-pointer"
                onClick={() => { setSelectedTask(task); setSheetOpen(true) }}
              >
                <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2">
                  <div
                    className="relative flex items-center gap-2"
                    style={{ paddingLeft: task.depth * INDENT_PX }}
                  >
                    {/* Indent guide */}
                    {isSubtask && (
                      <div
                        className="absolute top-0 bottom-0 border-l border-muted-foreground/15"
                        style={{ left: (task.depth - 1) * INDENT_PX + 7 }}
                      />
                    )}

                    {/* Expand/collapse */}
                    {hasChildren ? (
                      <button
                        className="shrink-0 p-0.5 rounded hover:bg-accent text-muted-foreground"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleExpanded(task.id)
                        }}
                        aria-label={isExpanded ? "Collapse" : "Expand"}
                      >
                        {isExpanded ? (
                          <ChevronDown className="size-3" />
                        ) : (
                          <ChevronRight className="size-3" />
                        )}
                      </button>
                    ) : (
                      <span className="shrink-0 w-4" />
                    )}

                    {/* Checkbox */}
                    <button
                      className={`size-4 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                        task.isCompleted ? "bg-green-500 border-green-500" : "border-muted-foreground/30 hover:border-green-500"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation()
                        updateTask(task.id, task.projectId, { isCompleted: !task.isCompleted })
                      }}
                    >
                      {task.isCompleted && (
                        <svg className="size-2.5 text-white" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>

                    <span className={`${
                      task.isCompleted
                        ? "line-through text-muted-foreground"
                        : isSubtask
                          ? "text-muted-foreground"
                          : ""
                    }`}>
                      {task.title}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  {status && (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ backgroundColor: `${status.color}22`, color: status.color }}
                    >
                      <span className="size-1.5 rounded-full" style={{ backgroundColor: status.color }} />
                      {status.name}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {dueDate ? (
                    <span className={`text-xs ${isOverdue ? "text-red-400" : "text-muted-foreground"}`}>
                      {dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/30">&mdash;</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className={`flex items-center gap-1 text-xs ${priorityColor}`}>
                    {task.priority !== "none" && <Flag className="size-3" />}
                    {PRIORITY_LABELS[task.priority] ?? "\u2014"}
                  </span>
                </td>
              </tr>
            )
          })}

          {/* Add task row */}
          {isAdding ? (
            <tr className="border-b">
              <td className="px-3 py-2 text-xs text-muted-foreground">{tasks.length + 1}</td>
              <td className="px-3 py-2" colSpan={4}>
                <div className="flex items-center gap-2">
                  <div className="relative max-w-xs flex-1">
                    <Input
                      autoFocus
                      placeholder="Task name..."
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAdd()
                        if (e.key === "Escape") { setIsAdding(false); setNewTitle("") }
                      }}
                      className="h-7 text-sm pr-8"
                    />
                    <div className="absolute right-1 top-1/2 -translate-y-1/2">
                      <SpeechButton onTranscript={(text) => setNewTitle((prev) => prev ? `${prev} ${text}` : text)} size="sm" showPulse={false} tooltip="Dictate task" />
                    </div>
                  </div>
                  <button onClick={handleAdd} className="text-xs text-primary font-medium">Save</button>
                  <button onClick={() => { setIsAdding(false); setNewTitle("") }} className="text-xs text-muted-foreground">Cancel</button>
                </div>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {/* Add row button */}
      {!isAdding && (
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors border-b w-full"
        >
          <Plus className="size-3" />
          Add task
        </button>
      )}

      <TaskDetailSheet task={selectedTask} statuses={statuses} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  )
}
