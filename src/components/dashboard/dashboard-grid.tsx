"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Plus,
  X,
  Clock,
  Star,
  FolderKanban,
  FileText,
  Layout,
  ListTodo,
  Bell,
  GitBranch,
  Pencil,
  MoreHorizontal,
  Trash2,
  CheckSquare,
  AlertCircle,
  Activity,
  ArrowUpRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
  createDashboardWidget,
  deleteDashboardWidget,
} from "@/lib/actions/dashboard-actions"
import {
  createElement,
  toggleFavorite,
} from "@/lib/actions/element-actions"
import type { Element, ElementType, Task } from "@/lib/db/schema"
import type { dashboardWidgets, reminders as remindersSchema, activityLog as activityLogSchema } from "@/lib/db/schema"
import { ContextMenu, useContextMenu, type ContextMenuEntry } from "@/components/shared/context-menu"
import { SpeechButton } from "@/components/shared/speech-button"
import { useT } from "@/lib/hooks/use-i18n"

type Widget = typeof dashboardWidgets.$inferSelect

const TYPE_ICONS: Record<ElementType, React.ComponentType<{ className?: string }>> = {
  project: FolderKanban,
  page: FileText,
  canvas: Layout,
  todo_list: ListTodo,
  reminder: Bell,
  process: GitBranch,
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

function formatDate(dateStr: string, t: (key: string) => string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (hours < 1) return t("dash.justNow")
  if (hours < 24) return t("dash.hoursAgo").replace("{n}", String(hours))
  if (days < 7) return t("dash.daysAgo").replace("{n}", String(days))
  return date.toLocaleDateString()
}

// ─── Widget Components ──────────────────────────────────────────────────

function RecentWidget({ elements }: { elements: Element[] }) {
  const router = useRouter()
  const { t } = useT()
  return (
    <div className="space-y-1">
      {elements.slice(0, 8).map((el) => {
        const Icon = TYPE_ICONS[el.type]
        return (
          <div
            key={el.id}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent cursor-pointer text-sm"
            onClick={() => router.push(getElementHref(el))}
          >
            <Icon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate flex-1">{el.title}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              {formatDate(el.updatedAt, t)}
            </span>
          </div>
        )
      })}
      {elements.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">{t("dash.noRecent")}</p>
      )}
    </div>
  )
}

function FavoritesWidget({ elements }: { elements: Element[] }) {
  const router = useRouter()
  const { t } = useT()
  return (
    <div className="space-y-1">
      {elements.map((el) => {
        const Icon = TYPE_ICONS[el.type]
        return (
          <div
            key={el.id}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent cursor-pointer text-sm"
            onClick={() => router.push(getElementHref(el))}
          >
            <Icon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{el.title}</span>
          </div>
        )
      })}
      {elements.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">{t("dash.noFavorites")}</p>
      )}
    </div>
  )
}

function QuickCaptureWidget() {
  const [title, setTitle] = useState("")
  const [type, setType] = useState<ElementType>("todo_list")
  const [creating, setCreating] = useState(false)
  const router = useRouter()
  const { t } = useT()

  const TYPE_LABEL_KEYS: Record<string, string> = {
    todo_list: "dash.type.todoList",
    page: "dash.type.page",
    project: "dash.type.project",
    canvas: "dash.type.canvas",
  }

  async function handleCreate() {
    if (!title.trim() || creating) return
    setCreating(true)
    try {
      const result = await createElement(type, title.trim())
      setTitle("")
      router.push(getElementHref({ id: result.id, type: result.type } as Element))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="relative flex items-center gap-2">
        <Input
          placeholder={t("dash.capturePlaceholder")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreate() }}
          className="pr-20"
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          <SpeechButton
            onTranscript={(text) => setTitle((prev) => prev ? `${prev} ${text}` : text)}
            size="sm"
            showPulse
            tooltip={t("dash.speakToCapture")}
          />
          {title.trim() && (
            <Button
              variant="ghost"
              size="sm"
              className="size-7 p-0 rounded-full"
              disabled={creating}
              onClick={handleCreate}
            >
              <ArrowUpRight className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex gap-1 flex-wrap">
        {(["todo_list", "page", "project", "canvas"] as ElementType[]).map((et) => {
          const Icon = TYPE_ICONS[et]
          return (
            <Button
              key={et}
              variant={type === et ? "secondary" : "ghost"}
              size="sm"
              className="text-xs gap-1 h-7"
              onClick={() => setType(et)}
            >
              <Icon className="size-3" />
              {t(TYPE_LABEL_KEYS[et])}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

// ─── My Tasks Widget ─────────────────────────────────────────────────────

type TaskWithProject = { task: Task; project: Element }

import { PRIORITY_TEXT_CLASS as PRIORITY_COLORS } from "@/lib/priority"

function MyTasksWidget({ tasks: taskList }: { tasks: TaskWithProject[] }) {
  const router = useRouter()
  const { t } = useT()
  return (
    <div className="space-y-1">
      {taskList.slice(0, 8).map(({ task, project }) => (
        <div
          key={task.id}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent cursor-pointer text-sm"
          onClick={() => router.push(`/projects/${task.projectId}`)}
        >
          <CheckSquare className={`size-3.5 shrink-0 ${PRIORITY_COLORS[task.priority] || "text-muted-foreground"}`} />
          <span className="truncate flex-1">{task.title}</span>
          {task.dueDate && (
            <span className={`text-[11px] shrink-0 ${
              new Date(task.dueDate) < new Date() ? "text-red-500" : "text-muted-foreground"
            }`}>
              {new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
      ))}
      {taskList.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">{t("dash.noOpenTasks")}</p>
      )}
    </div>
  )
}

// ─── Reminders Widget ────────────────────────────────────────────────────

type ReminderWithElement = {
  reminder: typeof remindersSchema.$inferSelect
  element: Element
}

function RemindersWidget({ reminders }: { reminders: ReminderWithElement[] }) {
  const router = useRouter()
  const { t } = useT()
  const now = new Date()
  return (
    <div className="space-y-1">
      {reminders.slice(0, 6).map(({ reminder, element }) => {
        const due = new Date(reminder.remindAt)
        const isPast = due < now
        return (
          <div
            key={reminder.id}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent cursor-pointer text-sm"
            onClick={() => router.push("/reminders")}
          >
            <Bell className={`size-3.5 shrink-0 ${isPast ? "text-red-500" : "text-amber-500"}`} />
            <span className="truncate flex-1">{element.title}</span>
            <span className={`text-[11px] shrink-0 ${isPast ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
              {due.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        )
      })}
      {reminders.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">{t("dash.noReminders")}</p>
      )}
    </div>
  )
}

// ─── Activity Feed Widget ────────────────────────────────────────────────

type ActivityWithElement = {
  activity: typeof activityLogSchema.$inferSelect
  element: Element
}

const ACTION_LABEL_KEYS: Record<string, string> = {
  created: "dash.action.created",
  updated: "dash.action.updated",
  deleted: "dash.action.deleted",
  completed: "dash.action.completed",
  reopened: "dash.action.reopened",
  status_changed: "dash.action.statusChanged",
  priority_changed: "dash.action.priorityChanged",
  assigned_user: "dash.action.assignedUser",
  added_comment: "dash.action.addedComment",
  approval_requested: "dash.action.approvalRequested",
  approval_resolved: "dash.action.approvalResolved",
}

function ActivityFeedWidget({ activities }: { activities: ActivityWithElement[] }) {
  const router = useRouter()
  const { t } = useT()
  return (
    <div className="space-y-1">
      {activities.slice(0, 8).map(({ activity, element }) => (
        <div
          key={activity.id}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent cursor-pointer text-sm"
          onClick={() => router.push(getElementHref(element))}
        >
          <Activity className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate flex-1">
            <span className="text-muted-foreground">{ACTION_LABEL_KEYS[activity.action] ? t(ACTION_LABEL_KEYS[activity.action]) : activity.action}</span>
            {" "}
            {element.title}
          </span>
          <span className="text-[11px] text-muted-foreground shrink-0">
            {formatDate(activity.createdAt, t)}
          </span>
        </div>
      ))}
      {activities.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">{t("dash.noActivity")}</p>
      )}
    </div>
  )
}

// ─── Dashboard Grid ─────────────────────────────────────────────────────

interface DashboardGridProps {
  widgets: Widget[]
  recentElements: Element[]
  favorites: Element[]
  myTasks?: TaskWithProject[]
  upcomingReminders?: ReminderWithElement[]
  recentActivity?: ActivityWithElement[]
}

export function DashboardGrid({
  widgets,
  recentElements,
  favorites,
  myTasks = [],
  upcomingReminders = [],
  recentActivity = [],
}: DashboardGridProps) {
  const [addOpen, setAddOpen] = useState(false)
  const { menu: ctxMenu, open: openCtx, close: closeCtx } = useContextMenu()
  const { t } = useT()

  function handleWidgetContextMenu(e: React.MouseEvent, widget: Widget) {
    const items: ContextMenuEntry[] = [
      {
        label: t("dash.removeWidget"),
        icon: X,
        variant: "destructive",
        onClick: () => deleteDashboardWidget(widget.id),
      },
    ]
    openCtx(e, items)
  }

  function renderWidget(widget: Widget) {
    switch (widget.widgetType) {
      case "recent_elements":
        return <RecentWidget elements={recentElements} />
      case "favorites":
        return <FavoritesWidget elements={favorites} />
      case "quick_capture":
        return <QuickCaptureWidget />
      case "my_tasks":
        return <MyTasksWidget tasks={myTasks} />
      case "reminders":
        return <RemindersWidget reminders={upcomingReminders} />
      case "activity_feed":
        return <ActivityFeedWidget activities={recentActivity} />
      default:
        return <p className="text-xs text-muted-foreground">Widget: {widget.widgetType}</p>
    }
  }

  const WIDGET_OPTIONS = [
    { type: "recent_elements" as const, label: "Recent Elements", labelKey: "dash.widget.recentElements", icon: Clock, w: 2, h: 2 },
    { type: "favorites" as const, label: "Favorites", labelKey: "dash.widget.favorites", icon: Star, w: 1, h: 2 },
    { type: "quick_capture" as const, label: "Quick Capture", labelKey: "dash.widget.quickCapture", icon: Pencil, w: 1, h: 1 },
    { type: "my_tasks" as const, label: "My Tasks", labelKey: "dash.widget.myTasks", icon: CheckSquare, w: 2, h: 2 },
    { type: "reminders" as const, label: "Upcoming Reminders", labelKey: "dash.widget.reminders", icon: Bell, w: 1, h: 2 },
    { type: "activity_feed" as const, label: "Activity Feed", labelKey: "dash.widget.activityFeed", icon: Activity, w: 2, h: 2 },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {widgets.map((widget) => (
          <div
            key={widget.id}
            className="rounded-lg border bg-card p-4 relative group"
            style={{
              gridColumn: `span ${Math.min(widget.width, 4)}`,
              gridRow: `span ${widget.height}`,
            }}
            onContextMenu={(e) => handleWidgetContextMenu(e, widget)}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">{widget.title}</h3>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 opacity-0 group-hover:opacity-100"
                onClick={() => deleteDashboardWidget(widget.id)}
              >
                <X className="size-3" />
              </Button>
            </div>
            {renderWidget(widget)}
          </div>
        ))}

        {/* Add widget button */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger className="rounded-lg border border-dashed p-4 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors min-h-[120px]">
            <Plus className="size-6" />
            <span className="text-sm">{t("dash.addWidget")}</span>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{t("dash.addWidget")}</DialogTitle>
              <DialogDescription>{t("dash.addWidgetDesc")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {WIDGET_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  className="flex items-center gap-3 w-full rounded-md p-3 hover:bg-accent text-left"
                  onClick={async () => {
                    const existing = widgets.length
                    await createDashboardWidget({
                      widgetType: opt.type,
                      title: opt.label,
                      positionX: existing % 4,
                      positionY: Math.floor(existing / 4),
                      width: opt.w,
                      height: opt.h,
                    })
                    setAddOpen(false)
                  }}
                >
                  <div className="size-8 rounded-md bg-muted flex items-center justify-center">
                    <opt.icon className="size-4" />
                  </div>
                  <span className="text-sm font-medium">{t(opt.labelKey)}</span>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxMenu.items}
          onClose={closeCtx}
        />
      )}
    </div>
  )
}
