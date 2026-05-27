"use client"

import { useCallback, useEffect, useState, useRef } from "react"
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
  Trash2,
  CheckSquare,
  Settings,
  MessageSquare,
  Rss,
  ShieldCheck,
  BookTemplate,
  Users,
  Sparkles,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { createElement, getElements } from "@/lib/actions/element-actions"
import { fullTextSearch, type SearchResult } from "@/lib/actions/search-actions"
import type { ElementType } from "@/lib/db/schema"
import { usePreferences } from "@/lib/hooks/use-preferences"
import { useAI } from "@/lib/hooks/use-ai"
import { embeddingsIndex } from "@/lib/ai/embeddings-index"

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
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

function getElementHref(el: { id: string; type: string }): string {
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

/** Open the command palette from anywhere */
export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent("flowspace:open-search"))
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [semanticResults, setSemanticResults] = useState<{ id: string; score: number; text: string; metadata?: Record<string, string> }[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [useSemanticSearch, setUseSemanticSearch] = useState(false)
  const [indexStatus, setIndexStatus] = useState<"idle" | "indexing" | "ready">("idle")
  const { preferences } = usePreferences()
  const { enabled: aiEnabled, connected: aiConnected } = useAI()
  const router = useRouter()
  const syncingRef = useRef(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    function onOpenSearch() {
      setOpen(true)
    }
    document.addEventListener("keydown", onKeyDown)
    window.addEventListener("flowspace:open-search", onOpenSearch)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("flowspace:open-search", onOpenSearch)
    }
  }, [])

  // Incremental sync: only re-embeds new/changed items, removes deleted ones
  useEffect(() => {
    if (!preferences.aiEnabled || !aiEnabled || !aiConnected) return
    if (syncingRef.current) return

    let cancelled = false

    async function syncElements() {
      syncingRef.current = true
      try {
        setIndexStatus("indexing")
        const allElements = await getElements()
        const entries = allElements.map((el) => ({
          id: el.id,
          text: `${el.title}${el.description ? ` — ${el.description}` : ""}`,
          updatedAt: el.updatedAt,
          metadata: {
            type: el.type,
            href: getElementHref({ id: el.id, type: el.type }),
          },
        }))
        const stats = await embeddingsIndex.syncIndex(entries)
        if (!cancelled) {
          setIndexStatus("ready")
          if (stats.added > 0 || stats.updated > 0 || stats.removed > 0) {
            console.log(
              `[Embeddings] Sync complete: +${stats.added} added, ~${stats.updated} updated, -${stats.removed} removed, =${stats.unchanged} unchanged`
            )
          }
        }
      } catch (err) {
        console.error("[Embeddings] Sync failed:", err)
        if (!cancelled) setIndexStatus("idle")
      } finally {
        syncingRef.current = false
      }
    }
    syncElements()

    return () => {
      cancelled = true
    }
  }, [preferences.aiEnabled, aiEnabled, aiConnected])

  useEffect(() => {
    if (!query) {
      setResults([])
      setSemanticResults([])
      return
    }
    setIsSearching(true)
    const timeout = setTimeout(async () => {
      // Always run FTS
      const found = await fullTextSearch(query)
      setResults(found)

      // Run semantic search if enabled
      if (useSemanticSearch && preferences.aiEnabled && embeddingsIndex.size > 0) {
        try {
          const semantic = await embeddingsIndex.search(query, 5)
          setSemanticResults(semantic)
        } catch {
          setSemanticResults([])
        }
      } else {
        setSemanticResults([])
      }

      setIsSearching(false)
    }, 150)
    return () => clearTimeout(timeout)
  }, [query, useSemanticSearch, preferences.aiEnabled])

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
    router.push(getElementHref({ id: result.id, type: result.type }))
  }

  const elementResults = results.filter((r) => r.type === "element")
  const taskResults = results.filter((r) => r.type === "task")
  const commentResults = results.filter((r) => r.type === "comment")
  const feedResults = results.filter((r) => r.type === "feed")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 shadow-lg sm:max-w-lg [&>button]:hidden">
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search elements and tasks, navigate, or create new items
        </DialogDescription>
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2.5">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Command.Input
              placeholder="Search everything... elements, tasks, pages"
              value={query}
              onValueChange={setQuery}
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
            {preferences.aiEnabled && aiEnabled && (
              <button
                type="button"
                onClick={() => setUseSemanticSearch((v) => !v)}
                disabled={indexStatus === "indexing"}
                title={
                  indexStatus === "indexing"
                    ? "Indexing elements..."
                    : useSemanticSearch
                      ? "Semantic search ON"
                      : "Semantic search OFF — click to enable AI search"
                }
                className={`inline-flex items-center gap-1 h-6 px-2 rounded text-[10px] font-medium transition-colors shrink-0 ml-2 ${
                  indexStatus === "indexing"
                    ? "bg-muted text-muted-foreground animate-pulse cursor-wait"
                    : useSemanticSearch
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sparkles className="size-3" />
                {indexStatus === "indexing" ? "Indexing..." : "AI"}
              </button>
            )}
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 ml-2 shrink-0">
              ESC
            </kbd>
          </div>
          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            {isSearching ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Searching...
              </div>
            ) : (
              <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                No results found.
              </Command.Empty>
            )}

            {/* Element search results */}
            {elementResults.length > 0 && (
              <Command.Group heading="Elements">
                {elementResults.map((r) => {
                  const Icon = TYPE_ICONS[r.elementType!] ?? FileText
                  return (
                    <Command.Item
                      key={r.id}
                      value={`element-${r.id}-${r.title}`}
                      onSelect={() =>
                        handleSelect(
                          getElementHref({ id: r.id, type: r.elementType! })
                        )
                      }
                      className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent"
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate">{r.title}</span>
                      <span className="text-xs text-muted-foreground capitalize">
                        {r.elementType?.replace("_", " ")}
                      </span>
                    </Command.Item>
                  )
                })}
              </Command.Group>
            )}

            {/* Task search results */}
            {taskResults.length > 0 && (
              <Command.Group heading="Tasks">
                {taskResults.map((r) => (
                  <Command.Item
                    key={r.id}
                    value={`task-${r.id}-${r.title}`}
                    onSelect={() =>
                      handleSelect(`/projects/${r.projectId}`)
                    }
                    className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent"
                  >
                    <CheckSquare className="size-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <span className="truncate block">{r.title}</span>
                      <span className="text-xs text-muted-foreground truncate block">
                        in {r.projectTitle}
                      </span>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Comment search results */}
            {commentResults.length > 0 && (
              <Command.Group heading="Comments">
                {commentResults.map((r) => (
                  <Command.Item
                    key={r.id}
                    value={`comment-${r.id}-${r.title}`}
                    onSelect={() =>
                      r.taskId
                        ? handleSelect(`/projects/${r.projectId || ""}`)
                        : undefined
                    }
                    className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent"
                  >
                    <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{r.title}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Feed search results */}
            {feedResults.length > 0 && (
              <Command.Group heading="Feed">
                {feedResults.map((r) => (
                  <Command.Item
                    key={r.id}
                    value={`feed-${r.id}-${r.title}`}
                    onSelect={() => handleSelect("/feed")}
                    className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent"
                  >
                    <Rss className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{r.title}</span>
                    <span className="text-xs text-muted-foreground">{r.elementType}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Semantic search results */}
            {semanticResults.length > 0 && (
              <Command.Group heading="Semantic Matches">
                {semanticResults.map((r) => {
                  const type = r.metadata?.type ?? "element"
                  const Icon = TYPE_ICONS[type] ?? FileText
                  return (
                    <Command.Item
                      key={`semantic-${r.id}`}
                      value={`semantic-${r.id}-${r.text}`}
                      onSelect={() => {
                        const href = r.metadata?.href
                        if (href) handleSelect(href)
                      }}
                      className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent"
                    >
                      <Sparkles className="size-4 shrink-0 text-primary/60" />
                      <span className="flex-1 truncate">{r.text}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {Math.round(r.score * 100)}%
                      </span>
                    </Command.Item>
                  )
                })}
              </Command.Group>
            )}

            {/* Navigation */}
            <Command.Group heading="Navigation">
              <Command.Item
                value="home-dashboard"
                onSelect={() => handleSelect("/")}
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent"
              >
                <Home className="size-4 text-muted-foreground" />
                Home
              </Command.Item>
              <Command.Item
                value="reminders-page"
                onSelect={() => handleSelect("/reminders")}
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent"
              >
                <Bell className="size-4 text-muted-foreground" />
                Reminders
              </Command.Item>
              <Command.Item
                value="trash-archive"
                onSelect={() => handleSelect("/trash")}
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent"
              >
                <Trash2 className="size-4 text-muted-foreground" />
                Trash & Archive
              </Command.Item>
              <Command.Item
                value="settings-page"
                onSelect={() => handleSelect("/settings")}
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent"
              >
                <Settings className="size-4 text-muted-foreground" />
                Settings
              </Command.Item>
              <Command.Item
                value="feed-page"
                onSelect={() => handleSelect("/feed")}
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent"
              >
                <Rss className="size-4 text-muted-foreground" />
                Feed
              </Command.Item>
              <Command.Item
                value="approvals-page"
                onSelect={() => handleSelect("/approvals")}
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent"
              >
                <ShieldCheck className="size-4 text-muted-foreground" />
                Approvals
              </Command.Item>
              <Command.Item
                value="templates-page"
                onSelect={() => handleSelect("/templates")}
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent"
              >
                <BookTemplate className="size-4 text-muted-foreground" />
                Templates
              </Command.Item>
              <Command.Item
                value="people-page"
                onSelect={() => handleSelect("/people")}
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent"
              >
                <Users className="size-4 text-muted-foreground" />
                People
              </Command.Item>
            </Command.Group>

            {/* Create */}
            <Command.Group heading="Create">
              {CREATE_ITEMS.map((item) => {
                const Icon = TYPE_ICONS[item.type]
                return (
                  <Command.Item
                    key={item.type}
                    value={`create-${item.type}`}
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
