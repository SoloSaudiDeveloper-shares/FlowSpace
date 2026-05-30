import { getVisibleUsers, getTeams } from "@/lib/actions/user-actions"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Users } from "lucide-react"
import { PeopleContent } from "@/components/people/people-content"
import { PageTitle } from "@/components/layout/page-title"

export default async function PeoplePage() {
  // Scoped to people in your teams (plus yourself). No global directory leak.
  const [users, teams] = await Promise.all([
    getVisibleUsers(),
    getTeams(),
  ])

  return (
    <div className="flex flex-col h-screen">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Users className="size-4 text-primary" />
        <PageTitle titleKey="page.people" fallback="People & Teams" className="text-sm font-semibold" />
      </header>
      <div className="flex-1 overflow-auto p-6">
        <PeopleContent users={users} teams={teams} />
      </div>
    </div>
  )
}
