"use client"

/**
 * Hint — minimal tooltip wrapper.
 *
 * Wraps any child in a tooltip with a single `label` prop. Optional
 * `side` to control placement and `delay` to override the default
 * (450ms feels right — long enough to not be noisy, short enough to feel
 * responsive when you do hover deliberately).
 *
 * Used to add lightweight "what does this do?" tooltips across the
 * platform without polluting JSX with Tooltip/TooltipTrigger/etc.
 *
 *   <Hint label="Refresh">
 *     <Button variant="ghost" size="icon"><RefreshCw /></Button>
 *   </Hint>
 */

import { ReactElement, ReactNode } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface HintProps {
  label: ReactNode
  children: ReactElement
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
  delay?: number
  /** Hide the tooltip entirely (useful when wrapped conditionally). */
  disabled?: boolean
  /** Optional shortcut hint shown in a muted kbd-style suffix. */
  shortcut?: string
}

export function Hint({
  label,
  children,
  side = "top",
  align = "center",
  delay = 450,
  disabled,
  shortcut,
}: HintProps) {
  if (disabled || !label) return <>{children}</>
  return (
    <TooltipProvider delay={delay}>
      <Tooltip>
        <TooltipTrigger render={children} />
        <TooltipContent side={side} align={align}>
          <span>{label}</span>
          {shortcut ? (
            <kbd
              data-slot="kbd"
              className="ml-1 inline-flex items-center gap-0.5 rounded-sm bg-background/10 px-1 py-0.5 text-[10px] font-medium uppercase tracking-wider opacity-80"
            >
              {shortcut}
            </kbd>
          ) : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
