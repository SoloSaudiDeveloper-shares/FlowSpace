"use client"

import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotificationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <AlertTriangle className="size-12 text-destructive" />
      <h2 className="text-lg font-semibold">Failed to load notifications</h2>
      <p className="text-sm text-muted-foreground max-w-md text-center">
        {error.message || "Something went wrong."}
      </p>
      <div className="flex gap-2">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" onClick={() => (window.location.href = "/")}>
          Go home
        </Button>
      </div>
    </div>
  )
}
