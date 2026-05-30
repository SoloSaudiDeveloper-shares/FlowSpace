import { getDeletedElements, getArchivedElements } from "@/lib/actions/element-actions"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Trash2 } from "lucide-react"
import { TrashList } from "@/components/trash/trash-list"
import { PageTitle } from "@/components/layout/page-title"

export default async function TrashPage() {
  const [deleted, archived] = await Promise.all([
    getDeletedElements(),
    getArchivedElements(),
  ])

  return (
    <div className="flex flex-col h-screen">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Trash2 className="size-4 text-muted-foreground" />
        <PageTitle titleKey="page.trash" fallback="Trash & Archive" />
      </header>

      <div className="flex-1 overflow-auto p-6 animate-page-enter">
        <TrashList deleted={deleted} archived={archived} />
      </div>
    </div>
  )
}
