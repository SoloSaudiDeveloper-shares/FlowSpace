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

// ── Session duration ──────────────────────────────────────────────────

/** Default: 7 days. Login uses this when minting new session cookies. */
const DEFAULT_SESSION_MS = 7 * 24 * 60 * 60 * 1000

// Bounds: 1 minute minimum, 90 days maximum.
const MIN_SESSION_MS = 60 * 1000
const MAX_SESSION_MS = 90 * 24 * 60 * 60 * 1000

export async function getSessionDurationMs(): Promise<number> {
  const raw = getRaw("sessionDurationMs")
  if (!raw) return DEFAULT_SESSION_MS
  const n = parseInt(raw, 10)
  if (Number.isNaN(n) || n < MIN_SESSION_MS) return DEFAULT_SESSION_MS
  return Math.min(n, MAX_SESSION_MS)
}

export async function setSessionDurationMs(ms: number) {
  await requireOwner()
  const clamped = Math.min(Math.max(ms, MIN_SESSION_MS), MAX_SESSION_MS)
  setRaw("sessionDurationMs", String(clamped))
  revalidatePath("/settings")
}

// ── Workspace name (admin-set, shown to everyone) ─────────────────────
// This is the bold prefix in the sidebar header. Owners change it for
// the whole workspace; everyone else just reads it. Per-user personal
// tagline (the line under it) is stored in user_preferences.workspaceSuffix.

const DEFAULT_WORKSPACE_NAME = "FlowSpace"

export async function getWorkspaceName(): Promise<string> {
  const raw = getRaw("workspaceName")
  return raw && raw.trim() ? raw : DEFAULT_WORKSPACE_NAME
}

export async function setWorkspaceName(name: string) {
  await requireOwner()
  const trimmed = name.trim().slice(0, 40)
  if (!trimmed) throw new Error("Workspace name cannot be empty")
  setRaw("workspaceName", trimmed)
  // The name shows up on every page (sidebar header), so revalidate root.
  revalidatePath("/", "layout")
}
