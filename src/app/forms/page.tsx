import { getForms } from "@/lib/actions/form-actions"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { FileInput } from "lucide-react"
import { FormsContent } from "@/components/forms/forms-content"

export default async function FormsPage() {
  const forms = await getForms()
  return (
    <div className="flex flex-col h-screen">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <FileInput className="size-4 text-primary" />
        <h1 className="text-sm font-semibold">Forms</h1>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <FormsContent forms={forms} />
      </div>
    </div>
  )
}
