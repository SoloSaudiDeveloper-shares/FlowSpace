import { Skeleton } from "@/components/ui/skeleton"

export default function PeopleLoading() {
  return (
    <div className="flex flex-col h-screen">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="h-6 w-6 rounded" />
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-32" />
      </header>
      <div className="flex-1 p-6 space-y-6">
        {/* Tab bar skeleton */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
        {/* Cards grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
