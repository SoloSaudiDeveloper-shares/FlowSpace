"use client"

import { useEffect, useState } from "react"
import {
  Repeat,
  Flame,
  Plus,
  Check,
  Loader2,
  Archive,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useT } from "@/lib/hooks/use-i18n"
import {
  listMyHabits,
  createHabit,
  checkInHabit,
  archiveHabit,
  type Habit,
} from "@/lib/actions/habit-actions"

const STARTER_COLORS = ["#a78bfa", "#60a5fa", "#67e8f9", "#6ee7b7", "#fbbf24", "#fb7185"]

export function HabitsContent() {
  const { t } = useT()
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [color, setColor] = useState(STARTER_COLORS[0])
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    void refresh()
  }, [])

  async function refresh() {
    setLoading(true)
    try {
      setHabits(await listMyHabits())
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || creating) return
    setCreating(true)
    try {
      const r = await createHabit({ name: name.trim(), color })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      setName("")
      await refresh()
    } finally {
      setCreating(false)
    }
  }

  async function handleCheck(habit: Habit) {
    // Optimistic toggle
    setHabits((hs) =>
      hs.map((h) =>
        h.id === habit.id
          ? {
              ...h,
              doneToday: !h.doneToday,
              currentStreak: !h.doneToday ? h.currentStreak + 1 : Math.max(0, h.currentStreak - 1),
            }
          : h,
      ),
    )
    try {
      await checkInHabit(habit.id)
    } catch {
      toast.error(t("habits.saveError"))
      await refresh()
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">{t("habits.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("habits.subtitle")}
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="rounded-lg border bg-card p-4 space-y-3"
      >
        <div className="flex items-center gap-2">
          <Plus className="size-4 text-primary" />
          <span className="text-sm font-medium">{t("habits.new")}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("habits.placeholder")}
            maxLength={100}
            className="flex-1 min-w-[200px] h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex items-center gap-1">
            {STARTER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`size-6 rounded-full ring-offset-background transition-transform ${
                  color === c ? "scale-110 ring-2 ring-foreground" : "opacity-60 hover:opacity-100"
                }`}
                style={{ background: c }}
                aria-label={t("habits.color").replace("{c}", c)}
              />
            ))}
          </div>
          <Button size="sm" className="h-9 text-xs" disabled={!name.trim() || creating}>
            {creating ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Plus className="size-3.5 mr-1.5" />}
            {t("habits.add")}
          </Button>
        </div>
      </form>

      {loading ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : habits.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-muted-foreground/80 italic border-2 border-dashed border-border/40 rounded-lg">
          <Repeat className="size-6 mx-auto mb-2 opacity-50" />
          {t("habits.empty")}
        </div>
      ) : (
        <div className="space-y-2">
          {habits.map((h) => (
            <div
              key={h.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border bg-card hover:border-primary/30 transition-colors group ${
                h.doneToday ? "bg-card/60" : ""
              }`}
              style={{ borderLeftWidth: 3, borderLeftColor: h.color ?? "#94a3b8" }}
            >
              <button
                type="button"
                onClick={() => handleCheck(h)}
                className={`size-9 rounded-full border-2 flex items-center justify-center transition-all ${
                  h.doneToday
                    ? "border-emerald-400 bg-emerald-500/15"
                    : "border-border hover:border-primary"
                }`}
                aria-label={h.doneToday ? t("habits.undoCheckin") : t("habits.checkin")}
              >
                {h.doneToday && <Check className="size-4 text-emerald-400" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{h.name}</p>
                <p className="text-[11px] text-muted-foreground/80 capitalize">{h.cadence}</p>
              </div>
              {h.currentStreak > 0 && (
                <div className="flex items-center gap-1 text-xs font-medium text-amber-400">
                  <Flame className="size-3.5" />
                  {h.currentStreak}
                </div>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground opacity-0 group-hover:opacity-100"
                onClick={async () => {
                  if (!confirm(t("habits.archiveConfirm").replace("{name}", h.name))) return
                  await archiveHabit(h.id)
                  setHabits((hs) => hs.filter((x) => x.id !== h.id))
                  toast.success(t("habits.archived"))
                }}
                aria-label={t("habits.archiveAria")}
              >
                <Archive className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
