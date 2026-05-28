"use client"

/**
 * Compose-and-send dialog for the "Send task as email" action.
 *
 * Usage:
 *   <SendTaskEmailDialog open={...} onOpenChange={...} task={task} />
 *
 * Dialog collects:
 *   - Recipient email (required, validated)
 *   - Optional message (preface for the recipient)
 *   - Toggles: include description / due date / status / priority / app link
 *
 * On send, hits the `sendTaskAsEmail` server action which composes a
 * styled HTML email via the existing Resend transport. We surface clear
 * toasts on success/failure so the user knows what happened.
 */

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Mail, Send, Loader2, Check, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { sendTaskAsEmail, isTaskEmailReady } from "@/lib/actions/task-email-actions"
import type { tasks } from "@/lib/db/schema"

type Task = typeof tasks.$inferSelect

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  task: Task
}

const INCLUDE_OPTIONS = [
  { key: "description", label: "Description" },
  { key: "dueDate",     label: "Due date" },
  { key: "status",      label: "Status" },
  { key: "priority",    label: "Priority" },
  { key: "appLink",     label: "Link back to FlowSpace" },
] as const

export function SendTaskEmailDialog({ open, onOpenChange, task }: Props) {
  const [to, setTo] = useState("")
  const [message, setMessage] = useState("")
  const [include, setInclude] = useState<Record<string, boolean>>({
    description: true,
    dueDate: true,
    status: true,
    priority: true,
    appLink: true,
  })
  const [sending, setSending] = useState(false)
  // We check on open whether the server has email configured at all so
  // we can render a clear warning instead of letting the user type out a
  // message and then hit a generic "failed to send" error.
  const [providerStatus, setProviderStatus] = useState<{
    ready: boolean
    provider: string
  } | null>(null)

  useEffect(() => {
    if (!open) return
    setTo("")
    setMessage("")
    isTaskEmailReady().then(setProviderStatus).catch(() => setProviderStatus({ ready: false, provider: "none" }))
  }, [open])

  function toggleInclude(k: string) {
    setInclude((prev) => ({ ...prev, [k]: !prev[k] }))
  }

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)

  async function handleSend() {
    if (!validEmail || sending) return
    setSending(true)
    try {
      const result = await sendTaskAsEmail({
        taskId: task.id,
        to: to.trim(),
        customMessage: message.trim() || undefined,
        include: {
          description: include.description,
          dueDate: include.dueDate,
          status: include.status,
          priority: include.priority,
          appLink: include.appLink,
        },
      })
      if (result.ok) {
        toast.success(`Email sent to ${to.trim()}`)
        onOpenChange(false)
      } else {
        toast.error(result.error)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send email")
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="size-4 text-primary" />
            Send task as email
          </DialogTitle>
          <DialogDescription>
            Email someone a clean summary of <strong>{task.title}</strong>.
            They&apos;ll see the details you choose below.
          </DialogDescription>
        </DialogHeader>

        {/* Provider warning — shown when the server isn't email-configured */}
        {providerStatus && !providerStatus.ready && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-md border border-amber-500/40 bg-amber-500/5 text-xs">
            <AlertCircle className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-amber-200/90 leading-relaxed">
              The server isn&apos;t set up to send email yet. Ask an admin to
              configure <code className="px-1 py-0.5 rounded bg-amber-500/15">RESEND_API_KEY</code>
              {" "}or Gmail SMTP credentials.
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* Recipient */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Recipient email
            </label>
            <Input
              type="email"
              placeholder="name@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              autoFocus
              autoComplete="email"
            />
          </div>

          {/* Optional message */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Add a note <span className="text-muted-foreground/50">(optional)</span>
            </label>
            <textarea
              placeholder={`e.g. "Quick reminder — can you take a look at this before Friday?"`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          {/* What to include */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              What to include
            </label>
            <div className="flex flex-wrap gap-1.5">
              {INCLUDE_OPTIONS.map((opt) => {
                const active = include[opt.key]
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => toggleInclude(opt.key)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border transition-colors ${
                      active
                        ? "bg-primary/15 text-foreground border-primary/40"
                        : "text-muted-foreground border-border hover:bg-accent"
                    }`}
                  >
                    {active && <Check className="size-3" />}
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!validEmail || sending || (providerStatus !== null && !providerStatus.ready)}
          >
            {sending ? (
              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
            ) : (
              <Send className="size-3.5 mr-1.5" />
            )}
            {sending ? "Sending…" : "Send email"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
