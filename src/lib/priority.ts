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
  /** Sort weight (lower = higher priority). */
  order: number
}

export const PRIORITIES: PriorityDef[] = [
  { value: "urgent", label: "Urgent", color: "#ef4444", textClass: "text-red-400", order: 0 },
  { value: "high", label: "High", color: "#f97316", textClass: "text-orange-400", order: 1 },
  { value: "medium", label: "Medium", color: "#eab308", textClass: "text-yellow-400", order: 2 },
  { value: "low", label: "Low", color: "#3b82f6", textClass: "text-blue-400", order: 3 },
  { value: "none", label: "None", color: "#94a3b8", textClass: "text-muted-foreground/30", order: 4 },
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

export function priorityLabel(v: string): string {
  return PRIORITY_BY_VALUE[v as Priority]?.label ?? "None"
}

export function colorToPriority(color: string): Priority {
  return PRIORITIES.find((p) => p.color === color)?.value ?? "none"
}
