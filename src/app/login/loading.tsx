export default function LoginLoading() {
  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="animate-pulse w-full max-w-sm space-y-4 p-8">
        <div className="h-12 w-12 bg-muted rounded-xl mx-auto" />
        <div className="h-8 bg-muted rounded w-1/2 mx-auto" />
        <div className="h-4 bg-muted rounded w-2/3 mx-auto" />
        <div className="mt-6 rounded-xl border border-border/50 p-6 space-y-4">
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded w-1/4" />
            <div className="h-10 bg-muted rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded w-1/4" />
            <div className="h-10 bg-muted rounded" />
          </div>
          <div className="h-10 bg-muted rounded" />
        </div>
      </div>
    </div>
  )
}
