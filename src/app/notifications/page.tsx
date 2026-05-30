import { getNotifications, generateNotifications } from "@/lib/actions/notification-actions"
import { listPendingInboundEmails } from "@/lib/actions/inbound-email-actions"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Bell } from "lucide-react"
import { NotificationList } from "@/components/notifications/notification-list"
import { PendingEmailsSection } from "@/components/notifications/pending-emails-section"
import { PageTitle } from "@/components/layout/page-title"

export default async function NotificationsPage() {
  // Generate any new notifications from due reminders/tasks
  await generateNotifications()

  const [notificationsData, pendingEmails] = await Promise.all([
    getNotifications(),
    listPendingInboundEmails().catch(() => []),
  ])

  return (
    <div className="flex flex-col h-screen">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Bell className="size-4 text-muted-foreground" />
        <PageTitle titleKey="page.notifications" fallback="Notifications" />
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-2xl animate-page-enter">
          <PendingEmailsSection emails={pendingEmails} />
          <NotificationList
            notifications={notificationsData}
          />
        </div>
      </div>
    </div>
  )
}
