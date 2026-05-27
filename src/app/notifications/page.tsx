import { getNotifications, generateNotifications } from "@/lib/actions/notification-actions"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Bell } from "lucide-react"
import { NotificationList } from "@/components/notifications/notification-list"

export default async function NotificationsPage() {
  // Generate any new notifications from due reminders/tasks
  await generateNotifications()

  const notificationsData = await getNotifications()

  return (
    <div className="flex flex-col h-screen">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Bell className="size-4 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Notifications</h1>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-2xl animate-page-enter">
          <NotificationList
            notifications={notificationsData}
          />
        </div>
      </div>
    </div>
  )
}
