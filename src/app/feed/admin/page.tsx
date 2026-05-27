import { getAdminFeed } from "@/lib/actions/feed-actions"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { ShieldAlert } from "lucide-react"
import { FeedContent } from "@/components/feed/feed-content"

export default async function AdminFeedPage() {
  const events = await getAdminFeed({ limit: 50 })
  return (
    <div className="flex flex-col h-screen">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <ShieldAlert className="size-4 text-primary" />
        <h1 className="text-sm font-semibold">Admin Feed</h1>
      </header>
      <div className="flex-1 overflow-auto">
        <FeedContent events={events} currentUserId={null} mode="admin" />
      </div>
    </div>
  )
}
