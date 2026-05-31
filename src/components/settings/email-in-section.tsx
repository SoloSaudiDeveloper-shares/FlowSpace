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
import { SectionHelp } from "@/components/shared/section-help"

export function EmailInSection() {
  const { user } = useAuth()
  const [pending, setPending] = useState<PendingInboundEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [addrCopied, setAddrCopied] = useState(false)

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

  // Best-effort guess of the email domain from the web host: email routing
  // lives on the registrable (zone) domain, so drop a leading subdomain
  // (flowspace.tashkeelh.com → tashkeelh.com).
  const emailDomain = (() => {
    if (typeof window === "undefined") return "your-domain.com"
    const host = window.location.host.split(":")[0]
    const labels = host.split(".")
    return labels.length > 2 ? labels.slice(1).join(".") : host
  })()
  const myAddress = `${user?.username ?? "your-username"}@${emailDomain}`

  return (
    <div className="px-4 py-3 rounded-lg border bg-card space-y-3">
      <div className="flex items-center gap-2">
        <Mail className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Email IN</h3>
        <SectionHelp guideId="markdownFormat" label="Markdown format guide" className="ml-auto" />
      </div>
      {/* What a normal user actually needs: their own address. */}
      <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-1.5">
        <p className="text-[10px] uppercase tracking-wider text-primary/70 font-medium">
          Your inbox address
        </p>
        <div className="flex items-center gap-1.5">
          <code className="flex-1 font-mono text-sm px-2 py-1.5 rounded bg-background/60 truncate">
            {myAddress}
          </code>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 shrink-0"
            onClick={() => {
              navigator.clipboard.writeText(myAddress).catch(() => undefined)
              setAddrCopied(true)
              setTimeout(() => setAddrCopied(false), 1500)
            }}
          >
            {addrCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Email anything to this address and it shows up in your bell to
          approve. A plain email becomes a simple to-do in your Inbox; an
          email written in the format below builds a full project (with
          tasks), a page, and so on.
        </p>
      </div>

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
