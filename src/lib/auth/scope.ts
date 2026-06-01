import "server-only"
import { db } from "@/lib/db"
import { elements } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/actions/user-actions"
import { eq, and } from "drizzle-orm"

/**
 * Returns the authenticated user or throws. Use this at the top of any
 * server action that mutates data. For read paths, prefer `currentUserId()`
 * and filter the query by ownership directly so unauthenticated callers
 * just see empty arrays instead of an error page.
 */
export async function requireAuth() {
  const u = await getCurrentUser()
  if (!u) throw new Error("Not authenticated")
  return u
}

/** Convenience — returns user.id or null. */
export async function currentUserId(): Promise<string | null> {
  const u = await getCurrentUser()
  return u?.id ?? null
}

/**
 * Require the caller to hold one of the given roles. Throws "Not authenticated"
 * or "Forbidden". Use to gate admin-only / privileged server actions.
 */
export async function requireRole(...allowed: string[]) {
  const u = await requireAuth()
  if (!allowed.includes(u.role)) throw new Error("Forbidden")
  return u
}

/** Require an administrative role (owner or admin). */
export async function requireAdmin() {
  return requireRole("owner", "admin")
}

/**
 * Verifies the element exists AND is owned by the current user.
 * Throws "Not authenticated" or "Forbidden" so server actions never
 * silently leak data.
 *
 * Returns the loaded element so callers can reuse it.
 */
export async function requireOwnedElement(elementId: string) {
  const user = await requireAuth()
  const rows = await db
    .select()
    .from(elements)
    .where(and(eq(elements.id, elementId), eq(elements.createdBy, user.id)))
    .limit(1)
  if (rows.length === 0) throw new Error("Forbidden")
  return rows[0]
}
