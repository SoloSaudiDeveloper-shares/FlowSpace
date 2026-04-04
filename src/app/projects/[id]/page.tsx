import { getElement } from "@/lib/actions/element-actions"
import { getTaskStatuses, getTasksByProject, getProjectData } from "@/lib/actions/task-actions"
import { getLinksForElement } from "@/lib/actions/link-actions"
import { notFound } from "next/navigation"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { FolderKanban } from "lucide-react"
import { InlineTitle } from "@/components/shared/inline-title"
import { TaskBoard } from "@/components/project/task-board"
import { ElementLinker } from "@/components/shared/element-linker"

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [element, statuses, tasks, project, links] = await Promise.all([
    getElement(id),
    getTaskStatuses(id),
    getTasksByProject(id),
    getProjectData(id),
    getLinksForElement(id),
  ])
  if (!element || element.type !== "project") notFound()

  return (
    <div className="flex flex-col h-full">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <span style={{ color: element.color ?? undefined }}>
          <FolderKanban className="size-4" />
        </span>
        <span className="text-sm font-medium truncate">{element.title}</span>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <InlineTitle elementId={element.id} initialTitle={element.title} />
        <div className="mt-2 mb-4">
          <ElementLinker elementId={element.id} links={links} />
        </div>
        <TaskBoard
          projectId={element.id}
          statuses={statuses}
          tasks={tasks}
          progress={project?.progress ?? 0}
        />
      </div>
    </div>
  )
}
