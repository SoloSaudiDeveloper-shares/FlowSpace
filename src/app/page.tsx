import {
  getRecentElements,
  getFavoriteElements,
} from "@/lib/actions/element-actions"
import { getDashboardSummary } from "@/lib/actions/dashboard-actions"
import { HomeDashboard } from "@/components/home/home-dashboard"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { PageContextMenu } from "@/components/shared/page-context-menu"

export default async function HomePage() {
  const [recent, favorites, summary] = await Promise.all([
    getRecentElements(16),
    getFavoriteElements(),
    getDashboardSummary(),
  ])

  return (
    <div className="flex flex-col h-full">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Home</h1>
      </header>
      <PageContextMenu className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-6xl">
          <HomeDashboard summary={summary} recent={recent} favorites={favorites} />
        </div>
      </PageContextMenu>
    </div>
  )
}
