import { Skeleton } from "@/components/ui/skeleton"

export default function NotificationsLoading() {
  return (
    <div className="flex flex-col h-screen animate-in fade-in duration-200">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="h-6 w-6 rounded" />
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-5 w-32" />
      </header>
      <div className="flex-1 p-6">
        <div className="mx-auto max-w-2xl space-y-3">
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-2">
              <Skeleton className="h-8 w-16 rounded-md" />
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
            <Skeleton className="h-8 w-28 rounded-md" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
