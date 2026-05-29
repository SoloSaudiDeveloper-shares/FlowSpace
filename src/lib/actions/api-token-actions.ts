"use server"

/**
 * Personal API tokens — bearer credentials for scripts and integrations
 * that don't want to maintain a session cookie.
 *
 * Issuance: generate a random 32-byte token, return the raw value once
 * (we never store it). Store SHA-256 hash. Every subsequent
 * verification matches against the hash.
 *
 * Format: `flws_<base64url(20 bytes)>` — namespaced prefix lets us spot
 * tokens in code and revoke them via GitHub's secret-scanning push
 * protection.
 */

import crypto from "crypto"
import { sqlite } from "@/lib/db"
import { requireAuth } from "@/lib/auth/scope"
import { createId } from "@/lib/utils/ids"

export interface ApiTokenRow {
  id: string
  name: string
  lastUsedAt: string | null
  createdAt: string
  expiresAt: string | null
}

const TOKEN_PREFIX = "flws_"

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex")
}

export async function listMyApiTokens(): Promise<ApiTokenRow[]> {
  const me = await requireAuth()
  return sqlite
    .prepare(
      `SELECT id, name, last_used_at AS lastUsedAt, created_at AS createdAt, expires_at AS expiresAt
         FROM api_tokens
        WHERE user_id = ?
        ORDER BY created_at DESC`,
    )
    .all(me.id) as ApiTokenRow[]
}

/**
 * Issue a new token. The raw value is returned ONCE; subsequent calls
 * can only see the hashed form, so the user must copy it now.
 */
export async function createApiToken(input: {
  name: string
  expiresInDays?: number
}): Promise<
  | { ok: true; id: string; token: string }
  | { ok: false; error: string }
> {
  const me = await requireAuth()
  const name = input.name.trim()
  if (!name) return { ok: false, error: "Name is required." }
  if (name.length > 100) return { ok: false, error: "Name too long." }
  const raw = `${TOKEN_PREFIX}${crypto.randomBytes(24).toString("base64url")}`
  const id = createId()
  const expiresAt =
    input.expiresInDays && input.expiresInDays > 0
      ? new Date(Date.now() + input.expiresInDays * 86400_000).toISOString()
      : null
  sqlite
    .prepare(
      `INSERT INTO api_tokens (id, user_id, name, token_hash, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, me.id, name, hashToken(raw), expiresAt)
  return { ok: true, id, token: raw }
}

export async function revokeApiToken(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requireAuth()
  const r = sqlite
    .prepare(`DELETE FROM api_tokens WHERE id = ? AND user_id = ?`)
    .run(id, me.id)
  if (r.changes === 0) return { ok: false, error: "Token not found." }
  return { ok: true }
}

// Bearer-token verification (sync) lives in `@/lib/auth/bearer` so it
// can be called from API routes without "use server" restrictions.
