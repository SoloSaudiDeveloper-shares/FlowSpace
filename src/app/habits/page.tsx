import { Suspense } from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Repeat } from "lucide-react"
import { HabitsContent } from "@/components/habits/habits-content"

export default function HabitsPage() {
  return (
    <div className="flex flex-col h-full">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Repeat className="size-4 text-primary" />
        <span className="text-sm font-medium">Habits</span>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-3xl">
          <Suspense fallback={null}>
            <HabitsContent />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
