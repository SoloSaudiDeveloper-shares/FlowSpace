/**
 * Natural-language quick-add parser.
 *
 * Turns a single line like `Submit report fri #high` into a structured task:
 *   { title: "Submit report", priority: "high", dueDate: "2026-06-05" }
 *
 * Supported tokens (case-insensitive, stripped from the title):
 *   • Priority — `#urgent` `#high` `#medium` `#low` `#none`
 *   • Relative — `today` `tod` `tomorrow` `tmr` `tom` `next week`
 *   • Weekday  — `mon|monday … sun|sunday` (next occurrence; same-day → next week)
 *   • ISO date — `2026-06-10` (optionally prefixed with `@`)
 *
 * Only the FIRST date token is consumed. Pure & deterministic given `now`.
 */

export type QuickAddPriority = "urgent" | "high" | "medium" | "low" | "none"

export interface ParsedQuickAdd {
  title: string
  priority?: QuickAddPriority
  /** ISO yyyy-mm-dd, or undefined if no date token was found. */
  dueDate?: string
}

const PRIORITY_RE = /(?:^|\s)#(urgent|high|medium|low|none)\b/i

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
}

function isoOf(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function addDays(now: Date, days: number): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  d.setDate(d.getDate() + days)
  return d
}

/**
 * Find and remove the first recognised date token. Returns the cleaned text
 * plus the resolved ISO date (or null if none found).
 */
function extractDate(text: string, now: Date): { text: string; dueDate?: string } {
  // 1) ISO date, optionally @-prefixed.
  const iso = text.match(/(?:^|\s)@?(\d{4}-\d{2}-\d{2})\b/)
  if (iso) {
    const d = new Date(`${iso[1]}T00:00:00`)
    if (!isNaN(d.getTime())) {
      return { text: text.replace(iso[0], " "), dueDate: iso[1] }
    }
  }

  // 2) "next week"
  const nextWeek = text.match(/(?:^|\s)next\s+week\b/i)
  if (nextWeek) {
    return { text: text.replace(nextWeek[0], " "), dueDate: isoOf(addDays(now, 7)) }
  }

  // 3) Relative words.
  const rel = text.match(/(?:^|\s)(today|tod|tomorrow|tmr|tom)\b/i)
  if (rel) {
    const word = rel[1].toLowerCase()
    const days = word === "today" || word === "tod" ? 0 : 1
    return { text: text.replace(rel[0], " "), dueDate: isoOf(addDays(now, days)) }
  }

  // 4) Weekday names → next occurrence (same weekday today resolves to +7).
  const wd = text.match(
    /(?:^|\s)(sunday|saturday|thursday|wednesday|tuesday|monday|friday|thurs|thur|tues|weds|sun|mon|tue|wed|thu|fri|sat)\b/i,
  )
  if (wd) {
    const target = WEEKDAYS[wd[1].toLowerCase()]
    if (target !== undefined) {
      let diff = (target - now.getDay() + 7) % 7
      if (diff === 0) diff = 7
      return { text: text.replace(wd[0], " "), dueDate: isoOf(addDays(now, diff)) }
    }
  }

  return { text }
}

export function parseQuickAdd(input: string, now: Date = new Date()): ParsedQuickAdd {
  const original = input.trim()
  let rest = ` ${original} `

  let priority: QuickAddPriority | undefined
  const pri = rest.match(PRIORITY_RE)
  if (pri) {
    priority = pri[1].toLowerCase() as QuickAddPriority
    rest = rest.replace(pri[0], " ")
  }

  const { text, dueDate } = extractDate(rest, now)
  rest = text

  const title = rest.replace(/\s+/g, " ").trim()

  return {
    // Never return an empty title — fall back to the original line.
    title: title || original,
    priority,
    dueDate,
  }
}
