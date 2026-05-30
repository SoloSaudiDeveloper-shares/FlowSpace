import {
  getRecentElements,
  getFavoriteElements,
} from "@/lib/actions/element-actions"
import { getDashboardSummary } from "@/lib/actions/dashboard-actions"
import { getCurrentUser } from "@/lib/actions/user-actions"
import { redirect } from "next/navigation"
import { HomeDashboard } from "@/components/home/home-dashboard"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { PageContextMenu } from "@/components/shared/page-context-menu"
import { PageTitle } from "@/components/layout/page-title"

export default async function HomePage() {
  // Guard: an unauthenticated visitor must land on /login, never on an
  // (empty) dashboard. The root layout renders this page's children even
  // when signed out, so the guard has to live here — same pattern the
  // other protected pages use.
  const currentUser = await getCurrentUser().catch(() => null)
  if (!currentUser) redirect("/login")

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
        <PageTitle titleKey="page.home" fallback="Home" className="text-lg font-semibold" />
      </header>
      <PageContextMenu className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-6xl">
          <HomeDashboard summary={summary} recent={recent} favorites={favorites} />
        </div>
      </PageContextMenu>
    </div>
  )
}
