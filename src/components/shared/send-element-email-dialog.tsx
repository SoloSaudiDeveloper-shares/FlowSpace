"use client"

/**
 * Generic "send element as email" dialog — works on any element type.
 * Pick a template, optionally add a personal note, send.
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
import {
  getElementEmailTemplates,
  sendElementAsEmail,
  isElementEmailReady,
} from "@/lib/actions/element-email-actions"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  elementId: string
}

interface TemplateInfo {
  id: string
  label: string
  description: string
}

export function SendElementEmailDialog({ open, onOpenChange, elementId }: Props) {
  const [to, setTo] = useState("")
  const [message, setMessage] = useState("")
  const [templates, setTemplates] = useState<TemplateInfo[]>([])
  const [templateId, setTemplateId] = useState<string>("")
  const [elementTitle, setElementTitle] = useState<string>("")
  const [serverReady, setServerReady] = useState<boolean | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open) return
    setTo("")
    setMessage("")
    isElementEmailReady().then((r) => setServerReady(r.ready))
    getElementEmailTemplates(elementId).then((r) => {
      if (r.ok) {
        setTemplates(r.templates)
        setTemplateId(r.templates[0]?.id ?? "")
        setElementTitle(r.elementTitle)
      } else {
        toast.error(r.error)
      }
    })
  }, [open, elementId])

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)
  const selectedTemplate = templates.find((t) => t.id === templateId)

  async function handleSend() {
    if (!validEmail || !templateId || sending) return
    setSending(true)
    try {
      const r = await sendElementAsEmail({
        elementId,
        to: to.trim(),
        templateId,
        customMessage: message.trim() || undefined,
      })
      if (r.ok) {
        toast.success(`Email sent to ${to.trim()}`)
        onOpenChange(false)
      } else {
        toast.error(r.error)
      }
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
            Send as email
          </DialogTitle>
          <DialogDescription>
            Email <strong>{elementTitle}</strong> using one of the built-in
            templates. The template fills in details automatically.
          </DialogDescription>
        </DialogHeader>

        {serverReady === false && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-md border border-amber-500/40 bg-amber-500/5 text-xs">
            <AlertCircle className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-amber-200/90 leading-relaxed">
              Email isn&apos;t configured on the server. Ask an admin to set
              <code className="px-1 py-0.5 rounded bg-amber-500/15 mx-0.5">RESEND_API_KEY</code>
              or Gmail SMTP creds.
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
            />
          </div>

          {/* Template picker */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Template
            </label>
            <div className="space-y-1.5">
              {templates.map((t) => {
                const active = t.id === templateId
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplateId(t.id)}
                    className={`w-full text-left px-3 py-2 rounded-md border-2 transition-colors ${
                      active
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30 hover:bg-accent/30"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {active ? (
                        <Check className="size-3.5 text-primary shrink-0 mt-0.5" />
                      ) : (
                        <div className="size-3.5 shrink-0" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{t.label}</p>
                        <p className="text-[11px] text-muted-foreground leading-snug">{t.description}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
              {templates.length === 0 && (
                <p className="text-xs text-muted-foreground italic py-2">
                  No templates available for this element type.
                </p>
              )}
            </div>
          </div>

          {/* Optional message */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Add a note <span className="text-muted-foreground/50">(optional)</span>
            </label>
            <textarea
              placeholder="Anything you want to say in addition to the template content"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!validEmail || !templateId || sending || serverReady === false || !selectedTemplate}
          >
            {sending ? (
              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
            ) : (
              <Send className="size-3.5 mr-1.5" />
            )}
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
