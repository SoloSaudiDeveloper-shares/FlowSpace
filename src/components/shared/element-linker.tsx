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
import {
  createLink,
  deleteLink,
  searchElements,
} from "@/lib/actions/link-actions"
import { useT } from "@/lib/hooks/use-i18n"
import type { Element, ElementType } from "@/lib/db/schema"

const TYPE_ICONS: Record<ElementType, React.ComponentType<{ className?: string }>> = {
  project: FolderKanban,
  page: FileText,
  canvas: Layout,
  todo_list: ListTodo,
  reminder: Bell,
  process: GitBranch,
}

/**
 * Tailwind tints per relationship type — keeps the chips readable while still
 * signalling what kind of link this is at a glance.
 */
const LINK_TYPE_STYLES: Record<string, { dot: string; labelKey: string }> = {
  reference:   { dot: "bg-blue-400",   labelKey: "shared.linker.type.reference" },
  dependency:  { dot: "bg-amber-400",  labelKey: "shared.linker.type.dependency" },
  contains:    { dot: "bg-violet-400", labelKey: "shared.linker.type.contains" },
  blocks:      { dot: "bg-rose-400",   labelKey: "shared.linker.type.blocks" },
  relates_to:  { dot: "bg-teal-400",   labelKey: "shared.linker.type.relatesTo" },
}

const LINK_TYPES = [
  { value: "reference"  as const, labelKey: "shared.linker.type.reference"  },
  { value: "dependency" as const, labelKey: "shared.linker.type.dependency" },
  { value: "contains"   as const, labelKey: "shared.linker.type.contains"   },
  { value: "blocks"     as const, labelKey: "shared.linker.type.blocks"     },
  { value: "relates_to" as const, labelKey: "shared.linker.type.relatesTo" },
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

/**
 * Horizontal chip-row that lives in its own bar below the page header.
 * Each link renders as a pill with a directional arrow, a type-tinted dot,
 * an icon, a name, and an × on hover. A trailing "+ Add link" chip opens
 * the search dialog.
 *
 * When there are zero links, the row collapses to just the Add chip on the
 * left — discoverable without being noisy.
 */
export function ElementLinker({ elementId, links }: ElementLinkerProps) {
  const router = useRouter()
  const { t } = useT()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Element[]>([])
  const [linkType, setLinkType] = useState<typeof LINK_TYPES[number]["value"]>("reference")

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 1) { setResults([]); return }
    const found = await searchElements(q, elementId)
    setResults(found)
  }, [elementId])

  useEffect(() => {
    const t = setTimeout(() => doSearch(query), 200)
    return () => clearTimeout(t)
  }, [query, doSearch])

  async function handleLink(targetId: string) {
    await createLink(elementId, targetId, linkType)
    setDialogOpen(false)
    setQuery("")
  }

  function getElementHref(el: Element): string {
    switch (el.type) {
      case "project":   return `/projects/${el.id}`
      case "page":      return `/pages/${el.id}`
      case "canvas":    return `/canvas/${el.id}`
      case "todo_list": return `/todos/${el.id}`
      case "reminder":  return `/reminders`
      case "process":   return `/process/${el.id}`
      default:          return "/"
    }
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 px-4 py-1.5 border-b bg-muted/30 min-w-0"
      data-slot="element-links-bar"
    >
      {/* Label — only shown when there's content to label */}
      {links.length > 0 && (
        <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium mr-1 shrink-0">
          <Link2 className="size-3" />
          {t("shared.linker.linked")}
        </div>
      )}

      {/* Link chips */}
      {links.map((link) => {
        if (!link.relatedElement) return null
        const Icon = TYPE_ICONS[link.relatedElement.type]
        const tint = LINK_TYPE_STYLES[link.linkType] ?? LINK_TYPE_STYLES.reference
        const tintLabel = t(tint.labelKey)
        const ArrowIcon = link.direction === "outgoing" ? ArrowRight : ArrowLeft
        return (
          <div
            key={link.id}
            className="group/chip inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full text-xs bg-card border border-border/60 hover:border-border hover:bg-accent/60 transition-colors cursor-pointer max-w-xs shrink-0"
            onClick={() => router.push(getElementHref(link.relatedElement!))}
            title={t("shared.linker.openHint").replace("{label}", tintLabel)}
          >
            <ArrowIcon className="size-3 text-muted-foreground/60 shrink-0" />
            <span className={`size-1.5 rounded-full shrink-0 ${tint.dot}`} aria-hidden />
            <Icon className="size-3 text-muted-foreground shrink-0" />
            <span className="truncate font-medium text-foreground/90">{link.relatedElement.title}</span>
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider shrink-0">
              {tintLabel}
            </span>
            <button
              type="button"
              className="size-4 inline-flex items-center justify-center rounded-full opacity-0 group-hover/chip:opacity-100 hover:bg-destructive/15 hover:text-destructive transition-colors shrink-0 ml-0.5"
              onClick={(e) => { e.stopPropagation(); deleteLink(link.id) }}
              title={t("shared.linker.removeLink")}
              aria-label={t("shared.linker.removeLink")}
            >
              <Trash2 className="size-2.5" />
            </button>
          </div>
        )
      })}

      {/* Add link chip */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-accent/60 border border-dashed border-border/60 hover:border-border transition-colors shrink-0">
          <Plus className="size-3" />
          {links.length === 0 ? t("shared.linker.addALink") : t("shared.linker.add")}
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
  )
}

function LinkDialog({
  query, setQuery, results, linkType, setLinkType, onSelect,
}: {
  query: string
  setQuery: (q: string) => void
  results: Element[]
  linkType: typeof LINK_TYPES[number]["value"]
  setLinkType: (t: typeof LINK_TYPES[number]["value"]) => void
  onSelect: (id: string) => void
}) {
  const { t } = useT()
  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{t("shared.linker.dialogTitle")}</DialogTitle>
        <DialogDescription>{t("shared.linker.dialogDescription")}</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder={t("shared.linker.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
              autoFocus
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md border px-3 text-xs hover:bg-accent shrink-0">
              <span className={`size-1.5 rounded-full ${LINK_TYPE_STYLES[linkType]?.dot ?? "bg-muted-foreground"}`} />
              {(() => {
                const lt = LINK_TYPES.find((x) => x.value === linkType)
                return lt ? t(lt.labelKey) : null
              })()}
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {LINK_TYPES.map((lt) => (
                <DropdownMenuItem key={lt.value} onClick={() => setLinkType(lt.value)} className="gap-2">
                  <span className={`size-1.5 rounded-full ${LINK_TYPE_STYLES[lt.value]?.dot ?? "bg-muted-foreground"}`} />
                  {t(lt.labelKey)}
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
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider ml-auto shrink-0">
                  {el.type.replace("_", " ")}
                </span>
              </button>
            )
          })}
          {query.length > 0 && results.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">{t("shared.linker.noResults")}</p>
          )}
        </div>
      </div>
    </DialogContent>
  )
}
