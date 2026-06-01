"use client"

import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect, useRef, type ReactNode } from "react"
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
  Palette,
  Repeat,
  ScanEye,
  ChevronsDownUp,
  ChevronsUpDown,
  HelpCircle,
} from "lucide-react"
import {
  DndContext,
  DragOverlay,
  closestCenter,
  defaultDropAnimationSideEffects,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
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
import { SidebarResizer } from "@/components/layout/sidebar-resizer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageToggle } from "@/components/layout/language-toggle"
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
import { createFeedEvent } from "@/lib/actions/feed-actions"
import type { Element, ElementType } from "@/lib/db/schema"
import { ContextMenu, useContextMenu, type ContextMenuEntry } from "@/components/shared/context-menu"
import { useAuth } from "@/lib/hooks/use-auth"
import { usePreferences, type SidebarSectionKey } from "@/lib/hooks/use-preferences"
import { useT } from "@/lib/hooks/use-i18n"
import { useWorkspaceName } from "@/lib/hooks/use-workspace-name"
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

/**
 * Sidebar header with an editable two-line workspace title.
 *
 * Layout: [Home icon button] [bold workspace name] / [muted personal tag]
 *
 * - The Home icon takes you home (existing behaviour).
 * - The bold workspace name is the admin-set prefix. Double-click only
 *   opens an editor if the current user is an owner. For everyone else
 *   it's read-only.
 * - The muted line below is a per-user tagline (workspaceSuffix in
 *   preferences). Anyone can double-click to edit their own. When empty,
 *   we show a faded "Add a personal tag…" prompt so the affordance is
 *   discoverable.
 */
function WorkspaceHeader({
  isOwner,
  isActive,
  onNavigateHome,
}: {
  isOwner: boolean
  isActive: boolean
  onNavigateHome: () => void
}) {
  const { workspaceName, setWorkspaceName } = useWorkspaceName()
  const { preferences, updatePreference } = usePreferences()
  const [editing, setEditing] = useState<"name" | "suffix" | null>(null)
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const suffix = preferences.workspaceSuffix ?? ""

  function startEditingName() {
    if (!isOwner) return
    setDraft(workspaceName)
    setEditing("name")
  }
  function startEditingSuffix() {
    setDraft(suffix)
    setEditing("suffix")
  }
  async function commit() {
    if (editing === "name") {
      const trimmed = draft.trim()
      if (trimmed && trimmed !== workspaceName) {
        try {
          await setWorkspaceName(trimmed)
          toast.success("Workspace name updated for everyone")
        } catch {
          toast.error("Only owners can rename the workspace")
        }
      }
    } else if (editing === "suffix") {
      const trimmed = draft.trim().slice(0, 40)
      if (trimmed !== suffix) updatePreference("workspaceSuffix", trimmed)
    }
    setEditing(null)
  }
  function cancel() {
    setEditing(null)
    setDraft("")
  }

  // Auto-focus the input when we open it.
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  return (
    <div
      className={`group/wsheader flex items-center gap-2 rounded-md p-2 transition-colors ${
        isActive ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/40"
      }`}
    >
      <button
        type="button"
        onClick={onNavigateHome}
        aria-label="Go home"
        className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform hover:scale-105"
      >
        <Home className="size-4" />
      </button>
      <div className="flex flex-col gap-0.5 leading-none min-w-0 flex-1">
        {/* ── Workspace name (admin-editable) ───────────────────────── */}
        {editing === "name" ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit()
              if (e.key === "Escape") cancel()
            }}
            maxLength={40}
            className="font-semibold text-sm bg-transparent border-b border-primary/60 outline-none w-full px-0.5"
          />
        ) : (
          <button
            type="button"
            onDoubleClick={startEditingName}
            onClick={onNavigateHome}
            title={isOwner ? "Double-click to rename workspace" : workspaceName}
            className={`font-semibold text-sm truncate text-left ${
              isOwner ? "cursor-text" : "cursor-pointer"
            }`}
          >
            {workspaceName}
          </button>
        )}

        {/* ── Personal tagline (per-user, anyone can edit) ──────────── */}
        {editing === "suffix" ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit()
              if (e.key === "Escape") cancel()
            }}
            maxLength={40}
            placeholder="Add a personal tag…"
            className="text-xs bg-transparent border-b border-primary/40 outline-none w-full px-0.5 text-muted-foreground placeholder:text-muted-foreground/50"
          />
        ) : (
          <button
            type="button"
            onDoubleClick={startEditingSuffix}
            title="Double-click to personalise"
            className={`text-xs truncate text-left transition-colors ${
              suffix
                ? "text-muted-foreground hover:text-foreground"
                : "text-muted-foreground/40 hover:text-muted-foreground italic opacity-0 group-hover/wsheader:opacity-100"
            }`}
          >
            {suffix || "Add a personal tag…"}
          </button>
        )}
      </div>
    </div>
  )
}

/** Friendly label for a hex — fallback when the color isn't in our named set. */
const NAMED_COLORS: Record<string, string> = {
  "#737373": "Neutral",
  "#3b82f6": "Blue",
  "#8b5cf6": "Violet",
  "#f43f5e": "Rose",
  "#10b981": "Green",
  "#f97316": "Orange",
  "#14b8a6": "Teal",
  "#a78bfa": "Violet",
  "#60a5fa": "Blue",
  "#67e8f9": "Cyan",
  "#6ee7b7": "Emerald",
  "#fbbf24": "Amber",
  "#fb7185": "Rose",
  "#94a3b8": "Slate",
}

/** Build the right-click color options from the user's curated palette.
 * Falls back to the platform default if they haven't set one. */
function getRightClickColorOptions(
  palette: string[] | undefined,
): { value: string; label: string }[] {
  const list = (palette && palette.length > 0)
    ? palette
    : ["#a78bfa", "#60a5fa", "#67e8f9", "#6ee7b7", "#fbbf24", "#fb7185", "#f97316", "#94a3b8"]
  return list.map((hex) => ({ value: hex, label: NAMED_COLORS[hex] ?? hex }))
}

/** Sidebar "Notifications" button with an unread-count badge. The badge
 *  combines unread notifications, pending Telegram imports, and overdue
 *  task/reminder counts into one number. Polls every 60s so newly arrived
 *  items show up without a refresh. The `enabled` prop hides the badge
 *  per user preference (Settings → … → Notification badge). */
function NotificationsButton({
  active,
  onClick,
  enabled,
}: {
  active: boolean
  onClick: () => void
  enabled: boolean
}) {
  const { t } = useT()
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!enabled) {
      setCount(0)
      return
    }
    let cancelled = false
    async function tick() {
      try {
        const { getMyNotificationCount } = await import(
          "@/lib/actions/notification-count-actions"
        )
        const c = await getMyNotificationCount()
        if (!cancelled) setCount(c.total)
      } catch {
        /* ignore — keep last known */
      }
    }
    void tick()
    const t = window.setInterval(tick, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [enabled])

  return (
    <SidebarMenuButton
      isActive={active}
      onClick={onClick}
      tooltip="Notifications"
    >
      <span className="relative inline-flex items-center justify-center">
        <Bell className="size-4" />
        {enabled && count > 0 && (
          <span
            aria-label={`${count} pending`}
            className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center leading-none ring-2 ring-sidebar"
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </span>
      <span>{t("sidebar.notifications")}</span>
    </SidebarMenuButton>
  )
}

/** Color presets used for SECTION HEADERS (Projects, Pages, Canvases…).
 * Tuned for dark-mode legibility: bright enough to read, soft enough not
 * to fight the content. Pair freely. */
const SIDEBAR_SECTION_COLOR_OPTIONS: { value: string; label: string }[] = [
  { value: "#94a3b8", label: "Neutral" },
  { value: "#a78bfa", label: "Violet" },
  { value: "#60a5fa", label: "Blue" },
  { value: "#67e8f9", label: "Cyan" },
  { value: "#6ee7b7", label: "Emerald" },
  { value: "#fbbf24", label: "Amber" },
  { value: "#fb7185", label: "Rose" },
  { value: "#f472b6", label: "Pink" },
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
  accentColor,
  onContextMenu,
}: {
  sectionKey: string
  icon?: React.ComponentType<{ className?: string }>
  label: string
  count?: number
  collapsed: boolean
  onToggle: (k: string) => void
  sortable?: boolean
  children: ReactNode
  accentColor?: string
  onContextMenu?: (e: React.MouseEvent) => void
}) {
  return sortable ? (
    <SortableCollapsibleSectionInner
      sectionKey={sectionKey}
      icon={Icon}
      label={label}
      count={count}
      collapsed={collapsed}
      onToggle={onToggle}
      accentColor={accentColor}
      onContextMenu={onContextMenu}
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
      accentColor={accentColor}
      onContextMenu={onContextMenu}
      onToggle={onToggle}
    >
      {children}
    </PlainCollapsibleSection>
  )
}

function SectionLabel({
  sectionKey, icon: Icon, label, count, collapsed, onToggle, dragHandle,
  accentColor, onContextMenu,
}: {
  sectionKey: string
  icon?: React.ComponentType<{ className?: string }>
  label: string
  count?: number
  collapsed: boolean
  onToggle: (k: string) => void
  dragHandle?: ReactNode
  accentColor?: string
  onContextMenu?: (e: React.MouseEvent) => void
}) {
  const accent = accentColor || undefined
  return (
    <SidebarGroupLabel
      role="button"
      tabIndex={0}
      onClick={() => onToggle(sectionKey)}
      onContextMenu={onContextMenu}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onToggle(sectionKey)
        }
      }}
      className={`group/lbl cursor-pointer select-none hover:bg-sidebar-accent/50 transition-colors relative ${
        !collapsed && accent ? "border-l-2 -ml-2 pl-1.5" : ""
      }`}
      style={!collapsed && accent ? { borderLeftColor: accent } : undefined}
      title={collapsed ? "Expand (right-click for color)" : "Collapse (right-click for color)"}
      aria-expanded={!collapsed}
    >
      {dragHandle}
      <ChevronRight
        className={`mr-1 size-3 shrink-0 transition-transform duration-200 ${
          collapsed ? "" : "rotate-90"
        }`}
      />
      {Icon && (
        <span
          className="mr-2 inline-flex shrink-0 transition-transform duration-200 group-hover/lbl:scale-110 group-hover/lbl:-rotate-6"
          style={accent ? { color: accent } : undefined}
        >
          <Icon className="size-3" />
        </span>
      )}
      <span
        className="flex-1 transition-[letter-spacing,color] duration-200 group-hover/lbl:tracking-[0.02em]"
        style={accent ? { color: `${accent}cc` } : undefined}
      >
        {label}
      </span>
      {typeof count === "number" && count > 0 && (
        <span
          className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums transition-colors"
          style={
            accent
              ? { background: `${accent}26`, color: accent }
              : { background: "color-mix(in oklab, var(--sidebar-accent) 60%, transparent)", color: "var(--muted-foreground)" }
          }
        >
          {count}
        </span>
      )}
    </SidebarGroupLabel>
  )
}

function SectionBody({
  collapsed, children, accentColor,
}: { collapsed: boolean; children: ReactNode; accentColor?: string }) {
  // When the section has an accent color, give expanded children a subtle
  // tint background + a vertical accent-colored connector line + a small
  // indent. Makes it obvious which items belong to which parent at a
  // glance, even when several sections are expanded.
  const accent = accentColor || undefined
  return (
    <div
      className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
        collapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
      }`}
      aria-hidden={collapsed}
    >
      <div className="overflow-hidden">
        {!collapsed && (
          <div
            className={accent ? "ml-3 pl-2 border-l-[1.5px] rounded-r-sm" : ""}
            style={
              accent
                ? {
                    borderLeftColor: `${accent}aa`,
                    background: `linear-gradient(to right, ${accent}10, transparent 70%)`,
                  }
                : undefined
            }
          >
            <SidebarGroupContent>{children}</SidebarGroupContent>
          </div>
        )}
      </div>
    </div>
  )
}

function PlainCollapsibleSection({
  sectionKey, icon: Icon, label, count, collapsed, onToggle, children,
  accentColor, onContextMenu,
}: {
  sectionKey: string
  icon?: React.ComponentType<{ className?: string }>
  label: string
  count?: number
  collapsed: boolean
  onToggle: (k: string) => void
  children: ReactNode
  accentColor?: string
  onContextMenu?: (e: React.MouseEvent) => void
}) {
  return (
    <SidebarGroup>
      <SectionLabel
        sectionKey={sectionKey} icon={Icon} label={label} count={count}
        collapsed={collapsed} onToggle={onToggle}
        accentColor={accentColor} onContextMenu={onContextMenu}
      />
      <SectionBody collapsed={collapsed} accentColor={accentColor}>{children}</SectionBody>
    </SidebarGroup>
  )
}

function SortableCollapsibleSectionInner({
  sectionKey, icon: Icon, label, count, collapsed, onToggle, children,
  accentColor, onContextMenu,
}: {
  sectionKey: string
  icon?: React.ComponentType<{ className?: string }>
  label: string
  count?: number
  collapsed: boolean
  onToggle: (k: string) => void
  children: ReactNode
  accentColor?: string
  onContextMenu?: (e: React.MouseEvent) => void
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
        accentColor={accentColor} onContextMenu={onContextMenu}
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
      <SectionBody collapsed={collapsed} accentColor={accentColor}>{children}</SectionBody>
    </SidebarGroup>
  )
}

/** Single draggable element row inside a typed section (Pages, Canvases, …). */
/**
 * Floating preview rendered under the cursor while a sidebar row is dragged.
 * Plain element name + matching icon, styled like the original row but with
 * a stronger shadow and a slight rotation so it reads as "lifted off the page".
 */
function SidebarDragGhost({ el }: { el: Element }) {
  const Icon = ELEMENT_TYPE_CONFIG[el.type]?.icon ?? FolderKanban
  return (
    <div
      className="inline-flex items-center gap-2 w-56 px-3 py-2 rounded-md bg-sidebar text-sidebar-foreground border border-sidebar-border shadow-xl text-sm cursor-grabbing"
      style={{ transform: "rotate(-1deg)" }}
    >
      <GripVertical className="size-3 text-muted-foreground shrink-0" />
      <span className="shrink-0" style={{ color: el.color ?? undefined }}>
        <Icon className="size-4" />
      </span>
      <span className="truncate font-medium">{el.title}</span>
    </div>
  )
}

/**
 * Thin horizontal insertion line, Figma-style. Positioned at the top or
 * bottom edge of the parent item via absolute positioning. Includes a
 * small dot on the left so it reads more like an "I-beam".
 */
function DropIndicatorLine({ position }: { position: "above" | "below" }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute left-1.5 right-1.5 h-0.5 bg-primary rounded-full z-50 ${
        position === "above" ? "-top-px" : "-bottom-px"
      }`}
    >
      <span className="absolute -left-1 -top-[3px] size-2 rounded-full bg-primary ring-2 ring-sidebar" />
    </div>
  )
}

function SortableElementItem({
  el,
  href,
  isActive,
  onOpen,
  onContextMenu,
  dropTarget,
}: {
  el: Element
  href: string
  isActive: boolean
  onOpen: () => void
  onContextMenu: (e: React.MouseEvent) => void
  dropTarget: { overId: string; position: "above" | "below" } | null
}) {
  const { attributes, listeners, setNodeRef, transition, isDragging } =
    useSortable({ id: el.id })
  // Deliberately do NOT apply `transform` here — Figma-style means rows stay
  // put and only the insertion line moves. The dragged item itself is shown
  // via <DragOverlay> following the cursor.
  const style = {
    transition,
    opacity: isDragging ? 0.4 : undefined,
  }
  const indicator = dropTarget?.overId === el.id ? dropTarget.position : null
  return (
    <SidebarMenuItem ref={setNodeRef} style={style} className="relative">
      {indicator === "above" && <DropIndicatorLine position="above" />}
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
      {indicator === "below" && <DropIndicatorLine position="below" />}
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
  dropTarget,
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
  dropTarget: { overId: string; position: "above" | "below" } | null
}) {
  const { attributes, listeners, setNodeRef, transition, isDragging } =
    useSortable({ id: project.id })
  // Figma-style: no `transform` — siblings stay put; only the indicator
  // line moves between rows. Source row dims to mark the lift.
  const style = {
    transition,
    opacity: isDragging ? 0.4 : undefined,
  }
  const indicator = dropTarget?.overId === project.id ? dropTarget.position : null
  return (
    <SidebarMenuItem ref={setNodeRef} style={style} className="relative">
      {indicator === "above" && <DropIndicatorLine position="above" />}
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
      {indicator === "below" && <DropIndicatorLine position="below" />}
    </SidebarMenuItem>
  )
}

export function AppSidebar({ elements, favorites }: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const { menu: ctxMenu, open: openCtx, close: closeCtx } = useContextMenu()
  const { preferences, updatePreference } = usePreferences()
  const { t, locale } = useT()
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())

  // Tracks the id of the row currently being dragged, so we can render a
  // floating preview via <DragOverlay>. Cleared on drop or cancel.
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  // Figma-style insertion indicator: which row the cursor is hovering over,
  // and whether the dragged row will land above or below it. The current
  // SortableContext items list is stashed so handleDragOver can compute the
  // direction.
  const [dropTarget, setDropTarget] = useState<{ overId: string; position: "above" | "below" } | null>(null)
  const activeItemsRef = useRef<string[]>([])

  // dnd-kit sensors — pointer for mouse/touch, keyboard for accessibility
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Subtle "snap into place" animation when the user drops a row.
  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: { active: { opacity: "0.4" } },
    }),
  }

  // Resolve the active drag id back to a renderable item (project or other element)
  const activeDragItem = activeDragId
    ? elements.find((el) => el.id === activeDragId) ?? null
    : null

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

  function persistCollapsed(next: Set<string>) {
    try {
      window.localStorage.setItem("flowspace.collapsedGroups", JSON.stringify([...next]))
    } catch {}
  }

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
        label: "Post to feed",
        icon: Rss,
        onClick: async () => {
          const note = window.prompt(`Add a note for the feed (optional):`, "")
          if (note === null) return  // user cancelled
          try {
            await createFeedEvent({
              type: "project_milestone",
              subjectElementId: el.id,
              projectId: el.type === "project" ? el.id : undefined,
              title: el.title,
              summary: note.trim() || `${el.type.replace(/_/g, " ")} highlighted`,
              priority: "normal",
              sourceType: "manual",
            })
            toast.success("Posted to feed")
          } catch {
            toast.error("Couldn't post to feed")
          }
        },
      },
      {
        colors: true,
        options: getRightClickColorOptions(preferences.rightClickPalette),
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

  // Resolve a section's display label.
  //
  // Lookup order:
  //   1. User-provided custom label (Settings → Sidebar)
  //   2. Locale translation via useT() — Arabic users see Arabic labels
  //   3. English default
  //
  // The translation key mirrors the section key so adding a new
  // locale is just adding rows to strings.ts.
  const I18N_KEYS: Record<SidebarSectionKey, string> = {
    favorites:       "sidebar.favorites",
    projects:        "sidebar.projects",
    "type:page":     "sidebar.pages",
    "type:canvas":   "sidebar.canvases",
    "type:todo_list":"sidebar.todoLists",
    "type:reminder": "sidebar.reminders",
    "type:process":  "sidebar.processes",
    platform:        "sidebar.platform",
  }
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
  const labelFor = (key: SidebarSectionKey) => {
    const custom = preferences.sidebarLabels?.[key]?.trim()
    if (custom) return custom
    const translated = t(I18N_KEYS[key])
    // useT returns the key itself if no translation exists, so if it
    // equals the lookup key we fall back to the English default.
    return translated && translated !== I18N_KEYS[key]
      ? translated
      : DEFAULT_LABELS[key]
  }
  const accentForSection = (key: SidebarSectionKey) =>
    preferences.sidebarSectionColors?.[key] || undefined

  function handleSectionContextMenu(e: React.MouseEvent, key: SidebarSectionKey, label: string) {
    const currentColor = preferences.sidebarSectionColors?.[key]
    const items: ContextMenuEntry[] = [
      { header: true, title: label, subtitle: "Section appearance", icon: Palette },
      { separator: true },
      {
        colors: true,
        options: SIDEBAR_SECTION_COLOR_OPTIONS,
        selected: currentColor,
        onPick: (val: string) => {
          const next = { ...(preferences.sidebarSectionColors ?? {}) }
          if (val) next[key] = val
          else delete next[key]
          updatePreference("sidebarSectionColors", next)
        },
      },
      { separator: true },
      {
        label: isCollapsed(key) ? "Expand section" : "Collapse section",
        icon: ChevronRight,
        onClick: () => toggleGroup(key),
      },
    ]
    openCtx(e, items)
  }

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

  // Collapse-all toggle: if every section is already folded, expand them all;
  // otherwise fold them all. Persisted like the individual section toggles.
  const allSectionsCollapsed =
    sectionOrder.length > 0 && sectionOrder.every((k) => collapsedGroups.has(k))
  function toggleCollapseAll() {
    const next = allSectionsCollapsed
      ? new Set<string>()
      : new Set<string>(sectionOrder)
    setCollapsedGroups(next)
    persistCollapsed(next)
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

  function handleDragStart(e: DragStartEvent) {
    setActiveDragId(e.active.id as string)
    setDropTarget(null)
  }

  function handleDragCancel() {
    setActiveDragId(null)
    setDropTarget(null)
  }

  /**
   * Updates the Figma-style insertion-line target as the user drags.
   * "above" / "below" is derived from the active vs. over indices in the
   * current sortable list: if active was originally above over, the drop
   * lands BELOW over (cursor moved down past it), and vice versa.
   */
  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) {
      setDropTarget(null)
      return
    }
    const ids = activeItemsRef.current
    const activeIdx = ids.indexOf(active.id as string)
    const overIdx = ids.indexOf(over.id as string)
    if (activeIdx === -1 || overIdx === -1) {
      setDropTarget(null)
      return
    }
    setDropTarget({
      overId: over.id as string,
      position: activeIdx < overIdx ? "below" : "above",
    })
  }

  // Per-section item drag handler. Optimistic — calls reorderElements server action.
  function handleItemDragEnd(typeKey: ElementType) {
    return async (e: DragEndEvent) => {
      setActiveDragId(null)
      setDropTarget(null)
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
    setActiveDragId(null)
    setDropTarget(null)
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
            accentColor={accentForSection("favorites")}
            onContextMenu={(e) => handleSectionContextMenu(e, "favorites", labelFor("favorites"))}
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
            accentColor={accentForSection("projects")}
            onContextMenu={(e) => handleSectionContextMenu(e, "projects", labelFor("projects"))}
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
                  onDragStart={(e) => {
                    activeItemsRef.current = rootProjects.map((p) => p.id)
                    handleDragStart(e)
                  }}
                  onDragOver={handleDragOver}
                  onDragEnd={handleProjectDragEnd}
                  onDragCancel={handleDragCancel}
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
                          dropTarget={dropTarget}
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
                  <DragOverlay dropAnimation={dropAnimation}>
                    {activeDragItem ? <SidebarDragGhost el={activeDragItem} /> : null}
                  </DragOverlay>
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
            accentColor={accentForSection("platform")}
            onContextMenu={(e) => handleSectionContextMenu(e, "platform", labelFor("platform"))}
          >
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname.startsWith("/feed")}
                  onClick={() => router.push("/feed")}
                  tooltip="Feed"
                >
                  <Rss className="size-4" />
                  <span>{t("sidebar.feed")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === "/templates"}
                  onClick={() => router.push("/templates")}
                  tooltip="Templates"
                >
                  <BookTemplate className="size-4" />
                  <span>{t("sidebar.templates")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === "/forms"}
                  onClick={() => router.push("/forms")}
                  tooltip="Forms"
                >
                  <FileInput className="size-4" />
                  <span>{t("sidebar.forms")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === "/automations"}
                  onClick={() => router.push("/automations")}
                  tooltip="Automations"
                >
                  <Zap className="size-4" />
                  <span>{t("sidebar.automations")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === "/approvals"}
                  onClick={() => router.push("/approvals")}
                  tooltip="Approvals"
                >
                  <ShieldCheck className="size-4" />
                  <span>{t("sidebar.approvals")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === "/habits"}
                  onClick={() => router.push("/habits")}
                  tooltip="Habits"
                >
                  <Repeat className="size-4" />
                  <span>Habits</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === "/vision"}
                  onClick={() => router.push("/vision")}
                  tooltip="Vision (image analysis)"
                >
                  <ScanEye className="size-4" />
                  <span>Vision</span>
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
            accentColor={accentForSection(key)}
            onContextMenu={(e) => handleSectionContextMenu(e, key, labelFor(key))}
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
                  onDragStart={(e) => {
                    activeItemsRef.current = items.map((it) => it.id)
                    handleDragStart(e)
                  }}
                  onDragOver={handleDragOver}
                  onDragEnd={handleItemDragEnd(typeKey)}
                  onDragCancel={handleDragCancel}
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
                          dropTarget={dropTarget}
                          onOpen={() => router.push(href)}
                          onContextMenu={(e) => handleElementContextMenu(e, el)}
                        />
                      )
                    })}
                  </SortableContext>
                  <DragOverlay dropAnimation={dropAnimation}>
                    {activeDragItem ? <SidebarDragGhost el={activeDragItem} /> : null}
                  </DragOverlay>
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
    <Sidebar collapsible="icon" side={locale === "ar" ? "right" : "left"}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-1">
              <div className="min-w-0 flex-1">
                <WorkspaceHeader
                  isOwner={user?.role === "owner"}
                  isActive={pathname === "/"}
                  onNavigateHome={() => router.push("/")}
                />
              </div>
              <button
                type="button"
                onClick={toggleCollapseAll}
                title={allSectionsCollapsed ? "Expand all sections" : "Collapse all sections"}
                aria-label={allSectionsCollapsed ? "Expand all sections" : "Collapse all sections"}
                className="shrink-0 grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground group-data-[collapsible=icon]:hidden"
              >
                {allSectionsCollapsed ? (
                  <ChevronsUpDown className="size-4" />
                ) : (
                  <ChevronsDownUp className="size-4" />
                )}
              </button>
            </div>
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
              <span>{t("sidebar.people")}</span>
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
                <span>{t("sidebar.admin")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <NotificationsButton
              active={pathname === "/notifications"}
              onClick={() => router.push("/notifications")}
              enabled={preferences.notificationBadgeEnabled !== false}
            />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname === "/trash"}
              onClick={() => router.push("/trash")}
              tooltip="Trash & Archive"
            >
              <Trash2 className="size-4" />
              <span>{t("sidebar.trash")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname === "/settings"}
              onClick={() => router.push("/settings")}
              tooltip="Settings"
            >
              <Settings className="size-4" />
              <span>{t("sidebar.settings")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-0.5">
                <ThemeToggle />
                <LanguageToggle />
                <button
                  onClick={() => router.push("/settings#guides")}
                  className="p-1.5 rounded-md hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-colors"
                  title="Help & guides"
                  aria-label="Help & guides"
                >
                  <HelpCircle className="size-4" />
                </button>
              </div>
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
      <SidebarResizer />

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
