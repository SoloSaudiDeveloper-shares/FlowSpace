"use client"

import { useState } from "react"
import {
  LayoutDashboard,
  List,
  LayoutGrid,
  Calendar,
  BarChart2,
  Table2,
  SlidersHorizontal,
  ArrowUpDown,
  Filter,
  X,
  Plus,
  ChevronDown,
  Search,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { OverviewView } from "./views/overview-view"
import { ListView } from "./views/list-view"
import { BulkActionBar } from "./bulk-action-bar"
import { CheckSquare } from "lucide-react"
import { TaskBoard } from "./task-board"
import { CalendarView } from "./views/calendar-view"
import { GanttView } from "./views/gantt-view"
import { TableView } from "./views/table-view"
import type { tasks, taskStatuses, taskLabels } from "@/lib/db/schema"

type Task = typeof tasks.$inferSelect
type TaskStatus = typeof taskStatuses.$inferSelect
type TaskLabel = typeof taskLabels.$inferSelect

export type TaskCardMeta = {
  subtaskCounts: Record<string, { total: number; done: number }>
  labelsByTask: Record<string, TaskLabel[]>
  checklistByTask: Record<string, { total: number; done: number }>
  attachmentCounts: Record<string, number>
  dependencyCounts: Record<string, number>
  commentCounts: Record<string, number>
}

type ViewType = "overview" | "list" | "board" | "calendar" | "gantt" | "table"

const VIEWS: { id: ViewType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "overview",  label: "Overview",  icon: LayoutDashboard },
  { id: "list",      label: "List",      icon: List },
  { id: "board",     label: "Board",     icon: LayoutGrid },
  { id: "calendar",  label: "Calendar",  icon: Calendar },
  { id: "gantt",     label: "Gantt",     icon: BarChart2 },
  { id: "table",     label: "Table",     icon: Table2 },
]

const TASK_FIELDS = [
  { key: "priority", label: "Priority" },
  { key: "dueDate", label: "Due Date" },
  { key: "startDate", label: "Start Date" },
  { key: "labels", label: "Labels" },
  { key: "subtasks", label: "Subtasks" },
  { key: "checklists", label: "Checklists" },
  { key: "timeTracking", label: "Time Tracking" },
  { key: "description", label: "Description" },
] as const

type SortField = "manual" | "title" | "priority" | "dueDate" | "createdAt" | "updatedAt"
type FilterPriority = "all" | "urgent" | "high" | "medium" | "low" | "none"

interface ProjectViewsProps {
  projectId: string
  statuses: TaskStatus[]
  tasks: Task[]
  progress: number
  projectDescription?: string | null
  parentId?: string
  taskMeta?: TaskCardMeta
}

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
  none: "#94a3b8",
}

export function ProjectViews({ projectId, statuses, tasks: rawTasks, progress, projectDescription, parentId, taskMeta }: ProjectViewsProps) {
  const [activeView, setActiveView] = useState<ViewType>("overview")
  const [hiddenFields, setHiddenFields] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState<SortField>("manual")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [filterPriority, setFilterPriority] = useState<FilterPriority>("all")
  const [filterCompleted, setFilterCompleted] = useState<"all" | "active" | "completed">("all")
  const [filterDueDate, setFilterDueDate] = useState<"all" | "overdue" | "today" | "this_week" | "no_date">("all")
  const [showFilterBar, setShowFilterBar] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showSearch, setShowSearch] = useState(false)

  // Multi-select (bulk actions) — only meaningful in the List view.
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  function toggleSelect(taskId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }
  function exitSelect() {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  function toggleField(key: string) {
    setHiddenFields((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Apply filters
  let tasks = rawTasks

  // Search
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase()
    tasks = tasks.filter((t) => t.title.toLowerCase().includes(q))
  }

  // Priority filter
  if (filterPriority !== "all") {
    tasks = tasks.filter((t) => t.priority === filterPriority)
  }

  // Completion filter
  if (filterCompleted === "active") {
    tasks = tasks.filter((t) => !t.isCompleted)
  } else if (filterCompleted === "completed") {
    tasks = tasks.filter((t) => t.isCompleted)
  }

  // Due date filter
  if (filterDueDate !== "all") {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekEnd = new Date(today)
    weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()))

    tasks = tasks.filter((t) => {
      if (filterDueDate === "no_date") return !t.dueDate
      if (!t.dueDate) return false
      const due = new Date(t.dueDate)
      if (filterDueDate === "overdue") return due < today && !t.isCompleted
      if (filterDueDate === "today") return due >= today && due < new Date(today.getTime() + 86400000)
      if (filterDueDate === "this_week") return due >= today && due <= weekEnd
      return true
    })
  }

  // Apply sort
  tasks = [...tasks].sort((a, b) => {
    let cmp = 0
    switch (sortField) {
      case "manual":
        cmp = a.sortOrder - b.sortOrder
        break
      case "title":
        cmp = a.title.localeCompare(b.title)
        break
      case "priority":
        cmp = (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4)
        break
      case "dueDate": {
        const da = a.dueDate ?? ""
        const db_ = b.dueDate ?? ""
        cmp = da.localeCompare(db_)
        break
      }
      case "createdAt":
        cmp = a.createdAt.localeCompare(b.createdAt)
        break
      case "updatedAt":
        cmp = a.updatedAt.localeCompare(b.updatedAt)
        break
    }
    return sortDir === "asc" ? cmp : -cmp
  })

  const activeFilterCount =
    (filterPriority !== "all" ? 1 : 0) +
    (filterCompleted !== "all" ? 1 : 0) +
    (filterDueDate !== "all" ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0)

  const hasActiveFilters = activeFilterCount > 0 || hiddenFields.size > 0

  function clearAllFilters() {
    setFilterPriority("all")
    setFilterCompleted("all")
    setFilterDueDate("all")
    setSearchQuery("")
    setHiddenFields(new Set())
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Views Bar */}
      <div className="flex items-center gap-0.5 border-b px-2 shrink-0" role="tablist" aria-label="Project views">
        {VIEWS.map((view) => {
          const Icon = view.icon
          const isActive = activeView === view.id
          return (
            <button
              key={view.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`view-panel-${view.id}`}
              id={`view-tab-${view.id}`}
              onClick={() => setActiveView(view.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <Icon className="size-3.5" />
              {view.label}
            </button>
          )
        })}

        <div className="flex-1" />

        {/* Action buttons */}
        <div className="flex items-center gap-1 pr-2">
          {/* Search toggle */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`flex items-center gap-1.5 h-7 px-2 text-xs rounded-md hover:bg-accent transition-colors ${
              showSearch ? "text-primary bg-accent" : "text-muted-foreground"
            }`}
          >
            <Search className="size-3" />
          </button>

          {/* Multi-select toggle (List view only) */}
          {activeView === "list" && (
            <button
              onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
              className={`flex items-center gap-1.5 h-7 px-2 text-xs rounded-md hover:bg-accent transition-colors ${
                selectMode ? "text-primary bg-accent" : "text-muted-foreground"
              }`}
              title="Select multiple tasks"
            >
              <CheckSquare className="size-3" />
              Select
            </button>
          )}

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilterBar(!showFilterBar)}
            className={`flex items-center gap-1.5 h-7 px-2 text-xs rounded-md hover:bg-accent transition-colors ${
              showFilterBar || activeFilterCount > 0 ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Filter className="size-3" />
            Filter
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px] min-w-[16px] justify-center">
                {activeFilterCount}
              </Badge>
            )}
          </button>

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1.5 h-7 px-2 text-xs text-muted-foreground rounded-md hover:bg-accent transition-colors">
              <ArrowUpDown className="size-3" />
              Sort
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel className="text-xs">Sort by</DropdownMenuLabel>
              {([
                ["manual", "Default order"],
                ["title", "Title"],
                ["priority", "Priority"],
                ["dueDate", "Due Date"],
                ["createdAt", "Created"],
                ["updatedAt", "Updated"],
              ] as const).map(([field, label]) => (
                <DropdownMenuCheckboxItem
                  key={field}
                  checked={sortField === field}
                  onCheckedChange={() => {
                    if (sortField === field) {
                      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
                    } else {
                      setSortField(field as SortField)
                    }
                  }}
                >
                  {label} {sortField === field && (sortDir === "asc" ? "\u2191" : "\u2193")}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Field visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={`flex items-center gap-1.5 h-7 px-2 text-xs rounded-md hover:bg-accent transition-colors ${
                hiddenFields.size > 0 ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <SlidersHorizontal className="size-3" />
              Fields
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel className="text-xs">Visible fields</DropdownMenuLabel>
              {TASK_FIELDS.map((f) => (
                <DropdownMenuCheckboxItem
                  key={f.key}
                  checked={!hiddenFields.has(f.key)}
                  onCheckedChange={() => toggleField(f.key)}
                >
                  {f.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Search bar (collapsible) */}
      {showSearch && (
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30 shrink-0 animate-in slide-in-from-top-1 duration-150">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <Input
            autoFocus
            placeholder="Search tasks in this project..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 text-sm border-none bg-transparent shadow-none focus-visible:ring-0 px-0"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      )}

      {/* ClickUp-style Filter Bar (collapsible, with filter pills) */}
      {showFilterBar && (
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/20 shrink-0 flex-wrap animate-in slide-in-from-top-1 duration-150">
          <span className="text-xs text-muted-foreground font-medium shrink-0">Filters:</span>

          {/* Priority filter pill */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={`inline-flex items-center gap-1 h-6 px-2 text-xs rounded-full border transition-colors ${
                filterPriority !== "all"
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "border-dashed border-muted-foreground/30 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              }`}
            >
              {filterPriority !== "all" ? (
                <>
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: PRIORITY_COLORS[filterPriority] }}
                  />
                  Priority: {filterPriority.charAt(0).toUpperCase() + filterPriority.slice(1)}
                  <span
                    role="button"
                    className="ml-0.5 hover:opacity-70"
                    onClick={(e) => { e.stopPropagation(); setFilterPriority("all") }}
                  >
                    <X className="size-2.5" />
                  </span>
                </>
              ) : (
                <>
                  <Plus className="size-2.5" />
                  Priority
                </>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              {(["all", "urgent", "high", "medium", "low", "none"] as const).map((p) => (
                <DropdownMenuCheckboxItem
                  key={p}
                  checked={filterPriority === p}
                  onCheckedChange={() => setFilterPriority(p)}
                >
                  {p === "all" ? (
                    "All"
                  ) : (
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: PRIORITY_COLORS[p] }}
                      />
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </span>
                  )}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Status filter pill */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={`inline-flex items-center gap-1 h-6 px-2 text-xs rounded-full border transition-colors ${
                filterCompleted !== "all"
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "border-dashed border-muted-foreground/30 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              }`}
            >
              {filterCompleted !== "all" ? (
                <>
                  Status: {filterCompleted.charAt(0).toUpperCase() + filterCompleted.slice(1)}
                  <span
                    role="button"
                    className="ml-0.5 hover:opacity-70"
                    onClick={(e) => { e.stopPropagation(); setFilterCompleted("all") }}
                  >
                    <X className="size-2.5" />
                  </span>
                </>
              ) : (
                <>
                  <Plus className="size-2.5" />
                  Status
                </>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-36">
              {(["all", "active", "completed"] as const).map((s) => (
                <DropdownMenuCheckboxItem
                  key={s}
                  checked={filterCompleted === s}
                  onCheckedChange={() => setFilterCompleted(s)}
                >
                  {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Due date filter pill */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={`inline-flex items-center gap-1 h-6 px-2 text-xs rounded-full border transition-colors ${
                filterDueDate !== "all"
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "border-dashed border-muted-foreground/30 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              }`}
            >
              {filterDueDate !== "all" ? (
                <>
                  Due: {filterDueDate === "no_date" ? "No date" : filterDueDate === "this_week" ? "This week" : filterDueDate.charAt(0).toUpperCase() + filterDueDate.slice(1)}
                  <span
                    role="button"
                    className="ml-0.5 hover:opacity-70"
                    onClick={(e) => { e.stopPropagation(); setFilterDueDate("all") }}
                  >
                    <X className="size-2.5" />
                  </span>
                </>
              ) : (
                <>
                  <Plus className="size-2.5" />
                  Due Date
                </>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-36">
              {(["all", "overdue", "today", "this_week", "no_date"] as const).map((d) => (
                <DropdownMenuCheckboxItem
                  key={d}
                  checked={filterDueDate === d}
                  onCheckedChange={() => setFilterDueDate(d)}
                >
                  {d === "all" ? "All" : d === "no_date" ? "No date" : d === "this_week" ? "This week" : d.charAt(0).toUpperCase() + d.slice(1)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear all */}
          {activeFilterCount > 0 && (
            <>
              <div className="h-4 w-px bg-border mx-1" />
              <button
                onClick={clearAllFilters}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear all
              </button>
            </>
          )}

          {/* Result count */}
          {activeFilterCount > 0 && (
            <span className="text-xs text-muted-foreground ml-auto">
              {tasks.length} task{tasks.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* View content */}
      <div className="flex-1 min-h-0 overflow-auto" role="tabpanel" id={`view-panel-${activeView}`} aria-labelledby={`view-tab-${activeView}`}>
        {activeView === "overview" && (
          <OverviewView
            projectId={projectId}
            statuses={statuses}
            tasks={tasks}
            progress={progress}
            projectDescription={projectDescription}
          />
        )}
        {activeView === "list" && (
          <ListView
            projectId={projectId}
            statuses={statuses}
            tasks={tasks}
            hiddenFields={hiddenFields}
            taskMeta={taskMeta}
            selectMode={selectMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
          />
        )}
        {activeView === "board" && (
          <div className="p-6">
            <TaskBoard projectId={projectId} statuses={statuses} tasks={tasks} progress={progress} taskMeta={taskMeta} />
          </div>
        )}
        {activeView === "calendar" && (
          <div className="h-full flex flex-col">
            <CalendarView projectId={projectId} statuses={statuses} tasks={tasks} />
          </div>
        )}
        {activeView === "gantt" && (
          <div className="h-full flex flex-col">
            <GanttView projectId={projectId} statuses={statuses} tasks={tasks} />
          </div>
        )}
        {activeView === "table" && (
          <TableView projectId={projectId} statuses={statuses} tasks={tasks} />
        )}
      </div>

      {selectMode && selectedIds.size > 0 && (
        <BulkActionBar
          ids={selectedIds}
          projectId={projectId}
          statuses={statuses}
          onClear={() => setSelectedIds(new Set())}
          onExit={exitSelect}
        />
      )}
    </div>
  )
}
