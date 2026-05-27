export default function AdminLoading() {
  return (
    <div className="flex flex-col h-screen">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <div className="h-4 w-4 bg-muted rounded animate-pulse" />
        <div className="h-4 w-px bg-border mx-2" />
        <div className="h-4 w-32 bg-muted rounded animate-pulse" />
      </header>
      <div className="flex-1 p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-muted/50 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-muted/50 rounded-lg animate-pulse" />
          <div className="h-64 bg-muted/50 rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  )
}
