"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("App error:", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 px-4">
      <div className="flex items-center justify-center size-16 rounded-full bg-destructive/10">
        <AlertTriangle className="size-8 text-destructive" />
      </div>
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        An unexpected error occurred. Please try again or refresh the page.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset} variant="outline">
          <RefreshCw className="size-4 mr-2" />
          Try again
        </Button>
        <Button onClick={() => window.location.href = "/"}>
          Go home
        </Button>
      </div>
    </div>
  )
}
