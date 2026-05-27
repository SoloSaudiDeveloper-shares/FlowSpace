"use client"

import { useState } from "react"
import {
  Bell,
  BellOff,
  CheckCheck,
  Trash2,
  Clock,
  AlertCircle,
  Info,
  Trophy,
  AtSign,
  UserPlus,
  ShieldCheck,
  MessageSquareReply,
  Lock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
} from "@/lib/actions/notification-actions"
import type { Notification, Element } from "@/lib/db/schema"

const TYPE_CONFIG: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; tab: string }
> = {
  reminder_due: { icon: Clock, color: "text-amber-500", tab: "tasks" },
  task_overdue: { icon: AlertCircle, color: "text-red-500", tab: "tasks" },
  task_due_soon: { icon: Clock, color: "text-orange-500", tab: "tasks" },
  project_milestone: { icon: Trophy, color: "text-green-500", tab: "tasks" },
  system: { icon: Info, color: "text-blue-500", tab: "system" },
  mention: { icon: AtSign, color: "text-violet-500", tab: "mentions" },
  assignment: { icon: UserPlus, color: "text-cyan-500", tab: "tasks" },
  approval_request: { icon: ShieldCheck, color: "text-emerald-500", tab: "approvals" },
  comment_reply: { icon: MessageSquareReply, color: "text-sky-500", tab: "mentions" },
  permission_change: { icon: Lock, color: "text-rose-500", tab: "system" },
}

interface NotificationListProps {
  notifications: Array<{
    notification: Notification
    element: Element | null
  }>
}

const TABS = [
  { id: "all", label: "All" },
  { id: "mentions", label: "Mentions" },
  { id: "tasks", label: "Tasks" },
  { id: "system", label: "System" },
  { id: "approvals", label: "Approvals" },
] as const

type TabId = (typeof TABS)[number]["id"]

export function NotificationList({ notifications }: NotificationListProps) {
  const [filter, setFilter] = useState<"all" | "unread">("all")
  const [activeTab, setActiveTab] = useState<TabId>("all")

  const tabFiltered =
    activeTab === "all"
      ? notifications
      : notifications.filter((n) => {
          const config = TYPE_CONFIG[n.notification.type]
          return config?.tab === activeTab
        })

  const filtered =
    filter === "unread"
      ? tabFiltered.filter((n) => !n.notification.isRead)
      : tabFiltered

  const unreadCount = notifications.filter(
    (n) => !n.notification.isRead
  ).length

  async function handleMarkAsRead(id: string) {
    await markAsRead(id)
  }

  async function handleMarkAllRead() {
    await markAllAsRead()
    toast.success("All notifications marked as read")
  }

  async function handleDelete(id: string) {
    await deleteNotification(id)
    toast.success("Notification deleted")
  }

  async function handleClearAll() {
    await clearAllNotifications()
    toast.success("Cleared read notifications")
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-4 p-1 bg-muted/50 rounded-lg w-fit">
        {TABS.map((tab) => {
          const count = tab.id === "all"
            ? notifications.filter((n) => !n.notification.isRead).length
            : notifications.filter((n) => {
                const cfg = TYPE_CONFIG[n.notification.type]
                return cfg?.tab === tab.id && !n.notification.isRead
              }).length
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className="bg-primary/10 text-primary text-[10px] rounded-full px-1.5 min-w-[18px] text-center">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Header actions */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === "all"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === "unread"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
          >
            Unread
            {unreadCount > 0 && (
              <Badge
                variant="secondary"
                className="text-xs px-1.5 py-0 h-5"
              >
                {unreadCount}
              </Badge>
            )}
          </button>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
              <CheckCheck className="size-3.5 mr-1.5" />
              Mark all read
            </Button>
          )}
          {notifications.some((n) => n.notification.isRead) && (
            <Button variant="outline" size="sm" onClick={handleClearAll}>
              <Trash2 className="size-3.5 mr-1.5" />
              Clear read
            </Button>
          )}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <BellOff className="size-12 mb-3 opacity-30" />
          <p className="text-sm">
            {filter === "unread"
              ? "No unread notifications"
              : "No notifications yet"}
          </p>
          <p className="text-xs mt-1">
            Notifications for reminders and tasks will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(({ notification: n, element }) => {
            const config = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.system
            const Icon = config.icon
            return (
              <div
                key={n.id}
                className={`stagger-item flex items-start gap-3 px-4 py-3 rounded-lg border transition-colors ${
                  n.isRead
                    ? "bg-card opacity-60"
                    : "bg-card border-primary/20"
                }`}
              >
                <div className={`shrink-0 mt-0.5 ${config.color}`}>
                  <Icon className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm ${
                      n.isRead ? "" : "font-medium"
                    } truncate`}
                  >
                    {n.title}
                  </p>
                  {n.message && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {n.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(n.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {!n.isRead && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => handleMarkAsRead(n.id)}
                    >
                      <CheckCheck className="size-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(n.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
