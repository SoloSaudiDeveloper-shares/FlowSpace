import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { ScanEye } from "lucide-react"
import { VisionWorkspace } from "@/components/vision/vision-workspace"

export const metadata = {
  title: "Vision — FlowSpace",
}

export default function VisionPage() {
  return (
    <div className="flex flex-col h-full">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <ScanEye className="size-4 text-primary" />
        <span className="text-sm font-medium">Vision</span>
      </header>
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="mx-auto max-w-3xl">
          <VisionWorkspace />
        </div>
      </div>
    </div>
  )
}
