"use client"

import { useState } from "react"
import {
  Trash2,
  Archive,
  RotateCcw,
  AlertTriangle,
  FolderKanban,
  FileText,
  Layout,
  ListTodo,
  Bell,
  GitBranch,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { restoreElement, permanentlyDeleteElement } from "@/lib/actions/element-actions"
import type { Element } from "@/lib/db/schema"

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  project: FolderKanban,
  page: FileText,
  canvas: Layout,
  todo_list: ListTodo,
  reminder: Bell,
  process: GitBranch,
}

const TYPE_LABELS: Record<string, string> = {
  project: "Project",
  page: "Page",
  canvas: "Canvas",
  todo_list: "Todo List",
  reminder: "Reminder",
  process: "Process",
}

interface TrashListProps {
  deleted: Element[]
  archived: Element[]
}

export function TrashList({ deleted, archived }: TrashListProps) {
  const [tab, setTab] = useState<"deleted" | "archived">("deleted")
  const items = tab === "deleted" ? deleted : archived

  async function handleRestore(id: string) {
    await restoreElement(id)
    toast.success("Item restored")
  }

  async function handlePermanentDelete(id: string) {
    await permanentlyDeleteElement(id)
    toast.success("Permanently deleted")
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-6">
        <button
          onClick={() => setTab("deleted")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "deleted" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          }`}
        >
          <Trash2 className="size-4" />
          Deleted
          <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 ml-1">{deleted.length}</Badge>
        </button>
        <button
          onClick={() => setTab("archived")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "archived" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          }`}
        >
          <Archive className="size-4" />
          Archived
          <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 ml-1">{archived.length}</Badge>
        </button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          {tab === "deleted" ? (
            <>
              <Trash2 className="size-12 mb-3 opacity-30" />
              <p className="text-sm">Trash is empty</p>
              <p className="text-xs mt-1">Deleted items will appear here</p>
            </>
          ) : (
            <>
              <Archive className="size-12 mb-3 opacity-30" />
              <p className="text-sm">No archived items</p>
              <p className="text-xs mt-1">Archived items will appear here</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const Icon = TYPE_ICONS[item.type] ?? FileText
            return (
              <div
                key={item.id}
                className="stagger-item flex items-center gap-3 px-4 py-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
              >
                <div className="shrink-0" style={{ color: item.color ?? undefined }}>
                  <Icon className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {TYPE_LABELS[item.type]} &middot; {tab === "deleted" ? "Deleted" : "Archived"}{" "}
                    {new Date(item.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRestore(item.id)}
                  >
                    <RotateCcw className="size-3.5 mr-1.5" />
                    Restore
                  </Button>
                  {tab === "deleted" && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handlePermanentDelete(item.id)}
                    >
                      <AlertTriangle className="size-3.5 mr-1.5" />
                      Delete forever
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
