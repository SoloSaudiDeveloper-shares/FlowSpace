import { getGlobalFeed } from "@/lib/actions/feed-actions"
import { getCurrentUser } from "@/lib/actions/user-actions"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Rss } from "lucide-react"
import { FeedContent } from "@/components/feed/feed-content"
import { PageTitle } from "@/components/layout/page-title"

export default async function FeedPage() {
  const [events, currentUser] = await Promise.all([
    getGlobalFeed({ limit: 50 }),
    getCurrentUser().catch(() => null),
  ])
  return (
    <div className="flex flex-col h-screen">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Rss className="size-4 text-primary" />
        <PageTitle titleKey="page.feed" fallback="Feed" className="text-sm font-semibold" />
      </header>
      <div className="flex-1 overflow-hidden min-h-0">
        <FeedContent events={events} currentUserId={currentUser?.id ?? null} mode="global" />
      </div>
    </div>
  )
}
