"use client"

import { useState } from "react"
import { Plus, Trash2, GripVertical, Calendar } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  createTodoItem,
  updateTodoItem,
  deleteTodoItem,
} from "@/lib/actions/todo-actions"
import type { todoItems } from "@/lib/db/schema"

type TodoItem = typeof todoItems.$inferSelect

interface TodoListEditorProps {
  listId: string
  items: TodoItem[]
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
        <Input
          placeholder="Add a new item..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd()
          }}
        />
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

  return (
    <div className="group flex items-center gap-2 rounded-lg border px-3 py-2 hover:bg-accent/50 transition-colors">
      <GripVertical className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab shrink-0" />
      <button
        onClick={() =>
          updateTodoItem(item.id, listId, { isCompleted: !item.isCompleted })
        }
        className={`size-5 shrink-0 rounded-full border-2 transition-colors flex items-center justify-center ${
          item.isCompleted
            ? "bg-green-500 border-green-500"
            : "border-muted-foreground/30 hover:border-green-500"
        }`}
      >
        {item.isCompleted && (
          <svg className="size-3 text-white" viewBox="0 0 12 12" fill="none">
            <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
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
          className="flex-1 bg-transparent outline-none text-sm"
        />
      ) : (
        <span
          onClick={() => setIsEditing(true)}
          className={`flex-1 text-sm cursor-text ${
            item.isCompleted ? "line-through text-muted-foreground" : ""
          }`}
        >
          {item.title}
        </span>
      )}
      {item.dueDate && (
        <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
          <Calendar className="size-3" />
          {new Date(item.dueDate).toLocaleDateString()}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="size-6 opacity-0 group-hover:opacity-100 shrink-0"
        onClick={() => deleteTodoItem(item.id, listId)}
      >
        <Trash2 className="size-3" />
      </Button>
    </div>
  )
}
