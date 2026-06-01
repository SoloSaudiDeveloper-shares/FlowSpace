"use client"

/**
 * Pending inbound-email queue, shown at the top of the Notifications page.
 *
 * Inbound emails (Email IN) used to surface ONLY in a buried Settings panel,
 * even though the sidebar bell badge counted them — so a user clicking the
 * bell never found them. This puts them right where the bell points, with
 * Approve / Dismiss inline. Approving drops the email into the Inbox todo
 * list; dismissing just clears it. Either way we refresh so the bell badge
 * updates.
 */

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Mail, Check, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  approveInboundEmail,
  dismissInboundEmail,
  type PendingInboundEmail,
} from "@/lib/actions/inbound-email-actions"
import { useT } from "@/lib/hooks/use-i18n"

export function PendingEmailsSection({
  emails: initial,
}: {
  emails: PendingInboundEmail[]
}) {
  const { t } = useT()
  const router = useRouter()
  const [emails, setEmails] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)

  if (emails.length === 0) return null

  async function handle(id: string, action: "approve" | "dismiss") {
    setBusy(id)
    try {
      const r =
        action === "approve"
          ? await approveInboundEmail(id)
          : await dismissInboundEmail(id)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      setEmails((prev) => prev.filter((e) => e.id !== id))
      toast.success(
        action === "approve" ? t("misc.email.added") : t("misc.email.dismissed"),
      )
      router.refresh()
    } catch {
      toast.error(t("misc.email.error"))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        <Mail className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">{t("misc.email.heading")}</h2>
        <span className="text-xs text-muted-foreground">
          {t("misc.email.waiting").replace("{count}", String(emails.length))}
        </span>
      </div>
      <div className="space-y-2">
        {emails.map((e) => (
          <div
            key={e.id}
            className="rounded-lg border border-primary/30 bg-primary/5 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {e.subject || t("misc.email.noSubject")}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {t("misc.email.from").replace("{sender}", e.fromName ? `${e.fromName} <${e.from}>` : e.from)}
                </p>
                {e.preview && (
                  <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-2">
                    {e.preview}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  disabled={busy === e.id}
                  onClick={() => handle(e.id, "approve")}
                >
                  {busy === e.id ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Check className="size-3" />
                  )}
                  {t("misc.email.approve")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-xs"
                  disabled={busy === e.id}
                  onClick={() => handle(e.id, "dismiss")}
                >
                  <X className="size-3" />
                  {t("misc.email.dismiss")}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
