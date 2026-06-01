"use client"

import { useState, useEffect, useRef } from "react"
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Flag,
  Calendar,
  CalendarClock,
  MessageCircle,
  Timer,
  Play,
  Pause,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Circle,
  GitBranch,
  ListChecks,
  Tag,
  FileText,
  Square,
  CheckSquare,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { SpeechButton } from "@/components/shared/speech-button"
import {
  createTask,
  updateTask,
  deleteTask,
  startTaskTimer,
  stopTaskTimer,
} from "@/lib/actions/task-actions"
import { TaskDetailSheet } from "../task-detail-sheet"
import {
  ContextMenu,
  useContextMenu,
  type ContextMenuEntry,
} from "@/components/shared/context-menu"
import type { TaskCardMeta } from "../project-views"
import type { tasks, taskStatuses, taskLabels } from "@/lib/db/schema"

type Task = typeof tasks.$inferSelect
type TaskStatus = typeof taskStatuses.$inferSelect
type TaskLabel = typeof taskLabels.$inferSelect

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "text-red-400",
  high: "text-orange-400",
  medium: "text-yellow-400",
  low: "text-blue-400",
  none: "text-muted-foreground/30",
}

const PRIORITY_BAR: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
  none: "transparent",
}

/** Priority picker (value + swatch colour) for the right-click colour row. */
const PRIORITY_PICKER = [
  { value: "urgent" as const, color: "#ef4444", label: "Urgent" },
  { value: "high" as const, color: "#f97316", label: "High" },
  { value: "medium" as const, color: "#eab308", label: "Medium" },
  { value: "low" as const, color: "#3b82f6", label: "Low" },
  { value: "none" as const, color: "#94a3b8", label: "None" },
]
function colorToPriority(color: string): Task["priority"] {
  return PRIORITY_PICKER.find((p) => p.color === color)?.value ?? "none"
}

const INDENT_PX = 20

function trackedSeconds(task: Task, now: number): number {
  const base = task.timeTracked ?? 0
  if (!task.timeTrackingStartedAt) return base
  return base + Math.max(0, Math.floor((now - new Date(task.timeTrackingStartedAt).getTime()) / 1000))
}

function fmtTracked(sec: number): string {
  if (sec <= 0) return ""
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`
  if (m > 0) return `${m}m`
  return `${sec}s`
}

function fmtDate(d: string | null): string | null {
  if (!d) return null
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

/** YYYY-MM-DD `offsetDays` from today (local). */
function isoDate(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

// ─── Task tree helpers ──────────────────────────────────────────────────────

type TaskNode = Task & { children: TaskNode[]; depth: number }

function buildTaskTree(tasks: Task[]): TaskNode[] {
  const taskMap = new Map<string, TaskNode>()
  const roots: TaskNode[] = []
  for (const t of tasks) taskMap.set(t.id, { ...t, children: [], depth: 0 })
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
      if (node.children.length > 0 && expanded.has(node.id)) walk(node.children)
    }
  }
  walk(nodes)
  return result
}

// ─── Column visibility ──────────────────────────────────────────────────────

interface Cols {
  time: boolean
  start: boolean
  due: boolean
  priority: boolean
  subtasks: boolean
  checklists: boolean
  labels: boolean
  description: boolean
}

// ─── Component ────────────────────────────────────────────────────────────

interface ListViewProps {
  projectId: string
  statuses: TaskStatus[]
  tasks: Task[]
  /** Field keys hidden via the toolbar's "Fields" menu. */
  hiddenFields?: Set<string>
  /** Per-task labels + subtask/checklist counts (shared with the board). */
  taskMeta?: TaskCardMeta
  /** Multi-select mode (bulk actions). */
  selectMode?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (taskId: string, opts?: { range?: boolean; order?: string[] }) => void
}

export function ListView({ projectId, statuses, tasks, hiddenFields, taskMeta, selectMode, selectedIds, onToggleSelect }: ListViewProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetTab, setSheetTab] = useState<"details" | "comments">("details")
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const { menu, open: openMenu, close: closeMenu } = useContextMenu()
  // Hidden native date input used by the right-click "Custom date…" action.
  const dateInputRef = useRef<HTMLInputElement>(null)
  const pendingDateTask = useRef<Task | null>(null)

  const cols: Cols = {
    time: !hiddenFields?.has("timeTracking"),
    start: !hiddenFields?.has("startDate"),
    due: !hiddenFields?.has("dueDate"),
    priority: !hiddenFields?.has("priority"),
    subtasks: !hiddenFields?.has("subtasks"),
    checklists: !hiddenFields?.has("checklists"),
    labels: !hiddenFields?.has("labels"),
    description: !hiddenFields?.has("description"),
  }

  // Tick every second while any timer runs, so the Time column updates live.
  const anyRunning = tasks.some((t) => t.timeTrackingStartedAt)
  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    if (!anyRunning) return
    const i = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(i)
  }, [anyRunning])

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const parentIds = new Set<string>()
    for (const t of tasks) {
      if (tasks.some((c) => c.parentTaskId === t.id)) parentIds.add(t.id)
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

  // Preserve the order coming from the toolbar (already filtered + sorted).
  const tasksByStatus = statuses.reduce((acc, s) => {
    acc[s.id] = tasks.filter((t) => t.statusId === s.id)
    return acc
  }, {} as Record<string, Task[]>)

  function toggleCollapse(statusId: string) {
    setCollapsed((prev) => ({ ...prev, [statusId]: !prev[statusId] }))
  }

  // Visual top-to-bottom order of every visible row, used for Shift-click range
  // select. Collapsed groups contribute no rows (you can't shift into them).
  const flatOrderIds = statuses.flatMap((status) => {
    if (collapsed[status.id]) return []
    const groupTasks = tasksByStatus[status.id] || []
    return flattenTree(buildTaskTree(groupTasks), expanded).map((t) => t.id)
  })
  const rowToggle = (id: string, opts?: { range?: boolean }) =>
    onToggleSelect?.(id, { range: opts?.range, order: flatOrderIds })

  function openTask(task: Task, tab: "details" | "comments" = "details") {
    setSelectedTask(task)
    setSheetTab(tab)
    setSheetOpen(true)
  }

  // Right-click a row → quick actions that don't require opening the task.
  function handleRowContextMenu(e: React.MouseEvent, task: Task) {
    e.preventDefault()
    e.stopPropagation()
    const running = !!task.timeTrackingStartedAt
    const set = (data: Parameters<typeof updateTask>[2]) => updateTask(task.id, task.projectId, data)
    const items: ContextMenuEntry[] = [
      { header: true, title: task.title },
      { label: "Open", icon: ExternalLink, onClick: () => openTask(task) },
      { label: "Add comment", icon: MessageCircle, onClick: () => openTask(task, "comments") },
      running
        ? { label: "Stop timer", icon: Pause, onClick: () => stopTaskTimer(task.id, task.projectId) }
        : { label: "Start timer", icon: Play, onClick: () => startTaskTimer(task.id, task.projectId) },
      { separator: true },
      { header: true, title: "Priority" },
      {
        colors: true,
        options: PRIORITY_PICKER.map((p) => ({ value: p.color, label: p.label })),
        selected: PRIORITY_BAR[task.priority],
        onPick: (color) => set({ priority: colorToPriority(color) }),
      },
      { separator: true },
      { header: true, title: "Move to" },
      ...statuses.map((s) => ({
        label: s.name,
        swatchColor: s.color,
        onClick: () => set({ statusId: s.id, isCompleted: !!s.isDoneState }),
      })),
      { separator: true },
      { header: true, title: "Due date" },
      { label: "Today", icon: Calendar, onClick: () => set({ dueDate: isoDate(0) }) },
      { label: "Tomorrow", icon: Calendar, onClick: () => set({ dueDate: isoDate(1) }) },
      { label: "Next week", icon: Calendar, onClick: () => set({ dueDate: isoDate(7) }) },
      {
        label: "Custom date…",
        icon: CalendarClock,
        onClick: () => {
          pendingDateTask.current = task
          const inp = dateInputRef.current
          if (inp) {
            inp.value = task.dueDate?.split("T")[0] ?? ""
            if (inp.showPicker) inp.showPicker()
            else inp.click()
          }
        },
      },
      { label: "Clear due date", icon: Calendar, onClick: () => set({ dueDate: null }) },
      { separator: true },
      {
        label: task.isCompleted ? "Mark incomplete" : "Mark complete",
        icon: task.isCompleted ? Circle : CheckCircle2,
        onClick: () => set({ isCompleted: !task.isCompleted }),
      },
      {
        label: "Delete task",
        icon: Trash2,
        variant: "destructive",
        onClick: () => deleteTask(task.id, task.projectId),
      },
    ]
    openMenu(e, items)
  }

  return (
    <div className="flex flex-col">
      {/* Column headers */}
      <div className="flex items-center gap-2 px-4 py-2 border-b text-xs font-medium text-muted-foreground sticky top-0 bg-background z-10">
        <div className="flex-1 pl-10 min-w-0">Name</div>
        {cols.time && <div className="w-24 text-center shrink-0">Time</div>}
        {cols.subtasks && <div className="w-14 text-center shrink-0">Subs</div>}
        {cols.checklists && <div className="w-14 text-center shrink-0">Checks</div>}
        {cols.labels && <div className="w-40 shrink-0">Labels</div>}
        {cols.start && <div className="w-24 text-center shrink-0">Start</div>}
        {cols.due && <div className="w-24 text-center shrink-0">Due</div>}
        {cols.priority && <div className="w-16 text-center shrink-0">Prio</div>}
        {cols.description && <div className="w-10 text-center shrink-0">Desc</div>}
      </div>

      {statuses.map((status) => {
        const groupTasks = tasksByStatus[status.id] || []
        const isCollapsed = collapsed[status.id]
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
            onTaskContextMenu={handleRowContextMenu}
            cols={cols}
            meta={taskMeta}
            nowTick={nowTick}
            selectMode={!!selectMode}
            selectedIds={selectedIds}
            onToggleSelect={rowToggle}
          />
        )
      })}

      <TaskDetailSheet
        task={selectedTask}
        statuses={statuses}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        initialTab={sheetTab}
      />

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={closeMenu} />
      )}

      {/* Hidden native date picker for the "Custom date…" quick action. */}
      <input
        ref={dateInputRef}
        type="date"
        className="fixed bottom-2 left-2 size-px opacity-0 pointer-events-none"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const t = pendingDateTask.current
          if (t) updateTask(t.id, t.projectId, { dueDate: e.target.value || null })
          pendingDateTask.current = null
        }}
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
  onTaskContextMenu,
  cols,
  meta,
  nowTick,
  selectMode,
  selectedIds,
  onToggleSelect,
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
  onTaskContextMenu: (e: React.MouseEvent, task: Task) => void
  cols: Cols
  meta?: TaskCardMeta
  nowTick: number
  selectMode: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (id: string, opts?: { range?: boolean }) => void
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
              onTaskContextMenu={onTaskContextMenu}
              cols={cols}
              meta={meta}
              nowTick={nowTick}
              selectMode={selectMode}
              selected={!!selectedIds?.has(task.id)}
              onToggleSelect={onToggleSelect}
            />
          ))}

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
  onTaskContextMenu,
  cols,
  meta,
  nowTick,
  selectMode,
  selected,
  onToggleSelect,
}: {
  task: Task
  depth: number
  hasChildren: boolean
  isExpanded: boolean
  onToggleExpand: (id: string) => void
  onTaskClick: (task: Task) => void
  onTaskContextMenu: (e: React.MouseEvent, task: Task) => void
  cols: Cols
  meta?: TaskCardMeta
  nowTick: number
  selectMode: boolean
  selected: boolean
  onToggleSelect?: (id: string, opts?: { range?: boolean }) => void
}) {
  const priorityColor = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.none
  const barColor = PRIORITY_BAR[task.priority] ?? PRIORITY_BAR.none
  const dueDate = task.dueDate ? new Date(task.dueDate) : null
  const isOverdue = dueDate && dueDate < new Date() && !task.isCompleted
  const isSubtask = depth > 0
  const timerRunning = !!task.timeTrackingStartedAt
  const tracked = trackedSeconds(task, nowTick)
  const labels: TaskLabel[] = meta?.labelsByTask[task.id] ?? []
  const subs = meta?.subtaskCounts[task.id]
  const checks = meta?.checklistByTask[task.id]

  return (
    <div
      className={`relative flex items-center gap-2 px-4 py-1.5 border-b cursor-pointer group ${
        selected ? "bg-primary/10" : "hover:bg-accent/30"
      }`}
      style={{ paddingLeft: 16 + depth * INDENT_PX }}
      onClick={(e) => (selectMode ? onToggleSelect?.(task.id, { range: e.shiftKey }) : onTaskClick(task))}
      onContextMenu={(e) => onTaskContextMenu(e, task)}
    >
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: barColor }} aria-hidden />

      {/* Selection checkbox (multi-select mode) */}
      {selectMode && (
        <button
          className="shrink-0"
          onClick={(e) => { e.stopPropagation(); onToggleSelect?.(task.id, { range: e.shiftKey }) }}
          aria-label={selected ? "Deselect" : "Select"}
        >
          {selected ? (
            <CheckSquare className="size-4 text-primary" />
          ) : (
            <Square className="size-4 text-muted-foreground/50" />
          )}
        </button>
      )}

      {isSubtask && (
        <div
          className="absolute top-0 bottom-0 border-l border-muted-foreground/15"
          style={{ left: 16 + (depth - 1) * INDENT_PX + 7 }}
        />
      )}

      {hasChildren ? (
        <button
          className="shrink-0 p-0.5 rounded hover:bg-accent text-muted-foreground"
          onClick={(e) => { e.stopPropagation(); onToggleExpand(task.id) }}
          aria-label={isExpanded ? "Collapse subtasks" : "Expand subtasks"}
        >
          {isExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        </button>
      ) : (
        <span className="shrink-0 w-4" />
      )}

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
      <span className={`flex-1 min-w-0 text-sm truncate ${
        task.isCompleted ? "line-through text-muted-foreground" : isSubtask ? "text-muted-foreground" : ""
      }`}>
        {task.title}
      </span>

      {/* Time */}
      {cols.time && (
        <div className="w-24 flex justify-center shrink-0">
          {tracked > 0 || timerRunning ? (
            <span className={`text-xs flex items-center gap-1 font-mono ${timerRunning ? "text-red-400" : "text-muted-foreground"}`}>
              {timerRunning ? <span className="size-1.5 rounded-full bg-red-400 animate-pulse" /> : <Timer className="size-3" />}
              {fmtTracked(tracked) || "0s"}
            </span>
          ) : <span className="text-xs text-muted-foreground/30">&mdash;</span>}
        </div>
      )}

      {/* Subtasks */}
      {cols.subtasks && (
        <div className="w-14 flex justify-center shrink-0">
          {subs && subs.total > 0 ? (
            <span className="text-xs text-muted-foreground flex items-center gap-1"><GitBranch className="size-3" />{subs.done}/{subs.total}</span>
          ) : <span className="text-xs text-muted-foreground/30">&mdash;</span>}
        </div>
      )}

      {/* Checklists */}
      {cols.checklists && (
        <div className="w-14 flex justify-center shrink-0">
          {checks && checks.total > 0 ? (
            <span className="text-xs text-muted-foreground flex items-center gap-1"><ListChecks className="size-3" />{checks.done}/{checks.total}</span>
          ) : <span className="text-xs text-muted-foreground/30">&mdash;</span>}
        </div>
      )}

      {/* Labels */}
      {cols.labels && (
        <div className="w-40 flex items-center gap-1 overflow-hidden shrink-0">
          {labels.length > 0 ? labels.slice(0, 3).map((l) => (
            <span key={l.id} className="text-[10px] px-1.5 py-0.5 rounded-full truncate max-w-[72px]"
              style={{ backgroundColor: `${l.color}20`, color: l.color }}>
              {l.name}
            </span>
          )) : <Tag className="size-3 text-muted-foreground/30" />}
          {labels.length > 3 && <span className="text-[10px] text-muted-foreground">+{labels.length - 3}</span>}
        </div>
      )}

      {/* Start date */}
      {cols.start && (
        <div className="w-24 flex justify-center shrink-0">
          {task.startDate ? (
            <span className="text-xs text-muted-foreground flex items-center gap-1"><CalendarClock className="size-3" />{fmtDate(task.startDate)}</span>
          ) : <span className="text-xs text-muted-foreground/30">&mdash;</span>}
        </div>
      )}

      {/* Due date */}
      {cols.due && (
        <div className="w-24 flex justify-center shrink-0">
          {dueDate ? (
            <span className={`text-xs flex items-center gap-1 ${isOverdue ? "text-red-400" : "text-muted-foreground"}`}>
              <Calendar className="size-3" />{fmtDate(task.dueDate)}
            </span>
          ) : <span className="text-xs text-muted-foreground/30">&mdash;</span>}
        </div>
      )}

      {/* Priority */}
      {cols.priority && (
        <div className="w-16 flex justify-center shrink-0">
          <Flag className={`size-3.5 ${priorityColor}`} />
        </div>
      )}

      {/* Description present? */}
      {cols.description && (
        <div className="w-10 flex justify-center shrink-0">
          {task.description?.trim() ? <FileText className="size-3.5 text-muted-foreground" /> : <span className="text-xs text-muted-foreground/30">&mdash;</span>}
        </div>
      )}
    </div>
  )
}
