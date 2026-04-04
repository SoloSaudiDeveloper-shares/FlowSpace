import { getElement } from "@/lib/actions/element-actions"
import { notFound } from "next/navigation"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { FolderKanban } from "lucide-react"

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const element = await getElement(id)
  if (!element || element.type !== "project") notFound()

  return (
    <div className="flex flex-col h-full">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <span style={{ color: element.color ?? undefined }}><FolderKanban className="size-4" /></span>
        <h1 className="text-lg font-semibold">{element.title}</h1>
      </header>
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <FolderKanban className="mx-auto size-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">Project Board</p>
          <p className="text-sm">Kanban task management coming in Phase 3</p>
        </div>
      </div>
    </div>
  )
}
