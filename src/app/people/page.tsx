import { getUsers } from "@/lib/actions/user-actions"
import { getTeams } from "@/lib/actions/user-actions"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Users } from "lucide-react"
import { PeopleContent } from "@/components/people/people-content"

export default async function PeoplePage() {
  const [users, teams] = await Promise.all([
    getUsers(),
    getTeams(),
  ])

  return (
    <div className="flex flex-col h-screen">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Users className="size-4 text-primary" />
        <h1 className="text-sm font-semibold">People & Teams</h1>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <PeopleContent users={users} teams={teams} />
      </div>
    </div>
  )
}
