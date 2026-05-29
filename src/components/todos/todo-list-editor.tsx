"use client"

import { useState } from "react"
import {
  Plus, Trash2, GripVertical, Calendar, Pencil, CheckSquare, Square,
  Flag, MoreVertical, X,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { SpeechButton } from "@/components/shared/speech-button"
import {
  createTodoItem,
  updateTodoItem,
  deleteTodoItem,
} from "@/lib/actions/todo-actions"
import type { todoItems } from "@/lib/db/schema"
import { ContextMenu, useContextMenu, type ContextMenuEntry } from "@/components/shared/context-menu"

type TodoItem = typeof todoItems.$inferSelect & {
  priority?: "urgent" | "high" | "medium" | "low" | null
}

interface TodoListEditorProps {
  listId: string
  items: TodoItem[]
}

const PRIORITY_COLORS: Record<NonNullable<TodoItem["priority"]>, string> = {
  urgent: "#ef4444",
  high:   "#f97316",
  medium: "#eab308",
  low:    "#94a3b8",
}

const PRIORITY_LABEL: Record<NonNullable<TodoItem["priority"]>, string> = {
  urgent: "Urgent",
  high:   "High",
  medium: "Medium",
  low:    "Low",
}

export function TodoListEditor({ listId, items }: TodoListEditorProps) {
  const [newTitle, setNewTitle] = useState("")

  async function handleAdd() {
    if (!newTitle.trim()) return
    await createTodoItem(listId, newTitle.trim())
    setNewTitle("")
  }

  const completedCount = items.filter((i) => i.isCompleted).length

  return (
    <div className="space-y-4">
      {/* Progress */}
      {items.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-300"
              style={{
                width: `${(completedCount / items.length) * 100}%`,
              }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {completedCount}/{items.length}
          </span>
        </div>
      )}

      {/* Add input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            placeholder="Add a new item..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd()
            }}
            className="pr-9"
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
            <SpeechButton
              onTranscript={(text) => setNewTitle((prev) => prev ? `${prev} ${text}` : text)}
              size="sm"
              showPulse={false}
              tooltip="Dictate item"
              preferAccuracy
            />
          </div>
        </div>
        <Button onClick={handleAdd} size="icon" variant="outline">
          <Plus className="size-4" />
        </Button>
      </div>

      {/* Items */}
      <div className="space-y-1">
        {items.map((item) => (
          <TodoItemRow key={item.id} item={item} listId={listId} />
        ))}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No items yet. Add one above.
          </p>
        )}
      </div>
    </div>
  )
}

function TodoItemRow({ item, listId }: { item: TodoItem; listId: string }) {
  const [title, setTitle] = useState(item.title)
  const [isEditing, setIsEditing] = useState(false)
  /** "priority" | "date" | null — which inline popover is open. */
  const [activePopover, setActivePopover] = useState<"priority" | "date" | null>(null)
  const { menu: ctxMenu, open: openCtx, close: closeCtx } = useContextMenu()

  function handleContextMenu(e: React.MouseEvent) {
    const entries: ContextMenuEntry[] = [
      {
        label: "Rename",
        icon: Pencil,
        onClick: () => setIsEditing(true),
      },
      {
        label: item.isCompleted ? "Mark incomplete" : "Mark complete",
        icon: item.isCompleted ? Square : CheckSquare,
        onClick: () => updateTodoItem(item.id, listId, { isCompleted: !item.isCompleted }),
      },
      { separator: true },
      {
        label: item.priority ? `Priority: ${PRIORITY_LABEL[item.priority]}` : "Set priority…",
        icon: Flag,
        onClick: () => setActivePopover("priority"),
      },
      {
        label: item.dueDate ? `Due ${new Date(item.dueDate).toLocaleDateString()}` : "Set due date…",
        icon: Calendar,
        onClick: () => setActivePopover("date"),
      },
      { separator: true },
      {
        label: "Delete",
        icon: Trash2,
        variant: "destructive",
        onClick: () => deleteTodoItem(item.id, listId),
      },
    ]
    openCtx(e, entries)
  }

  const priorityColor = item.priority ? PRIORITY_COLORS[item.priority] : null

  return (
    <>
      <div
        className="group relative rounded-lg border bg-card hover:bg-accent/50 transition-colors"
        onContextMenu={handleContextMenu}
      >
        <div className="flex items-center gap-2 px-2 sm:px-3 py-2">
          <GripVertical className="hidden sm:block size-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab shrink-0" />

          {/* Checkbox */}
          <button
            onClick={() =>
              updateTodoItem(item.id, listId, { isCompleted: !item.isCompleted })
            }
            className={`size-5 shrink-0 rounded-full border-2 transition-colors flex items-center justify-center ${
              item.isCompleted
                ? "bg-green-500 border-green-500"
                : "border-muted-foreground/30 hover:border-green-500"
            }`}
            aria-label={item.isCompleted ? "Mark incomplete" : "Mark complete"}
          >
            {item.isCompleted && (
              <svg className="size-3 text-white" viewBox="0 0 12 12" fill="none">
                <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>

          {/* Title */}
          {isEditing ? (
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                setIsEditing(false)
                if (title !== item.title) {
                  updateTodoItem(item.id, listId, { title: title || "Untitled" })
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  ;(e.target as HTMLInputElement).blur()
                }
              }}
              className="flex-1 bg-transparent outline-none text-sm min-w-0"
            />
          ) : (
            <span
              onClick={() => setIsEditing(true)}
              className={`flex-1 text-sm cursor-text min-w-0 break-words ${
                item.isCompleted ? "line-through text-muted-foreground" : ""
              }`}
            >
              {item.title}
            </span>
          )}

          {/* Always-visible chips — tap to edit (mobile-friendly).
              Priority dot is colored when set, faded when not. Calendar
              chip shows the date or just an icon if none. */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setActivePopover(activePopover === "priority" ? null : "priority")}
              className={`size-7 rounded-md flex items-center justify-center transition-colors ${
                priorityColor ? "" : "text-muted-foreground/40 hover:text-foreground"
              } hover:bg-accent`}
              aria-label="Set priority"
              title={item.priority ? `Priority: ${PRIORITY_LABEL[item.priority]}` : "Set priority"}
              style={priorityColor ? { color: priorityColor } : undefined}
            >
              <Flag className={item.priority ? "size-3.5 fill-current" : "size-3.5"} />
            </button>
            <button
              type="button"
              onClick={() => setActivePopover(activePopover === "date" ? null : "date")}
              className={`h-7 px-1.5 rounded-md flex items-center gap-1 text-[11px] transition-colors hover:bg-accent ${
                item.dueDate ? "text-foreground" : "text-muted-foreground/40 hover:text-foreground"
              }`}
              aria-label={item.dueDate ? `Due ${new Date(item.dueDate).toLocaleDateString()}` : "Set due date"}
            >
              <Calendar className="size-3.5" />
              {item.dueDate && (
                <span className="hidden sm:inline tabular-nums">
                  {shortDate(item.dueDate)}
                </span>
              )}
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground/40 hover:text-foreground"
              onClick={(e) => handleContextMenu(e as unknown as React.MouseEvent)}
              aria-label="More actions"
            >
              <MoreVertical className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Inline popover — picks priority */}
        {activePopover === "priority" && (
          <div className="border-t bg-background/95 backdrop-blur-sm px-2 sm:px-3 py-2 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium mr-1">
              Priority
            </span>
            {(["urgent", "high", "medium", "low"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  updateTodoItem(item.id, listId, { priority: p })
                  setActivePopover(null)
                }}
                className={`px-2 py-1 rounded-full text-[11px] font-medium border-2 transition-colors ${
                  item.priority === p ? "border-current" : "border-transparent hover:border-current/30"
                }`}
                style={{ color: PRIORITY_COLORS[p] }}
              >
                {PRIORITY_LABEL[p]}
              </button>
            ))}
            {item.priority && (
              <button
                type="button"
                onClick={() => {
                  updateTodoItem(item.id, listId, { priority: null })
                  setActivePopover(null)
                }}
                className="px-2 py-1 rounded-full text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <X className="size-3" /> Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => setActivePopover(null)}
              className="ml-auto size-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center"
              aria-label="Close"
            >
              <X className="size-3" />
            </button>
          </div>
        )}

        {/* Inline popover — picks due date */}
        {activePopover === "date" && (
          <div className="border-t bg-background/95 backdrop-blur-sm px-2 sm:px-3 py-2 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium mr-1">
              Due
            </span>
            {[
              { label: "Today",     fn: () => isoDate(0) },
              { label: "Tomorrow",  fn: () => isoDate(1) },
              { label: "Next week", fn: () => isoDate(7) },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  updateTodoItem(item.id, listId, { dueDate: preset.fn() })
                  setActivePopover(null)
                }}
                className="px-2 py-1 rounded-full text-[11px] border-2 border-border hover:border-primary/40 transition-colors"
              >
                {preset.label}
              </button>
            ))}
            <input
              type="date"
              value={item.dueDate ? item.dueDate.slice(0, 10) : ""}
              onChange={(e) => {
                updateTodoItem(item.id, listId, { dueDate: e.target.value || null })
              }}
              className="h-7 rounded-md border border-input bg-background px-2 text-[11px]"
            />
            {item.dueDate && (
              <button
                type="button"
                onClick={() => {
                  updateTodoItem(item.id, listId, { dueDate: null })
                  setActivePopover(null)
                }}
                className="px-2 py-1 rounded-full text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <X className="size-3" /> Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => setActivePopover(null)}
              className="ml-auto size-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center"
              aria-label="Close"
            >
              <X className="size-3" />
            </button>
          </div>
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

function isoDate(daysFromToday: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + daysFromToday)
  return d.toISOString().slice(0, 10)
}

function shortDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}
