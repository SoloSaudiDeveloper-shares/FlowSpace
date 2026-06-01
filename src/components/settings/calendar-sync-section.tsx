"use client"

import { useEffect, useState } from "react"
import { Calendar, ExternalLink, AlertCircle, Loader2, Check, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  getCalendarSyncStatus,
  setCalendarSyncEnabled,
  disconnectCalendarSync,
  runMyCalendarSyncNow,
  type CalendarSyncStatus,
} from "@/lib/actions/calendar-sync-actions"
import { SectionHelp } from "@/components/shared/section-help"
import { useT } from "@/lib/hooks/use-i18n"

export function CalendarSyncSection() {
  const { t } = useT()
  const [status, setStatus] = useState<CalendarSyncStatus | null>(null)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    void getCalendarSyncStatus().then(setStatus).catch(() => undefined)
  }, [])

  async function handleSyncNow() {
    setSyncing(true)
    try {
      const r = await runMyCalendarSyncNow()
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      if (r.pushed === 0 && r.removed === 0) {
        toast.info(t("settings.calendar.upToDate"))
      } else {
        const removed = r.removed
          ? t("settings.calendar.removedSuffix").replace("{count}", String(r.removed))
          : ""
        toast.success(
          t("settings.calendar.synced")
            .replace("{pushed}", String(r.pushed))
            .replace("{removed}", removed),
        )
      }
      void getCalendarSyncStatus().then(setStatus).catch(() => undefined)
    } finally {
      setSyncing(false)
    }
  }

  if (!status) {
    return (
      <div className="px-4 py-3 rounded-lg border bg-card">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!status.connected) {
    return (
      <div className="px-4 py-3 rounded-lg border bg-card space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">{t("settings.calendar.notConnected")}</h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t("settings.calendar.notConnectedHelp")}
        </p>
        <a
          href="/api/auth/google-calendar"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
        >
          <ExternalLink className="size-3.5" />
          {t("settings.calendar.connectButton")}
        </a>
        <p className="text-[10px] text-muted-foreground/70 italic">
          {t("settings.calendar.adminNote")}
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 py-3 rounded-lg border bg-card space-y-3">
      <div className="flex items-center gap-2">
        <Check className="size-4 text-emerald-400" />
        <h3 className="text-sm font-medium">{t("settings.calendar.connected")}</h3>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/15 text-emerald-300">
          {status.enabled ? t("settings.calendar.syncing") : t("settings.calendar.paused")}
        </span>
        <SectionHelp guideId="calendarSync" className="ml-auto" />
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {t("settings.calendar.connectedDetail.pre")}{" "}
        <strong>{t("settings.calendar.connectedDetail.items")}</strong>{" "}
        {t("settings.calendar.connectedDetail.mid")}{" "}
        <code className="px-1 py-0.5 text-[10px] bg-muted/50 rounded">{status.calendarId}</code>{" "}
        {t("settings.calendar.connectedDetail.post")}{" "}
        {status.lastSyncAt
          ? new Date(status.lastSyncAt).toLocaleString()
          : t("settings.calendar.never")}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          variant="default"
          className="h-7 text-xs gap-1.5"
          disabled={syncing}
          onClick={handleSyncNow}
        >
          {syncing ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}
          {t("settings.calendar.syncNow")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={async () => {
            const r = await setCalendarSyncEnabled(!status.enabled)
            if (r.ok) {
              toast.success(status.enabled ? t("settings.calendar.pausedToast") : t("settings.calendar.resumedToast"))
              setStatus({ ...status, enabled: !status.enabled })
            } else {
              toast.error(r.error)
            }
          }}
        >
          {status.enabled ? t("settings.calendar.pauseAuto") : t("settings.calendar.resumeAuto")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-destructive hover:text-destructive"
          onClick={async () => {
            if (!confirm(t("settings.calendar.disconnectConfirm"))) return
            await disconnectCalendarSync()
            toast.success(t("settings.calendar.disconnected"))
            setStatus({ ...status, connected: false })
          }}
        >
          {t("settings.calendar.disconnect")}
        </Button>
      </div>
      <div className="flex items-start gap-2 px-2.5 py-2 rounded-md border border-amber-500/30 bg-amber-500/5">
        <AlertCircle className="size-3 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-200/85 leading-relaxed">
          {t("settings.calendar.oneWayNote")}
        </p>
      </div>
    </div>
  )
}
