"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function TodoError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Todo error:", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 px-4">
      <div className="flex items-center justify-center size-16 rounded-full bg-destructive/10">
        <AlertTriangle className="size-8 text-destructive" />
      </div>
      <h2 className="text-xl font-semibold">Failed to load todo list</h2>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        Could not load this todo list. It may have been deleted or there was a database error.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset} variant="outline">
          <RefreshCw className="size-4 mr-2" />
          Retry
        </Button>
        <Button onClick={() => window.location.href = "/"}>
          <ArrowLeft className="size-4 mr-2" />
          Back to home
        </Button>
      </div>
    </div>
  )
}
