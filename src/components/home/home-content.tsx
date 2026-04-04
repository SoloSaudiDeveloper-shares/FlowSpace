"use client"

import { useRouter } from "next/navigation"
import {
  FolderKanban,
  FileText,
  Layout,
  ListTodo,
  Bell,
  GitBranch,
  Plus,
  Star,
  Clock,
  MoreHorizontal,
  Trash2,
  Archive,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  createElement,
  toggleFavorite,
  deleteElement,
  archiveElement,
} from "@/lib/actions/element-actions"
import type { Element, ElementType } from "@/lib/db/schema"

const TYPE_ICONS: Record<ElementType, React.ComponentType<{ className?: string }>> = {
  project: FolderKanban,
  page: FileText,
  canvas: Layout,
  todo_list: ListTodo,
  reminder: Bell,
  process: GitBranch,
}

const TYPE_LABELS: Record<ElementType, string> = {
  project: "Project",
  page: "Page",
  canvas: "Canvas",
  todo_list: "Todo List",
  reminder: "Reminder",
  process: "Process",
}

function getElementHref(element: Element): string {
  switch (element.type) {
    case "project":
      return `/projects/${element.id}`
    case "page":
      return `/pages/${element.id}`
    case "canvas":
      return `/canvas/${element.id}`
    case "todo_list":
      return `/todos/${element.id}`
    case "reminder":
      return `/reminders`
    case "process":
      return `/process/${element.id}`
    default:
      return "/"
  }
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

const CREATE_OPTIONS: { type: ElementType; label: string; description: string }[] = [
  { type: "project", label: "Project", description: "Kanban board with tasks" },
  { type: "page", label: "Page", description: "Rich text document" },
  { type: "canvas", label: "Canvas", description: "Infinite visual canvas" },
  { type: "todo_list", label: "Todo List", description: "Simple checklist" },
  { type: "reminder", label: "Reminder", description: "Time-based reminder" },
  { type: "process", label: "Process", description: "Flowchart & steps" },
]

interface HomeContentProps {
  recentElements: Element[]
  favorites: Element[]
}

export function HomeContent({ recentElements, favorites }: HomeContentProps) {
  const router = useRouter()

  async function handleCreate(type: ElementType) {
    const result = await createElement(type)
    const href = getElementHref({ id: result.id, type: result.type } as Element)
    router.push(href)
  }

  return (
    <div className="space-y-8">
      {/* Quick Create */}
      <div>
            <h2 className="text-3xl font-bold tracking-tight">Welcome to FlowSpace</h2>
            <p className="text-muted-foreground mt-1">
              Your personal workspace for organizing everything.
            </p>
          </div>

          {/* Quick Create Grid */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Quick Create
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {CREATE_OPTIONS.map((option) => {
                const Icon = TYPE_ICONS[option.type]
                return (
                  <button
                    key={option.type}
                    onClick={() => handleCreate(option.type)}
                    className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-4 text-center transition-colors hover:bg-accent hover:border-accent-foreground/20"
                  >
                    <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                      <Icon className="size-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{option.label}</p>
                      <p className="text-xs text-muted-foreground hidden sm:block">
                        {option.description}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Favorites */}
          {favorites.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Star className="size-4" />
                Favorites
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {favorites.map((el) => (
                  <ElementCard
                    key={el.id}
                    element={el}
                    onClick={() => router.push(getElementHref(el))}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Recent Elements */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <Clock className="size-4" />
              Recent
            </h3>
            {recentElements.length === 0 ? (
              <div className="rounded-lg border border-dashed p-12 text-center">
                <Plus className="mx-auto size-8 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No elements yet</h3>
                <p className="text-muted-foreground mt-1">
                  Create your first project, page, or canvas to get started.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {recentElements.map((el) => (
                  <ElementCard
                    key={el.id}
                    element={el}
                    onClick={() => router.push(getElementHref(el))}
                  />
                ))}
              </div>
            )}
          </div>
    </div>
  )
}

function ElementCard({
  element,
  onClick,
}: {
  element: Element
  onClick: () => void
}) {
  const Icon = TYPE_ICONS[element.type]

  return (
    <div
      className="group relative flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-accent cursor-pointer"
      onClick={onClick}
    >
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: (element.color ?? "#888") + "20", color: element.color ?? undefined }}
      >
        <Icon className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{element.title}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
          <span>{TYPE_LABELS[element.type]}</span>
          <span>·</span>
          <span>{formatDate(element.updatedAt)}</span>
        </p>
      </div>

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className="absolute top-3 right-3 size-7 inline-flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              toggleFavorite(element.id)
            }}
          >
            <Star className="mr-2 size-4" />
            {element.isFavorite ? "Remove from favorites" : "Add to favorites"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              archiveElement(element.id)
            }}
          >
            <Archive className="mr-2 size-4" />
            Archive
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              deleteElement(element.id)
            }}
          >
            <Trash2 className="mr-2 size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {element.isFavorite && (
        <Star className="absolute top-2 right-2 size-3 text-yellow-500 fill-yellow-500 group-hover:hidden" />
      )}
    </div>
  )
}
