import { Skeleton } from "@/components/ui/skeleton"

export default function SettingsLoading() {
  return (
    <div className="flex flex-col h-screen animate-in fade-in duration-200">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="h-6 w-6 rounded" />
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-5 w-24" />
      </header>
      <div className="flex-1 p-6">
        <div className="mx-auto max-w-2xl space-y-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-16 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
