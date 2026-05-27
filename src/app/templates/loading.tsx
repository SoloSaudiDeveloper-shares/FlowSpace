import { Skeleton } from "@/components/ui/skeleton"

export default function TemplatesLoading() {
  return (
    <div className="flex flex-col h-screen animate-in fade-in duration-200">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="h-6 w-6 rounded" />
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-5 w-28" />
      </header>
      <div className="flex-1 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded" />
                <Skeleton className="h-5 w-32" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <div className="flex items-center justify-between pt-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-8 w-24 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
