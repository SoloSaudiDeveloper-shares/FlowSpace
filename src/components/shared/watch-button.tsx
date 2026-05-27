"use client"

import { useState, useTransition } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toggleWatch } from "@/lib/actions/watcher-actions"
import { useAuth } from "@/lib/hooks/use-auth"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface WatchButtonProps {
  elementId: string
  initialWatching: boolean
  initialCount: number
}

export function WatchButton({
  elementId,
  initialWatching,
  initialCount,
}: WatchButtonProps) {
  const { user } = useAuth()
  const [watching, setWatching] = useState(initialWatching)
  const [count, setCount] = useState(initialCount)
  const [isPending, startTransition] = useTransition()

  if (!user) return null

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleWatch(elementId, user!.id)
      setWatching(result.watching)
      setCount((prev) => (result.watching ? prev + 1 : Math.max(0, prev - 1)))
    })
  }

  return (
    <TooltipProvider delay={300}>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant={watching ? "secondary" : "ghost"}
              size="sm"
              onClick={handleToggle}
              disabled={isPending}
              className="gap-1.5"
            >
              {watching ? (
                <Eye className="size-3.5" />
              ) : (
                <EyeOff className="size-3.5" />
              )}
              {count > 0 && (
                <span className="text-xs tabular-nums">{count}</span>
              )}
            </Button>
          }
        />
        <TooltipContent>
          <p>{watching ? "Stop watching" : "Watch this element"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
