import { Skeleton } from "@/components/ui/skeleton"

export default function TrashLoading() {
  return (
    <div className="flex flex-col h-screen animate-in fade-in duration-200">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="h-6 w-6 rounded" />
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-5 w-32" />
      </header>
      <div className="flex-1 p-6">
        <div className="flex gap-2 mb-6">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
