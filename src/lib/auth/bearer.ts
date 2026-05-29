/**
 * Bearer-token authentication helper.
 *
 * Looks up an API token in the database and returns the owning user
 * id. Stamps `last_used_at` on every successful lookup so users can see
 * which tokens are actually in use.
 *
 * Tokens are SHA-256 hashed at rest — we never compare raw strings.
 *
 * Lives outside `/actions` because it's sync and used by API routes.
 */

import "server-only"
import crypto from "crypto"
import { sqlite } from "@/lib/db"

const TOKEN_PREFIX = "flws_"

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex")
}

/**
 * Pull a bearer token out of an `Authorization: Bearer …` header and
 * resolve it to a user id. Returns null on missing/malformed/expired.
 */
export function authenticateByBearer(authHeader: string | null): {
  userId: string
} | null {
  if (!authHeader) return null
  const match = authHeader.match(/^Bearer\s+(\S+)$/i)
  if (!match) return null
  const rawToken = match[1]
  if (!rawToken.startsWith(TOKEN_PREFIX)) return null
  const hash = hashToken(rawToken)
  const row = sqlite
    .prepare(
      `SELECT id, user_id AS userId, expires_at AS expiresAt
         FROM api_tokens
        WHERE token_hash = ?`,
    )
    .get(hash) as { id: string; userId: string; expiresAt: string | null } | undefined
  if (!row) return null
  if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
    return null
  }
  sqlite
    .prepare(`UPDATE api_tokens SET last_used_at = datetime('now') WHERE id = ?`)
    .run(row.id)
  return { userId: row.userId }
}
