"use client"

import { useState, useCallback, useRef } from "react"
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronRightIcon,
  Plus,
  Trash2,
  Copy,
  Flag,
  Pencil,
  Calendar,
  CircleDot,
  CheckCircle2,
  Circle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TaskDetailSheet } from "../task-detail-sheet"
import {
  ContextMenu,
  useContextMenu,
  type ContextMenuEntry,
} from "@/components/shared/context-menu"
import {
  updateTask,
  deleteTask,
  createTask,
} from "@/lib/actions/task-actions"
import { usePreferences } from "@/lib/hooks/use-preferences"
import type { tasks, taskStatuses } from "@/lib/db/schema"

type Task = typeof tasks.$inferSelect
type TaskStatus = typeof taskStatuses.$inferSelect

// ─── Helpers ────────────────────────────────────────────────────────────────

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function dayDiff(a: Date, b: Date) {
  return Math.round(
    (startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000,
  )
}

function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function getWeekNumber(d: Date) {
  const oneJan = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7)
}

// ─── Task Tree Helpers ─────────────────────────────────────────────────────

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

// ─── Constants ──────────────────────────────────────────────────────────────

type ZoomLevel = "day" | "week" | "month"

const ZOOM: Record<ZoomLevel, { colW: number; days: number; label: string }> = {
  day:   { colW: 72, days: 14,  label: "Day" },
  week:  { colW: 48, days: 28,  label: "Week" },
  month: { colW: 28, days: 60,  label: "Month" },
}

const ROW_H = 40
const INDENT_PX = 20

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
  none: "#94a3b8",
}

const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "None",
}

// ─── Component ──────────────────────────────────────────────────────────────

interface GanttViewProps {
  projectId: string
  statuses: TaskStatus[]
  tasks: Task[]
}

export function GanttView({
  projectId,
  statuses,
  tasks: allTasks,
}: GanttViewProps) {
  const today = startOfDay(new Date())
  const [viewStart, setViewStart] = useState(() => addDays(today, -3))
  const [zoom, setZoom] = useState<ZoomLevel>("week")
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const { menu: ctxMenu, open: openCtx, close: closeCtx } = useContextMenu()
  const timelineRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  // Preferences for tooltip
  const { preferences } = usePreferences()
  const tooltipFields = preferences.ganttTooltipFields

  // Tooltip state
  const [tooltip, setTooltip] = useState<{
    task: TaskNode
    x: number
    y: number
  } | null>(null)

  // Tree state — all parents expanded by default
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const parentIds = new Set<string>()
    for (const t of allTasks) {
      if (allTasks.some((c) => c.parentTaskId === t.id)) {
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

  // Build tree and flatten
  const tree = buildTaskTree(allTasks)
  const visibleTasks = flattenTree(tree, expanded)

  const { colW, days: daysCount } = ZOOM[zoom]

  // Build day columns
  const days: Date[] = []
  for (let i = 0; i < daysCount; i++) {
    days.push(addDays(viewStart, i))
  }

  const todayIdx = days.findIndex(
    (d) =>
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate(),
  )

  const statusMap = Object.fromEntries(statuses.map((s) => [s.id, s]))
  const totalWidth = daysCount * colW

  // Navigation
  function shift(n: number) {
    setViewStart((prev) => addDays(prev, n))
  }
  function goToday() {
    setViewStart(addDays(today, -3))
  }

  // ─── Week group headers ─────────────────────────────────────────────────
  const wkGroups: { label: string; span: number }[] = []
  {
    let prevKey = ""
    let span = 0
    let label = ""
    days.forEach((d, i) => {
      const key = `${d.getFullYear()}-W${getWeekNumber(d)}`
      if (key !== prevKey) {
        if (span > 0) wkGroups.push({ label, span })
        prevKey = key
        span = 1
        label = `W${getWeekNumber(d)}  ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
      } else {
        span++
      }
      if (i === days.length - 1) wkGroups.push({ label, span })
    })
  }

  // ─── Drag state ─────────────────────────────────────────────────────────

  const handleBarDrag = useCallback(
    (
      task: Task,
      e: React.PointerEvent,
      mode: "move" | "resize-start" | "resize-end",
    ) => {
      e.preventDefault()
      e.stopPropagation()

      // Hide tooltip and mark as dragging
      setTooltip(null)
      isDragging.current = true

      const timeline = timelineRef.current
      if (!timeline) return

      const taskStart = task.startDate
        ? startOfDay(new Date(task.startDate))
        : task.dueDate
          ? startOfDay(new Date(task.dueDate))
          : null
      const taskEnd = task.dueDate
        ? startOfDay(new Date(task.dueDate))
        : task.startDate
          ? startOfDay(new Date(task.startDate))
          : null
      if (!taskStart || !taskEnd) return

      const startX = e.clientX
      const origStartDiff = dayDiff(viewStart, taskStart)
      const origEndDiff = dayDiff(viewStart, taskEnd)

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX
        const dayShift = Math.round(dx / colW)

        const bar = document.querySelector(
          `[data-gantt-bar="${task.id}"]`,
        ) as HTMLElement | null
        if (!bar) return

        if (mode === "move") {
          const newStartCol = origStartDiff + dayShift
          bar.style.left = `${newStartCol * colW}px`
        } else if (mode === "resize-start") {
          const newStartCol = Math.min(origStartDiff + dayShift, origEndDiff)
          const newWidth = (origEndDiff - newStartCol + 1) * colW - 4
          bar.style.left = `${newStartCol * colW}px`
          bar.style.width = `${Math.max(colW - 4, newWidth)}px`
        } else {
          const newEndCol = Math.max(origStartDiff, origEndDiff + dayShift)
          const newWidth = (newEndCol - origStartDiff + 1) * colW - 4
          bar.style.width = `${Math.max(colW - 4, newWidth)}px`
        }
      }

      const onUp = (ev: PointerEvent) => {
        document.removeEventListener("pointermove", onMove)
        document.removeEventListener("pointerup", onUp)
        isDragging.current = false

        const dx = ev.clientX - startX
        const dayShift = Math.round(dx / colW)
        if (dayShift === 0) return

        let newStart: Date
        let newEnd: Date

        if (mode === "move") {
          newStart = addDays(taskStart, dayShift)
          newEnd = addDays(taskEnd, dayShift)
        } else if (mode === "resize-start") {
          newStart = addDays(taskStart, dayShift)
          newEnd = taskEnd
          if (newStart > newEnd) newStart = newEnd
        } else {
          newStart = taskStart
          newEnd = addDays(taskEnd, dayShift)
          if (newEnd < newStart) newEnd = newStart
        }

        updateTask(task.id, projectId, {
          startDate: fmtDate(newStart),
          dueDate: fmtDate(newEnd),
        })
      }

      document.addEventListener("pointermove", onMove)
      document.addEventListener("pointerup", onUp)
    },
    [colW, projectId, viewStart],
  )

  // ─── Click to schedule ──────────────────────────────────────────────────

  function handleRowClick(task: Task, e: React.MouseEvent) {
    if (task.startDate || task.dueDate) return
    const timeline = timelineRef.current
    if (!timeline) return
    const rect = timeline.getBoundingClientRect()
    const x = e.clientX - rect.left + timeline.scrollLeft
    const dayIndex = Math.floor(x / colW)
    if (dayIndex < 0 || dayIndex >= days.length) return
    const clickedDate = fmtDate(days[dayIndex])
    updateTask(task.id, projectId, {
      startDate: clickedDate,
      dueDate: clickedDate,
    })
  }

  // ─── Context menu ───────────────────────────────────────────────────────

  function handleTaskContextMenu(e: React.MouseEvent, task: Task) {
    e.preventDefault()
    e.stopPropagation()

    const statusItems: ContextMenuEntry[] = statuses.map((s) => ({
      label: s.name,
      icon: CircleDot,
      onClick: () =>
        updateTask(task.id, projectId, { statusId: s.id }),
    }))

    const priorityItems: ContextMenuEntry[] = (
      ["urgent", "high", "medium", "low", "none"] as const
    ).map((p) => ({
      label: PRIORITY_LABELS[p],
      icon: Flag,
      onClick: () => updateTask(task.id, projectId, { priority: p }),
    }))

    const items: ContextMenuEntry[] = [
      {
        label: "Open",
        icon: Pencil,
        onClick: () => {
          setSelectedTask(task)
          setSheetOpen(true)
        },
      },
      {
        label: "Rename",
        icon: Pencil,
        onClick: async () => {
          const name = window.prompt("Rename task:", task.title)
          if (name?.trim())
            await updateTask(task.id, projectId, { title: name.trim() })
        },
      },
      { separator: true },
      ...statusItems,
      { separator: true },
      ...priorityItems,
      { separator: true },
      {
        label: "Unschedule",
        icon: Calendar,
        onClick: () =>
          updateTask(task.id, projectId, {
            startDate: null,
            dueDate: null,
          }),
      },
      {
        label: "Duplicate",
        icon: Copy,
        onClick: async () => {
          await createTask(projectId, task.statusId, `${task.title} (copy)`)
        },
      },
      { separator: true },
      {
        label: "Delete",
        icon: Trash2,
        variant: "destructive" as const,
        onClick: () => deleteTask(task.id, projectId),
      },
    ]
    openCtx(e, items)
  }

  // ─── Tooltip handlers ──────────────────────────────────────────────────

  function showTooltip(task: TaskNode, e: React.MouseEvent) {
    if (isDragging.current) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setTooltip({
      task,
      x: rect.left + rect.width / 2,
      y: rect.top,
    })
  }

  function hideTooltip() {
    setTooltip(null)
  }

  // ─── Add task ───────────────────────────────────────────────────────────

  async function handleAddTask() {
    if (!newTitle.trim() || statuses.length === 0) return
    await createTask(projectId, statuses[0].id, newTitle.trim())
    setNewTitle("")
    setIsAdding(false)
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={goToday}
        >
          Today
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => shift(-7)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => shift(7)}
        >
          <ChevronRight className="size-4" />
        </Button>
        <span className="text-sm text-muted-foreground flex-1">
          {days[0].toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
          {" \u2013 "}
          {days[days.length - 1].toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>

        {/* Zoom */}
        <div className="flex bg-muted rounded-md p-0.5 gap-0.5">
          {(Object.keys(ZOOM) as ZoomLevel[]).map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`px-2 py-0.5 text-xs rounded-sm transition-colors ${
                zoom === z
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {ZOOM[z].label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Left: task list sidebar */}
        <div className="w-72 shrink-0 border-r flex flex-col overflow-y-auto">
          {/* Sidebar header */}
          <div className="border-b bg-muted/30 shrink-0" style={{ height: 56 }}>
            <div className="flex items-end h-full px-4 pb-2 gap-4">
              <span className="text-xs font-medium text-muted-foreground flex-1">
                Name
              </span>
              <span className="text-xs font-medium text-muted-foreground w-20 text-right">
                Due Date
              </span>
            </div>
          </div>

          {/* Task rows */}
          {visibleTasks.map((task) => {
            const status = statusMap[task.statusId]
            const hasChildren = task.children.length > 0
            const isExpanded = expanded.has(task.id)
            const depth = task.depth
            const due = task.dueDate
              ? new Date(task.dueDate).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })
              : "\u2014"

            return (
              <div
                key={task.id}
                className="flex items-center gap-1.5 border-b hover:bg-accent/30 cursor-pointer shrink-0 pr-4 group"
                style={{ height: ROW_H, paddingLeft: 16 + depth * INDENT_PX }}
                onClick={() => {
                  setSelectedTask(task)
                  setSheetOpen(true)
                }}
                onContextMenu={(e) => handleTaskContextMenu(e, task)}
              >
                {/* Indent guide line for subtasks */}
                {depth > 0 && (
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
                      toggleExpanded(task.id)
                    }}
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                  >
                    {isExpanded ? (
                      <ChevronDown className="size-3" />
                    ) : (
                      <ChevronRightIcon className="size-3" />
                    )}
                  </button>
                ) : (
                  <span className="shrink-0 w-4" />
                )}

                {/* Status dot */}
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: status?.color ?? "#94a3b8",
                  }}
                />

                {/* Task name */}
                <span
                  className={`flex-1 text-sm truncate ${
                    task.isCompleted
                      ? "line-through text-muted-foreground"
                      : depth > 0
                        ? "text-muted-foreground"
                        : ""
                  }`}
                >
                  {task.title}
                </span>

                {/* Due date */}
                <span className="text-xs text-muted-foreground w-16 text-right shrink-0">
                  {due}
                </span>
              </div>
            )
          })}

          {/* Add task row */}
          {isAdding ? (
            <div className="flex items-center gap-2 px-4 border-b shrink-0" style={{ height: ROW_H }}>
              <Input
                autoFocus
                className="h-7 text-sm"
                placeholder="Task name..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddTask()
                  if (e.key === "Escape") {
                    setIsAdding(false)
                    setNewTitle("")
                  }
                }}
              />
            </div>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-1.5 px-4 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors shrink-0"
              style={{ height: ROW_H }}
            >
              <Plus className="size-3" />
              Add Task
            </button>
          )}
        </div>

        {/* Right: timeline */}
        <div ref={timelineRef} className="flex-1 overflow-auto">
          {/* Header: week row + day row */}
          <div
            className="sticky top-0 z-10 bg-background border-b"
            style={{ width: totalWidth }}
          >
            {/* Week row */}
            <div className="flex border-b" style={{ height: 24 }}>
              {wkGroups.map((wk, i) => (
                <div
                  key={i}
                  className="text-[10px] text-muted-foreground font-medium truncate px-2 flex items-center border-r"
                  style={{ width: wk.span * colW }}
                >
                  {wk.label}
                </div>
              ))}
            </div>

            {/* Day row */}
            <div className="flex" style={{ height: 32 }}>
              {days.map((day, i) => {
                const isToday = i === todayIdx
                const isWeekend =
                  day.getDay() === 0 || day.getDay() === 6
                return (
                  <div
                    key={i}
                    className={`flex flex-col items-center justify-center border-r shrink-0 ${
                      isWeekend ? "bg-muted/40" : ""
                    }`}
                    style={{ width: colW }}
                  >
                    <span
                      className={`text-[10px] leading-none ${
                        isToday
                          ? "font-bold text-primary"
                          : "text-muted-foreground"
                      }`}
                    >
                      {day
                        .toLocaleDateString(undefined, {
                          weekday: "short",
                        })
                        .slice(0, 2)}
                    </span>
                    <span
                      className={`text-xs font-medium leading-none mt-0.5 ${
                        isToday
                          ? "bg-primary text-primary-foreground rounded-full size-5 flex items-center justify-center"
                          : ""
                      }`}
                    >
                      {day.getDate()}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Timeline rows */}
          <div className="relative" style={{ width: totalWidth }}>
            {/* Today line */}
            {todayIdx >= 0 && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500/70 z-30 pointer-events-none"
                style={{ left: todayIdx * colW + colW / 2 }}
              />
            )}

            {visibleTasks.map((task) => {
              const status = statusMap[task.statusId]
              const color = status?.color ?? "#6366f1"
              const isSubtask = task.depth > 0

              const taskStartDate = task.startDate
                ? startOfDay(new Date(task.startDate))
                : null
              const taskEndDate = task.dueDate
                ? startOfDay(new Date(task.dueDate))
                : null

              const barStart = taskStartDate ?? taskEndDate
              const barEnd = taskEndDate ?? taskStartDate
              const hasBar = barStart && barEnd

              let barLeft = 0
              let barWidth = 0
              if (hasBar) {
                const startCol = dayDiff(viewStart, barStart)
                const endCol = dayDiff(viewStart, barEnd)
                barLeft = startCol * colW
                barWidth = (endCol - startCol + 1) * colW - 4
              }

              return (
                <div
                  key={task.id}
                  className="relative flex items-center border-b"
                  style={{ height: ROW_H }}
                  onContextMenu={(e) => handleTaskContextMenu(e, task)}
                  onClick={(e) => handleRowClick(task, e)}
                >
                  {/* Background columns */}
                  {days.map((day, i) => {
                    const isWeekend =
                      day.getDay() === 0 || day.getDay() === 6
                    return (
                      <div
                        key={i}
                        className={`h-full border-r shrink-0 ${
                          isWeekend ? "bg-muted/20" : ""
                        }`}
                        style={{ width: colW }}
                      />
                    )
                  })}

                  {/* Task bar */}
                  {hasBar && barWidth > 0 && (
                    <div
                      data-gantt-bar={task.id}
                      className={`absolute top-1/2 -translate-y-1/2 flex items-center rounded-md cursor-grab active:cursor-grabbing z-10 group/bar select-none ${
                        isSubtask ? "opacity-80" : ""
                      }`}
                      style={{
                        left: barLeft,
                        width: Math.max(colW - 4, barWidth),
                        height: isSubtask ? ROW_H - 16 : ROW_H - 12,
                        backgroundColor: `${color}33`,
                        border: `1.5px solid ${color}`,
                      }}
                      onPointerDown={(e) => handleBarDrag(task, e, "move")}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedTask(task)
                        setSheetOpen(true)
                      }}
                      onMouseEnter={(e) => showTooltip(task, e)}
                      onMouseLeave={hideTooltip}
                    >
                      {/* Left resize handle */}
                      <div
                        className="absolute left-0 top-0 w-1.5 h-full cursor-ew-resize z-20 opacity-0 group-hover/bar:opacity-100 hover:bg-foreground/20 rounded-l-md"
                        onPointerDown={(e) => {
                          e.stopPropagation()
                          handleBarDrag(task, e, "resize-start")
                        }}
                      />

                      {/* Bar content */}
                      <div className="flex items-center gap-1.5 px-2 overflow-hidden flex-1 min-w-0">
                        <span
                          className="size-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span
                          className={`text-xs font-medium truncate ${
                            isSubtask ? "text-[11px]" : ""
                          }`}
                          style={{ color }}
                        >
                          {task.title}
                        </span>
                      </div>

                      {/* Right resize handle */}
                      <div
                        className="absolute right-0 top-0 w-1.5 h-full cursor-ew-resize z-20 opacity-0 group-hover/bar:opacity-100 hover:bg-foreground/20 rounded-r-md"
                        onPointerDown={(e) => {
                          e.stopPropagation()
                          handleBarDrag(task, e, "resize-end")
                        }}
                      />
                    </div>
                  )}

                  {/* Unscheduled indicator */}
                  {!hasBar && (
                    <div className="absolute inset-0 flex items-center px-3 z-10 pointer-events-none">
                      <span className="text-xs text-muted-foreground/50 italic">
                        Click to schedule
                      </span>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Add task row in timeline */}
            <div
              className="border-b"
              style={{ height: ROW_H, width: totalWidth }}
            />
          </div>
        </div>
      </div>

      {/* ─── Hover Tooltip ─────────────────────────────────────────────────── */}
      {tooltip && tooltipFields.length > 0 && (
        <GanttTooltip
          task={tooltip.task}
          x={tooltip.x}
          y={tooltip.y}
          fields={tooltipFields}
          statusMap={statusMap}
        />
      )}

      <TaskDetailSheet
        task={selectedTask}
        statuses={statuses}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxMenu.items}
          onClose={closeCtx}
        />
      )}
    </div>
  )
}

// ─── Gantt Tooltip ──────────────────────────────────────────────────────────

function GanttTooltip({
  task,
  x,
  y,
  fields,
  statusMap,
}: {
  task: TaskNode
  x: number
  y: number
  fields: string[]
  statusMap: Record<string, TaskStatus>
}) {
  const status = statusMap[task.statusId]

  // Keep tooltip within viewport
  const safeX = Math.max(120, Math.min(x, (typeof window !== "undefined" ? window.innerWidth : 1200) - 120))
  const showAbove = y > 140

  return (
    <div
      className="fixed z-[100] pointer-events-none animate-in fade-in-0 zoom-in-95 duration-100"
      style={{
        left: safeX,
        top: showAbove ? y - 10 : y + 40,
        transform: showAbove ? "translate(-50%, -100%)" : "translate(-50%, 0)",
      }}
    >
      <div className="relative bg-popover/95 backdrop-blur-sm border border-border rounded-lg shadow-xl px-3.5 py-2.5 min-w-[180px] max-w-[260px]">
        {/* Task title — always shown */}
        <p className="text-sm font-semibold text-foreground leading-snug mb-1 line-clamp-2">
          {task.title}
        </p>

        {/* Info fields */}
        {(fields.includes("status") || fields.includes("priority") || fields.includes("dates") || fields.includes("completion")) && (
          <>
            <div className="h-px bg-border my-1.5" />
            <div className="space-y-1">
              {/* Status */}
              {fields.includes("status") && status && (
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: status.color }}
                  />
                  <span className="text-muted-foreground">{status.name}</span>
                </div>
              )}

              {/* Priority */}
              {fields.includes("priority") && task.priority !== "none" && (
                <div className="flex items-center gap-2 text-xs">
                  <Flag
                    className="size-3 shrink-0"
                    style={{ color: PRIORITY_COLORS[task.priority] }}
                  />
                  <span className="text-muted-foreground">
                    {PRIORITY_LABELS[task.priority]}
                  </span>
                </div>
              )}

              {/* Dates */}
              {fields.includes("dates") && (task.startDate || task.dueDate) && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="size-3 shrink-0" />
                  <span>
                    {task.startDate &&
                      new Date(task.startDate).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    {task.startDate && task.dueDate && " \u2192 "}
                    {task.dueDate &&
                      new Date(task.dueDate).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                  </span>
                </div>
              )}

              {/* Completion */}
              {fields.includes("completion") && (
                <div className="flex items-center gap-2 text-xs">
                  {task.isCompleted ? (
                    <>
                      <CheckCircle2 className="size-3 shrink-0 text-green-500" />
                      <span className="text-green-500">Completed</span>
                    </>
                  ) : (
                    <>
                      <Circle className="size-3 shrink-0 text-muted-foreground/50" />
                      <span className="text-muted-foreground">In progress</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Arrow */}
        {showAbove ? (
          <div
            className="absolute left-1/2 -translate-x-1/2 -bottom-[5px] w-[10px] h-[10px] bg-popover border-r border-b border-border rotate-45"
          />
        ) : (
          <div
            className="absolute left-1/2 -translate-x-1/2 -top-[5px] w-[10px] h-[10px] bg-popover border-l border-t border-border rotate-45"
          />
        )}
      </div>
    </div>
  )
}
