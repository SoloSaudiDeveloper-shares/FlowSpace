"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Command } from "cmdk"
import {
  FolderKanban,
  FileText,
  Layout,
  ListTodo,
  Bell,
  GitBranch,
  Plus,
  Search,
  Home,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { createElement } from "@/lib/actions/element-actions"
import { searchElements } from "@/lib/actions/link-actions"
import type { Element, ElementType } from "@/lib/db/schema"

const TYPE_ICONS: Record<ElementType, React.ComponentType<{ className?: string }>> = {
  project: FolderKanban,
  page: FileText,
  canvas: Layout,
  todo_list: ListTodo,
  reminder: Bell,
  process: GitBranch,
}

const CREATE_ITEMS: { type: ElementType; label: string }[] = [
  { type: "project", label: "New Project" },
  { type: "page", label: "New Page" },
  { type: "canvas", label: "New Canvas" },
  { type: "todo_list", label: "New Todo List" },
  { type: "reminder", label: "New Reminder" },
  { type: "process", label: "New Process" },
]

function getElementHref(el: { id: string; type: ElementType }): string {
  switch (el.type) {
    case "project": return `/projects/${el.id}`
    case "page": return `/pages/${el.id}`
    case "canvas": return `/canvas/${el.id}`
    case "todo_list": return `/todos/${el.id}`
    case "reminder": return `/reminders`
    case "process": return `/process/${el.id}`
    default: return "/"
  }
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Element[]>([])
  const router = useRouter()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (!query) {
      setResults([])
      return
    }
    const timeout = setTimeout(async () => {
      const found = await searchElements(query)
      setResults(found)
    }, 150)
    return () => clearTimeout(timeout)
  }, [query])

  const handleSelect = useCallback(
    (href: string) => {
      setOpen(false)
      setQuery("")
      router.push(href)
    },
    [router]
  )

  async function handleCreate(type: ElementType) {
    const result = await createElement(type)
    setOpen(false)
    setQuery("")
    router.push(getElementHref(result))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 shadow-lg sm:max-w-lg [&>button]:hidden">
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search and navigate to elements or create new ones
        </DialogDescription>
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2.5">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Command.Input
              placeholder="Search elements or type a command..."
              value={query}
              onValueChange={setQuery}
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 ml-2 shrink-0">
              ESC
            </kbd>
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            {/* Search results */}
            {results.length > 0 && (
              <Command.Group heading="Elements">
                {results.map((el) => {
                  const Icon = TYPE_ICONS[el.type]
                  return (
                    <Command.Item
                      key={el.id}
                      value={el.title}
                      onSelect={() => handleSelect(getElementHref(el))}
                      className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent"
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate">{el.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {el.type.replace("_", " ")}
                      </span>
                    </Command.Item>
                  )
                })}
              </Command.Group>
            )}

            {/* Navigation */}
            <Command.Group heading="Navigation">
              <Command.Item
                onSelect={() => handleSelect("/")}
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent"
              >
                <Home className="size-4 text-muted-foreground" />
                Home
              </Command.Item>
            </Command.Group>

            {/* Create */}
            <Command.Group heading="Create">
              {CREATE_ITEMS.map((item) => {
                const Icon = TYPE_ICONS[item.type]
                return (
                  <Command.Item
                    key={item.type}
                    onSelect={() => handleCreate(item.type)}
                    className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent"
                  >
                    <Plus className="size-4 text-muted-foreground" />
                    <Icon className="size-4 text-muted-foreground" />
                    {item.label}
                  </Command.Item>
                )
              })}
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
