import { getServerHealth, getDatabaseStats, getRecentServerEvents, getStorageBreakdown, getActiveSessionCount } from "@/lib/actions/admin-actions"
import { getUsers } from "@/lib/actions/user-actions"
import { getBackups } from "@/lib/actions/backup-actions"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Shield } from "lucide-react"
import { AdminContent } from "@/components/admin/admin-content"

export default async function AdminPage() {
  const [health, dbStats, events, storage, sessionCount, users, backups] = await Promise.all([
    getServerHealth(),
    getDatabaseStats(),
    getRecentServerEvents(20),
    getStorageBreakdown(),
    getActiveSessionCount(),
    getUsers(),
    getBackups(),
  ])

  return (
    <div className="flex flex-col h-screen">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Shield className="size-4 text-primary" />
        <h1 className="text-sm font-semibold">Administration</h1>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <AdminContent
          health={health}
          dbStats={dbStats}
          events={events}
          storage={storage}
          sessionCount={sessionCount}
          users={users}
          backups={backups}
        />
      </div>
    </div>
  )
}
