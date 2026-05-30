import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Settings } from "lucide-react"
import { SettingsContent } from "@/components/settings/settings-content"
import { PageTitle } from "@/components/layout/page-title"

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-screen">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Settings className="size-4 text-muted-foreground" />
        <PageTitle titleKey="page.settings" fallback="Settings" />
      </header>

      <div className="flex-1 overflow-auto">
        <div className="animate-page-enter">
          <SettingsContent />
        </div>
      </div>
    </div>
  )
}
