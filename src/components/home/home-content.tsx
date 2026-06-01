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
  Sparkles,
  Volume2,
} from "lucide-react"
import { TTSButton } from "@/components/shared/tts-button"
import { AIActionButton } from "@/components/shared/ai-action-button"
import { useT } from "@/lib/hooks/use-i18n"
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
import { ContextMenu, useContextMenu, type ContextMenuEntry } from "@/components/shared/context-menu"

const TYPE_ICONS: Record<ElementType, React.ComponentType<{ className?: string }>> = {
  project: FolderKanban,
  page: FileText,
  canvas: Layout,
  todo_list: ListTodo,
  reminder: Bell,
  process: GitBranch,
}

const TYPE_LABEL_KEYS: Record<ElementType, string> = {
  project: "home.elementType.project",
  page: "home.elementType.page",
  canvas: "home.elementType.canvas",
  todo_list: "home.elementType.todoList",
  reminder: "home.elementType.reminder",
  process: "home.elementType.process",
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

/**
 * Returns a {key, n} the caller resolves via t(). For dates older than a week
 * we fall back to a locale date string (returned in `literal`).
 */
function formatDate(dateStr: string): { key: string; n?: number; literal?: string } {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return { key: "home.time.justNow" }
  if (minutes < 60) return { key: "home.time.minutesAgo", n: minutes }
  if (hours < 24) return { key: "home.time.hoursAgo", n: hours }
  if (days < 7) return { key: "home.time.daysAgo", n: days }
  return { key: "", literal: date.toLocaleDateString() }
}

const CREATE_OPTIONS: { type: ElementType; labelKey: string; descKey: string }[] = [
  { type: "project", labelKey: "home.elementType.project", descKey: "home.createOpt.project.desc" },
  { type: "page", labelKey: "home.elementType.page", descKey: "home.createOpt.page.desc" },
  { type: "canvas", labelKey: "home.elementType.canvas", descKey: "home.createOpt.canvas.desc" },
  { type: "todo_list", labelKey: "home.elementType.todoList", descKey: "home.createOpt.todoList.desc" },
  { type: "reminder", labelKey: "home.elementType.reminder", descKey: "home.createOpt.reminder.desc" },
  { type: "process", labelKey: "home.elementType.process", descKey: "home.createOpt.process.desc" },
]

interface HomeContentProps {
  recentElements: Element[]
  favorites: Element[]
}

export function HomeContent({ recentElements, favorites }: HomeContentProps) {
  const router = useRouter()
  const { t } = useT()

  async function handleCreate(type: ElementType) {
    const result = await createElement(type)
    const href = getElementHref({ id: result.id, type: result.type } as Element)
    router.push(href)
  }

  return (
    <div className="space-y-8">
      {/* Quick Create */}
      <div>
            <h2 className="text-3xl font-bold tracking-tight">{t("home.welcome.title")}</h2>
            <p className="text-muted-foreground mt-1">
              {t("home.welcome.subtitle")}
            </p>
          </div>

          {/* Quick Create Grid */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              {t("home.quickCreate.title")}
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
                      <p className="text-sm font-medium">{t(option.labelKey)}</p>
                      <p className="text-xs text-muted-foreground hidden sm:block">
                        {t(option.descKey)}
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
                {t("home.section.favorites")}
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
              {t("home.section.recent")}
            </h3>
            {recentElements.length === 0 ? (
              <div className="rounded-lg border border-dashed p-12 text-center">
                <Plus className="mx-auto size-8 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">{t("home.empty.title")}</h3>
                <p className="text-muted-foreground mt-1">
                  {t("home.empty.desc")}
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
  const { t } = useT()
  const Icon = TYPE_ICONS[element.type]
  const { menu: ctxMenu, open: openCtx, close: closeCtx } = useContextMenu()
  const dateLabel = formatDate(element.updatedAt)

  function handleContextMenu(e: React.MouseEvent) {
    const items: ContextMenuEntry[] = [
      {
        label: t("home.card.open"),
        onClick,
      },
      {
        label: element.isFavorite ? t("home.card.removeFavorite") : t("home.card.addFavorite"),
        icon: Star,
        onClick: () => toggleFavorite(element.id),
      },
      {
        label: t("home.card.archive"),
        icon: Archive,
        onClick: () => archiveElement(element.id),
      },
      { separator: true },
      {
        label: t("home.card.delete"),
        icon: Trash2,
        variant: "destructive",
        onClick: () => deleteElement(element.id),
      },
    ]
    openCtx(e, items)
  }

  return (
    <>
    <div
      className="group relative flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-accent cursor-pointer"
      onClick={onClick}
      onContextMenu={handleContextMenu}
    >
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: `${element.color ?? "#888"}20`, color: element.color ?? undefined }}
      >
        <Icon className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{element.title}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
          <span>{t(TYPE_LABEL_KEYS[element.type])}</span>
          <span>·</span>
          <span>
            {dateLabel.literal ??
              t(dateLabel.key).replace("{n}", String(dateLabel.n ?? ""))}
          </span>
        </p>
      </div>

      {/* AI buttons */}
      <div
        className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mr-6"
        onClick={(e) => e.stopPropagation()}
      >
        <TTSButton
          text={element.title + (element.description ? `. ${element.description}` : "")}
          size="sm"
          tooltip={t("home.card.readAloud")}
        />
        <AIActionButton
          text={element.title + (element.description ? `. ${element.description}` : "")}
          onResult={(result) => {
            navigator.clipboard.writeText(result)
          }}
          actions={["summarize", "expand", "improve"]}
          size="sm"
        />
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
            {element.isFavorite ? t("home.card.removeFavoriteLower") : t("home.card.addFavoriteLower")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              archiveElement(element.id)
            }}
          >
            <Archive className="mr-2 size-4" />
            {t("home.card.archive")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              deleteElement(element.id)
            }}
          >
            <Trash2 className="mr-2 size-4" />
            {t("home.card.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {element.isFavorite && (
        <Star className="absolute top-2 right-2 size-3 text-yellow-500 fill-yellow-500 group-hover:hidden" />
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
