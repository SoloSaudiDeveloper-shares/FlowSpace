"use client"

import { useState, useEffect, useRef, useCallback, useId } from "react"
import {
  Plus, X, TrendingUp, List, Clock, BarChart3, StickyNote,
  PieChart as PieChartIcon, Hash, CheckSquare, Square, AlertTriangle,
  Flag, Table2, Code2, LayoutDashboard, CircleDot, Search,
  GripVertical, Copy, Palette, Trash2, ArrowUp, ArrowDown,
  Maximize2, Minimize2, RotateCcw, Activity, Layers,
} from "lucide-react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import { TaskDetailSheet } from "../task-detail-sheet"
import { ContextMenu, useContextMenu, type ContextMenuEntry } from "@/components/shared/context-menu"
import { updateElement } from "@/lib/actions/element-actions"
import type { tasks, taskStatuses } from "@/lib/db/schema"

type Task = typeof tasks.$inferSelect
type TaskStatus = typeof taskStatuses.$inferSelect

// ─── Priority Constants ───────────────────────────────────────────────────────

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
  none: "No Priority",
}

const PRIORITY_ORDER = ["urgent", "high", "medium", "low", "none"]

// ─── Card Registry ────────────────────────────────────────────────────────────

type CategoryId = "overview" | "statuses" | "priorities" | "tasks" | "tables" | "charts" | "embeds"

interface CardDef {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  colSpan: 1 | 2 | 3 | 4
  category: CategoryId
}

const CARD_CATEGORIES = [
  { id: "overview" as CategoryId, label: "Overview", icon: LayoutDashboard },
  { id: "statuses" as CategoryId, label: "Statuses", icon: CircleDot },
  { id: "priorities" as CategoryId, label: "Priorities", icon: Flag },
  { id: "tasks" as CategoryId, label: "Tasks", icon: List },
  { id: "tables" as CategoryId, label: "Tables", icon: Table2 },
  { id: "charts" as CategoryId, label: "Charts", icon: Activity },
  { id: "embeds" as CategoryId, label: "Embeds", icon: Code2 },
]

const CARD_REGISTRY: CardDef[] = [
  // Overview
  { id: "progress",    title: "Progress",            description: "Task completion overview with status breakdown",      icon: TrendingUp,   colSpan: 4, category: "overview" },
  { id: "notes",       title: "Notes",               description: "Project notes and description",                       icon: StickyNote,   colSpan: 4, category: "overview" },
  // Statuses
  { id: "workload",    title: "Workload by Status",  description: "Task count per status as horizontal bars",            icon: BarChart3,    colSpan: 2, category: "statuses" },
  { id: "status_pie",  title: "Tasks by Status",     description: "Pie chart of task distribution by status",           icon: PieChartIcon, colSpan: 2, category: "statuses" },
  { id: "total_tasks", title: "Total Tasks",         description: "Total number of tasks in this project",              icon: Hash,         colSpan: 1, category: "statuses" },
  { id: "completed_tasks",  title: "Completed Tasks",  description: "Number of completed tasks",                        icon: CheckSquare,  colSpan: 1, category: "statuses" },
  { id: "incomplete_tasks", title: "Incomplete Tasks", description: "Number of tasks not yet completed",                icon: Square,       colSpan: 1, category: "statuses" },
  // Priorities
  { id: "priority_bar",  title: "Priority Breakdown",    description: "Task count per priority as bar chart",           icon: BarChart3,    colSpan: 2, category: "priorities" },
  { id: "priority_pie",  title: "Priority Distribution", description: "Pie chart of tasks by priority",                 icon: PieChartIcon, colSpan: 2, category: "priorities" },
  { id: "urgent_tasks",  title: "Total Urgent Tasks",    description: "Number of urgent priority tasks",                icon: AlertTriangle,colSpan: 1, category: "priorities" },
  { id: "high_tasks",    title: "Total High Tasks",      description: "Number of high priority tasks",                  icon: Flag,         colSpan: 1, category: "priorities" },
  { id: "priority_list", title: "Priority Tasks",        description: "List of urgent and high priority tasks",         icon: List,         colSpan: 4, category: "priorities" },
  // Tasks
  { id: "task_list", title: "Task List",     description: "All tasks at a glance",      icon: List,          colSpan: 2, category: "tasks" },
  { id: "recent",    title: "Recent Tasks",  description: "Recently updated tasks",     icon: Clock,         colSpan: 4, category: "tasks" },
  { id: "overdue",   title: "Overdue Tasks", description: "Tasks past their due date",  icon: AlertTriangle, colSpan: 4, category: "tasks" },
  // Tables
  { id: "status_table",   title: "Tasks by Status",   description: "Table of task counts grouped by status",   icon: Table2, colSpan: 2, category: "tables" },
  { id: "priority_table", title: "Tasks by Priority", description: "Table of task counts grouped by priority", icon: Table2, colSpan: 2, category: "tables" },
  // Charts
  { id: "line_chart",      title: "Tasks Over Time",     description: "Line chart of cumulative tasks created over time",  icon: Activity,     colSpan: 2, category: "charts" },
  { id: "burndown",        title: "Burndown Chart",      description: "Track remaining tasks toward completion",           icon: TrendingUp,   colSpan: 2, category: "charts" },
  { id: "battery",         title: "Battery Chart",       description: "Status completion as battery-style fill bars",      icon: BarChart3,    colSpan: 2, category: "charts" },
  { id: "cumulative_flow", title: "Cumulative Flow",     description: "Stacked area showing status distribution over time",icon: Layers,       colSpan: 2, category: "charts" },
  // Embeds
  { id: "embed", title: "Custom Embed", description: "Embed any URL or website via iframe", icon: Code2, colSpan: 4, category: "embeds" },
]

const DEFAULT_CARD_IDS = ["progress", "workload", "task_list"]

// ─── Persisted Layout ────────────────────────────────────────────────────────

const GRID_COLS = 4

const CARD_COLORS = [
  { label: "Red", value: "#ef4444" },
  { label: "Orange", value: "#f97316" },
  { label: "Yellow", value: "#eab308" },
  { label: "Green", value: "#22c55e" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Purple", value: "#8b5cf6" },
  { label: "Pink", value: "#ec4899" },
  { label: "Cyan", value: "#06b6d4" },
]

interface CardSize {
  colSpan: number
  height?: number
}

interface CardLayout {
  ids: string[]
  sizes: Record<string, CardSize>
  colors: Record<string, string>
}

function getDefaultSize(cardId: string): CardSize {
  const def = CARD_REGISTRY.find((c) => c.id === cardId)
  return { colSpan: def?.colSpan ?? 2 }
}

function loadLayout(projectId: string): CardLayout {
  try {
    const raw = localStorage.getItem(`overview-layout-${projectId}`)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.ids) return { ids: parsed.ids, sizes: parsed.sizes ?? {}, colors: parsed.colors ?? {} }
    }
    // migrate old format (just an array of ids)
    const oldRaw = localStorage.getItem(`overview-cards-${projectId}`)
    if (oldRaw) {
      const ids = JSON.parse(oldRaw) as string[]
      return { ids, sizes: {}, colors: {} }
    }
  } catch {}
  return { ids: DEFAULT_CARD_IDS, sizes: {}, colors: {} }
}

function saveLayout(projectId: string, layout: CardLayout) {
  localStorage.setItem(`overview-layout-${projectId}`, JSON.stringify(layout))
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface OverviewViewProps {
  projectId: string
  statuses: TaskStatus[]
  tasks: Task[]
  progress: number
  projectDescription?: string | null
}

export function OverviewView({ projectId, statuses, tasks, progress, projectDescription }: OverviewViewProps) {
  const [layout, setLayout] = useState<CardLayout>({ ids: DEFAULT_CARD_IDS, sizes: {}, colors: {} })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    setLayout(loadLayout(projectId))
  }, [projectId])

  const persistLayout = useCallback(
    (next: CardLayout) => {
      setLayout(next)
      saveLayout(projectId, next)
    },
    [projectId],
  )

  function addCard(id: string) {
    if (!layout.ids.includes(id)) {
      persistLayout({ ...layout, ids: [...layout.ids, id] })
    }
    setPickerOpen(false)
  }

  const { menu: ctxMenu, open: openCtx, close: closeCtx } = useContextMenu()

  function removeCard(id: string) {
    const { [id]: _s, ...restSizes } = layout.sizes
    const { [id]: _c, ...restColors } = layout.colors
    persistLayout({ ids: layout.ids.filter((c) => c !== id), sizes: restSizes, colors: restColors })
  }

  function setCardSize(id: string, size: Partial<CardSize>) {
    const current = layout.sizes[id] ?? getDefaultSize(id)
    persistLayout({
      ...layout,
      sizes: { ...layout.sizes, [id]: { ...current, ...size } },
    })
  }

  function setCardColor(id: string, color: string | undefined) {
    if (color) {
      persistLayout({ ...layout, colors: { ...layout.colors, [id]: color } })
    } else {
      const { [id]: _, ...rest } = layout.colors
      persistLayout({ ...layout, colors: rest })
    }
  }

  function duplicateCard(id: string) {
    // Can't add the same card twice — instead just bring it to the end (re-add behavior)
    // For now, just show a toast-like behavior — cards are unique by ID
  }

  function moveCard(id: string, direction: "up" | "down") {
    const idx = layout.ids.indexOf(id)
    if (idx === -1) return
    const newIdx = direction === "up" ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= layout.ids.length) return
    const next = [...layout.ids]
    next.splice(idx, 1)
    next.splice(newIdx, 0, id)
    persistLayout({ ...layout, ids: next })
  }

  function resetCardSize(id: string) {
    const { [id]: _, ...rest } = layout.sizes
    persistLayout({ ...layout, sizes: rest })
  }

  function handleCardContextMenu(e: React.MouseEvent, cardId: string) {
    const idx = layout.ids.indexOf(cardId)
    const currentColor = layout.colors[cardId]
    const hasCustomSize = !!layout.sizes[cardId]
    const currentSize = layout.sizes[cardId] ?? getDefaultSize(cardId)

    const colorItems: ContextMenuEntry[] = CARD_COLORS.map((c) => ({
      label: c.label,
      icon: Palette,
      onClick: () => setCardColor(cardId, c.value),
    }))

    const items: ContextMenuEntry[] = [
      // Width presets
      {
        label: "1 Column",
        icon: Minimize2,
        onClick: () => setCardSize(cardId, { colSpan: 1 }),
      },
      {
        label: "2 Columns",
        icon: Minimize2,
        onClick: () => setCardSize(cardId, { colSpan: 2 }),
      },
      {
        label: "3 Columns",
        icon: Maximize2,
        onClick: () => setCardSize(cardId, { colSpan: 3 }),
      },
      {
        label: "Full Width",
        icon: Maximize2,
        onClick: () => setCardSize(cardId, { colSpan: 4 }),
      },
      { separator: true },
      // Color submenu inline
      ...colorItems,
      ...(currentColor
        ? [
            {
              label: "Remove Color",
              icon: RotateCcw,
              onClick: () => setCardColor(cardId, undefined),
            },
          ]
        : []),
      { separator: true },
      // Move
      ...(idx > 0
        ? [{ label: "Move Up", icon: ArrowUp, onClick: () => moveCard(cardId, "up" as const) }]
        : []),
      ...(idx < layout.ids.length - 1
        ? [{ label: "Move Down", icon: ArrowDown, onClick: () => moveCard(cardId, "down" as const) }]
        : []),
      // Reset
      ...(hasCustomSize
        ? [
            {
              label: "Reset Size",
              icon: RotateCcw,
              onClick: () => resetCardSize(cardId),
            },
          ]
        : []),
      { separator: true },
      {
        label: "Remove Card",
        icon: Trash2,
        variant: "destructive" as const,
        onClick: () => removeCard(cardId),
      },
    ]
    openCtx(e, items)
  }

  const dndId = useId()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = layout.ids.indexOf(active.id as string)
    const newIndex = layout.ids.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return
    const next = [...layout.ids]
    next.splice(oldIndex, 1)
    next.splice(newIndex, 0, active.id as string)
    persistLayout({ ...layout, ids: next })
  }

  const cards = layout.ids
    .map((id) => CARD_REGISTRY.find((c) => c.id === id))
    .filter(Boolean) as CardDef[]

  return (
    <div className="p-6">
      {/* Toolbar */}
      <div className="flex items-center justify-end mb-5">
        <Button size="sm" onClick={() => setPickerOpen(true)} className="gap-1.5 h-8 text-xs">
          <Plus className="size-3.5" />
          Card
        </Button>
      </div>

      {/* Card grid */}
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={layout.ids} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-4 gap-4 auto-rows-auto">
            {cards.map((card) => {
              const size = layout.sizes[card.id] ?? getDefaultSize(card.id)
              return (
                <SortableCard
                  key={card.id}
                  card={card}
                  colSpan={Math.min(size.colSpan, GRID_COLS)}
                  height={size.height}
                  borderColor={layout.colors[card.id]}
                  onRemove={() => removeCard(card.id)}
                  onSizeChange={(s) => setCardSize(card.id, s)}
                  onContextMenu={(e) => handleCardContextMenu(e, card.id)}
                >
                  <CardBody
                    cardId={card.id}
                    projectId={projectId}
                    statuses={statuses}
                    tasks={tasks}
                    progress={progress}
                    projectDescription={projectDescription}
                    onTaskClick={(task) => { setSelectedTask(task); setSheetOpen(true) }}
                  />
                </SortableCard>
              )
            })}
          </div>
        </SortableContext>
      </DndContext>

      {cards.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed rounded-lg">
          <p className="text-muted-foreground text-sm">No cards added yet</p>
          <p className="text-muted-foreground text-xs mt-1">Click the &quot;Card&quot; button to add widgets</p>
        </div>
      )}

      {pickerOpen && (
        <CardPicker cardIds={layout.ids} onAdd={addCard} onClose={() => setPickerOpen(false)} />
      )}

      <TaskDetailSheet
        task={selectedTask}
        statuses={statuses}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />

      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={closeCtx} />
      )}
    </div>
  )
}

// ─── SortableCard ────────────────────────────────────────────────────────────

function SortableCard({
  card,
  colSpan,
  height,
  borderColor,
  onRemove,
  onSizeChange,
  onContextMenu,
  children,
}: {
  card: CardDef
  colSpan: number
  height?: number
  borderColor?: string
  onRemove: () => void
  onSizeChange: (size: Partial<CardSize>) => void
  onContextMenu: (e: React.MouseEvent) => void
  children: React.ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id })

  const cardRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)

  const handleResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const el = cardRef.current
      if (!el) return

      // Get grid container to compute column width
      const grid = el.parentElement
      if (!grid) return
      gridRef.current = grid as HTMLDivElement

      const startX = e.clientX
      const startY = e.clientY
      const startW = el.offsetWidth
      const startH = el.offsetHeight
      const gridWidth = grid.offsetWidth
      const gap = 16 // gap-4 = 16px
      const colWidth = (gridWidth - gap * (GRID_COLS - 1)) / GRID_COLS

      // Show live preview
      el.style.zIndex = "10"

      const onMove = (ev: PointerEvent) => {
        const dX = ev.clientX - startX
        const dY = ev.clientY - startY
        const nextW = Math.max(colWidth, startW + dX)
        const nextH = Math.max(100, startH + dY)
        el.style.width = `${nextW}px`
        el.style.height = `${nextH}px`
      }

      const onUp = (ev: PointerEvent) => {
        const dX = ev.clientX - startX
        const dY = ev.clientY - startY
        const nextW = startW + dX
        const nextH = Math.max(100, startH + dY)

        // Snap width to nearest column count
        const newColSpan = Math.max(1, Math.min(GRID_COLS, Math.round((nextW + gap) / (colWidth + gap))))

        // Clear inline styles
        el.style.width = ""
        el.style.height = ""
        el.style.zIndex = ""

        onSizeChange({ colSpan: newColSpan, height: nextH })

        document.removeEventListener("pointermove", onMove)
        document.removeEventListener("pointerup", onUp)
      }

      document.addEventListener("pointermove", onMove)
      document.addEventListener("pointerup", onUp)
    },
    [onSizeChange],
  )

  // Right edge resize (width only)
  const handleResizeRight = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const el = cardRef.current
      const grid = el?.parentElement
      if (!el || !grid) return

      const startX = e.clientX
      const startW = el.offsetWidth
      const gridWidth = grid.offsetWidth
      const gap = 16
      const colWidth = (gridWidth - gap * (GRID_COLS - 1)) / GRID_COLS

      el.style.zIndex = "10"

      const onMove = (ev: PointerEvent) => {
        const dX = ev.clientX - startX
        el.style.width = `${Math.max(colWidth, startW + dX)}px`
      }

      const onUp = (ev: PointerEvent) => {
        const dX = ev.clientX - startX
        const nextW = startW + dX
        const newColSpan = Math.max(1, Math.min(GRID_COLS, Math.round((nextW + gap) / (colWidth + gap))))
        el.style.width = ""
        el.style.zIndex = ""
        onSizeChange({ colSpan: newColSpan })
        document.removeEventListener("pointermove", onMove)
        document.removeEventListener("pointerup", onUp)
      }

      document.addEventListener("pointermove", onMove)
      document.addEventListener("pointerup", onUp)
    },
    [onSizeChange],
  )

  // Bottom edge resize (height only)
  const handleResizeBottom = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const el = cardRef.current
      if (!el) return

      const startY = e.clientY
      const startH = el.offsetHeight

      const onMove = (ev: PointerEvent) => {
        const dY = ev.clientY - startY
        el.style.height = `${Math.max(100, startH + dY)}px`
      }

      const onUp = (ev: PointerEvent) => {
        const dY = ev.clientY - startY
        const nextH = Math.max(100, startH + dY)
        el.style.height = ""
        onSizeChange({ height: nextH })
        document.removeEventListener("pointermove", onMove)
        document.removeEventListener("pointerup", onUp)
      }

      document.addEventListener("pointermove", onMove)
      document.addEventListener("pointerup", onUp)
    },
    [onSizeChange],
  )

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    gridColumn: `span ${colSpan}`,
    ...(height ? { height } : {}),
    opacity: isDragging ? 0.5 : 1,
    ...(borderColor ? { borderColor, borderWidth: 2 } : {}),
  }

  return (
    <div
      ref={(node) => {
        setNodeRef(node)
        ;(cardRef as React.MutableRefObject<HTMLDivElement | null>).current = node
      }}
      style={style}
      className="group relative rounded-lg border bg-card p-4 overflow-hidden"
      onContextMenu={onContextMenu}
    >
      {/* Card header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* Drag handle */}
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity -ml-1 p-0.5 rounded hover:bg-muted"
          >
            <GripVertical className="size-3.5 text-muted-foreground" />
          </div>
          <card.icon className="size-3.5 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{card.title}</h3>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onRemove}
            className="size-5 flex items-center justify-center rounded hover:bg-muted"
          >
            <X className="size-3" />
          </button>
        </div>
      </div>

      {/* Card content */}
      <div className="overflow-auto" style={height ? { height: height - 56 } : undefined}>
        {children}
      </div>

      {/* Right edge resize handle (width) */}
      <div
        onPointerDown={handleResizeRight}
        className="absolute top-0 right-0 w-1.5 h-full cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/20 rounded-r-lg"
      />

      {/* Bottom edge resize handle (height) */}
      <div
        onPointerDown={handleResizeBottom}
        className="absolute bottom-0 left-0 w-full h-1.5 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/20 rounded-b-lg"
      />

      {/* Bottom-right corner resize handle (both) */}
      <div
        onPointerDown={handleResizeStart}
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        <svg
          className="w-full h-full text-muted-foreground/50"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="8" cy="12" r="1.5" />
          <circle cx="12" cy="8" r="1.5" />
        </svg>
      </div>
    </div>
  )
}

// ─── CardPicker ───────────────────────────────────────────────────────────────

function CardPicker({
  cardIds,
  onAdd,
  onClose,
}: {
  cardIds: string[]
  onAdd: (id: string) => void
  onClose: () => void
}) {
  const [activeCategory, setActiveCategory] = useState<CategoryId>("overview")
  const [search, setSearch] = useState("")

  const filteredCards = search
    ? CARD_REGISTRY.filter(
        (c) =>
          c.title.toLowerCase().includes(search.toLowerCase()) ||
          c.description.toLowerCase().includes(search.toLowerCase()),
      )
    : CARD_REGISTRY.filter((c) => c.category === activeCategory)

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto w-[700px] max-h-[560px] rounded-xl border bg-card shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
            <span className="font-semibold text-sm flex-1">Add Card</span>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                autoFocus={false}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search cards..."
                className="w-full h-7 pl-8 pr-3 text-xs rounded-md border bg-muted/50 outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <button
              onClick={onClose}
              className="size-6 flex items-center justify-center rounded hover:bg-muted"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex flex-1 min-h-0">
            {/* Left: category nav — hide when searching */}
            {!search && (
              <div className="w-36 shrink-0 border-r py-2 space-y-0.5 overflow-y-auto">
                {CARD_CATEGORIES.map((cat) => {
                  const Icon = cat.icon
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs rounded-md transition-colors text-left ${
                        activeCategory === cat.id
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      <Icon className="size-3.5 shrink-0" />
                      {cat.label}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Right: card grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {!search && (
                <p className="text-xs font-medium text-muted-foreground mb-3">
                  {CARD_CATEGORIES.find((c) => c.id === activeCategory)?.label}
                </p>
              )}
              <div className="grid grid-cols-3 gap-3">
                {filteredCards.map((card) => {
                  const added = cardIds.includes(card.id)
                  return (
                    <button
                      key={card.id}
                      disabled={added}
                      onClick={() => onAdd(card.id)}
                      className={`text-left rounded-lg border overflow-hidden transition-colors ${
                        added
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:border-primary cursor-pointer"
                      }`}
                    >
                      {/* Preview area */}
                      <div className="h-20 bg-muted/40 flex items-center justify-center p-2">
                        <CardMiniPreview cardId={card.id} />
                      </div>
                      <div className="px-2.5 py-2">
                        <p className="text-xs font-semibold leading-tight">{card.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight line-clamp-2">
                          {card.description}
                        </p>
                        {added && (
                          <span className="text-[10px] text-muted-foreground">Added</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
              {filteredCards.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">No cards found</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── CardMiniPreview ──────────────────────────────────────────────────────────

function CardMiniPreview({ cardId }: { cardId: string }) {
  const colors = ["#6366f1", "#22c55e", "#3b82f6", "#f59e0b", "#ec4899"]

  switch (cardId) {
    case "progress":
      return (
        <div className="w-full space-y-1.5 px-2">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full w-2/3 rounded-full bg-primary" />
          </div>
          <div className="flex gap-1">
            {(["#94a3b8", "#3b82f6", "#22c55e"] as string[]).map((c, i) => (
              <div key={i} className="flex-1 rounded text-center py-1" style={{ backgroundColor: `${c}22` }}>
                <div className="text-[8px] font-bold" style={{ color: c }}>3</div>
              </div>
            ))}
          </div>
        </div>
      )

    case "notes":
      return (
        <div className="w-full space-y-1 px-2">
          {[100, 80, 60, 90, 70].map((w, i) => (
            <div key={i} className="h-1.5 rounded-full bg-muted" style={{ width: `${w}%` }} />
          ))}
        </div>
      )

    case "workload":
      return (
        <div className="w-full space-y-1 px-2">
          {(["#94a3b8", "#3b82f6", "#22c55e"] as string[]).map((c, i) => {
            const widths = [60, 40, 75]
            return (
              <div key={i} className="flex items-center gap-1">
                <div className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: c }} />
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${widths[i]}%`, backgroundColor: c }} />
                </div>
              </div>
            )
          })}
        </div>
      )

    case "status_pie":
    case "priority_pie":
      return (
        <svg viewBox="0 0 60 60" className="w-12 h-12">
          <path d="M30 30 L30 5 A25 25 0 0 1 55 30 Z" fill="#6366f1" />
          <path d="M30 30 L55 30 A25 25 0 0 1 17 52 Z" fill="#22c55e" />
          <path d="M30 30 L17 52 A25 25 0 1 1 30 5 Z" fill="#3b82f6" />
          <circle cx={30} cy={30} r={12} fill="hsl(var(--card))" />
        </svg>
      )

    case "total_tasks":
      return (
        <div className="text-center">
          <div className="text-2xl font-bold">24</div>
          <div className="text-[9px] text-muted-foreground">Total Tasks</div>
        </div>
      )

    case "completed_tasks":
      return (
        <div className="text-center">
          <div className="text-2xl font-bold text-green-500">18</div>
          <div className="text-[9px] text-muted-foreground">Completed</div>
        </div>
      )

    case "incomplete_tasks":
      return (
        <div className="text-center">
          <div className="text-2xl font-bold text-amber-500">6</div>
          <div className="text-[9px] text-muted-foreground">Incomplete</div>
        </div>
      )

    case "urgent_tasks":
      return (
        <div className="text-center">
          <div className="text-2xl font-bold text-red-500">3</div>
          <div className="text-[9px] text-muted-foreground">Urgent Tasks</div>
        </div>
      )

    case "high_tasks":
      return (
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-500">5</div>
          <div className="text-[9px] text-muted-foreground">High Tasks</div>
        </div>
      )

    case "priority_bar":
      return (
        <div className="w-full space-y-1 px-2">
          {(["#ef4444", "#f97316", "#eab308", "#3b82f6"] as string[]).map((c, i) => {
            const widths = [30, 55, 70, 45]
            return (
              <div key={i} className="flex items-center gap-1">
                <div className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: c }} />
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${widths[i]}%`, backgroundColor: c }} />
                </div>
              </div>
            )
          })}
        </div>
      )

    case "task_list":
    case "priority_list":
      return (
        <div className="w-full space-y-1 px-2">
          {(["#6366f1", "#22c55e", "#3b82f6", "#f59e0b"] as string[]).map((c, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="size-1.5 rounded-full" style={{ backgroundColor: c }} />
              <div className="h-1.5 flex-1 rounded bg-muted" />
              <div className="h-1.5 w-8 rounded bg-muted/50" />
            </div>
          ))}
        </div>
      )

    case "recent":
      return (
        <div className="w-full space-y-1 px-2">
          {[70, 90, 55, 80].map((w, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="h-1.5 flex-1 rounded bg-muted" style={{ maxWidth: `${w}%` }} />
              <div className="h-1.5 w-6 rounded ml-auto" style={{ backgroundColor: colors[i % colors.length] + "44" }} />
              <div className="h-1.5 w-5 rounded bg-muted/40" />
            </div>
          ))}
        </div>
      )

    case "overdue":
      return (
        <div className="w-full space-y-1 px-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="size-2 rounded-full bg-red-500/60 shrink-0" />
              <div className="h-1.5 flex-1 rounded bg-muted" />
              <div className="h-1.5 w-8 rounded bg-red-400/30" />
            </div>
          ))}
        </div>
      )

    case "status_table":
    case "priority_table":
      return (
        <div className="w-full px-2 space-y-1">
          <div className="flex justify-between border-b pb-0.5 mb-1">
            <div className="h-1.5 w-12 rounded bg-muted/60" />
            <div className="h-1.5 w-6 rounded bg-muted/60" />
          </div>
          {colors.slice(0, 3).map((c, i) => (
            <div key={i} className="flex justify-between items-center">
              <div className="flex items-center gap-1">
                <div className="size-1.5 rounded-full" style={{ backgroundColor: c }} />
                <div className="h-1.5 w-10 rounded bg-muted" />
              </div>
              <div className="h-1.5 w-4 rounded bg-muted/60" />
            </div>
          ))}
        </div>
      )

    case "line_chart":
      return (
        <svg viewBox="0 0 60 40" className="w-14 h-10">
          <path
            d="M5 35 L15 28 L25 30 L35 20 L45 15 L55 8"
            fill="none"
            stroke="#6366f1"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M5 35 L15 28 L25 30 L35 20 L45 15 L55 8 L55 38 L5 38 Z"
            fill="#6366f1"
            fillOpacity="0.15"
          />
        </svg>
      )

    case "burndown":
      return (
        <svg viewBox="0 0 60 40" className="w-14 h-10">
          <line
            x1="5"
            y1="5"
            x2="55"
            y2="35"
            stroke="#94a3b8"
            strokeWidth="1"
            strokeDasharray="3 2"
          />
          <path
            d="M5 5 L15 8 L25 12 L35 18 L45 28 L55 35"
            fill="none"
            stroke="#f97316"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M5 5 L15 8 L25 12 L35 18 L45 28 L55 35 L55 38 L5 38 Z"
            fill="#f97316"
            fillOpacity="0.15"
          />
        </svg>
      )

    case "battery":
      return (
        <div className="w-full space-y-1.5 px-2">
          {(
            [
              ["#22c55e", 75],
              ["#3b82f6", 50],
              ["#f59e0b", 30],
            ] as [string, number][]
          ).map(([c, w], i) => (
            <div key={i} className="flex items-center gap-0.5">
              <div className="flex-1 h-2 rounded border border-foreground/10 overflow-hidden">
                <div
                  className="h-full rounded-sm"
                  style={{ width: `${w}%`, backgroundColor: c }}
                />
              </div>
              <div className="w-0.5 h-1.5 rounded-r-sm bg-foreground/15" />
            </div>
          ))}
        </div>
      )

    case "cumulative_flow":
      return (
        <svg viewBox="0 0 60 40" className="w-14 h-10">
          <path
            d="M5 35 L15 30 L25 25 L35 22 L45 18 L55 14 L55 38 L5 38 Z"
            fill="#3b82f6"
            fillOpacity="0.5"
          />
          <path
            d="M5 35 L15 32 L25 30 L35 28 L45 26 L55 24 L55 38 L5 38 Z"
            fill="#22c55e"
            fillOpacity="0.5"
          />
          <path
            d="M5 37 L15 36 L25 35 L35 34 L45 33 L55 32 L55 38 L5 38 Z"
            fill="#f59e0b"
            fillOpacity="0.5"
          />
        </svg>
      )

    case "embed":
      return (
        <div className="flex flex-col items-center justify-center gap-1">
          <Code2 className="size-8 text-muted-foreground" />
          <span className="text-[9px] text-muted-foreground">Paste URL</span>
        </div>
      )

    default:
      return <div className="size-8 rounded bg-muted" />
  }
}

// ─── Card Body Router ─────────────────────────────────────────────────────────

function CardBody({
  cardId,
  projectId,
  statuses,
  tasks,
  progress,
  projectDescription,
  onTaskClick,
}: {
  cardId: string
  projectId: string
  statuses: TaskStatus[]
  tasks: Task[]
  progress: number
  projectDescription?: string | null
  onTaskClick: (task: Task) => void
}) {
  switch (cardId) {
    case "progress":
      return <ProgressCard statuses={statuses} tasks={tasks} progress={progress} />
    case "workload":
      return <WorkloadCard statuses={statuses} tasks={tasks} />
    case "status_pie":
      return <StatusPieCard statuses={statuses} tasks={tasks} />
    case "total_tasks":
      return <BigNumberCard value={tasks.length} label="Total Tasks" color="hsl(var(--foreground))" />
    case "completed_tasks":
      return <BigNumberCard value={tasks.filter((t) => t.isCompleted).length} label="Completed Tasks" color="#22c55e" />
    case "incomplete_tasks":
      return <BigNumberCard value={tasks.filter((t) => !t.isCompleted).length} label="Incomplete Tasks" color="#f59e0b" />
    case "priority_bar":
      return <PriorityBarCard tasks={tasks} />
    case "priority_pie":
      return <PriorityPieCard tasks={tasks} />
    case "urgent_tasks":
      return <BigNumberCard value={tasks.filter((t) => t.priority === "urgent").length} label="Urgent Tasks" color="#ef4444" />
    case "high_tasks":
      return <BigNumberCard value={tasks.filter((t) => t.priority === "high").length} label="High Tasks" color="#f97316" />
    case "priority_list":
      return <PriorityListCard tasks={tasks} statuses={statuses} onTaskClick={onTaskClick} />
    case "task_list":
      return <TaskListCard tasks={tasks} statuses={statuses} onTaskClick={onTaskClick} />
    case "recent":
      return <RecentTasksCard tasks={tasks} statuses={statuses} onTaskClick={onTaskClick} />
    case "overdue":
      return <OverdueTasksCard tasks={tasks} statuses={statuses} onTaskClick={onTaskClick} />
    case "status_table":
      return <StatusTableCard statuses={statuses} tasks={tasks} />
    case "priority_table":
      return <PriorityTableCard tasks={tasks} />
    case "line_chart":
      return <LineChartCard tasks={tasks} />
    case "burndown":
      return <BurndownCard tasks={tasks} />
    case "battery":
      return <BatteryCard statuses={statuses} tasks={tasks} />
    case "cumulative_flow":
      return <CumulativeFlowCard statuses={statuses} tasks={tasks} />
    case "notes":
      return <NotesCard projectId={projectId} initialValue={projectDescription ?? ""} />
    case "embed":
      return <EmbedCard projectId={projectId} />
    default:
      return null
  }
}

// ─── Card: Progress ───────────────────────────────────────────────────────────

function ProgressCard({
  statuses,
  tasks,
  progress,
}: {
  statuses: TaskStatus[]
  tasks: Task[]
  progress: number
}) {
  const total = tasks.length
  const completed = tasks.filter((t) => t.isCompleted).length

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{completed} / {total} tasks complete</span>
          <span className="font-semibold">{progress}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {statuses.length > 0 && (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${Math.min(statuses.length, 4)}, 1fr)` }}
        >
          {statuses.map((status) => {
            const count = tasks.filter((t) => t.statusId === status.id).length
            return (
              <div key={status.id} className="rounded-lg border p-3 text-center space-y-1">
                <div className="text-xl font-bold">{count}</div>
                <div className="flex items-center justify-center gap-1">
                  <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: status.color }} />
                  <span className="text-xs text-muted-foreground truncate">{status.name}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {total === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">No tasks yet</p>
      )}
    </div>
  )
}

// ─── Card: Workload by Status ─────────────────────────────────────────────────

function WorkloadCard({ statuses, tasks }: { statuses: TaskStatus[]; tasks: Task[] }) {
  const total = tasks.length

  if (total === 0) {
    return <p className="text-xs text-muted-foreground text-center py-4">No tasks yet</p>
  }

  return (
    <div className="space-y-3">
      {statuses.map((status) => {
        const count = tasks.filter((t) => t.statusId === status.id).length
        const pct = total > 0 ? (count / total) * 100 : 0
        return (
          <div key={status.id} className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: status.color }} />
                <span className="text-muted-foreground truncate">{status.name}</span>
              </div>
              <span className="font-semibold tabular-nums">{count}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: status.color }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Shared: PieChartSVG ──────────────────────────────────────────────────────

function PieChartSVG({
  segments,
}: {
  segments: { value: number; color: string; label: string }[]
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  if (total === 0) {
    return <p className="text-xs text-muted-foreground text-center py-4">No data</p>
  }

  const cx = 50, cy = 50, r = 40, innerR = 22
  let angle = -Math.PI / 2

  const paths = segments
    .filter((s) => s.value > 0)
    .map((seg, i) => {
      const sliceAngle = (seg.value / total) * 2 * Math.PI
      const startAngle = angle
      angle += sliceAngle

      if (sliceAngle >= 2 * Math.PI - 0.001) {
        return <circle key={i} cx={cx} cy={cy} r={r} fill={seg.color} />
      }

      const x1 = cx + r * Math.cos(startAngle)
      const y1 = cy + r * Math.sin(startAngle)
      const x2 = cx + r * Math.cos(angle)
      const y2 = cy + r * Math.sin(angle)
      const largeArc = sliceAngle > Math.PI ? 1 : 0
      const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`

      return (
        <path
          key={i}
          d={d}
          fill={seg.color}
          stroke="hsl(var(--card))"
          strokeWidth="1.5"
        />
      )
    })

  return (
    <div className="flex items-center gap-4 h-full min-h-[100px]">
      <svg viewBox="0 0 100 100" className="shrink-0 h-full min-h-20 max-h-60 aspect-square">
        {paths}
        <circle cx={cx} cy={cy} r={innerR} fill="hsl(var(--card))" />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="12" fontWeight="bold" fill="currentColor">
          {total}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="7" fill="gray">
          tasks
        </text>
      </svg>
      <div className="space-y-1.5 flex-1 min-w-0">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
              <span className="truncate text-muted-foreground">{seg.label}</span>
            </div>
            <span className="font-semibold tabular-nums shrink-0">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Card: Tasks by Status (Pie) ──────────────────────────────────────────────

function StatusPieCard({ statuses, tasks }: { statuses: TaskStatus[]; tasks: Task[] }) {
  if (tasks.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-4">No tasks yet</p>
  }

  const segments = statuses.map((status) => ({
    value: tasks.filter((t) => t.statusId === status.id).length,
    color: status.color,
    label: status.name,
  }))

  return <PieChartSVG segments={segments} />
}

// ─── Card: BigNumber ──────────────────────────────────────────────────────────

function BigNumberCard({
  value,
  label,
  color,
}: {
  value: number
  label: string
  color?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-4 gap-1">
      <span className="text-5xl font-bold tabular-nums" style={{ color }}>
        {value.toLocaleString()}
      </span>
      <span className="text-xs text-muted-foreground mt-1">{label}</span>
    </div>
  )
}

// ─── Card: Priority Breakdown (Bar) ──────────────────────────────────────────

function PriorityBarCard({ tasks }: { tasks: Task[] }) {
  const total = tasks.length

  if (total === 0) {
    return <p className="text-xs text-muted-foreground text-center py-4">No tasks yet</p>
  }

  const rows = PRIORITY_ORDER
    .map((p) => ({ priority: p, count: tasks.filter((t) => t.priority === p).length }))
    .filter((r) => r.count > 0)

  return (
    <div className="space-y-3">
      {rows.map(({ priority, count }) => {
        const pct = (count / total) * 100
        return (
          <div key={priority} className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-1.5">
                <Flag className="size-2.5 shrink-0" style={{ color: PRIORITY_COLORS[priority] }} />
                <span className="text-muted-foreground truncate">{PRIORITY_LABELS[priority]}</span>
              </div>
              <span className="font-semibold tabular-nums">{count}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: PRIORITY_COLORS[priority] }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Card: Priority Distribution (Pie) ───────────────────────────────────────

function PriorityPieCard({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-4">No tasks yet</p>
  }

  const segments = PRIORITY_ORDER
    .map((p) => ({
      value: tasks.filter((t) => t.priority === p).length,
      color: PRIORITY_COLORS[p],
      label: PRIORITY_LABELS[p],
    }))
    .filter((s) => s.value > 0)

  return <PieChartSVG segments={segments} />
}

// ─── Card: Priority List ──────────────────────────────────────────────────────

function PriorityListCard({
  tasks,
  statuses,
  onTaskClick,
}: {
  tasks: Task[]
  statuses: TaskStatus[]
  onTaskClick: (task: Task) => void
}) {
  const statusMap = Object.fromEntries(statuses.map((s) => [s.id, s]))
  const priorityOrder: Record<string, number> = { urgent: 0, high: 1 }

  const filtered = tasks
    .filter((t) => t.priority === "urgent" || t.priority === "high")
    .sort((a, b) => {
      return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
    })
    .slice(0, 8)

  if (filtered.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4">
        No urgent or high priority tasks
      </p>
    )
  }

  return (
    <div className="space-y-0.5 -mx-1">
      {filtered.map((task) => {
        const status = statusMap[task.statusId]
        return (
          <button
            key={task.id}
            onClick={() => onTaskClick(task)}
            className="flex items-center gap-2 w-full text-left rounded-md px-2 py-1.5 hover:bg-accent transition-colors"
          >
            <Flag
              className="size-3 shrink-0"
              style={{ color: PRIORITY_COLORS[task.priority] }}
            />
            <span
              className={`flex-1 text-sm truncate ${
                task.isCompleted ? "line-through text-muted-foreground" : ""
              }`}
            >
              {task.title}
            </span>
            {status && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full shrink-0"
                style={{ backgroundColor: `${status.color}22`, color: status.color }}
              >
                {status.name}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Card: Task List ──────────────────────────────────────────────────────────

function TaskListCard({
  tasks,
  statuses,
  onTaskClick,
}: {
  tasks: Task[]
  statuses: TaskStatus[]
  onTaskClick: (task: Task) => void
}) {
  const statusMap = Object.fromEntries(statuses.map((s) => [s.id, s]))
  const sorted = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder).slice(0, 10)

  if (sorted.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-4">No tasks</p>
  }

  return (
    <div className="space-y-0.5 max-h-52 overflow-y-auto -mx-1">
      {sorted.map((task) => {
        const status = statusMap[task.statusId]
        return (
          <button
            key={task.id}
            onClick={() => onTaskClick(task)}
            className="flex items-center gap-2 w-full text-left rounded-md px-2 py-1.5 hover:bg-accent transition-colors"
          >
            <span
              className="size-2 rounded-full shrink-0"
              style={{ backgroundColor: status?.color ?? "#94a3b8" }}
            />
            <span
              className={`flex-1 text-sm truncate ${
                task.isCompleted ? "line-through text-muted-foreground" : ""
              }`}
            >
              {task.title}
            </span>
            {status && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full shrink-0"
                style={{ backgroundColor: `${status.color}22`, color: status.color }}
              >
                {status.name}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Card: Recent Tasks ───────────────────────────────────────────────────────

function RecentTasksCard({
  tasks,
  statuses,
  onTaskClick,
}: {
  tasks: Task[]
  statuses: TaskStatus[]
  onTaskClick: (task: Task) => void
}) {
  const statusMap = Object.fromEntries(statuses.map((s) => [s.id, s]))
  const recent = [...tasks]
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
    .slice(0, 6)

  if (recent.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-4">No tasks yet</p>
  }

  return (
    <div className="space-y-1 -mx-1">
      <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-2 pb-1 border-b">
        <span className="text-xs text-muted-foreground">Name</span>
        <span className="text-xs text-muted-foreground w-20 text-right">Status</span>
        <span className="text-xs text-muted-foreground w-14 text-right">Updated</span>
      </div>
      {recent.map((task) => {
        const status = statusMap[task.statusId]
        const updated = task.updatedAt ? getTimeAgo(new Date(task.updatedAt)) : "—"
        return (
          <button
            key={task.id}
            onClick={() => onTaskClick(task)}
            className="grid grid-cols-[1fr_auto_auto] gap-4 items-center w-full text-left rounded-md px-2 py-1.5 hover:bg-accent transition-colors"
          >
            <span
              className={`text-sm truncate ${
                task.isCompleted ? "line-through text-muted-foreground" : ""
              }`}
            >
              {task.title}
            </span>
            {status ? (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full w-20 text-center"
                style={{ backgroundColor: `${status.color}22`, color: status.color }}
              >
                {status.name}
              </span>
            ) : (
              <span />
            )}
            <span className="text-xs text-muted-foreground w-14 text-right">{updated}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Card: Overdue Tasks ──────────────────────────────────────────────────────

function OverdueTasksCard({
  tasks,
  statuses,
  onTaskClick,
}: {
  tasks: Task[]
  statuses: TaskStatus[]
  onTaskClick: (task: Task) => void
}) {
  const statusMap = Object.fromEntries(statuses.map((s) => [s.id, s]))
  const today = new Date()

  const overdue = tasks
    .filter((t) => !t.isCompleted && t.dueDate && new Date(t.dueDate) < today)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .slice(0, 8)

  if (overdue.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-4">No overdue tasks</p>
  }

  return (
    <div className="space-y-1 -mx-1">
      <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-2 pb-1 border-b">
        <span className="text-xs text-muted-foreground">Name</span>
        <span className="text-xs text-muted-foreground w-20 text-right">Status</span>
        <span className="text-xs text-muted-foreground w-20 text-right">Due</span>
      </div>
      {overdue.map((task) => {
        const status = statusMap[task.statusId]
        const due = task.dueDate
          ? new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })
          : ""
        return (
          <button
            key={task.id}
            onClick={() => onTaskClick(task)}
            className="grid grid-cols-[1fr_auto_auto] gap-4 items-center w-full text-left rounded-md px-2 py-1.5 hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <AlertTriangle className="size-3 text-red-400 shrink-0" />
              <span className="text-sm truncate">{task.title}</span>
            </div>
            {status ? (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full w-20 text-center shrink-0"
                style={{ backgroundColor: `${status.color}22`, color: status.color }}
              >
                {status.name}
              </span>
            ) : (
              <span />
            )}
            <span className="text-xs text-red-400 w-20 text-right shrink-0">{due}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Card: Status Table ───────────────────────────────────────────────────────

function StatusTableCard({ statuses, tasks }: { statuses: TaskStatus[]; tasks: Task[] }) {
  const total = tasks.length

  if (total === 0) {
    return <p className="text-xs text-muted-foreground text-center py-4">No tasks yet</p>
  }

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b">
          <th className="text-left pb-2 text-muted-foreground font-medium">Status</th>
          <th className="text-right pb-2 text-muted-foreground font-medium w-16">Tasks</th>
          <th className="text-right pb-2 text-muted-foreground font-medium w-12">%</th>
        </tr>
      </thead>
      <tbody>
        {statuses.map((status) => {
          const count = tasks.filter((t) => t.statusId === status.id).length
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          return (
            <tr key={status.id} className="border-b last:border-0">
              <td className="py-2">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: status.color }} />
                  <span className="truncate">{status.name}</span>
                </div>
              </td>
              <td className="py-2 text-right tabular-nums font-semibold">{count}</td>
              <td className="py-2 text-right tabular-nums text-muted-foreground">{pct}%</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ─── Card: Priority Table ─────────────────────────────────────────────────────

function PriorityTableCard({ tasks }: { tasks: Task[] }) {
  const total = tasks.length

  if (total === 0) {
    return <p className="text-xs text-muted-foreground text-center py-4">No tasks yet</p>
  }

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b">
          <th className="text-left pb-2 text-muted-foreground font-medium">Priority</th>
          <th className="text-right pb-2 text-muted-foreground font-medium w-16">Tasks</th>
          <th className="text-right pb-2 text-muted-foreground font-medium w-12">%</th>
        </tr>
      </thead>
      <tbody>
        {PRIORITY_ORDER.map((p) => {
          const count = tasks.filter((t) => t.priority === p).length
          if (count === 0) return null
          const pct = Math.round((count / total) * 100)
          return (
            <tr key={p} className="border-b last:border-0">
              <td className="py-2">
                <div className="flex items-center gap-1.5">
                  <Flag className="size-2.5 shrink-0" style={{ color: PRIORITY_COLORS[p] }} />
                  <span>{PRIORITY_LABELS[p]}</span>
                </div>
              </td>
              <td className="py-2 text-right tabular-nums font-semibold">{count}</td>
              <td className="py-2 text-right tabular-nums text-muted-foreground">{pct}%</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ─── Card: Line Chart (Tasks Over Time) ──────────────────────────────────────

function LineChartCard({ tasks }: { tasks: Task[] }) {
  const dated = tasks
    .filter((t) => t.createdAt)
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""))

  if (dated.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-4">No tasks yet</p>
  }

  const counts: Record<string, number> = {}
  dated.forEach((t) => {
    const d = new Date(t.createdAt!).toISOString().slice(0, 10)
    counts[d] = (counts[d] || 0) + 1
  })

  const dates = Object.keys(counts).sort()
  let cum = 0
  const points = dates.map((d) => {
    cum += counts[d]
    return { date: d, value: cum }
  })

  if (points.length === 1) points.push({ ...points[0] })

  const pad = { t: 12, r: 12, b: 22, l: 32 }
  const W = 300,
    H = 160
  const cW = W - pad.l - pad.r,
    cH = H - pad.t - pad.b
  const maxV = Math.max(...points.map((p) => p.value), 1)
  const xPos = (i: number) => pad.l + (i / Math.max(1, points.length - 1)) * cW
  const yPos = (v: number) => pad.t + cH - (v / maxV) * cH

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xPos(i)},${yPos(p.value)}`)
    .join(" ")
  const area = `${line} L${xPos(points.length - 1)},${yPos(0)} L${xPos(0)},${yPos(0)} Z`

  const gridN = 4
  const gridVals = Array.from({ length: gridN + 1 }, (_, i) =>
    Math.round((maxV * i) / gridN),
  )

  const labelIndices =
    points.length <= 6
      ? points.map((_, i) => i)
      : [0, Math.floor(points.length / 2), points.length - 1]

  return (
    <div className="h-full min-h-[120px]">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="grad-line" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {gridVals.map((v, i) => (
          <g key={i}>
            <line
              x1={pad.l}
              y1={yPos(v)}
              x2={W - pad.r}
              y2={yPos(v)}
              stroke="currentColor"
              strokeOpacity="0.08"
            />
            <text
              x={pad.l - 4}
              y={yPos(v) + 3}
              textAnchor="end"
              fontSize="7"
              fill="gray"
            >
              {v}
            </text>
          </g>
        ))}
        <path d={area} fill="url(#grad-line)" />
        <path
          d={line}
          fill="none"
          stroke="#6366f1"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={xPos(i)}
            cy={yPos(p.value)}
            r="2.5"
            fill="#6366f1"
          />
        ))}
        {labelIndices.map((i) => (
          <text
            key={i}
            x={xPos(i)}
            y={H - 4}
            textAnchor="middle"
            fontSize="7"
            fill="gray"
          >
            {new Date(points[i].date).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </text>
        ))}
      </svg>
    </div>
  )
}

// ─── Card: Burndown Chart ────────────────────────────────────────────────────

function BurndownCard({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4">
        No tasks yet
      </p>
    )
  }

  const eventMap: Record<string, { created: number; completed: number }> = {}

  tasks.forEach((t) => {
    if (t.createdAt) {
      const d = new Date(t.createdAt).toISOString().slice(0, 10)
      if (!eventMap[d]) eventMap[d] = { created: 0, completed: 0 }
      eventMap[d].created++
    }
    if (t.isCompleted && t.updatedAt) {
      const d = new Date(t.updatedAt).toISOString().slice(0, 10)
      if (!eventMap[d]) eventMap[d] = { created: 0, completed: 0 }
      eventMap[d].completed++
    }
  })

  const dates = Object.keys(eventMap).sort()
  if (dates.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4">No data</p>
    )
  }

  let totalCreated = 0,
    totalCompleted = 0
  const points = dates.map((d) => {
    totalCreated += eventMap[d].created
    totalCompleted += eventMap[d].completed
    return { date: d, remaining: totalCreated - totalCompleted }
  })

  if (points.length === 1) points.push({ ...points[0] })

  const pad = { t: 12, r: 12, b: 22, l: 32 }
  const W = 300,
    H = 160
  const cW = W - pad.l - pad.r,
    cH = H - pad.t - pad.b
  const maxV = Math.max(...points.map((p) => p.remaining), tasks.length, 1)

  const xPos = (i: number) =>
    pad.l + (i / Math.max(1, points.length - 1)) * cW
  const yPos = (v: number) => pad.t + cH - (v / maxV) * cH

  const idealStart = { x: xPos(0), y: yPos(tasks.length) }
  const idealEnd = { x: xPos(points.length - 1), y: yPos(0) }

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xPos(i)},${yPos(p.remaining)}`)
    .join(" ")
  const area = `${line} L${xPos(points.length - 1)},${yPos(0)} L${xPos(0)},${yPos(0)} Z`

  const gridN = 4
  const gridVals = Array.from({ length: gridN + 1 }, (_, i) =>
    Math.round((maxV * i) / gridN),
  )

  const labelIndices =
    points.length <= 6
      ? points.map((_, i) => i)
      : [0, Math.floor(points.length / 2), points.length - 1]

  return (
    <div className="h-full min-h-[120px]">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="grad-burndown" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {gridVals.map((v, i) => (
          <g key={i}>
            <line
              x1={pad.l}
              y1={yPos(v)}
              x2={W - pad.r}
              y2={yPos(v)}
              stroke="currentColor"
              strokeOpacity="0.08"
            />
            <text
              x={pad.l - 4}
              y={yPos(v) + 3}
              textAnchor="end"
              fontSize="7"
              fill="gray"
            >
              {v}
            </text>
          </g>
        ))}
        <line
          x1={idealStart.x}
          y1={idealStart.y}
          x2={idealEnd.x}
          y2={idealEnd.y}
          stroke="#94a3b8"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
        <path d={area} fill="url(#grad-burndown)" />
        <path
          d={line}
          fill="none"
          stroke="#f97316"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={xPos(i)}
            cy={yPos(p.remaining)}
            r="2.5"
            fill="#f97316"
          />
        ))}
        {labelIndices.map((i) => (
          <text
            key={i}
            x={xPos(i)}
            y={H - 4}
            textAnchor="middle"
            fontSize="7"
            fill="gray"
          >
            {new Date(points[i].date).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </text>
        ))}
        <line
          x1={W - 80}
          y1={8}
          x2={W - 68}
          y2={8}
          stroke="#f97316"
          strokeWidth="2"
        />
        <text x={W - 65} y={11} fontSize="7" fill="gray">
          Actual
        </text>
        <line
          x1={W - 80}
          y1={18}
          x2={W - 68}
          y2={18}
          stroke="#94a3b8"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
        <text x={W - 65} y={21} fontSize="7" fill="gray">
          Ideal
        </text>
      </svg>
    </div>
  )
}

// ─── Card: Battery Chart ─────────────────────────────────────────────────────

function BatteryCard({
  statuses,
  tasks,
}: {
  statuses: TaskStatus[]
  tasks: Task[]
}) {
  const total = tasks.length

  if (total === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4">
        No tasks yet
      </p>
    )
  }

  const completed = tasks.filter((t) => t.isCompleted).length
  const pct = Math.round((completed / total) * 100)

  return (
    <div className="h-full flex flex-col justify-center gap-4 min-h-[100px]">
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Overall Completion</span>
          <span className="font-semibold">{pct}%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex-1 h-7 rounded-md border-2 border-foreground/20 overflow-hidden flex bg-muted/20">
            {statuses.map((status) => {
              const count = tasks.filter(
                (t) => t.statusId === status.id && t.isCompleted,
              ).length
              const w = total > 0 ? (count / total) * 100 : 0
              if (w === 0) return null
              return (
                <div
                  key={status.id}
                  className="h-full transition-all"
                  style={{ width: `${w}%`, backgroundColor: status.color }}
                  title={`${status.name}: ${count}`}
                />
              )
            })}
          </div>
          <div className="w-1.5 h-3.5 rounded-r-sm bg-foreground/20" />
        </div>
      </div>

      <div className="space-y-2.5">
        {statuses.map((status) => {
          const count = tasks.filter((t) => t.statusId === status.id).length
          const statusPct =
            total > 0 ? Math.round((count / total) * 100) : 0
          return (
            <div key={status.id} className="space-y-0.5">
              <div className="flex justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: status.color }}
                  />
                  <span className="text-muted-foreground truncate">
                    {status.name}
                  </span>
                </div>
                <span className="text-muted-foreground tabular-nums">
                  {count} ({statusPct}%)
                </span>
              </div>
              <div className="flex items-center gap-0.5">
                <div className="flex-1 h-3.5 rounded border border-foreground/10 overflow-hidden bg-muted/20">
                  <div
                    className="h-full rounded-sm transition-all"
                    style={{
                      width: `${statusPct}%`,
                      backgroundColor: status.color,
                    }}
                  />
                </div>
                <div className="w-1 h-2 rounded-r-sm bg-foreground/10" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Card: Cumulative Flow ───────────────────────────────────────────────────

function CumulativeFlowCard({
  statuses,
  tasks,
}: {
  statuses: TaskStatus[]
  tasks: Task[]
}) {
  if (tasks.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4">
        No tasks yet
      </p>
    )
  }

  const dated = tasks
    .filter((t) => t.createdAt)
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""))

  if (dated.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4">No data</p>
    )
  }

  const dateStatusMap: Record<string, Record<string, number>> = {}
  dated.forEach((t) => {
    const d = new Date(t.createdAt!).toISOString().slice(0, 10)
    if (!dateStatusMap[d]) dateStatusMap[d] = {}
    dateStatusMap[d][t.statusId] = (dateStatusMap[d][t.statusId] || 0) + 1
  })

  const dates = Object.keys(dateStatusMap).sort()

  const cumByStatus: Record<string, number> = {}
  statuses.forEach((s) => {
    cumByStatus[s.id] = 0
  })

  const stackedData = dates.map((d) => {
    statuses.forEach((s) => {
      cumByStatus[s.id] += dateStatusMap[d][s.id] || 0
    })
    return { date: d, values: { ...cumByStatus } }
  })

  if (stackedData.length === 1) stackedData.push({ ...stackedData[0] })

  const pad = { t: 12, r: 12, b: 22, l: 32 }
  const W = 300,
    H = 160
  const cW = W - pad.l - pad.r,
    cH = H - pad.t - pad.b
  const maxTotal = Math.max(
    ...stackedData.map((d) =>
      statuses.reduce((s, st) => s + d.values[st.id], 0),
    ),
    1,
  )

  const xPos = (i: number) =>
    pad.l + (i / Math.max(1, stackedData.length - 1)) * cW
  const yPos = (v: number) => pad.t + cH - (v / maxTotal) * cH

  const reversedStatuses = [...statuses].reverse()
  const areas = reversedStatuses.map((status) => {
    const belowStatuses = reversedStatuses.slice(
      reversedStatuses.indexOf(status) + 1,
    )

    const topPoints = stackedData.map((d, i) => {
      const belowSum = belowStatuses.reduce((s, st) => s + d.values[st.id], 0)
      return { x: xPos(i), y: yPos(belowSum + d.values[status.id]) }
    })

    const bottomPoints = stackedData
      .map((d, i) => {
        const belowSum = belowStatuses.reduce(
          (s, st) => s + d.values[st.id],
          0,
        )
        return { x: xPos(i), y: yPos(belowSum) }
      })
      .reverse()

    const pathD = [
      ...topPoints.map(
        (p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`,
      ),
      ...bottomPoints.map((p) => `L${p.x},${p.y}`),
      "Z",
    ].join(" ")

    return { id: status.id, color: status.color, d: pathD }
  })

  const gridN = 4
  const gridVals = Array.from({ length: gridN + 1 }, (_, i) =>
    Math.round((maxTotal * i) / gridN),
  )

  const labelIndices =
    stackedData.length <= 6
      ? stackedData.map((_, i) => i)
      : [0, Math.floor(stackedData.length / 2), stackedData.length - 1]

  return (
    <div className="h-full min-h-[120px] flex flex-col">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full flex-1"
        preserveAspectRatio="xMidYMid meet"
      >
        {gridVals.map((v, i) => (
          <g key={i}>
            <line
              x1={pad.l}
              y1={yPos(v)}
              x2={W - pad.r}
              y2={yPos(v)}
              stroke="currentColor"
              strokeOpacity="0.08"
            />
            <text
              x={pad.l - 4}
              y={yPos(v) + 3}
              textAnchor="end"
              fontSize="7"
              fill="gray"
            >
              {v}
            </text>
          </g>
        ))}
        {areas.map((a) => (
          <path
            key={a.id}
            d={a.d}
            fill={a.color}
            fillOpacity="0.6"
            stroke={a.color}
            strokeWidth="1"
          />
        ))}
        {labelIndices.map((i) => (
          <text
            key={i}
            x={xPos(i)}
            y={H - 4}
            textAnchor="middle"
            fontSize="7"
            fill="gray"
          >
            {new Date(stackedData[i].date).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </text>
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
        {statuses.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-1 text-[10px] text-muted-foreground"
          >
            <span
              className="size-2 rounded-sm"
              style={{ backgroundColor: s.color }}
            />
            {s.name}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Card: Notes ──────────────────────────────────────────────────────────────

function NotesCard({ projectId, initialValue }: { projectId: string; initialValue: string }) {
  const [value, setValue] = useState(initialValue)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleChange(text: string) {
    setValue(text)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      updateElement(projectId, { description: text })
    }, 800)
  }

  return (
    <textarea
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      placeholder="Add notes about this project..."
      className="w-full h-32 bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground/40 leading-relaxed"
    />
  )
}

// ─── Card: Embed ──────────────────────────────────────────────────────────────

function EmbedCard({ projectId }: { projectId: string }) {
  const storageKey = `embed-url-${projectId}`
  const [savedUrl, setSavedUrl] = useState<string>("")
  const [inputVal, setInputVal] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [showWarning, setShowWarning] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    setSavedUrl(localStorage.getItem(storageKey) ?? "")
  }, [storageKey])

  // Detect blocked embeds: if iframe hasn't fired onLoad after 5s, show warning
  useEffect(() => {
    if (!savedUrl) return
    setLoaded(false)
    setShowWarning(false)
    const timer = setTimeout(() => {
      if (!loaded) setShowWarning(true)
    }, 5000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedUrl])

  function save() {
    const u = inputVal.trim()
    if (!u) return
    setSavedUrl(u)
    localStorage.setItem(storageKey, u)
  }

  function clear() {
    setSavedUrl("")
    setLoaded(false)
    setShowWarning(false)
    localStorage.removeItem(storageKey)
    setInputVal("")
  }

  if (!savedUrl) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Paste a URL to embed content (Google Docs, Sheets, Figma, YouTube, etc.)
        </p>
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            className="flex-1 h-8 px-3 text-xs rounded-md border bg-transparent outline-none focus:ring-1 focus:ring-ring"
          />
          <Button size="sm" className="h-8 text-xs" onClick={save}>
            Embed
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground/60">
          Some websites block embedding for security. Google Docs, YouTube, Figma, and CodePen work best.
        </p>
      </div>
    )
  }

  return (
    <div className="relative h-full min-h-[200px]">
      <iframe
        ref={iframeRef}
        src={savedUrl}
        className="w-full h-full rounded border-0"
        style={{ minHeight: 200 }}
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        referrerPolicy="no-referrer-when-downgrade"
        title="Embedded content"
        onLoad={() => { setLoaded(true); setShowWarning(false) }}
      />

      {/* Warning overlay when embed is likely blocked */}
      {showWarning && !loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/90 backdrop-blur-sm rounded z-10">
          <AlertTriangle className="size-8 text-muted-foreground" />
          <p className="text-xs text-muted-foreground text-center px-6 max-w-sm">
            This website may have blocked embedding. Many sites (including claude.ai) prevent being shown inside other pages for security.
          </p>
          <div className="flex gap-2">
            <a
              href={savedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-7 px-3 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Code2 className="size-3" />
              Open in New Tab
            </a>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={clear}>
              Change URL
            </Button>
          </div>
        </div>
      )}

      <div className="absolute top-1 right-1 flex gap-1 z-20">
        <a
          href={savedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-background/90 border rounded px-2 py-0.5 text-xs hover:bg-muted inline-block"
          title="Open in new tab"
        >
          ↗
        </a>
        <button
          onClick={clear}
          className="bg-background/90 border rounded px-2 py-0.5 text-xs hover:bg-muted"
        >
          Change
        </button>
      </div>
    </div>
  )
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function getTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}
