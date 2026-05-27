"use client"

import { type ReactNode } from "react"
import { usePreferences } from "@/lib/hooks/use-preferences"
import { FeedTicker } from "@/components/layout/feed-ticker"

/**
 * Wraps page children with the FeedTicker positioned correctly (top or
 * bottom). Using a flex column with the ticker as a flow sibling means
 * the ticker reserves real layout space — no CSS-variable hacks needed.
 */
export function MainShell({ children }: { children: ReactNode }) {
  const { preferences } = usePreferences()
  const showTop =
    preferences.feedTicker?.show !== false &&
    (preferences.feedTicker?.position ?? "top") === "top"
  const showBottom =
    preferences.feedTicker?.show !== false &&
    preferences.feedTicker?.position === "bottom"

  return (
    <div className="flex flex-col w-full min-h-full">
      {showTop && <FeedTicker />}
      <div className="flex-1 min-h-0">{children}</div>
      {showBottom && <FeedTicker />}
    </div>
  )
}
