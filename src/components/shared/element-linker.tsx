"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  FolderKanban,
  FileText,
  Layout,
  ListTodo,
  Bell,
  GitBranch,
  Link2,
  Plus,
  Trash2,
  Search,
  ArrowRight,
  ArrowLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import {
  createLink,
  deleteLink,
  searchElements,
} from "@/lib/actions/link-actions"
import type { Element, ElementType } from "@/lib/db/schema"

const TYPE_ICONS: Record<ElementType, React.ComponentType<{ className?: string }>> = {
  project: FolderKanban,
  page: FileText,
  canvas: Layout,
  todo_list: ListTodo,
  reminder: Bell,
  process: GitBranch,
}

const LINK_TYPES = [
  { value: "reference" as const, label: "Reference" },
  { value: "dependency" as const, label: "Dependency" },
  { value: "contains" as const, label: "Contains" },
  { value: "blocks" as const, label: "Blocks" },
  { value: "relates_to" as const, label: "Relates to" },
]

interface LinkInfo {
  id: string
  sourceId: string
  targetId: string
  linkType: string
  relatedElement?: Element
  direction: string
}

interface ElementLinkerProps {
  elementId: string
  links: LinkInfo[]
}

export function ElementLinker({ elementId, links }: ElementLinkerProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Element[]>([])
  const [linkType, setLinkType] = useState<typeof LINK_TYPES[number]["value"]>("reference")

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 1) {
      setResults([])
      return
    }
    const found = await searchElements(q, elementId)
    setResults(found)
  }, [elementId])

  useEffect(() => {
    const timeout = setTimeout(() => doSearch(query), 200)
    return () => clearTimeout(timeout)
  }, [query, doSearch])

  async function handleLink(targetId: string) {
    await createLink(elementId, targetId, linkType)
    setDialogOpen(false)
    setQuery("")
  }

  function getElementHref(el: Element): string {
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

  if (links.length === 0 && !dialogOpen) {
    return (
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground">
          <Link2 className="size-3.5" />
          Add link
        </DialogTrigger>
        <LinkDialog
          query={query}
          setQuery={setQuery}
          results={results}
          linkType={linkType}
          setLinkType={setLinkType}
          onSelect={handleLink}
        />
      </Dialog>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Link2 className="size-3" />
          Linked Elements
        </h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger className="inline-flex items-center justify-center size-6 rounded-md hover:bg-accent">
            <Plus className="size-3" />
          </DialogTrigger>
          <LinkDialog
            query={query}
            setQuery={setQuery}
            results={results}
            linkType={linkType}
            setLinkType={setLinkType}
            onSelect={handleLink}
          />
        </Dialog>
      </div>
      <div className="space-y-1">
        {links.map((link) => {
          if (!link.relatedElement) return null
          const Icon = TYPE_ICONS[link.relatedElement.type]
          return (
            <div
              key={link.id}
              className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent cursor-pointer text-sm"
              onClick={() => router.push(getElementHref(link.relatedElement!))}
            >
              {link.direction === "outgoing" ? (
                <ArrowRight className="size-3 text-muted-foreground shrink-0" />
              ) : (
                <ArrowLeft className="size-3 text-muted-foreground shrink-0" />
              )}
              <Icon className="size-3.5 shrink-0" />
              <span className="truncate flex-1">{link.relatedElement.title}</span>
              <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
                {link.linkType}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="size-5 opacity-0 group-hover:opacity-100 shrink-0"
                onClick={(e) => {
                  e.stopPropagation()
                  deleteLink(link.id)
                }}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LinkDialog({
  query,
  setQuery,
  results,
  linkType,
  setLinkType,
  onSelect,
}: {
  query: string
  setQuery: (q: string) => void
  results: Element[]
  linkType: typeof LINK_TYPES[number]["value"]
  setLinkType: (t: typeof LINK_TYPES[number]["value"]) => void
  onSelect: (id: string) => void
}) {
  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Link Element</DialogTitle>
        <DialogDescription>Search for an element to link to.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search elements..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
              autoFocus
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 rounded-md border px-2 text-xs hover:bg-accent shrink-0">
              {LINK_TYPES.find((t) => t.value === linkType)?.label}
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {LINK_TYPES.map((t) => (
                <DropdownMenuItem key={t.value} onClick={() => setLinkType(t.value)}>
                  {t.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="max-h-[300px] overflow-y-auto space-y-1">
          {results.map((el) => {
            const Icon = TYPE_ICONS[el.type]
            return (
              <button
                key={el.id}
                className="flex items-center gap-2 w-full rounded-md px-2 py-2 text-sm hover:bg-accent text-left"
                onClick={() => onSelect(el.id)}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{el.title}</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-auto shrink-0">
                  {el.type.replace("_", " ")}
                </Badge>
              </button>
            )
          })}
          {query.length > 0 && results.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No elements found
            </p>
          )}
        </div>
      </div>
    </DialogContent>
  )
}
