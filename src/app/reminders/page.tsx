import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Bell } from "lucide-react"

export default function RemindersPage() {
  return (
    <div className="flex flex-col h-full">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Bell className="size-4" />
        <h1 className="text-lg font-semibold">Reminders</h1>
      </header>
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Bell className="mx-auto size-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">Reminders</p>
          <p className="text-sm">Time-based reminders coming in Phase 5</p>
        </div>
      </div>
    </div>
  )
}
