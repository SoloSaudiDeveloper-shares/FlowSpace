import { getElement } from "@/lib/actions/element-actions"
import { getTodoItems } from "@/lib/actions/todo-actions"
import { getLinksForElement } from "@/lib/actions/link-actions"
import { isWatching, getWatcherCount } from "@/lib/actions/watcher-actions"
import { getCurrentUser } from "@/lib/actions/user-actions"
import { notFound } from "next/navigation"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { ListTodo } from "lucide-react"
import { InlineTitle } from "@/components/shared/inline-title"
import { TodoListEditor } from "@/components/todos/todo-list-editor"
import { ElementLinker } from "@/components/shared/element-linker"
import { PageContextMenu } from "@/components/shared/page-context-menu"
import { WatchButton } from "@/components/shared/watch-button"
import { SendEmailButton } from "@/components/shared/send-email-button"
import { ExportXlsxButton } from "@/components/shared/export-xlsx-button"

export default async function TodoListPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [element, items, links, currentUser] = await Promise.all([
    getElement(id),
    getTodoItems(id),
    getLinksForElement(id),
    getCurrentUser(),
  ])
  if (!element || element.type !== "todo_list") notFound()

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
          <ListTodo className="size-4" />
        </span>
        <span className="text-sm font-medium truncate">{element.title}</span>
        <div className="ml-auto flex items-center gap-1">
          <ExportXlsxButton listId={element.id} />
          <SendEmailButton elementId={element.id} />
          <WatchButton
            elementId={element.id}
            initialWatching={watching}
            initialCount={watcherCount}
          />
        </div>
      </header>
      <ElementLinker elementId={element.id} links={links} />
      <PageContextMenu className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-2xl">
          <InlineTitle elementId={element.id} initialTitle={element.title} />
          <TodoListEditor listId={element.id} items={items} />
        </div>
      </PageContextMenu>
    </div>
  )
}
