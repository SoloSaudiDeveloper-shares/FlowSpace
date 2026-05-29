/**
 * Sync helpers for 2FA — separated from `actions/two-factor-actions.ts`
 * because "use server" files may only export async functions.
 *
 * `verifyTwoFactorForLogin` is called during login (which is itself an
 * async action) to gate session creation on a valid TOTP or recovery
 * code.
 */

import "server-only"
import { sqlite } from "@/lib/db"
import { verifyTOTPCode, hashRecoveryCode } from "@/lib/auth/totp"

export function verifyTwoFactorForLogin(userId: string, code: string): boolean {
  const row = sqlite
    .prepare(
      `SELECT totp_secret, totp_recovery_hashes FROM users WHERE id = ? AND totp_enabled = 1`,
    )
    .get(userId) as
    | { totp_secret: string | null; totp_recovery_hashes: string | null }
    | undefined
  if (!row || !row.totp_secret) return false
  if (verifyTOTPCode(row.totp_secret, code)) return true
  return consumeRecoveryCode(userId, code, row.totp_recovery_hashes)
}

function consumeRecoveryCode(
  userId: string,
  code: string,
  rawHashesJson: string | null,
): boolean {
  if (!rawHashesJson) return false
  let hashes: string[]
  try {
    hashes = JSON.parse(rawHashesJson) as string[]
  } catch {
    return false
  }
  const target = hashRecoveryCode(code)
  const idx = hashes.indexOf(target)
  if (idx === -1) return false
  hashes.splice(idx, 1)
  sqlite
    .prepare(`UPDATE users SET totp_recovery_hashes = ? WHERE id = ?`)
    .run(JSON.stringify(hashes), userId)
  return true
}
