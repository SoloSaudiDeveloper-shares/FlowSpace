import { getApprovals } from "@/lib/actions/approval-actions"
import { getUsers } from "@/lib/actions/user-actions"
import { ApprovalsContent } from "@/components/approvals/approvals-content"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"

export default async function ApprovalsPage() {
  const [allApprovals, allUsers] = await Promise.all([
    getApprovals("all"),
    getUsers(),
  ])

  return (
    <div className="flex flex-col h-full">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Approvals</h1>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl animate-page-enter">
          <ApprovalsContent approvals={allApprovals} users={allUsers} />
        </div>
      </div>
    </div>
  )
}
