import { Skeleton } from "@/components/ui/skeleton"

export default function ProjectLoading() {
  return (
    <div className="flex flex-col h-screen">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="h-6 w-6 rounded" />
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-6 w-48" />
      </header>
      {/* Views bar skeleton */}
      <div className="flex items-center gap-1 border-b px-2 h-10">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-20 rounded" />
        ))}
      </div>
      {/* Board skeleton */}
      <div className="flex-1 p-6">
        <Skeleton className="h-2 w-full rounded-full mb-6" />
        <div className="flex gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="w-72 shrink-0 space-y-3">
              <Skeleton className="h-10 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
