/**
 * Task recurrence rules.
 *
 * A recurring task spawns its next occurrence when you complete it: the
 * completed copy stays in Done, and a fresh copy appears with its due date
 * rolled forward by the rule. Stored as a short string in `tasks.repeat_rule`
 * (null / "" = does not repeat).
 */

export type RepeatRule =
  | "daily"
  | "weekdays"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "yearly"

export const REPEAT_OPTIONS: { value: RepeatRule | ""; label: string }[] = [
  { value: "", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Every weekday (Mon–Fri)" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
]

const REPEAT_LABELS: Record<RepeatRule, string> = {
  daily: "Daily",
  weekdays: "Weekdays",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  yearly: "Yearly",
}

export function isRepeatRule(v: unknown): v is RepeatRule {
  return typeof v === "string" && v in REPEAT_LABELS
}

export function repeatLabel(rule: string | null | undefined): string | null {
  return rule && isRepeatRule(rule) ? REPEAT_LABELS[rule] : null
}

/** Move a date one step forward by the rule (no past-date guard). */
function step(d: Date, rule: RepeatRule): void {
  switch (rule) {
    case "daily":
      d.setDate(d.getDate() + 1)
      break
    case "weekdays":
      do {
        d.setDate(d.getDate() + 1)
      } while (d.getDay() === 0 || d.getDay() === 6)
      break
    case "weekly":
      d.setDate(d.getDate() + 7)
      break
    case "biweekly":
      d.setDate(d.getDate() + 14)
      break
    case "monthly":
      d.setMonth(d.getMonth() + 1)
      break
    case "yearly":
      d.setFullYear(d.getFullYear() + 1)
      break
  }
}

function formatLike(template: string, d: Date): string {
  // Preserve the stored shape: date-only ("yyyy-mm-dd") vs full ISO datetime.
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  const dateOnly = `${y}-${m}-${day}`
  if (template.includes("T")) {
    const hh = String(d.getHours()).padStart(2, "0")
    const mm = String(d.getMinutes()).padStart(2, "0")
    const ss = String(d.getSeconds()).padStart(2, "0")
    return `${dateOnly}T${hh}:${mm}:${ss}`
  }
  return dateOnly
}

/**
 * Advance an ISO date string by the rule, rolling forward until it lands
 * strictly after `now` (so completing a long-overdue recurring task gives a
 * sensible future date rather than another overdue one). Caps iterations so a
 * pathological input can't loop forever. Returns the same string shape it was
 * given (date-only or datetime).
 */
export function advanceDate(
  iso: string,
  rule: RepeatRule,
  now: Date = new Date(),
): string {
  const base = new Date(iso)
  if (isNaN(base.getTime())) return iso
  const d = new Date(base)
  let guard = 0
  do {
    step(d, rule)
    guard++
  } while (d.getTime() <= now.getTime() && guard < 800)
  return formatLike(iso, d)
}
