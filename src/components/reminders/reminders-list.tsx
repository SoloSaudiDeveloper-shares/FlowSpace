"use client"

import { Bell, BellOff, Clock, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { updateReminder } from "@/lib/actions/reminder-actions"
import { deleteElement } from "@/lib/actions/element-actions"
import type { reminders, elements } from "@/lib/db/schema"

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

export function RemindersList({ reminders }: RemindersListProps) {
  const active = reminders.filter((r) => !r.reminder.isDismissed)
  const dismissed = reminders.filter((r) => r.reminder.isDismissed)

  return (
    <div className="space-y-6">
      {/* Active reminders */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <Bell className="size-4" />
          Active ({active.length})
        </h2>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8 border rounded-lg border-dashed">
            No active reminders
          </p>
        ) : (
          <div className="space-y-2">
            {active.map(({ reminder, element }) => {
              const { text, isPast } = formatRemindDate(reminder.remindAt)
              return (
                <div
                  key={reminder.id}
                  className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors"
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
                          Overdue
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
                      onClick={() =>
                        updateReminder(reminder.id, { isDismissed: true })
                      }
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
              )
            })}
          </div>
        )}
      </div>

      {/* Dismissed */}
      {dismissed.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <BellOff className="size-4" />
            Dismissed ({dismissed.length})
          </h2>
          <div className="space-y-2 opacity-60">
            {dismissed.map(({ reminder, element }) => (
              <div
                key={reminder.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <BellOff className="size-4 text-muted-foreground shrink-0" />
                <span className="text-sm flex-1 line-through">{element.title}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() =>
                    updateReminder(reminder.id, { isDismissed: false })
                  }
                >
                  Restore
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
