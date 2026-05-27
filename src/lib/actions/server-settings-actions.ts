"use server"

import { sqlite } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth/scope"

/**
 * Generic key-value config store. Keys are well-known strings, values are
 * stored as TEXT. Callers use the typed helpers below rather than touching
 * raw keys.
 *
 * Reads are public (no auth needed) so the login page can ask "are signups
 * open?" without an active session. Writes are restricted to owner role
 * via requireOwner().
 */

function getRaw(key: string): string | null {
  const row = sqlite
    .prepare("SELECT value FROM server_settings WHERE key = ?")
    .get(key) as { value: string } | undefined
  return row?.value ?? null
}

function setRaw(key: string, value: string) {
  sqlite
    .prepare(
      `INSERT INTO server_settings (key, value, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run(key, value)
}

async function requireOwner() {
  const user = await requireAuth()
  if (user.role !== "owner") throw new Error("Forbidden: owner only")
  return user
}

// ── Typed settings ────────────────────────────────────────────────────

/** Whether anyone can register an account besides the initial setup. */
export async function getSignupsEnabled(): Promise<boolean> {
  return getRaw("signupsEnabled") === "true"
}

export async function setSignupsEnabled(enabled: boolean) {
  await requireOwner()
  setRaw("signupsEnabled", enabled ? "true" : "false")
  revalidatePath("/login")
  revalidatePath("/settings")
}
