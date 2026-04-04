import { getAllReminders } from "@/lib/actions/reminder-actions"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Bell } from "lucide-react"
import { RemindersList } from "@/components/reminders/reminders-list"

export default async function RemindersPage() {
  const remindersData = await getAllReminders()

  return (
    <div className="flex flex-col h-full">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Bell className="size-4" />
        <h1 className="text-lg font-semibold">Reminders</h1>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-2xl">
          <RemindersList reminders={remindersData} />
        </div>
      </div>
    </div>
  )
}
