"use client"

/**
 * Settings → Account → API tokens.
 *
 * List the user's existing tokens (name, created, last used) with a
 * Revoke action, and a "+ Issue new token" flow that generates a
 * `flws_…` bearer string shown ONCE.
 */

import { useEffect, useState } from "react"
import { KeyRound, Plus, Trash2, Copy, Check, Loader2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  listMyApiTokens,
  createApiToken,
  revokeApiToken,
  type ApiTokenRow,
} from "@/lib/actions/api-token-actions"

const EXPIRY_PRESETS = [
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "1 year", days: 365 },
  { label: "Never", days: 0 },
]

export function ApiTokensSection() {
  const [tokens, setTokens] = useState<ApiTokenRow[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [expiryDays, setExpiryDays] = useState(90)
  const [issuing, setIssuing] = useState(false)
  const [justIssued, setJustIssued] = useState<{ id: string; token: string; name: string } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    void refresh()
  }, [])

  async function refresh() {
    setLoading(true)
    try {
      setTokens(await listMyApiTokens())
    } finally {
      setLoading(false)
    }
  }

  async function handleIssue(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || issuing) return
    setIssuing(true)
    try {
      const r = await createApiToken({ name: name.trim(), expiresInDays: expiryDays })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      setJustIssued({ id: r.id, token: r.token, name: name.trim() })
      setName("")
      await refresh()
    } finally {
      setIssuing(false)
    }
  }

  async function handleRevoke(id: string, name: string) {
    if (!confirm(`Revoke "${name}"? Any script using it stops working immediately.`)) return
    const r = await revokeApiToken(id)
    if (r.ok) {
      toast.success(`Revoked "${name}"`)
      setTokens((t) => t.filter((row) => row.id !== id))
    } else {
      toast.error(r.error)
    }
  }

  return (
    <div className="px-4 py-3 rounded-lg border bg-card space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">API tokens</h3>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Long-lived bearer tokens for scripts and integrations. Send as
        <code className="px-1 py-0.5 mx-1 text-[10px] bg-muted/50 rounded">Authorization: Bearer flws_…</code>
        on API routes that support it.
      </p>

      {justIssued && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="size-3.5 text-emerald-400" />
            <p className="text-xs font-medium text-emerald-200">
              Token issued — copy it now
            </p>
          </div>
          <p className="text-[11px] text-emerald-200/80 leading-relaxed">
            This is the only time you'll see the full value. Store it in
            your password manager or your script's secrets.
          </p>
          <div className="flex items-center gap-1.5">
            <code className="flex-1 font-mono text-xs px-2 py-1.5 rounded bg-background/60 break-all">
              {justIssued.token}
            </code>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={() => {
                navigator.clipboard.writeText(justIssued.token).catch(() => undefined)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            </Button>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px] w-full"
            onClick={() => setJustIssued(null)}
          >
            I've saved it — close
          </Button>
        </div>
      )}

      <form onSubmit={handleIssue} className="flex flex-wrap items-center gap-1.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What's this token for? (e.g. cron-importer)"
          maxLength={100}
          className="flex-1 min-w-[160px] h-8 rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <select
          value={expiryDays}
          onChange={(e) => setExpiryDays(Number(e.target.value))}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {EXPIRY_PRESETS.map((p) => (
            <option key={p.days} value={p.days}>
              {p.label}
            </option>
          ))}
        </select>
        <Button size="sm" className="h-8 text-xs gap-1.5" disabled={!name.trim() || issuing}>
          {issuing ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Plus className="size-3" />
          )}
          Issue
        </Button>
      </form>

      <div className="space-y-1">
        {loading ? (
          <Loader2 className="size-3 animate-spin text-muted-foreground" />
        ) : tokens.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic py-1">
            No tokens yet.
          </p>
        ) : (
          tokens.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-accent/30 group"
            >
              <KeyRound className="size-3 text-muted-foreground/70 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{t.name}</p>
                <p className="text-[10px] text-muted-foreground/80">
                  Created {relativeDate(t.createdAt)}
                  {t.lastUsedAt
                    ? ` · last used ${relativeDate(t.lastUsedAt)}`
                    : " · never used"}
                  {t.expiresAt
                    ? ` · expires ${shortDate(t.expiresAt)}`
                    : ""}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-destructive opacity-0 group-hover:opacity-100"
                onClick={() => handleRevoke(t.id, t.name)}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function relativeDate(iso: string): string {
  const then = new Date(iso).getTime()
  const diffSec = Math.max(0, (Date.now() - then) / 1000)
  if (diffSec < 60) return "just now"
  const m = Math.floor(diffSec / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  const mo = Math.floor(d / 30)
  return `${mo}mo ago`
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
