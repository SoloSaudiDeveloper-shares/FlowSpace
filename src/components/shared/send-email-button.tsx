"use client"

/**
 * Header action button that opens SendElementEmailDialog for the given
 * element. Owns the open/close state so page headers can drop it in
 * with one line.
 *
 *   <SendEmailButton elementId={element.id} />
 *
 * Wrapped in a Hint tooltip so people who don't recognize the icon get
 * a one-second hover explanation.
 */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Mail } from "lucide-react"
import { Hint } from "@/components/shared/hint"
import { useT } from "@/lib/hooks/use-i18n"
import { SendElementEmailDialog } from "@/components/shared/send-element-email-dialog"

interface SendEmailButtonProps {
  elementId: string
  /** Visual variant for the trigger. Default: "ghost" + icon size. */
  variant?: "ghost" | "secondary" | "outline"
  /** Show a "Email" text label after the icon. */
  showLabel?: boolean
}

export function SendEmailButton({
  elementId,
  variant = "ghost",
  showLabel = false,
}: SendEmailButtonProps) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Hint label={t("shared.emailBtn.hint")} delay={350}>
        <Button
          variant={variant}
          size={showLabel ? "sm" : "icon"}
          onClick={() => setOpen(true)}
          className={showLabel ? "gap-1.5" : "size-8"}
        >
          <Mail className="size-3.5" />
          {showLabel && <span className="text-xs">{t("shared.emailBtn.label")}</span>}
        </Button>
      </Hint>
      <SendElementEmailDialog
        open={open}
        onOpenChange={setOpen}
        elementId={elementId}
      />
    </>
  )
}
