import { getElement } from "@/lib/actions/element-actions"
import { getProcessSteps } from "@/lib/actions/process-actions"
import { getCanvasData } from "@/lib/actions/canvas-actions"
import { getLinksForElement } from "@/lib/actions/link-actions"
import { isWatching, getWatcherCount } from "@/lib/actions/watcher-actions"
import { getCurrentUser } from "@/lib/actions/user-actions"
import { notFound } from "next/navigation"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { GitBranch } from "lucide-react"
import { InlineTitle } from "@/components/shared/inline-title"
import { ElementLinker } from "@/components/shared/element-linker"
import { ProcessContent } from "@/components/process/process-content"
import { PageContextMenu } from "@/components/shared/page-context-menu"
import { WatchButton } from "@/components/shared/watch-button"

export default async function ProcessPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [element, steps, links, currentUser] = await Promise.all([
    getElement(id),
    getProcessSteps(id),
    getLinksForElement(id),
    getCurrentUser(),
  ])
  if (!element || element.type !== "process") notFound()

  const [watching, watcherCount] = await Promise.all([
    currentUser ? isWatching(id, currentUser.id) : false,
    getWatcherCount(id),
  ])

  return (
    <div className="flex flex-col h-full">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <span style={{ color: element.color ?? undefined }}>
          <GitBranch className="size-4" />
        </span>
        <span className="text-sm font-medium truncate">{element.title}</span>
        <div className="ml-auto">
          <WatchButton
            elementId={element.id}
            initialWatching={watching}
            initialCount={watcherCount}
          />
        </div>
      </header>
      <ElementLinker elementId={element.id} links={links} />
      <PageContextMenu className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-3xl">
          <InlineTitle elementId={element.id} initialTitle={element.title} />
          <ProcessContent processId={element.id} steps={steps} />
        </div>
      </PageContextMenu>
    </div>
  )
}
