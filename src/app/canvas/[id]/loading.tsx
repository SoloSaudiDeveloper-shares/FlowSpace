import { Skeleton } from "@/components/ui/skeleton"

export default function CanvasLoading() {
  return (
    <div className="flex flex-col h-screen">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="h-6 w-6 rounded" />
        <Skeleton className="h-6 w-48" />
      </header>
      <div className="flex-1 relative bg-muted/20">
        <Skeleton className="absolute top-4 left-4 h-10 w-64 rounded-lg" />
        <Skeleton className="absolute bottom-4 right-4 h-32 w-40 rounded-lg" />
      </div>
    </div>
  )
}
