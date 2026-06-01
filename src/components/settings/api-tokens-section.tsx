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
import { SectionHelp } from "@/components/shared/section-help"
import { useT } from "@/lib/hooks/use-i18n"

const EXPIRY_PRESETS = [
  { key: "settings.tokens.expiry.30d", days: 30 },
  { key: "settings.tokens.expiry.90d", days: 90 },
  { key: "settings.tokens.expiry.1y", days: 365 },
  { key: "settings.tokens.expiry.never", days: 0 },
]

export function ApiTokensSection() {
  const { t } = useT()
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
    if (!confirm(t("settings.tokens.revokeConfirm").replace("{name}", name))) return
    const r = await revokeApiToken(id)
    if (r.ok) {
      toast.success(t("settings.tokens.revoked").replace("{name}", name))
      setTokens((rows) => rows.filter((row) => row.id !== id))
    } else {
      toast.error(r.error)
    }
  }

  return (
    <div className="px-4 py-3 rounded-lg border bg-card space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">{t("settings.tokens.title")}</h3>
        <SectionHelp guideId="apiTokens" className="ml-auto" />
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {t("settings.tokens.help")}
        <code className="px-1 py-0.5 mx-1 text-[10px] bg-muted/50 rounded">Authorization: Bearer flws_…</code>
        {t("settings.tokens.helpSuffix")}
      </p>

      {justIssued && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="size-3.5 text-emerald-400" />
            <p className="text-xs font-medium text-emerald-200">
              {t("settings.tokens.issued")}
            </p>
          </div>
          <p className="text-[11px] text-emerald-200/80 leading-relaxed">
            {t("settings.tokens.issuedHelp")}
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
            {t("settings.tokens.saved")}
          </Button>
        </div>
      )}

      <form onSubmit={handleIssue} className="flex flex-wrap items-center gap-1.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("settings.tokens.placeholder")}
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
              {t(p.key)}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" className="h-8 text-xs gap-1.5" disabled={!name.trim() || issuing}>
          {issuing ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Plus className="size-3" />
          )}
          {t("settings.tokens.issue")}
        </Button>
      </form>

      <div className="space-y-1">
        {loading ? (
          <Loader2 className="size-3 animate-spin text-muted-foreground" />
        ) : tokens.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic py-1">
            {t("settings.tokens.empty")}
          </p>
        ) : (
          tokens.map((row) => (
            <div
              key={row.id}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-accent/30 group"
            >
              <KeyRound className="size-3 text-muted-foreground/70 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{row.name}</p>
                <p className="text-[10px] text-muted-foreground/80">
                  {t("settings.tokens.created").replace("{when}", relativeDate(row.createdAt, t))}
                  {row.lastUsedAt
                    ? t("settings.tokens.lastUsed").replace("{when}", relativeDate(row.lastUsedAt, t))
                    : t("settings.tokens.neverUsed")}
                  {row.expiresAt
                    ? t("settings.tokens.expires").replace("{when}", shortDate(row.expiresAt))
                    : ""}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-destructive opacity-0 group-hover:opacity-100"
                onClick={() => handleRevoke(row.id, row.name)}
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

function relativeDate(iso: string, t: (key: string) => string): string {
  const then = new Date(iso).getTime()
  const diffSec = Math.max(0, (Date.now() - then) / 1000)
  if (diffSec < 60) return t("settings.tokens.justNow")
  const m = Math.floor(diffSec / 60)
  if (m < 60) return t("settings.tokens.minutesAgo").replace("{n}", String(m))
  const h = Math.floor(m / 60)
  if (h < 24) return t("settings.tokens.hoursAgo").replace("{n}", String(h))
  const d = Math.floor(h / 24)
  if (d < 30) return t("settings.tokens.daysAgo").replace("{n}", String(d))
  const mo = Math.floor(d / 30)
  return t("settings.tokens.monthsAgo").replace("{n}", String(mo))
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
