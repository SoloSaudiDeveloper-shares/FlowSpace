"use client"

import { useState } from "react"
import {
  Plus, Trash2, GripVertical, Calendar, Pencil, CheckSquare, Square,
  Flag, MoreVertical, X, Smile, MessageSquare,
} from "lucide-react"
import { IconPicker, TodoIcon } from "@/components/shared/icon-picker"
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
import { toast } from "sonner"
import { useT } from "@/lib/hooks/use-i18n"

type TodoItem = typeof todoItems.$inferSelect & {
  priority?: "urgent" | "high" | "medium" | "low" | null
}

interface TodoListEditorProps {
  listId: string
  items: TodoItem[]
}

import { PRIORITY_COLOR as PRIORITY_COLORS, PRIORITY_LABEL } from "@/lib/priority"

export function TodoListEditor({ listId, items }: TodoListEditorProps) {
  const { t } = useT()
  const [newTitle, setNewTitle] = useState("")
  // Items hidden optimistically while their delete is in flight, so removal is
  // instant on screen instead of waiting for the server revalidation round-trip.
  const [removing, setRemoving] = useState<Set<string>>(new Set())

  async function handleAdd() {
    if (!newTitle.trim()) return
    await createTodoItem(listId, newTitle.trim())
    setNewTitle("")
  }

  async function handleDelete(id: string) {
    setRemoving((prev) => new Set(prev).add(id))
    try {
      await deleteTodoItem(id, listId)
    } catch {
      // Restore the row and tell the user.
      setRemoving((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      toast.error(t("misc.todo.deleteError"))
    }
  }

  const visibleItems = items.filter((i) => !removing.has(i.id))
  const completedCount = visibleItems.filter((i) => i.isCompleted).length

  return (
    <div className="space-y-4">
      {/* Progress */}
      {visibleItems.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-300"
              style={{
                width: `${(completedCount / visibleItems.length) * 100}%`,
              }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {completedCount}/{visibleItems.length}
          </span>
        </div>
      )}

      {/* Add input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            placeholder={t("misc.todo.addPlaceholder")}
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
              tooltip={t("misc.todo.dictate")}
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
        {visibleItems.map((item) => (
          <TodoItemRow key={item.id} item={item} listId={listId} onDelete={handleDelete} />
        ))}
        {visibleItems.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            {t("misc.todo.empty")}
          </p>
        )}
      </div>
    </div>
  )
}

function TodoItemRow({ item, listId, onDelete }: { item: TodoItem; listId: string; onDelete: (id: string) => void }) {
  const { t } = useT()
  const [title, setTitle] = useState(item.title)
  const [isEditing, setIsEditing] = useState(false)
  /** which inline popover is open. */
  const [activePopover, setActivePopover] = useState<"priority" | "date" | "icon" | "desc" | null>(null)
  const { menu: ctxMenu, open: openCtx, close: closeCtx } = useContextMenu()

  function handleContextMenu(e: React.MouseEvent) {
    const entries: ContextMenuEntry[] = [
      {
        label: t("misc.todo.rename"),
        icon: Pencil,
        onClick: () => setIsEditing(true),
      },
      {
        label: item.isCompleted ? t("misc.todo.markIncomplete") : t("misc.todo.markComplete"),
        icon: item.isCompleted ? Square : CheckSquare,
        onClick: () => updateTodoItem(item.id, listId, { isCompleted: !item.isCompleted }),
      },
      { separator: true },
      {
        label: item.priority ? t("misc.todo.priorityNamed").replace("{priority}", PRIORITY_LABEL[item.priority]) : t("misc.todo.setPriority"),
        icon: Flag,
        onClick: () => setActivePopover("priority"),
      },
      {
        label: item.dueDate ? t("misc.todo.due").replace("{date}", new Date(item.dueDate).toLocaleDateString()) : t("misc.todo.setDueDate"),
        icon: Calendar,
        onClick: () => setActivePopover("date"),
      },
      {
        label: item.icon ? "Change icon" : "Add icon",
        icon: Smile,
        onClick: () => setActivePopover("icon"),
      },
      {
        label: item.description ? "Edit comment" : "Add comment",
        icon: MessageSquare,
        onClick: () => setActivePopover("desc"),
      },
      { separator: true },
      {
        label: t("misc.todo.delete"),
        icon: Trash2,
        variant: "destructive",
        onClick: () => onDelete(item.id),
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
            aria-label={item.isCompleted ? t("misc.todo.markIncomplete") : t("misc.todo.markComplete")}
          >
            {item.isCompleted && (
              <svg className="size-3 text-white" viewBox="0 0 12 12" fill="none">
                <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>

          {/* Icon — shows when set; a faint placeholder appears on hover so
              you can add one. Optional. */}
          <button
            type="button"
            onClick={() => setActivePopover(activePopover === "icon" ? null : "icon")}
            className={`shrink-0 size-6 rounded-md flex items-center justify-center hover:bg-accent transition-all ${
              item.icon ? "" : "opacity-0 group-hover:opacity-100 text-muted-foreground/40"
            }`}
            title={item.icon ? "Change icon" : "Add icon"}
            aria-label="Set icon"
          >
            {item.icon ? <TodoIcon icon={item.icon} /> : <Smile className="size-4" />}
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
                  updateTodoItem(item.id, listId, { title: title || t("misc.todo.untitled") })
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
              aria-label={t("misc.todo.setPriorityShort")}
              title={item.priority ? t("misc.todo.priorityNamed").replace("{priority}", PRIORITY_LABEL[item.priority]) : t("misc.todo.setPriorityShort")}
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
              aria-label={item.dueDate ? t("misc.todo.due").replace("{date}", new Date(item.dueDate).toLocaleDateString()) : t("misc.todo.setDueDateShort")}
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
              aria-label={t("misc.todo.moreActions")}
            >
              <MoreVertical className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground/40 hover:text-destructive"
              onClick={() => onDelete(item.id)}
              aria-label={t("misc.todo.deleteItem")}
              title={t("misc.todo.delete")}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Comment / description — shown beneath the title, separated by a
            thin line, when set (and not currently being edited). */}
        {item.description && activePopover !== "desc" && (
          <div className="px-2 sm:px-3 pb-2 -mt-0.5">
            <div className="ml-7 border-t border-border/50 pt-1.5 text-xs text-muted-foreground whitespace-pre-wrap break-words">
              {item.description}
            </div>
          </div>
        )}

        {/* Inline popover — pick an icon */}
        {activePopover === "icon" && (
          <div className="border-t bg-background/95 backdrop-blur-sm px-2 sm:px-3 py-2">
            <IconPicker
              value={item.icon}
              onPick={(ic) => updateTodoItem(item.id, listId, { icon: ic })}
              onClose={() => setActivePopover(null)}
            />
          </div>
        )}

        {/* Inline popover — edit the comment */}
        {activePopover === "desc" && (
          <DescEditor
            initial={item.description ?? ""}
            onSave={(d) => {
              updateTodoItem(item.id, listId, { description: d || null })
              setActivePopover(null)
            }}
            onClose={() => setActivePopover(null)}
          />
        )}

        {/* Inline popover — picks priority */}
        {activePopover === "priority" && (
          <div className="border-t bg-background/95 backdrop-blur-sm px-2 sm:px-3 py-2 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium mr-1">
              {t("misc.todo.priorityLabel")}
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
                <X className="size-3" /> {t("misc.todo.clear")}
              </button>
            )}
            <button
              type="button"
              onClick={() => setActivePopover(null)}
              className="ml-auto size-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center"
              aria-label={t("misc.todo.close")}
            >
              <X className="size-3" />
            </button>
          </div>
        )}

        {/* Inline popover — picks due date */}
        {activePopover === "date" && (
          <div className="border-t bg-background/95 backdrop-blur-sm px-2 sm:px-3 py-2 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium mr-1">
              {t("misc.todo.dueLabel")}
            </span>
            {[
              { key: "today",    label: t("misc.todo.today"),    fn: () => isoDate(0) },
              { key: "tomorrow", label: t("misc.todo.tomorrow"), fn: () => isoDate(1) },
              { key: "nextWeek", label: t("misc.todo.nextWeek"), fn: () => isoDate(7) },
            ].map((preset) => (
              <button
                key={preset.key}
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
                <X className="size-3" /> {t("misc.todo.clear")}
              </button>
            )}
            <button
              type="button"
              onClick={() => setActivePopover(null)}
              className="ml-auto size-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center"
              aria-label={t("misc.todo.close")}
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

function DescEditor({
  initial,
  onSave,
  onClose,
}: {
  initial: string
  onSave: (d: string) => void
  onClose: () => void
}) {
  const [text, setText] = useState(initial)
  return (
    <div className="border-t bg-background/95 backdrop-blur-sm px-2 sm:px-3 py-2">
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a comment / description…"
        rows={2}
        className="w-full resize-none rounded-md border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary/60"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSave(text.trim())
          if (e.key === "Escape") onClose()
        }}
      />
      <div className="flex items-center justify-end gap-1.5 mt-1.5">
        <button type="button" onClick={onClose} className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(text.trim())}
          className="text-[11px] text-primary font-medium px-2 py-1 rounded-md hover:bg-primary/10"
        >
          Save
        </button>
      </div>
    </div>
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
