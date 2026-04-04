import { getElement } from "@/lib/actions/element-actions"
import { getPageContent } from "@/lib/actions/page-actions"
import { getLinksForElement } from "@/lib/actions/link-actions"
import { notFound } from "next/navigation"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { FileText } from "lucide-react"
import { InlineTitle } from "@/components/shared/inline-title"
import { PageEditor } from "@/components/editor/page-editor"
import { ElementLinker } from "@/components/shared/element-linker"

export default async function PageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [element, page, links] = await Promise.all([
    getElement(id),
    getPageContent(id),
    getLinksForElement(id),
  ])
  if (!element || element.type !== "page") notFound()

  return (
    <div className="flex flex-col h-full">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <span style={{ color: element.color ?? undefined }}>
          <FileText className="size-4" />
        </span>
        <span className="text-sm font-medium truncate">{element.title}</span>
      </header>
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <InlineTitle elementId={element.id} initialTitle={element.title} />
          <div className="mt-2 mb-4">
            <ElementLinker elementId={element.id} links={links} />
          </div>
          <PageEditor pageId={element.id} initialContent={page?.content} />
        </div>
      </div>
    </div>
  )
}
