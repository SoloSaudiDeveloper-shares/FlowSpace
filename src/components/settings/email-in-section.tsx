"use client"

/**
 * Settings → Integrations → Email IN.
 *
 * Explains how to point a domain's inbound emails at FlowSpace, shows
 * the webhook URL the user will give their inbound provider, and lists
 * the user's currently-pending inbound emails (with Approve / Dismiss
 * buttons).
 */

import { useEffect, useState } from "react"
import { Mail, Copy, Check, AlertCircle, Inbox, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useAuth } from "@/lib/hooks/use-auth"
import {
  listPendingInboundEmails,
  approveInboundEmail,
  dismissInboundEmail,
  type PendingInboundEmail,
} from "@/lib/actions/inbound-email-actions"
import { MarkdownFormatGuide } from "@/components/shared/markdown-format-guide"

export function EmailInSection() {
  const { user } = useAuth()
  const [pending, setPending] = useState<PendingInboundEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    void refresh()
  }, [])

  async function refresh() {
    setLoading(true)
    try {
      setPending(await listPendingInboundEmails())
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(id: string) {
    const r = await approveInboundEmail(id)
    if (r.ok) {
      toast.success("Imported to your Inbox")
      setPending((p) => p.filter((e) => e.id !== id))
    } else {
      toast.error(r.error)
    }
  }

  async function handleDismiss(id: string) {
    const r = await dismissInboundEmail(id)
    if (r.ok) {
      setPending((p) => p.filter((e) => e.id !== id))
    } else {
      toast.error(r.error)
    }
  }

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/email/inbound`
      : "/api/email/inbound"

  return (
    <div className="px-4 py-3 rounded-lg border bg-card space-y-3">
      <div className="flex items-center gap-2">
        <Mail className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Email IN</h3>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Forward emails from anywhere into FlowSpace. Each accepted email
        becomes a pending item in your bell — approve to keep it, or
        dismiss. A plain email becomes a simple to-do in your Inbox; if the
        email is written in the format below, approving builds the full
        structure (a project with tasks, a page, etc.).
      </p>

      <div className="rounded-md border border-border/60 p-3 space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
          Setup
        </p>
        <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal pl-4 leading-relaxed">
          <li>
            Point an inbound-mail provider (Resend, Postmark, SendGrid
            Parse, Cloudflare Email Routing) at the webhook below.
          </li>
          <li>
            Set the secret as <code className="px-1 py-0.5 mx-0.5 text-[10px] bg-muted/50 rounded">EMAIL_INBOUND_SECRET</code>
            on the server, then have the provider send it as
            <code className="px-1 py-0.5 mx-0.5 text-[10px] bg-muted/50 rounded">X-Inbound-Secret</code>.
          </li>
          <li>
            Send mail to <code className="px-1 py-0.5 mx-0.5 text-[10px] bg-muted/50 rounded">
              {user?.username ?? "your-username"}@your-domain.com
            </code>{" "}
            (the local part matches your username).
          </li>
        </ol>
        <div className="flex items-center gap-1.5 pt-1">
          <code className="flex-1 font-mono text-[11px] px-2 py-1 rounded bg-muted/60 truncate">
            {webhookUrl}
          </code>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => {
              navigator.clipboard.writeText(webhookUrl).catch(() => undefined)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </Button>
        </div>
      </div>

      <MarkdownFormatGuide />

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium flex items-center gap-1.5">
            <Inbox className="size-3" />
            Pending
            {pending.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/15 text-rose-400">
                {pending.length}
              </span>
            )}
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px]"
            onClick={refresh}
          >
            Refresh
          </Button>
        </div>

        {loading ? (
          <Loader2 className="size-3 animate-spin text-muted-foreground" />
        ) : pending.length === 0 ? (
          <div className="flex items-center gap-1.5 py-3 text-[11px] text-muted-foreground/80 italic">
            <AlertCircle className="size-3" />
            No emails waiting.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {pending.map((e) => (
              <li
                key={e.id}
                className="rounded-md border border-border/40 bg-background/40 p-2.5"
              >
                <div className="flex items-start gap-2 mb-1.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{e.subject || "(no subject)"}</p>
                    <p className="text-[10px] text-muted-foreground/80 truncate">
                      from {e.fromName ? `${e.fromName} <${e.from}>` : e.from}
                    </p>
                    {e.preview && (
                      <p className="text-[10px] text-muted-foreground/60 line-clamp-2 mt-1 leading-snug">
                        {e.preview}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="default"
                    className="h-6 text-[10px]"
                    onClick={() => handleApprove(e.id)}
                  >
                    Add to Inbox
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px] text-muted-foreground"
                    onClick={() => handleDismiss(e.id)}
                  >
                    Dismiss
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
