"use client"

import { useState, useCallback, useId } from "react"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { useDroppable } from "@dnd-kit/core"
import { Plus, Trash2, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { TaskCard } from "./task-card"
import { TaskDetailSheet } from "./task-detail-sheet"
import {
  createTask,
  moveTask,
  createTaskStatus,
  deleteTaskStatus,
  updateTaskStatus,
} from "@/lib/actions/task-actions"
import { toast } from "sonner"
import type { tasks, taskStatuses, taskLabels } from "@/lib/db/schema"
import { ContextMenu, useContextMenu, type ContextMenuEntry } from "@/components/shared/context-menu"
import type { TaskCardMeta } from "./project-views"

type Task = typeof tasks.$inferSelect
type TaskStatus = typeof taskStatuses.$inferSelect

interface TaskBoardProps {
  projectId: string
  statuses: TaskStatus[]
  tasks: Task[]
  progress: number
  taskMeta?: TaskCardMeta
}

function StatusColumn({
  status,
  tasks: columnTasks,
  projectId,
  onTaskClick,
  taskMeta,
}: {
  status: TaskStatus
  tasks: Task[]
  projectId: string
  onTaskClick: (task: Task) => void
  taskMeta?: TaskCardMeta
}) {
  const [isAdding, setIsAdding] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const { menu: ctxMenu, open: openCtx, close: closeCtx } = useContextMenu()

  const { setNodeRef, isOver } = useDroppable({
    id: status.id,
    data: { type: "column", status },
  })

  async function handleAdd() {
    if (!newTitle.trim()) return
    await createTask(projectId, status.id, newTitle.trim())
    setNewTitle("")
    setIsAdding(false)
  }

  function handleHeaderContextMenu(e: React.MouseEvent) {
    const items: ContextMenuEntry[] = [
      {
        label: "Add Task",
        icon: Plus,
        onClick: () => setIsAdding(true),
      },
      {
        label: "Rename",
        icon: Pencil,
        onClick: async () => {
          const name = window.prompt("Rename column to:", status.name)
          if (name && name.trim()) {
            await updateTaskStatus(status.id, projectId, { name: name.trim() })
          }
        },
      },
      { separator: true },
      {
        label: "Delete Column",
        icon: Trash2,
        variant: "destructive",
        onClick: () => deleteTaskStatus(status.id, projectId),
      },
    ]
    openCtx(e, items)
  }

  return (
    <>
    <div
      className={`flex flex-col w-72 shrink-0 rounded-lg border bg-muted/30 ${
        isOver ? "ring-2 ring-primary/50" : ""
      }`}
    >
      {/* Column Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        onContextMenu={handleHeaderContextMenu}
      >
        <div className="flex items-center gap-2">
          <span
            className="size-2.5 rounded-full"
            style={{ backgroundColor: status.color }}
          />
          <span className="text-sm font-medium">{status.name}</span>
          <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
            {columnTasks.length}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Tasks */}
      <div ref={setNodeRef} className="flex-1 p-2 space-y-2 min-h-[100px]">
        <SortableContext
          items={columnTasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {columnTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task)}
              labels={taskMeta?.labelsByTask[task.id]}
              subtaskCount={taskMeta?.subtaskCounts[task.id]?.total}
              subtaskDoneCount={taskMeta?.subtaskCounts[task.id]?.done}
              checklistTotal={taskMeta?.checklistByTask[task.id]?.total}
              checklistDone={taskMeta?.checklistByTask[task.id]?.done}
            />
          ))}
        </SortableContext>

        {/* Add task input */}
        {isAdding && (
          <div className="space-y-2">
            <Input
              autoFocus
              placeholder="Task title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd()
                if (e.key === "Escape") {
                  setIsAdding(false)
                  setNewTitle("")
                }
              }}
            />
            <div className="flex gap-1">
              <Button size="sm" onClick={handleAdd}>
                Add
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsAdding(false)
                  setNewTitle("")
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add task button at bottom */}
      {!isAdding && (
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors border-t"
        >
          <Plus className="size-3" />
          Add task
        </button>
      )}
    </div>

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

export function TaskBoard({ projectId, statuses, tasks: allTasks, progress, taskMeta }: TaskBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [isAddingColumn, setIsAddingColumn] = useState(false)
  const [newColumnName, setNewColumnName] = useState("")

  const dndId = useId()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  )

  const tasksByStatus = statuses.reduce(
    (acc, status) => {
      acc[status.id] = allTasks
        .filter((t) => t.statusId === status.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
      return acc
    },
    {} as Record<string, Task[]>
  )

  function handleDragStart(event: DragStartEvent) {
    const task = allTasks.find((t) => t.id === event.active.id)
    if (task) setActiveTask(task)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null)
    const { active, over } = event
    if (!over) return

    const taskId = active.id as string
    const task = allTasks.find((t) => t.id === taskId)
    if (!task) return

    // Determine target column
    let targetStatusId: string
    const overData = over.data.current

    if (overData?.type === "column") {
      targetStatusId = over.id as string
    } else if (overData?.type === "task") {
      targetStatusId = overData.task.statusId
    } else {
      // Dropping on a column droppable
      targetStatusId = over.id as string
    }

    const targetTasks = tasksByStatus[targetStatusId] || []
    const newSortOrder = targetTasks.length > 0
      ? Math.max(...targetTasks.map((t) => t.sortOrder)) + 1
      : 0

    if (task.statusId !== targetStatusId || task.sortOrder !== newSortOrder) {
      moveTask(taskId, projectId, targetStatusId, newSortOrder)
    }
  }

  function handleTaskClick(task: Task) {
    setSelectedTask(task)
    setSheetOpen(true)
  }

  async function handleAddColumn() {
    if (!newColumnName.trim()) return
    await createTaskStatus(projectId, {
      name: newColumnName.trim(),
      color: "#94a3b8",
    })
    setNewColumnName("")
    setIsAddingColumn(false)
  }

  return (
    <>
      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-sm text-muted-foreground">{progress}%</span>
      </div>

      {/* Board */}
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {statuses.map((status) => (
            <StatusColumn
              key={status.id}
              status={status}
              tasks={tasksByStatus[status.id] || []}
              projectId={projectId}
              onTaskClick={handleTaskClick}
              taskMeta={taskMeta}
            />
          ))}

          {/* Add column */}
          {isAddingColumn ? (
            <div className="w-72 shrink-0 rounded-lg border border-dashed p-3 space-y-2">
              <Input
                autoFocus
                placeholder="Column name..."
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddColumn()
                  if (e.key === "Escape") {
                    setIsAddingColumn(false)
                    setNewColumnName("")
                  }
                }}
              />
              <div className="flex gap-1">
                <Button size="sm" onClick={handleAddColumn}>
                  Add
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsAddingColumn(false)
                    setNewColumnName("")
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingColumn(true)}
              className="flex items-center gap-2 w-72 shrink-0 rounded-lg border border-dashed p-4 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors justify-center"
            >
              <Plus className="size-4" />
              Add column
            </button>
          )}
        </div>

        <DragOverlay>
          {activeTask && (
            <div className="rounded-lg border bg-card p-3 shadow-lg opacity-90 w-72">
              <p className="text-sm font-medium">{activeTask.title}</p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <TaskDetailSheet
        task={selectedTask}
        statuses={statuses}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  )
}
