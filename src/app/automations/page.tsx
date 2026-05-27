import { getAutomations, getFailedRuns } from "@/lib/actions/automation-actions"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Zap } from "lucide-react"
import { AutomationsContent } from "@/components/automations/automations-content"

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
        <h1 className="text-sm font-semibold">Automations</h1>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <AutomationsContent automations={automations} failedRuns={failedRuns} />
      </div>
    </div>
  )
}
