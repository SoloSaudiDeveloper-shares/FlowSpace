"use client"

import { useState, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Activity,
  Archive,
  Clock,
  Database,
  HardDrive,
  Loader2,
  MonitorCheck,
  Plus,
  RefreshCw,
  Server,
  Shield,
  Trash2,
  Upload,
  User,
  Users,
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  Zap,
  LogIn,
  LogOut,
  UserPlus,
  Lock,
  Bot,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { createBackup, deleteBackup, restoreBackup } from "@/lib/actions/backup-actions"
import { updateUser, deleteUser } from "@/lib/actions/user-actions"
import { getTelegramFeatureEnabled, setTelegramFeatureEnabled } from "@/lib/actions/telegram-actions"

// ─── Helpers ────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0) parts.push(`${h}h`)
  parts.push(`${m}m`)
  return parts.join(" ")
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)

  if (diffSec < 60) return "just now"
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? "" : "s"} ago`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`
  const diffMonth = Math.floor(diffDay / 30)
  return `${diffMonth} month${diffMonth === 1 ? "" : "s"} ago`
}

// ─── Types ──────────────────────────────────────────────────────────────

interface AdminContentProps {
  health: any
  dbStats: any
  events: any[]
  storage: any
  sessionCount: number
  users: any[]
  backups: any[]
}

const TABS = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "users", label: "Users", icon: Users },
  { id: "backups", label: "Backups", icon: Archive },
  { id: "events", label: "Events", icon: Zap },
  { id: "database", label: "Database", icon: Database },
  { id: "integrations", label: "Integrations", icon: Bot },
] as const

type TabId = (typeof TABS)[number]["id"]

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  admin: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  editor: "bg-green-500/15 text-green-400 border-green-500/30",
  commenter: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  viewer: "bg-gray-500/15 text-gray-400 border-gray-500/30",
}

const EVENT_ICONS: Record<string, typeof Activity> = {
  server_start: MonitorCheck,
  server_stop: XCircle,
  backup_completed: CheckCircle2,
  backup_failed: XCircle,
  user_login: LogIn,
  user_logout: LogOut,
  user_created: UserPlus,
  permission_changed: Lock,
  error: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
}

// ─── Component ──────────────────────────────────────────────────────────

export function AdminContent({
  health,
  dbStats,
  events,
  storage,
  sessionCount,
  users,
  backups,
}: AdminContentProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview")
  const [isPending, startTransition] = useTransition()
  const [searchQuery, setSearchQuery] = useState("")
  const router = useRouter()

  // Per-tab fuzzy filter source. Each tab's content reads searchQuery
  // and decides what to hide; the search box itself just stores the
  // string and shows a clear-button when there's text.
  const q = searchQuery.trim().toLowerCase()
  const isSearching = q.length > 0

  // ─── Backup Actions ───────────────────────────────────────────

  async function handleCreateBackup() {
    startTransition(async () => {
      const result = await createBackup({ name: `Manual Backup ${new Date().toLocaleDateString()}` })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Backup created successfully")
        router.refresh()
      }
    })
  }

  async function handleDeleteBackup(id: string, name: string) {
    if (!confirm(`Delete backup "${name}"? This cannot be undone.`)) return
    startTransition(async () => {
      await deleteBackup(id)
      toast.success("Backup deleted")
      router.refresh()
    })
  }

  async function handleRestoreBackup(id: string, name: string) {
    if (!confirm(`Restore backup "${name}"? This will replace all current data. A safety backup will be created first.`)) return
    startTransition(async () => {
      const result = await restoreBackup(id)
      if (result.success) {
        toast.success("Backup restored successfully")
        router.refresh()
      } else {
        toast.error(result.error ?? "Restore failed")
      }
    })
  }

  // ─── User Actions ─────────────────────────────────────────────

  async function handleToggleUserActive(id: string, currentlyActive: boolean) {
    startTransition(async () => {
      if (currentlyActive) {
        await deleteUser(id)
        toast.success("User deactivated")
      } else {
        await updateUser(id, { isActive: true })
        toast.success("User reactivated")
      }
      router.refresh()
    })
  }

  // ─── Storage Percentage ───────────────────────────────────────

  const totalStorage = storage.total || 1
  const dbPercent = Math.round((storage.database.size / totalStorage) * 100)
  const uploadsPercent = Math.round((storage.uploads.size / totalStorage) * 100)
  const backupsPercent = Math.round((storage.backups.size / totalStorage) * 100)

  return (
    <div className="space-y-6 animate-page-enter">
      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b pb-px">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-md transition-colors border-b-2 -mb-px ${
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              }`}
            >
              <Icon className="size-3.5" />
              {tab.label}
            </button>
          )
        })}
        <div className="ml-auto flex items-center gap-2 pb-1">
          <div className="relative">
            <svg
              className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              placeholder="Search this tab…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 w-44 sm:w-56 rounded-md border border-input bg-background pl-7 pr-2 text-xs placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {isPending && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Updating…
            </div>
          )}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <OverviewTab
          health={health}
          sessionCount={sessionCount}
          storage={storage}
          totalStorage={totalStorage}
          dbPercent={dbPercent}
          uploadsPercent={uploadsPercent}
          backupsPercent={backupsPercent}
        />
      )}
      {activeTab === "users" && (
        <UsersTab
          users={
            isSearching
              ? users.filter((u: any) =>
                  [u.username, u.displayName, u.email, u.role]
                    .filter(Boolean)
                    .some((v: string) => v.toLowerCase().includes(q)),
                )
              : users
          }
          onToggleActive={handleToggleUserActive}
          isPending={isPending}
        />
      )}
      {activeTab === "backups" && (
        <BackupsTab
          backups={
            isSearching
              ? backups.filter((b: any) =>
                  [b.name, b.description, b.kind]
                    .filter(Boolean)
                    .some((v: string) => v.toLowerCase().includes(q)),
                )
              : backups
          }
          onCreateBackup={handleCreateBackup}
          onDeleteBackup={handleDeleteBackup}
          onRestoreBackup={handleRestoreBackup}
          isPending={isPending}
        />
      )}
      {activeTab === "events" && (
        <EventsTab
          events={
            isSearching
              ? events.filter((e: any) =>
                  [e.event_type, e.eventType, e.details, e.message, e.username, e.user]
                    .filter(Boolean)
                    .some((v: string) => String(v).toLowerCase().includes(q)),
                )
              : events
          }
        />
      )}
      {activeTab === "database" && <DatabaseTab dbStats={dbStats} />}
      {activeTab === "integrations" && <IntegrationsTab />}
    </div>
  )
}

// ─── Integrations Tab (admin enable/disable for each integration) ──────
// Currently: Telegram bot feature flag. Adding more (Slack webhook, etc.)
// is a matter of dropping in another `IntegrationCard`.

function IntegrationsTab() {
  const [telegram, setTelegram] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getTelegramFeatureEnabled().then(setTelegram).catch(() => setTelegram(false))
  }, [])

  async function toggleTelegram() {
    if (telegram === null) return
    setSaving(true)
    try {
      await setTelegramFeatureEnabled(!telegram)
      setTelegram(!telegram)
      toast.success(!telegram ? "Telegram enabled workspace-wide" : "Telegram disabled")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update setting")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="px-4 py-4 rounded-lg border bg-card flex items-start gap-3">
        <div className="size-9 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
          <Bot className="size-4" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium flex items-center gap-1.5">
            Telegram bots
            {telegram && (
              <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">on</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            When on, each user can connect their own Telegram bot from
            Settings → Telegram. Per-user — no sharing between accounts.
            Inbound webhook traffic is routed via a per-user secret in the URL.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={telegram ?? false}
          onClick={toggleTelegram}
          disabled={telegram === null || saving}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
            telegram ? "bg-primary" : "bg-muted-foreground/30"
          }`}
        >
          <span
            className={`inline-block size-4 transform rounded-full bg-white shadow-sm transition-transform ${
              telegram ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  )
}

// ─── Overview Tab ───────────────────────────────────────────────────────

function OverviewTab({
  health,
  sessionCount,
  storage,
  totalStorage,
  dbPercent,
  uploadsPercent,
  backupsPercent,
}: {
  health: any
  sessionCount: number
  storage: any
  totalStorage: number
  dbPercent: number
  uploadsPercent: number
  backupsPercent: number
}) {
  const memUsed = health.memoryUsage.heapUsed
  const memTotal = health.memoryUsage.heapTotal

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Server Status</span>
            <Server className="size-4 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-2">
            <div className="size-2.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-lg font-semibold">Healthy</span>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active Sessions</span>
            <Users className="size-4 text-muted-foreground" />
          </div>
          <span className="text-lg font-semibold">{sessionCount}</span>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Database Size</span>
            <Database className="size-4 text-muted-foreground" />
          </div>
          <span className="text-lg font-semibold">{formatBytes(health.dbSize)}</span>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Storage Used</span>
            <HardDrive className="size-4 text-muted-foreground" />
          </div>
          <span className="text-lg font-semibold">{formatBytes(totalStorage)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Server Health */}
        <div className="bg-card border rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <MonitorCheck className="size-4 text-primary" />
            Server Health
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-1.5 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Uptime</span>
              <span className="text-sm font-medium">{formatUptime(health.uptime)}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Platform</span>
              <span className="text-sm font-medium">{health.platform}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Node Version</span>
              <span className="text-sm font-medium font-mono">{health.nodeVersion}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Heap Used</span>
              <span className="text-sm font-medium">{formatBytes(memUsed)}</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-muted-foreground">Heap Total</span>
              <span className="text-sm font-medium">{formatBytes(memTotal)}</span>
            </div>
            {/* Memory bar */}
            <div className="pt-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Memory Usage</span>
                <span className="text-xs text-muted-foreground">
                  {Math.round((memUsed / memTotal) * 100)}%
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.round((memUsed / memTotal) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Storage Breakdown */}
        <div className="bg-card border rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <HardDrive className="size-4 text-primary" />
            Storage Breakdown
          </h3>
          <div className="space-y-4">
            {/* Database */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Database className="size-3.5 text-blue-400" />
                  <span className="text-sm font-medium">Database</span>
                </div>
                <span className="text-xs text-muted-foreground">{formatBytes(storage.database.size)}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${Math.max(dbPercent, 1)}%` }}
                />
              </div>
            </div>

            {/* Uploads */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Upload className="size-3.5 text-green-400" />
                  <span className="text-sm font-medium">Uploads</span>
                  <span className="text-xs text-muted-foreground">({storage.uploads.fileCount} files)</span>
                </div>
                <span className="text-xs text-muted-foreground">{formatBytes(storage.uploads.size)}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${Math.max(uploadsPercent, 1)}%` }}
                />
              </div>
            </div>

            {/* Backups */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Archive className="size-3.5 text-amber-400" />
                  <span className="text-sm font-medium">Backups</span>
                  <span className="text-xs text-muted-foreground">({storage.backups.fileCount} files)</span>
                </div>
                <span className="text-xs text-muted-foreground">{formatBytes(storage.backups.size)}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all"
                  style={{ width: `${Math.max(backupsPercent, 1)}%` }}
                />
              </div>
            </div>

            {/* Total */}
            <div className="pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total</span>
                <span className="text-sm font-semibold">{formatBytes(totalStorage)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Users Tab ──────────────────────────────────────────────────────────

function UsersTab({
  users,
  onToggleActive,
  isPending,
}: {
  users: any[]
  onToggleActive: (id: string, isActive: boolean) => void
  isPending: boolean
}) {
  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left font-medium text-muted-foreground px-4 py-3">User</th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">Username</th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">Email</th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">Role</th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">Status</th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">Last Active</th>
              <th className="text-right font-medium text-muted-foreground px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="size-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                        {(user.displayName || user.username || "?")[0].toUpperCase()}
                      </div>
                      <span className="font-medium truncate max-w-[150px]">{user.displayName || user.username}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{user.username}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{user.email || "--"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                        ROLE_COLORS[user.role] ?? ROLE_COLORS.viewer
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {user.isActive ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-400">
                        <span className="size-1.5 rounded-full bg-green-500" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="size-1.5 rounded-full bg-muted-foreground/50" />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {user.lastActiveAt ? formatRelativeTime(user.lastActiveAt) : "Never"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {user.role !== "owner" && (
                      <Button
                        variant="ghost"
                        size="xs"
                        disabled={isPending}
                        onClick={() => onToggleActive(user.id, user.isActive)}
                        className="text-xs"
                      >
                        {user.isActive ? "Deactivate" : "Reactivate"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Backups Tab ────────────────────────────────────────────────────────

function BackupsTab({
  backups,
  onCreateBackup,
  onDeleteBackup,
  onRestoreBackup,
  isPending,
}: {
  backups: any[]
  onCreateBackup: () => void
  onDeleteBackup: (id: string, name: string) => void
  onRestoreBackup: (id: string, name: string) => void
  isPending: boolean
}) {
  const STATUS_STYLES: Record<string, string> = {
    completed: "bg-green-500/15 text-green-400 border-green-500/30",
    in_progress: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    failed: "bg-red-500/15 text-red-400 border-red-500/30",
  }

  const TYPE_STYLES: Record<string, string> = {
    full: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    selective: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
    scheduled: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Backups</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {backups.length} backup{backups.length !== 1 ? "s" : ""} stored
          </p>
        </div>
        <Button size="sm" onClick={onCreateBackup} disabled={isPending}>
          {isPending ? (
            <Loader2 className="size-3.5 mr-1.5 animate-spin" />
          ) : (
            <Plus className="size-3.5 mr-1.5" />
          )}
          Create Backup
        </Button>
      </div>

      {backups.length === 0 ? (
        <div className="bg-card border rounded-lg px-4 py-8 text-center text-muted-foreground text-sm">
          No backups yet. Create your first backup to protect your data.
        </div>
      ) : (
        <div className="space-y-2">
          {backups.map((backup) => (
            <div
              key={backup.id}
              className="bg-card border rounded-lg px-4 py-3 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Archive className="size-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{backup.name}</span>
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${
                        STATUS_STYLES[backup.status] ?? STATUS_STYLES.completed
                      }`}
                    >
                      {backup.status === "in_progress" ? "In Progress" : backup.status}
                    </span>
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${
                        TYPE_STYLES[backup.type] ?? TYPE_STYLES.full
                      }`}
                    >
                      {backup.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {backup.startedAt ? formatRelativeTime(backup.startedAt) : "--"}
                    </span>
                    {backup.fileSize != null && (
                      <span className="text-xs text-muted-foreground">
                        {formatBytes(backup.fileSize)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="outline"
                  size="xs"
                  disabled={isPending || backup.status !== "completed"}
                  onClick={() => onRestoreBackup(backup.id, backup.name)}
                >
                  <RefreshCw className="size-3 mr-1" />
                  Restore
                </Button>
                <Button
                  variant="destructive"
                  size="xs"
                  disabled={isPending}
                  onClick={() => onDeleteBackup(backup.id, backup.name)}
                >
                  <Trash2 className="size-3 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Events Tab ─────────────────────────────────────────────────────────

function EventsTab({ events }: { events: any[] }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Recent Events</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Last {events.length} server events
        </p>
      </div>

      {/* Explainer panel — events are opaque without context */}
      <div className="px-4 py-3 rounded-lg border border-primary/30 bg-primary/5">
        <p className="text-xs font-medium uppercase tracking-wider text-primary mb-2 flex items-center gap-1.5">
          <Info className="size-3" />
          What are server events?
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed mb-2">
          The audit log of everything important the server did. Each entry
          records WHEN something happened, WHAT happened, and WHO triggered
          it. Use this to debug issues, spot suspicious activity, or
          confirm a deploy succeeded.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground mt-2">
          <div><strong className="text-foreground/80">server_start / server_stop</strong> — container booted or shut down. After every deploy you should see a fresh start.</div>
          <div><strong className="text-foreground/80">backup_completed / backup_failed</strong> — scheduled backups firing on schedule. Red = investigate.</div>
          <div><strong className="text-foreground/80">user_login / user_logout</strong> — session activity. Useful for security review.</div>
          <div><strong className="text-foreground/80">user_created</strong> — new account signed up. Cross-check the Users tab.</div>
          <div><strong className="text-foreground/80">permission_changed</strong> — admin or role flips. High-impact action.</div>
          <div><strong className="text-foreground/80">error / warning</strong> — server-side errors logged for investigation.</div>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="bg-card border rounded-lg px-4 py-8 text-center text-muted-foreground text-sm">
          No events recorded yet.
        </div>
      ) : (
        <div className="bg-card border rounded-lg divide-y divide-border/50 max-h-[600px] overflow-y-auto">
          {events.map((event) => {
            const Icon = EVENT_ICONS[event.type] ?? Activity
            const isError = event.type === "error" || event.type === "backup_failed"
            const isWarning = event.type === "warning"

            return (
              <div key={event.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                <div
                  className={`mt-0.5 size-7 rounded-full flex items-center justify-center shrink-0 ${
                    isError
                      ? "bg-red-500/15 text-red-400"
                      : isWarning
                        ? "bg-amber-500/15 text-amber-400"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="size-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{event.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {event.createdAt ? formatRelativeTime(event.createdAt) : ""}
                    </span>
                  </div>
                  {event.message && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{event.message}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Database Tab ───────────────────────────────────────────────────────

function DatabaseTab({ dbStats }: { dbStats: any }) {
  const sortedTables = [...(dbStats.tables || [])].sort(
    (a: any, b: any) => b.rowCount - a.rowCount
  )
  const totalRows = sortedTables.reduce((sum: number, t: any) => sum + t.rowCount, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Database Tables</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {sortedTables.length} tables, {totalRows.toLocaleString()} total rows
          </p>
        </div>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left font-medium text-muted-foreground px-4 py-3">Table Name</th>
              <th className="text-right font-medium text-muted-foreground px-4 py-3">Row Count</th>
              <th className="text-right font-medium text-muted-foreground px-4 py-3">% of Total</th>
            </tr>
          </thead>
          <tbody>
            {sortedTables.map((table: any) => {
              const pct = totalRows > 0 ? (table.rowCount / totalRows) * 100 : 0
              return (
                <tr key={table.name} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs">{table.name}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs">
                    {table.rowCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${Math.max(pct, 0.5)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-10 text-right">
                        {pct < 1 && pct > 0 ? "<1" : Math.round(pct)}%
                      </span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
