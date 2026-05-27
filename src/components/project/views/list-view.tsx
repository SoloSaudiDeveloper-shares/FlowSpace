"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Plus, Flag, Calendar } from "lucide-react"
import { Input } from "@/components/ui/input"
import { SpeechButton } from "@/components/shared/speech-button"
import { createTask, updateTask } from "@/lib/actions/task-actions"
import { TaskDetailSheet } from "../task-detail-sheet"
import type { tasks, taskStatuses } from "@/lib/db/schema"

type Task = typeof tasks.$inferSelect
type TaskStatus = typeof taskStatuses.$inferSelect

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "text-red-400",
  high: "text-orange-400",
  medium: "text-yellow-400",
  low: "text-blue-400",
  none: "text-muted-foreground/30",
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

interface ListViewProps {
  projectId: string
  statuses: TaskStatus[]
  tasks: Task[]
}

export function ListView({ projectId, statuses, tasks }: ListViewProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  // Track which parent tasks are expanded (all by default)
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

  const tasksByStatus = statuses.reduce((acc, s) => {
    acc[s.id] = tasks.filter((t) => t.statusId === s.id).sort((a, b) => a.sortOrder - b.sortOrder)
    return acc
  }, {} as Record<string, Task[]>)

  function toggleCollapse(statusId: string) {
    setCollapsed((prev) => ({ ...prev, [statusId]: !prev[statusId] }))
  }

  function openTask(task: Task) {
    setSelectedTask(task)
    setSheetOpen(true)
  }

  return (
    <div className="flex flex-col">
      {/* Column headers */}
      <div className="flex items-center gap-2 px-4 py-2 border-b text-xs font-medium text-muted-foreground sticky top-0 bg-background z-10">
        <div className="flex-1 pl-10">Name</div>
        <div className="w-28 text-center">Due Date</div>
        <div className="w-20 text-center">Priority</div>
      </div>

      {statuses.map((status) => {
        const groupTasks = tasksByStatus[status.id] || []
        const isCollapsed = collapsed[status.id]

        // Build tree for this status group
        const tree = buildTaskTree(groupTasks)
        const visibleTasks = flattenTree(tree, expanded)

        return (
          <StatusGroup
            key={status.id}
            status={status}
            tasks={groupTasks}
            visibleTasks={visibleTasks}
            expanded={expanded}
            onToggleExpand={toggleExpanded}
            projectId={projectId}
            isCollapsed={isCollapsed}
            onToggle={() => toggleCollapse(status.id)}
            onTaskClick={openTask}
          />
        )
      })}

      <TaskDetailSheet
        task={selectedTask}
        statuses={statuses}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  )
}

function StatusGroup({
  status,
  tasks,
  visibleTasks,
  expanded,
  onToggleExpand,
  projectId,
  isCollapsed,
  onToggle,
  onTaskClick,
}: {
  status: TaskStatus
  tasks: Task[]
  visibleTasks: TaskNode[]
  expanded: Set<string>
  onToggleExpand: (id: string) => void
  projectId: string
  isCollapsed: boolean
  onToggle: () => void
  onTaskClick: (task: Task) => void
}) {
  const [isAdding, setIsAdding] = useState(false)
  const [newTitle, setNewTitle] = useState("")

  async function handleAdd() {
    if (!newTitle.trim()) return
    await createTask(projectId, status.id, newTitle.trim())
    setNewTitle("")
    setIsAdding(false)
  }

  return (
    <div>
      {/* Group header */}
      <div
        className="flex items-center gap-2 px-4 py-2 hover:bg-accent/30 cursor-pointer select-none border-b"
        onClick={onToggle}
      >
        <button className="text-muted-foreground shrink-0">
          {isCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
        <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: status.color }} />
        <span className="text-xs font-semibold uppercase tracking-wide">{status.name}</span>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>

      {!isCollapsed && (
        <>
          {visibleTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              depth={task.depth}
              hasChildren={task.children.length > 0}
              isExpanded={expanded.has(task.id)}
              onToggleExpand={onToggleExpand}
              onTaskClick={onTaskClick}
            />
          ))}

          {/* Add task inline */}
          {isAdding ? (
            <div className="flex items-center gap-2 px-4 py-1.5 border-b pl-10">
              <div className="relative flex-1">
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
              <button onClick={handleAdd} className="text-xs text-primary font-medium px-2">Save</button>
              <button onClick={() => { setIsAdding(false); setNewTitle("") }} className="text-xs text-muted-foreground">Cancel</button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setIsAdding(true) }}
              className="flex items-center gap-2 px-4 py-1.5 w-full text-xs text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors border-b pl-10"
            >
              <Plus className="size-3" /> Add task
            </button>
          )}
        </>
      )}
    </div>
  )
}

function TaskRow({
  task,
  depth,
  hasChildren,
  isExpanded,
  onToggleExpand,
  onTaskClick,
}: {
  task: Task
  depth: number
  hasChildren: boolean
  isExpanded: boolean
  onToggleExpand: (id: string) => void
  onTaskClick: (task: Task) => void
}) {
  const priorityColor = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.none
  const dueDate = task.dueDate ? new Date(task.dueDate) : null
  const isOverdue = dueDate && dueDate < new Date() && !task.isCompleted
  const isSubtask = depth > 0

  return (
    <div
      className="relative flex items-center gap-2 px-4 py-1.5 border-b hover:bg-accent/30 cursor-pointer group"
      style={{ paddingLeft: 16 + depth * INDENT_PX }}
      onClick={() => onTaskClick(task)}
    >
      {/* Indent guide line */}
      {isSubtask && (
        <div
          className="absolute top-0 bottom-0 border-l border-muted-foreground/15"
          style={{ left: 16 + (depth - 1) * INDENT_PX + 7 }}
        />
      )}

      {/* Expand/collapse toggle */}
      {hasChildren ? (
        <button
          className="shrink-0 p-0.5 rounded hover:bg-accent text-muted-foreground"
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpand(task.id)
          }}
          aria-label={isExpanded ? "Collapse subtasks" : "Expand subtasks"}
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
        onClick={(e) => { e.stopPropagation(); updateTask(task.id, task.projectId, { isCompleted: !task.isCompleted }) }}
      >
        {task.isCompleted && (
          <svg className="size-2.5 text-white" viewBox="0 0 12 12" fill="none">
            <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Name */}
      <span className={`flex-1 text-sm truncate ${
        task.isCompleted
          ? "line-through text-muted-foreground"
          : isSubtask
            ? "text-muted-foreground"
            : ""
      }`}>
        {task.title}
      </span>

      {/* Due date */}
      <div className="w-28 flex justify-center">
        {dueDate ? (
          <span className={`text-xs flex items-center gap-1 ${isOverdue ? "text-red-400" : "text-muted-foreground"}`}>
            <Calendar className="size-3" />
            {dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/30">&mdash;</span>
        )}
      </div>

      {/* Priority */}
      <div className="w-20 flex justify-center">
        <Flag className={`size-3.5 ${priorityColor}`} />
      </div>
    </div>
  )
}
