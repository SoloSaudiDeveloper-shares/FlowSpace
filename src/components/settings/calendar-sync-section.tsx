"use client"

import { useEffect, useState } from "react"
import { Calendar, ExternalLink, AlertCircle, Loader2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  getCalendarSyncStatus,
  setCalendarSyncEnabled,
  disconnectCalendarSync,
  type CalendarSyncStatus,
} from "@/lib/actions/calendar-sync-actions"

export function CalendarSyncSection() {
  const [status, setStatus] = useState<CalendarSyncStatus | null>(null)

  useEffect(() => {
    void getCalendarSyncStatus().then(setStatus).catch(() => undefined)
  }, [])

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
          <h3 className="text-sm font-medium">Not connected</h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Connect your Google Calendar so tasks with due dates appear there
          automatically. Permission grants Calendar event read/write on
          your primary calendar only.
        </p>
        <a
          href="/api/auth/google-calendar"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
        >
          <ExternalLink className="size-3.5" />
          Connect Google Calendar
        </a>
        <p className="text-[10px] text-muted-foreground/70 italic">
          Requires the server admin to expose the calendar OAuth scope.
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 py-3 rounded-lg border bg-card space-y-3">
      <div className="flex items-center gap-2">
        <Check className="size-4 text-emerald-400" />
        <h3 className="text-sm font-medium">Connected</h3>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/15 text-emerald-300">
          {status.enabled ? "Syncing" : "Paused"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Pushing to <code className="px-1 py-0.5 text-[10px] bg-muted/50 rounded">{status.calendarId}</code>.
        Last sync:{" "}
        {status.lastSyncAt
          ? new Date(status.lastSyncAt).toLocaleString()
          : "never"}
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant={status.enabled ? "outline" : "default"}
          className="h-7 text-xs"
          onClick={async () => {
            const r = await setCalendarSyncEnabled(!status.enabled)
            if (r.ok) {
              toast.success(status.enabled ? "Sync paused" : "Sync resumed")
              setStatus({ ...status, enabled: !status.enabled })
            } else {
              toast.error(r.error)
            }
          }}
        >
          {status.enabled ? "Pause sync" : "Resume sync"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-destructive hover:text-destructive"
          onClick={async () => {
            if (!confirm("Disconnect Google Calendar? Existing events stay; new tasks won't be pushed.")) return
            await disconnectCalendarSync()
            toast.success("Disconnected")
            setStatus({ ...status, connected: false })
          }}
        >
          Disconnect
        </Button>
      </div>
      <div className="flex items-start gap-2 px-2.5 py-2 rounded-md border border-amber-500/30 bg-amber-500/5">
        <AlertCircle className="size-3 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-200/85 leading-relaxed">
          Sync is one-way. Tasks → Calendar. Editing the event on Google
          Calendar's side won't change the FlowSpace task.
        </p>
      </div>
    </div>
  )
}
