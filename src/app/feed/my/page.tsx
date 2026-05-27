import { getMyFeed, getUserSubscriptions, getUnreadCount, getPinnedEvents } from "@/lib/actions/feed-actions"
import { getCurrentUser } from "@/lib/actions/user-actions"
import { redirect } from "next/navigation"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { User } from "lucide-react"
import { FeedContent } from "@/components/feed/feed-content"

export default async function MyFeedPage() {
  const currentUser = await getCurrentUser().catch(() => null)
  if (!currentUser) redirect("/login")

  const [events, subscriptions, unreadCount, pinned] = await Promise.all([
    getMyFeed(currentUser.id, { limit: 50 }),
    getUserSubscriptions(currentUser.id),
    getUnreadCount(currentUser.id),
    getPinnedEvents(currentUser.id),
  ])
  return (
    <div className="flex flex-col h-screen">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <User className="size-4 text-primary" />
        <h1 className="text-sm font-semibold">My Feed</h1>
        {unreadCount > 0 && (
          <span className="ml-2 text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">{unreadCount} new</span>
        )}
      </header>
      <div className="flex-1 overflow-auto">
        <FeedContent events={events} currentUserId={currentUser.id} mode="personal" subscriptions={subscriptions} pinnedEvents={pinned} />
      </div>
    </div>
  )
}
