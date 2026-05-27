export default function ApprovalsLoading() {
  return (
    <div className="flex flex-col h-full">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <div className="h-4 w-24 bg-muted animate-pulse rounded" />
      </header>
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
