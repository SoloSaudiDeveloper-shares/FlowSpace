/**
 * Canonical task/todo priority definitions.
 *
 * Single source of truth for the value ↔ label ↔ colour ↔ sort-order mapping
 * that was previously copy-pasted across a dozen view components. New code
 * should import from here; older views are being migrated incrementally.
 */

export type Priority = "urgent" | "high" | "medium" | "low" | "none"

export interface PriorityDef {
  value: Priority
  label: string
  /** Solid hex used for swatches / bars / chips. */
  color: string
  /** Tailwind text class used for the flag icon in lists. */
  textClass: string
  /** Tailwind classes for a soft chip (bg + text + border). Empty for none. */
  chipClass: string
  /** Leading emoji used in plain-text surfaces (e.g. Telegram menus). */
  emoji: string
  /** Sort weight (lower = higher priority). */
  order: number
}

export const PRIORITIES: PriorityDef[] = [
  { value: "urgent", label: "Urgent", color: "#ef4444", textClass: "text-red-400", chipClass: "bg-red-500/20 text-red-400 border-red-500/30", emoji: "🔥", order: 0 },
  { value: "high", label: "High", color: "#f97316", textClass: "text-orange-400", chipClass: "bg-orange-500/20 text-orange-400 border-orange-500/30", emoji: "🟠", order: 1 },
  { value: "medium", label: "Medium", color: "#eab308", textClass: "text-yellow-400", chipClass: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", emoji: "🟡", order: 2 },
  { value: "low", label: "Low", color: "#3b82f6", textClass: "text-blue-400", chipClass: "bg-blue-500/20 text-blue-400 border-blue-500/30", emoji: "🔵", order: 3 },
  { value: "none", label: "None", color: "#94a3b8", textClass: "text-muted-foreground/30", chipClass: "", emoji: "⚪", order: 4 },
]

export const PRIORITY_BY_VALUE: Record<Priority, PriorityDef> = Object.fromEntries(
  PRIORITIES.map((p) => [p.value, p]),
) as Record<Priority, PriorityDef>

export const PRIORITY_COLOR: Record<Priority, string> = Object.fromEntries(
  PRIORITIES.map((p) => [p.value, p.color]),
) as Record<Priority, string>

export const PRIORITY_ORDER: Record<Priority, number> = Object.fromEntries(
  PRIORITIES.map((p) => [p.value, p.order]),
) as Record<Priority, number>

/** Priority values high→low, for iterating breakdowns. */
export const PRIORITY_ORDER_LIST: Priority[] = PRIORITIES.map((p) => p.value)

export const PRIORITY_LABEL: Record<Priority, string> = Object.fromEntries(
  PRIORITIES.map((p) => [p.value, p.label]),
) as Record<Priority, string>

export const PRIORITY_TEXT_CLASS: Record<Priority, string> = Object.fromEntries(
  PRIORITIES.map((p) => [p.value, p.textClass]),
) as Record<Priority, string>

export const PRIORITY_CHIP: Record<Priority, string> = Object.fromEntries(
  PRIORITIES.map((p) => [p.value, p.chipClass]),
) as Record<Priority, string>

export const PRIORITY_EMOJI: Record<Priority, string> = Object.fromEntries(
  PRIORITIES.map((p) => [p.value, p.emoji]),
) as Record<Priority, string>

export function priorityLabel(v: string): string {
  return PRIORITY_BY_VALUE[v as Priority]?.label ?? "None"
}

export function colorToPriority(color: string): Priority {
  return PRIORITIES.find((p) => p.color === color)?.value ?? "none"
}
