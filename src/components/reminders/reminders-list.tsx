"use client"

import { Bell, BellOff, Clock, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { updateReminder } from "@/lib/actions/reminder-actions"
import { deleteElement } from "@/lib/actions/element-actions"
import type { reminders, elements } from "@/lib/db/schema"
import { ContextMenu, useContextMenu, type ContextMenuEntry } from "@/components/shared/context-menu"
import { useT } from "@/lib/hooks/use-i18n"

type Reminder = typeof reminders.$inferSelect
type Element = typeof elements.$inferSelect

interface RemindersListProps {
  reminders: Array<{ reminder: Reminder; element: Element }>
}

function formatRemindDate(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const isPast = date < now

  return {
    text: date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
    isPast,
  }
}

function ActiveReminderRow({ reminder, element }: { reminder: Reminder; element: Element }) {
  const { t } = useT()
  const { menu: ctxMenu, open: openCtx, close: closeCtx } = useContextMenu()
  const { text, isPast } = formatRemindDate(reminder.remindAt)

  function handleContextMenu(e: React.MouseEvent) {
    const items: ContextMenuEntry[] = [
      {
        label: t("misc.reminders.dismiss"),
        icon: BellOff,
        onClick: () => updateReminder(reminder.id, { isDismissed: true }),
      },
      { separator: true },
      {
        label: t("misc.reminders.delete"),
        icon: Trash2,
        variant: "destructive",
        onClick: () => deleteElement(reminder.id),
      },
    ]
    openCtx(e, items)
  }

  return (
    <>
      <div
        className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors"
        onContextMenu={handleContextMenu}
      >
        <div className={`size-8 rounded-full flex items-center justify-center shrink-0 ${
          isPast ? "bg-red-500/20" : "bg-amber-500/20"
        }`}>
          <Bell className={`size-4 ${isPast ? "text-red-400" : "text-amber-400"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{element.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="size-3" />
              {text}
            </span>
            {isPast && (
              <Badge variant="destructive" className="text-xs px-1.5 py-0">
                {t("misc.reminders.overdue")}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Input
            type="datetime-local"
            className="w-auto text-xs h-8"
            defaultValue={reminder.remindAt.slice(0, 16)}
            onChange={(e) => {
              if (e.target.value) {
                updateReminder(reminder.id, {
                  remindAt: new Date(e.target.value).toISOString(),
                })
              }
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => updateReminder(reminder.id, { isDismissed: true })}
          >
            <BellOff className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-destructive"
            onClick={() => deleteElement(reminder.id)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxMenu.items}
          onClose={closeCtx}
        />
      )}
    </>
  )
}

function DismissedReminderRow({ reminder, element }: { reminder: Reminder; element: Element }) {
  const { t } = useT()
  const { menu: ctxMenu, open: openCtx, close: closeCtx } = useContextMenu()

  function handleContextMenu(e: React.MouseEvent) {
    const items: ContextMenuEntry[] = [
      {
        label: t("misc.reminders.restore"),
        icon: Bell,
        onClick: () => updateReminder(reminder.id, { isDismissed: false }),
      },
      { separator: true },
      {
        label: t("misc.reminders.delete"),
        icon: Trash2,
        variant: "destructive",
        onClick: () => deleteElement(reminder.id),
      },
    ]
    openCtx(e, items)
  }

  return (
    <>
      <div
        className="flex items-center gap-3 rounded-lg border p-3"
        onContextMenu={handleContextMenu}
      >
        <BellOff className="size-4 text-muted-foreground shrink-0" />
        <span className="text-sm flex-1 line-through">{element.title}</span>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => updateReminder(reminder.id, { isDismissed: false })}
        >
          {t("misc.reminders.restore")}
        </Button>
      </div>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxMenu.items}
          onClose={closeCtx}
        />
      )}
    </>
  )
}

export function RemindersList({ reminders }: RemindersListProps) {
  const { t } = useT()
  const active = reminders.filter((r) => !r.reminder.isDismissed)
  const dismissed = reminders.filter((r) => r.reminder.isDismissed)

  return (
    <div className="space-y-6">
      {/* Active reminders */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <Bell className="size-4" />
          {t("misc.reminders.active").replace("{count}", String(active.length))}
        </h2>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8 border rounded-lg border-dashed">
            {t("misc.reminders.empty")}
          </p>
        ) : (
          <div className="space-y-2">
            {active.map(({ reminder, element }) => (
              <ActiveReminderRow key={reminder.id} reminder={reminder} element={element} />
            ))}
          </div>
        )}
      </div>

      {/* Dismissed */}
      {dismissed.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <BellOff className="size-4" />
            {t("misc.reminders.dismissed").replace("{count}", String(dismissed.length))}
          </h2>
          <div className="space-y-2 opacity-60">
            {dismissed.map(({ reminder, element }) => (
              <DismissedReminderRow key={reminder.id} reminder={reminder} element={element} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
