import { getAutomations, getFailedRuns } from "@/lib/actions/automation-actions"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Zap } from "lucide-react"
import { AutomationsContent } from "@/components/automations/automations-content"
import { PageTitle } from "@/components/layout/page-title"

export default async function AutomationsPage() {
  const [automations, failedRuns] = await Promise.all([
    getAutomations(),
    getFailedRuns(10),
  ])
  return (
    <div className="flex flex-col h-screen">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Zap className="size-4 text-primary" />
        <PageTitle titleKey="page.automations" fallback="Automations" className="text-sm font-semibold" />
      </header>
      <div className="flex-1 overflow-auto p-6">
        <AutomationsContent automations={automations} failedRuns={failedRuns} />
      </div>
    </div>
  )
}
