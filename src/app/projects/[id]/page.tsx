import { getElement, getElements } from "@/lib/actions/element-actions"
import { getTaskStatuses, getTasksByProject, getProjectData, getTaskCardMetadata } from "@/lib/actions/task-actions"
import { getLinksForElement } from "@/lib/actions/link-actions"
import { isWatching, getWatcherCount } from "@/lib/actions/watcher-actions"
import { getCurrentUser } from "@/lib/actions/user-actions"
import { notFound } from "next/navigation"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { FolderKanban } from "lucide-react"
import { InlineTitle } from "@/components/shared/inline-title"
import { ElementLinker } from "@/components/shared/element-linker"
import { ProjectViews } from "@/components/project/project-views"
import { SubProjectBar } from "@/components/project/sub-project-bar"
import { PageContextMenu } from "@/components/shared/page-context-menu"
import { WatchButton } from "@/components/shared/watch-button"
import { SendEmailButton } from "@/components/shared/send-email-button"
import { CustomFieldsPanel } from "@/components/shared/custom-fields-panel"

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [element, statuses, tasks, project, links, allElements, taskMeta, currentUser] = await Promise.all([
    getElement(id),
    getTaskStatuses(id),
    getTasksByProject(id),
    getProjectData(id),
    getLinksForElement(id),
    getElements(),
    getTaskCardMetadata(id),
    getCurrentUser(),
  ])
  if (!element || element.type !== "project") notFound()

  const [watching, watcherCount] = await Promise.all([
    currentUser ? isWatching(id, currentUser.id) : false,
    getWatcherCount(id),
  ])

  const subProjects = allElements.filter(
    (e) => e.type === "project" && e.parentId === id
  )

  return (
    <div className="flex flex-col h-screen">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <span style={{ color: element.color ?? undefined }}>
          <FolderKanban className="size-4" />
        </span>
        <InlineTitle elementId={element.id} initialTitle={element.title} />
        <div className="ml-auto flex items-center gap-1">
          <SendEmailButton elementId={element.id} />
          <WatchButton
            elementId={element.id}
            initialWatching={watching}
            initialCount={watcherCount}
          />
        </div>
      </header>

      <ElementLinker elementId={element.id} links={links} />

      {subProjects.length > 0 && (
        <SubProjectBar parentId={id} subProjects={subProjects} />
      )}

      <div className="px-4 pt-3">
        <CustomFieldsPanel
          entityType="element"
          entityId={element.id}
          projectId={element.id}
        />
      </div>

      <PageContextMenu className="flex-1 min-h-0">
        <ProjectViews
          projectId={element.id}
          statuses={statuses}
          tasks={tasks}
          progress={project?.progress ?? 0}
          projectDescription={element.description}
          parentId={element.parentId ?? undefined}
          taskMeta={taskMeta}
        />
      </PageContextMenu>
    </div>
  )
}
