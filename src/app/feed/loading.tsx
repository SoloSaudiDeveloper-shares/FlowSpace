import { Skeleton } from "@/components/ui/skeleton"

export default function FeedLoading() {
  return (
    <div className="flex flex-col h-screen animate-in fade-in duration-200">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="h-6 w-6 rounded" />
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-5 w-24" />
      </header>
      <div className="flex-1 p-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="flex items-center gap-2 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-5 w-16 mb-2" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
