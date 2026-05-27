import {
  getRecentElements,
  getFavoriteElements,
} from "@/lib/actions/element-actions"
import {
  getDashboardWidgets,
  initializeDefaultDashboard,
  getMyTasks,
  getUpcomingReminders,
  getRecentActivity,
} from "@/lib/actions/dashboard-actions"
import { HomeContent } from "@/components/home/home-content"
import { DashboardGrid } from "@/components/dashboard/dashboard-grid"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { PageContextMenu } from "@/components/shared/page-context-menu"

export default async function HomePage() {
  await initializeDefaultDashboard()

  const [recentElements, favorites, widgets, myTasks, upcomingReminders, recentActivity] = await Promise.all([
    getRecentElements(20),
    getFavoriteElements(),
    getDashboardWidgets(),
    getMyTasks(),
    getUpcomingReminders(),
    getRecentActivity(),
  ])

  return (
    <div className="flex flex-col h-full">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Home</h1>
      </header>
      <PageContextMenu className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-6xl space-y-8 animate-page-enter">
          {/* Dashboard Widgets */}
          <DashboardGrid
            widgets={widgets}
            recentElements={recentElements}
            favorites={favorites}
            myTasks={myTasks}
            upcomingReminders={upcomingReminders}
            recentActivity={recentActivity}
          />

          {/* Quick Create + Recent below dashboard */}
          <HomeContent recentElements={recentElements} favorites={favorites} />
        </div>
      </PageContextMenu>
    </div>
  )
}
