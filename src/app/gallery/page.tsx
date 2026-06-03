import { getMyGalleryImages } from "@/lib/actions/gallery-actions"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Image as ImageIcon } from "lucide-react"
import { GalleryGrid } from "@/components/gallery/gallery-grid"
import { PageTitle } from "@/components/layout/page-title"

export default async function GalleryPage() {
  const images = await getMyGalleryImages()
  return (
    <div className="flex flex-col h-screen">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <ImageIcon className="size-4 text-muted-foreground" />
        <PageTitle titleKey="page.gallery" fallback="Gallery" />
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-6xl animate-page-enter">
          <GalleryGrid images={images} />
        </div>
      </div>
    </div>
  )
}
