"use client"

import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect, type ReactNode } from "react"
import {
  FolderKanban,
  FileText,
  Layout,
  ListTodo,
  Bell,
  GitBranch,
  Plus,
  Home,
  Star,
  Trash2,
  Pencil,
  Archive,
  ExternalLink,
  ChevronRight,
  FolderPlus,
  Settings,
  Inbox,
  Users,
  Shield,
  LogOut,
  Rss,
  BookTemplate,
  FileInput,
  Zap,
  ShieldCheck,
  GripVertical,
  Pin,
  PinOff,
} from "lucide-react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { openCommandPalette } from "@/components/layout/command-palette"
import { Search } from "lucide-react"
import {
  createElement,
  updateElement,
  toggleFavorite,
  archiveElement,
  deleteElement,
} from "@/lib/actions/element-actions"
import { toast } from "sonner"
import type { Element, ElementType } from "@/lib/db/schema"
import { ContextMenu, useContextMenu, type ContextMenuEntry } from "@/components/shared/context-menu"
import { useAuth } from "@/lib/hooks/use-auth"
import { usePreferences, type SidebarSectionKey } from "@/lib/hooks/use-preferences"
import { reorderElements } from "@/lib/actions/element-actions"

const ELEMENT_TYPE_CONFIG: Record<
  ElementType,
  { label: string; icon: React.ComponentType<{ className?: string }>; href: string }
> = {
  project: { label: "Projects", icon: FolderKanban, href: "/projects" },
  page: { label: "Pages", icon: FileText, href: "/pages" },
  canvas: { label: "Canvases", icon: Layout, href: "/canvas" },
  todo_list: { label: "Todo Lists", icon: ListTodo, href: "/todos" },
  reminder: { label: "Reminders", icon: Bell, href: "/reminders" },
  process: { label: "Processes", icon: GitBranch, href: "/process" },
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

interface AppSidebarProps {
  elements: Element[]
  favorites: Element[]
}

/** Color presets used by the sidebar right-click color picker. */
const SIDEBAR_COLOR_OPTIONS: { value: string; label: string }[] = [
  { value: "#737373", label: "Neutral" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Violet" },
  { value: "#f43f5e", label: "Rose" },
  { value: "#10b981", label: "Green" },
  { value: "#f97316", label: "Orange" },
  { value: "#14b8a6", label: "Teal" },
]

function sidebarRelativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diffSec = Math.max(0, (Date.now() - then) / 1000)
  if (diffSec < 60) return "just now"
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`
  return new Date(iso).toLocaleDateString()
}

/**
 * Collapsible section wrapper. Click the label to fold/unfold; state is
 * persisted to localStorage so it survives reloads. Sortable via dnd-kit —
 * a grip handle appears on hover and the section can be dragged to reorder.
 */
function CollapsibleSection({
  sectionKey,
  icon: Icon,
  label,
  count,
  collapsed,
  onToggle,
  sortable = false,
  children,
}: {
  sectionKey: string
  icon?: React.ComponentType<{ className?: string }>
  label: string
  count?: number
  collapsed: boolean
  onToggle: (k: string) => void
  sortable?: boolean
  children: ReactNode
}) {
  return sortable ? (
    <SortableCollapsibleSectionInner
      sectionKey={sectionKey}
      icon={Icon}
      label={label}
      count={count}
      collapsed={collapsed}
      onToggle={onToggle}
    >
      {children}
    </SortableCollapsibleSectionInner>
  ) : (
    <PlainCollapsibleSection
      sectionKey={sectionKey}
      icon={Icon}
      label={label}
      count={count}
      collapsed={collapsed}
      onToggle={onToggle}
    >
      {children}
    </PlainCollapsibleSection>
  )
}

function SectionLabel({
  sectionKey, icon: Icon, label, count, collapsed, onToggle, dragHandle,
}: {
  sectionKey: string
  icon?: React.ComponentType<{ className?: string }>
  label: string
  count?: number
  collapsed: boolean
  onToggle: (k: string) => void
  dragHandle?: ReactNode
}) {
  return (
    <SidebarGroupLabel
      role="button"
      tabIndex={0}
      onClick={() => onToggle(sectionKey)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onToggle(sectionKey)
        }
      }}
      className="group/lbl cursor-pointer select-none hover:bg-sidebar-accent/50 transition-colors"
      title={collapsed ? "Expand" : "Collapse"}
      aria-expanded={!collapsed}
    >
      {dragHandle}
      <ChevronRight
        className={`mr-1 size-3 shrink-0 transition-transform duration-200 ${
          collapsed ? "" : "rotate-90"
        }`}
      />
      {Icon && <Icon className="mr-2 size-3 shrink-0" />}
      <span className="flex-1">{label}</span>
      {typeof count === "number" && count > 0 && (
        <span className="ml-1 rounded-full bg-sidebar-accent/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
          {count}
        </span>
      )}
    </SidebarGroupLabel>
  )
}

function SectionBody({
  collapsed, children,
}: { collapsed: boolean; children: ReactNode }) {
  return (
    <div
      className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
        collapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
      }`}
      aria-hidden={collapsed}
    >
      <div className="overflow-hidden">
        {!collapsed && <SidebarGroupContent>{children}</SidebarGroupContent>}
      </div>
    </div>
  )
}

function PlainCollapsibleSection({
  sectionKey, icon: Icon, label, count, collapsed, onToggle, children,
}: {
  sectionKey: string
  icon?: React.ComponentType<{ className?: string }>
  label: string
  count?: number
  collapsed: boolean
  onToggle: (k: string) => void
  children: ReactNode
}) {
  return (
    <SidebarGroup>
      <SectionLabel
        sectionKey={sectionKey} icon={Icon} label={label} count={count}
        collapsed={collapsed} onToggle={onToggle}
      />
      <SectionBody collapsed={collapsed}>{children}</SectionBody>
    </SidebarGroup>
  )
}

function SortableCollapsibleSectionInner({
  sectionKey, icon: Icon, label, count, collapsed, onToggle, children,
}: {
  sectionKey: string
  icon?: React.ComponentType<{ className?: string }>
  label: string
  count?: number
  collapsed: boolean
  onToggle: (k: string) => void
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: sectionKey })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  }
  return (
    <SidebarGroup ref={setNodeRef} style={style}>
      <SectionLabel
        sectionKey={sectionKey} icon={Icon} label={label} count={count}
        collapsed={collapsed} onToggle={onToggle}
        dragHandle={
          <span
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="cursor-grab active:cursor-grabbing opacity-0 group-hover/lbl:opacity-60 hover:!opacity-100 -ml-1 mr-0.5 p-0.5 rounded transition-opacity"
            title="Drag to reorder"
            aria-label={`Drag ${label} section`}
          >
            <GripVertical className="size-3" />
          </span>
        }
      />
      <SectionBody collapsed={collapsed}>{children}</SectionBody>
    </SidebarGroup>
  )
}

/** Single draggable element row inside a typed section (Pages, Canvases, …). */
function SortableElementItem({
  el,
  href,
  isActive,
  onOpen,
  onContextMenu,
}: {
  el: Element
  href: string
  isActive: boolean
  onOpen: () => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: el.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  }
  return (
    <SidebarMenuItem ref={setNodeRef} style={style}>
      <SidebarMenuButton
        isActive={isActive}
        onClick={onOpen}
        onContextMenu={onContextMenu}
        tooltip={el.title}
        className="group/row"
      >
        <span
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="cursor-grab active:cursor-grabbing opacity-0 group-hover/row:opacity-60 hover:!opacity-100 -ml-1 mr-0.5 p-0.5 rounded transition-opacity shrink-0"
          title="Drag to reorder"
          aria-label="Drag"
        >
          <GripVertical className="size-3" />
        </span>
        <span className="truncate">{el.title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

/**
 * Sortable wrapper for a ROOT project item. Mirrors the project row's
 * existing chrome (chevron-to-expand, hover "+ new sub-project", folder
 * icon, context menu) but adds a drag handle on the far left.
 *
 * Sub-projects (rendered inside SidebarMenuSub) remain non-sortable for now —
 * they live under their parent's expanded state and don't share a list with
 * root projects.
 */
function SortableProjectItem({
  project,
  isActive,
  hasChildren,
  isExpanded,
  onOpen,
  onContextMenu,
  onToggleExpanded,
  onAddChild,
  children,
}: {
  project: Element
  isActive: boolean
  hasChildren: boolean
  isExpanded: boolean
  onOpen: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onToggleExpanded: () => void
  onAddChild: () => void
  children?: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: project.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  }
  return (
    <SidebarMenuItem ref={setNodeRef} style={style}>
      <SidebarMenuButton
        isActive={isActive}
        onClick={onOpen}
        onContextMenu={onContextMenu}
        tooltip={project.title}
        className="group/proj"
      >
        {/* Drag handle — visible on hover, never steals click on the row */}
        <span
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="cursor-grab active:cursor-grabbing opacity-0 group-hover/proj:opacity-60 hover:!opacity-100 -ml-1 p-0.5 rounded transition-opacity shrink-0"
          title="Drag to reorder"
          aria-label="Drag project"
        >
          <GripVertical className="size-3" />
        </span>
        {hasChildren ? (
          <div
            role="button"
            className="shrink-0 p-0.5 rounded hover:bg-sidebar-accent"
            onClick={(e) => { e.stopPropagation(); onToggleExpanded() }}
          >
            <ChevronRight className={`size-3 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
          </div>
        ) : (
          <FolderKanban className="size-4 shrink-0" style={{ color: project.color ?? undefined }} />
        )}
        <span className="truncate flex-1">{project.title}</span>
        <div
          role="button"
          className="opacity-0 group-hover/proj:opacity-100 shrink-0 p-0.5 rounded hover:bg-sidebar-accent transition-opacity"
          title="New sub-project"
          onClick={(e) => { e.stopPropagation(); onAddChild() }}
        >
          <Plus className="size-3" />
        </div>
      </SidebarMenuButton>
      {children}
    </SidebarMenuItem>
  )
}

export function AppSidebar({ elements, favorites }: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const { menu: ctxMenu, open: openCtx, close: closeCtx } = useContextMenu()
  const { preferences, updatePreference } = usePreferences()
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())

  // dnd-kit sensors — pointer for mouse/touch, keyboard for accessibility
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Gate dnd-kit until after hydration — it generates incrementing
  // aria-describedby IDs that don't match between SSR and CSR.
  const [dndReady, setDndReady] = useState(false)
  useEffect(() => setDndReady(true), [])

  // ── Collapsed section state (per-browser) ───────────────────────────
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("flowspace.collapsedGroups")
      if (raw) setCollapsedGroups(new Set(JSON.parse(raw) as string[]))
    } catch {}
  }, [])
  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      try {
        window.localStorage.setItem(
          "flowspace.collapsedGroups",
          JSON.stringify([...next])
        )
      } catch {}
      return next
    })
  }
  const isCollapsed = (k: string) => collapsedGroups.has(k)

  async function handleCreate(type: ElementType, parentId?: string) {
    const result = await createElement(type, undefined, parentId)
    const href = getElementHref({ ...result, title: "Untitled" } as Element)
    toast.success(`${type.replace("_", " ")} created`)
    router.push(href)
  }

  function toggleExpanded(id: string) {
    setExpandedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleElementContextMenu(e: React.MouseEvent, el: Element) {
    const href = getElementHref(el)
    const typeLabel =
      ELEMENT_TYPE_CONFIG[el.type]?.label.replace(/s$/, "") ?? el.type
    const lastEdited = el.updatedAt ? sidebarRelativeTime(el.updatedAt) : null
    const items: ContextMenuEntry[] = [
      {
        header: true,
        title: el.title,
        subtitle: [typeLabel, lastEdited ? `edited ${lastEdited}` : null]
          .filter(Boolean)
          .join(" · "),
        icon: ELEMENT_TYPE_CONFIG[el.type]?.icon,
      },
      { separator: true },
      {
        label: "Open",
        icon: ExternalLink,
        onClick: () => router.push(href),
      },
      {
        label: "Rename",
        icon: Pencil,
        onClick: async () => {
          const newTitle = window.prompt("Rename to:", el.title)
          if (newTitle && newTitle.trim()) {
            await updateElement(el.id, { title: newTitle.trim() })
          }
        },
      },
      {
        label: el.isFavorite ? "Unpin from Favorites" : "Pin to Favorites",
        icon: el.isFavorite ? PinOff : Pin,
        onClick: () => toggleFavorite(el.id),
      },
      {
        colors: true,
        options: SIDEBAR_COLOR_OPTIONS,
        selected: el.color ?? undefined,
        onPick: async (val: string) => {
          await updateElement(el.id, { color: val || undefined })
        },
      },
      ...(el.type === "project"
        ? [
            { separator: true as const },
            {
              label: "New Sub-project",
              icon: FolderPlus,
              onClick: async () => {
                const result = await createElement("project", undefined, el.id)
                setExpandedProjects((prev) => new Set([...prev, el.id]))
                router.push(`/projects/${result.id}`)
              },
            },
          ]
        : []),
      { separator: true },
      {
        label: "Archive",
        icon: Archive,
        onClick: () => archiveElement(el.id),
      },
      {
        label: "Delete",
        icon: Trash2,
        variant: "destructive",
        onClick: () => deleteElement(el.id),
      },
    ]
    openCtx(e, items)
  }

  // Build project tree
  const allProjects = elements.filter((e) => e.type === "project")
  const projectSet = new Set(allProjects.map((p) => p.id))
  const rootProjects = allProjects.filter((p) => !p.parentId || !projectSet.has(p.parentId))
  function getSubProjects(parentId: string) {
    return allProjects.filter((p) => p.parentId === parentId)
  }

  // Group non-project elements by type
  const grouped = elements.reduce(
    (acc, el) => {
      if (el.type === "project") return acc
      if (!acc[el.type]) acc[el.type] = []
      acc[el.type].push(el)
      return acc
    },
    {} as Record<string, Element[]>
  )

  // Visibility from preferences (default true if missing)
  const isVisible = (key: SidebarSectionKey) =>
    preferences.sidebarVisible?.[key] !== false

  // Resolve a section's display label — user override falls back to default.
  const DEFAULT_LABELS: Record<SidebarSectionKey, string> = {
    favorites: "Favorites",
    projects: "Projects",
    "type:page": "Pages",
    "type:canvas": "Canvases",
    "type:todo_list": "Todo Lists",
    "type:reminder": "Reminders",
    "type:process": "Processes",
    platform: "Platform",
  }
  const labelFor = (key: SidebarSectionKey) =>
    preferences.sidebarLabels?.[key]?.trim() || DEFAULT_LABELS[key]

  // Section order from preferences, falling back to default order
  const DEFAULT_ORDER: SidebarSectionKey[] = [
    "favorites",
    "projects",
    "type:page",
    "type:canvas",
    "type:todo_list",
    "type:reminder",
    "type:process",
    "platform",
  ]
  const sectionOrder = (preferences.sidebarOrder ?? DEFAULT_ORDER).filter(
    (k): k is SidebarSectionKey => DEFAULT_ORDER.includes(k as SidebarSectionKey)
  )
  // Make sure newly-added section keys not yet in stored prefs still appear
  for (const k of DEFAULT_ORDER) {
    if (!sectionOrder.includes(k)) sectionOrder.push(k)
  }

  function handleSectionDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = sectionOrder.indexOf(active.id as SidebarSectionKey)
    const newIdx = sectionOrder.indexOf(over.id as SidebarSectionKey)
    if (oldIdx === -1 || newIdx === -1) return
    const next = arrayMove(sectionOrder, oldIdx, newIdx)
    updatePreference("sidebarOrder", next)
  }

  // Per-section item drag handler. Optimistic — calls reorderElements server action.
  function handleItemDragEnd(typeKey: ElementType) {
    return async (e: DragEndEvent) => {
      const { active, over } = e
      if (!over || active.id === over.id) return
      const items = grouped[typeKey] || []
      const ids = items.map((it) => it.id)
      const oldIdx = ids.indexOf(active.id as string)
      const newIdx = ids.indexOf(over.id as string)
      if (oldIdx === -1 || newIdx === -1) return
      const next = arrayMove(ids, oldIdx, newIdx)
      try {
        await reorderElements(next)
      } catch {
        toast.error("Failed to save new order")
      }
    }
  }

  // Root-project drag handler. Reorders only the top-level projects.
  // Sub-projects retain their position inside their parent.
  async function handleProjectDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = rootProjects.map((p) => p.id)
    const oldIdx = ids.indexOf(active.id as string)
    const newIdx = ids.indexOf(over.id as string)
    if (oldIdx === -1 || newIdx === -1) return
    const next = arrayMove(ids, oldIdx, newIdx)
    try {
      await reorderElements(next)
    } catch {
      toast.error("Failed to save new project order")
    }
  }

  function renderProjectItem(project: Element, depth = 0): React.ReactNode {
    const href = `/projects/${project.id}`
    const children = getSubProjects(project.id)
    const hasChildren = children.length > 0
    const isExpanded = expandedProjects.has(project.id)
    const isActive = pathname === href

    if (depth === 0) {
      return (
        <SidebarMenuItem key={project.id}>
          <SidebarMenuButton
            isActive={isActive}
            onClick={() => router.push(href)}
            onContextMenu={(e) => handleElementContextMenu(e, project)}
            tooltip={project.title}
            className="group/proj"
          >
            {hasChildren ? (
              <div
                role="button"
                className="shrink-0 -ml-1 p-0.5 rounded hover:bg-sidebar-accent"
                onClick={(e) => { e.stopPropagation(); toggleExpanded(project.id) }}
              >
                <ChevronRight className={`size-3 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
              </div>
            ) : (
              <FolderKanban className="size-4 shrink-0" style={{ color: project.color ?? undefined }} />
            )}
            <span className="truncate flex-1">{project.title}</span>
            <div
              role="button"
              className="opacity-0 group-hover/proj:opacity-100 shrink-0 p-0.5 rounded hover:bg-sidebar-accent transition-opacity"
              title="New sub-project"
              onClick={async (e) => {
                e.stopPropagation()
                const result = await createElement("project", undefined, project.id)
                setExpandedProjects((prev) => new Set([...prev, project.id]))
                router.push(`/projects/${result.id}`)
              }}
            >
              <Plus className="size-3" />
            </div>
          </SidebarMenuButton>

          {hasChildren && isExpanded && (
            <SidebarMenuSub>
              {children.map((child) => (
                <SidebarMenuSubItem key={child.id}>
                  <SidebarMenuSubButton
                    isActive={pathname === `/projects/${child.id}`}
                    onClick={() => router.push(`/projects/${child.id}`)}
                    onContextMenu={(e) => handleElementContextMenu(e, child)}
                    className="group/sub"
                  >
                    <FolderKanban className="size-3.5 shrink-0" style={{ color: child.color ?? undefined }} />
                    <span className="truncate flex-1">{child.title}</span>
                    <div
                      role="button"
                      className="opacity-0 group-hover/sub:opacity-100 shrink-0 p-0.5 rounded hover:bg-sidebar-accent transition-opacity"
                      title="New sub-project"
                      onClick={async (e) => {
                        e.stopPropagation()
                        const result = await createElement("project", undefined, child.id)
                        router.push(`/projects/${result.id}`)
                      }}
                    >
                      <Plus className="size-3" />
                    </div>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          )}
        </SidebarMenuItem>
      )
    }
    return null
  }

  // Render a single section based on its key
  function renderSection(key: SidebarSectionKey) {
    if (!isVisible(key)) return null

    switch (key) {
      case "favorites":
        if (favorites.length === 0) return null
        return (
          <CollapsibleSection sortable={dndReady}
            key="favorites"
            sectionKey="favorites"
            icon={Star}
            label={labelFor("favorites")}
            count={favorites.length}
            collapsed={isCollapsed("favorites")}
            onToggle={toggleGroup}
          >
            <SidebarMenu>
              {favorites.map((el) => {
                const config = ELEMENT_TYPE_CONFIG[el.type]
                const Icon = config.icon
                const href = getElementHref(el)
                return (
                  <SidebarMenuItem key={el.id}>
                    <SidebarMenuButton
                      isActive={pathname === href}
                      onClick={() => router.push(href)}
                      onContextMenu={(e) => handleElementContextMenu(e, el)}
                      tooltip={el.title}
                    >
                      <Icon className="size-4" />
                      <span className="truncate">{el.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </CollapsibleSection>
        )

      case "projects":
        return (
          <CollapsibleSection sortable={dndReady}
            key="projects"
            sectionKey="projects"
            icon={FolderKanban}
            label={labelFor("projects")}
            count={rootProjects.length}
            collapsed={isCollapsed("projects")}
            onToggle={toggleGroup}
          >
            <SidebarMenu>
              {rootProjects.length === 0 ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="text-muted-foreground text-xs"
                    onClick={() => handleCreate("project")}
                  >
                    <Plus className="size-3" />
                    <span>Add project</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : dndReady ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleProjectDragEnd}
                >
                  <SortableContext
                    items={rootProjects.map((p) => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {rootProjects.map((project) => {
                      const href = `/projects/${project.id}`
                      const childProjects = getSubProjects(project.id)
                      const hasChildren = childProjects.length > 0
                      const isExpanded = expandedProjects.has(project.id)
                      return (
                        <SortableProjectItem
                          key={project.id}
                          project={project}
                          isActive={pathname === href}
                          hasChildren={hasChildren}
                          isExpanded={isExpanded}
                          onOpen={() => router.push(href)}
                          onContextMenu={(e) => handleElementContextMenu(e, project)}
                          onToggleExpanded={() => toggleExpanded(project.id)}
                          onAddChild={async () => {
                            const result = await createElement("project", undefined, project.id)
                            setExpandedProjects((prev) => new Set([...prev, project.id]))
                            router.push(`/projects/${result.id}`)
                          }}
                        >
                          {hasChildren && isExpanded && (
                            <SidebarMenuSub>
                              {childProjects.map((child) => (
                                <SidebarMenuSubItem key={child.id}>
                                  <SidebarMenuSubButton
                                    isActive={pathname === `/projects/${child.id}`}
                                    onClick={() => router.push(`/projects/${child.id}`)}
                                    onContextMenu={(e) => handleElementContextMenu(e, child)}
                                    className="group/sub"
                                  >
                                    <FolderKanban className="size-3.5 shrink-0" style={{ color: child.color ?? undefined }} />
                                    <span className="truncate flex-1">{child.title}</span>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          )}
                        </SortableProjectItem>
                      )
                    })}
                  </SortableContext>
                </DndContext>
              ) : (
                rootProjects.map((project) => renderProjectItem(project))
              )}
            </SidebarMenu>
          </CollapsibleSection>
        )

      case "platform":
        return (
          <CollapsibleSection sortable={dndReady}
            key="platform"
            sectionKey="platform"
            label={labelFor("platform")}
            collapsed={isCollapsed("platform")}
            onToggle={toggleGroup}
          >
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname.startsWith("/feed")}
                  onClick={() => router.push("/feed")}
                  tooltip="Feed"
                >
                  <Rss className="size-4" />
                  <span>Feed</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === "/templates"}
                  onClick={() => router.push("/templates")}
                  tooltip="Templates"
                >
                  <BookTemplate className="size-4" />
                  <span>Templates</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === "/forms"}
                  onClick={() => router.push("/forms")}
                  tooltip="Forms"
                >
                  <FileInput className="size-4" />
                  <span>Forms</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === "/automations"}
                  onClick={() => router.push("/automations")}
                  tooltip="Automations"
                >
                  <Zap className="size-4" />
                  <span>Automations</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === "/approvals"}
                  onClick={() => router.push("/approvals")}
                  tooltip="Approvals"
                >
                  <ShieldCheck className="size-4" />
                  <span>Approvals</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </CollapsibleSection>
        )

      default: {
        // Element-type sections (type:page, type:canvas, ...)
        const typeKey = key.replace("type:", "") as ElementType
        const config = ELEMENT_TYPE_CONFIG[typeKey]
        if (!config) return null
        const items = grouped[typeKey] || []
        return (
          <CollapsibleSection sortable={dndReady}
            key={key}
            sectionKey={key}
            icon={config.icon}
            label={labelFor(key)}
            count={items.length}
            collapsed={isCollapsed(key)}
            onToggle={toggleGroup}
          >
            <SidebarMenu>
              {items.length === 0 ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="text-muted-foreground text-xs"
                    onClick={() => handleCreate(typeKey)}
                  >
                    <Plus className="size-3" />
                    <span>Add {config.label.replace(/s$/, "").toLowerCase()}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : dndReady ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleItemDragEnd(typeKey)}
                >
                  <SortableContext
                    items={items.map((it) => it.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {items.map((el) => {
                      const href = getElementHref(el)
                      return (
                        <SortableElementItem
                          key={el.id}
                          el={el}
                          href={href}
                          isActive={pathname === href}
                          onOpen={() => router.push(href)}
                          onContextMenu={(e) => handleElementContextMenu(e, el)}
                        />
                      )
                    })}
                  </SortableContext>
                </DndContext>
              ) : (
                items.map((el) => {
                  const href = getElementHref(el)
                  return (
                    <SidebarMenuItem key={el.id}>
                      <SidebarMenuButton
                        isActive={pathname === href}
                        onClick={() => router.push(href)}
                        onContextMenu={(e) => handleElementContextMenu(e, el)}
                        tooltip={el.title}
                      >
                        <span className="truncate">{el.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })
              )}
            </SidebarMenu>
          </CollapsibleSection>
        )
      }
    }
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              onClick={() => router.push("/")}
              isActive={pathname === "/"}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Home className="size-4" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">FlowSpace</span>
                <span className="text-xs text-muted-foreground">Workspace</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Search */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => openCommandPalette()}
                  tooltip="Search (Ctrl+K)"
                  className="text-muted-foreground"
                >
                  <Search className="size-4" />
                  <span className="flex-1">Search...</span>
                  <kbd className="pointer-events-none hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                    ⌘K
                  </kbd>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Quick Create */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  >
                    <Plus className="size-4" />
                    <span>New Element</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start" className="w-48">
                    {(Object.entries(ELEMENT_TYPE_CONFIG) as [ElementType, typeof ELEMENT_TYPE_CONFIG[ElementType]][]).map(
                      ([type, config]) => (
                        <DropdownMenuItem
                          key={type}
                          onClick={() => handleCreate(type)}
                        >
                          <config.icon className="mr-2 size-4" />
                          {config.label.replace(/s$/, "")}
                        </DropdownMenuItem>
                      )
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Sections rendered in user-defined order — draggable to reorder
            (only wired after hydration to avoid SSR mismatch from dnd-kit). */}
        {dndReady ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleSectionDragEnd}
          >
            <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
              {sectionOrder.map((key) => renderSection(key))}
            </SortableContext>
          </DndContext>
        ) : (
          sectionOrder.map((key) => renderSection(key))
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname === "/people"}
              onClick={() => router.push("/people")}
              tooltip="People & Teams"
            >
              <Users className="size-4" />
              <span>People</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {user && (user.role === "owner" || user.role === "admin") && (
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === "/admin"}
                onClick={() => router.push("/admin")}
                tooltip="Administration"
              >
                <Shield className="size-4" />
                <span>Admin</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname === "/notifications"}
              onClick={() => router.push("/notifications")}
              tooltip="Notifications"
            >
              <Inbox className="size-4" />
              <span>Notifications</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname === "/trash"}
              onClick={() => router.push("/trash")}
              tooltip="Trash & Archive"
            >
              <Trash2 className="size-4" />
              <span>Trash</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname === "/settings"}
              onClick={() => router.push("/settings")}
              tooltip="Settings"
            >
              <Settings className="size-4" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <div className="flex items-center justify-between px-2">
              <ThemeToggle />
              {user && (
                <button
                  onClick={() => logout()}
                  className="p-1.5 rounded-md hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-colors"
                  title={`Sign out (${user.displayName})`}
                >
                  <LogOut className="size-3.5" />
                </button>
              )}
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxMenu.items}
          onClose={closeCtx}
        />
      )}
    </Sidebar>
  )
}
