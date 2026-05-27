"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TaskDetailSheet } from "../task-detail-sheet"
import type { tasks, taskStatuses } from "@/lib/db/schema"

type Task = typeof tasks.$inferSelect
type TaskStatus = typeof taskStatuses.$inferSelect

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

interface CalendarViewProps {
  projectId: string
  statuses: TaskStatus[]
  tasks: Task[]
}

export function CalendarView({ statuses, tasks }: CalendarViewProps) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1) }
    else setMonth((m) => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1) }
    else setMonth((m) => m + 1)
  }
  function goToday() {
    setYear(today.getFullYear())
    setMonth(today.getMonth())
  }

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  // Tasks keyed by "YYYY-M-D"
  const tasksByDate: Record<string, Task[]> = {}
  for (const task of tasks) {
    if (!task.dueDate) continue
    const d = new Date(task.dueDate)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    if (!tasksByDate[key]) tasksByDate[key] = []
    tasksByDate[key].push(task)
  }

  const unscheduled = tasks.filter((t) => !t.dueDate)
  const overdue = tasks.filter((t) => {
    if (!t.dueDate || t.isCompleted) return false
    return new Date(t.dueDate) < today
  })

  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" })

  // Grid cells: prev month overflow + current month + next month overflow
  const cells: { date: Date; isCurrentMonth: boolean }[] = []
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, daysInPrevMonth - i), isCurrentMonth: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), isCurrentMonth: true })
  }
  const remaining = 42 - cells.length
  for (let d = 1; d <= remaining; d++) {
    cells.push({ date: new Date(year, month + 1, d), isCurrentMonth: false })
  }

  const statusMap = Object.fromEntries(statuses.map((s) => [s.id, s]))

  return (
    <div className="flex h-full">
      {/* Calendar */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b">
          <Button variant="outline" size="sm" onClick={goToday} className="h-7 text-xs">Today</Button>
          <Button variant="ghost" size="icon" className="size-7" onClick={prevMonth}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7" onClick={nextMonth}>
            <ChevronRight className="size-4" />
          </Button>
          <span className="text-sm font-medium">{monthLabel}</span>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b">
          {DAYS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground border-r last:border-r-0">
              {d}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 grid grid-cols-7" style={{ gridTemplateRows: `repeat(6, minmax(0, 1fr))` }}>
          {cells.map((cell, i) => {
            const key = `${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`
            const cellTasks = tasksByDate[key] || []
            const isToday =
              cell.date.getFullYear() === today.getFullYear() &&
              cell.date.getMonth() === today.getMonth() &&
              cell.date.getDate() === today.getDate()

            return (
              <div
                key={i}
                className={`border-r border-b last:border-r-0 p-1 flex flex-col gap-0.5 min-h-0 ${
                  !cell.isCurrentMonth ? "bg-muted/20" : ""
                }`}
              >
                <span
                  className={`text-xs self-end px-1 rounded-full ${
                    isToday
                      ? "bg-primary text-primary-foreground font-bold"
                      : cell.isCurrentMonth
                      ? "text-foreground"
                      : "text-muted-foreground/40"
                  }`}
                >
                  {cell.date.getDate()}
                </span>
                {cellTasks.slice(0, 3).map((task) => {
                  const status = statusMap[task.statusId]
                  return (
                    <button
                      key={task.id}
                      onClick={() => { setSelectedTask(task); setSheetOpen(true) }}
                      className="flex items-center gap-1 rounded text-xs px-1 py-0.5 hover:opacity-80 text-left truncate w-full"
                      style={{ backgroundColor: `${status?.color ?? "#6366f1"}22`, color: status?.color ?? "#6366f1" }}
                    >
                      <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: status?.color ?? "#6366f1" }} />
                      <span className="truncate">{task.title}</span>
                    </button>
                  )
                })}
                {cellTasks.length > 3 && (
                  <span className="text-xs text-muted-foreground px-1">+{cellTasks.length - 3} more</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Right sidebar */}
      <div className="w-36 border-l flex flex-col shrink-0">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Unscheduled</span>
            <span className="text-xs font-semibold">{unscheduled.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-red-400">Overdue</span>
            <span className="text-xs font-semibold text-red-400">{overdue.length}</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {unscheduled.map((task) => (
            <button
              key={task.id}
              onClick={() => { setSelectedTask(task); setSheetOpen(true) }}
              className="w-full text-left text-xs rounded px-2 py-1 hover:bg-accent truncate text-muted-foreground"
            >
              {task.title}
            </button>
          ))}
        </div>
      </div>

      <TaskDetailSheet task={selectedTask} statuses={statuses} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  )
}
