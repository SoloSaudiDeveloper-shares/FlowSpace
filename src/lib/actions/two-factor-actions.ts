"use server"

/**
 * Two-factor authentication setup + verification.
 *
 * Enrollment flow:
 *   1. user clicks "Enable 2FA"          → startEnrollment()
 *      → returns { secret, otpauthUri }  — UI shows QR + recovery code preview
 *   2. user enters a code from their app → confirmEnrollment(code)
 *      → flips totp_enabled=1, persists recovery codes
 *   3. on next login, the agent challenges for a code
 *
 * Recovery flow: the user enters a recovery code instead of a TOTP.
 * Each code is one-use; verifyRecoveryCode strikes it from the list.
 *
 * Disable: requires a current TOTP code (or recovery) — no silent
 *          downgrade.
 */

import { sqlite } from "@/lib/db"
import { requireAuth } from "@/lib/auth/scope"
import {
  generateTOTPSecret,
  buildOTPAuthURI,
  verifyTOTPCode,
  generateRecoveryCodes,
  hashRecoveryCode,
} from "@/lib/auth/totp"

const ISSUER = "FlowSpace"

// ─── Enrollment ──────────────────────────────────────────────────────

export async function getTwoFactorStatus(): Promise<{
  enabled: boolean
  pendingEnrollment: boolean
}> {
  const me = await requireAuth()
  const row = sqlite
    .prepare(`SELECT totp_secret, totp_enabled FROM users WHERE id = ?`)
    .get(me.id) as { totp_secret: string | null; totp_enabled: number } | undefined
  return {
    enabled: row?.totp_enabled === 1,
    pendingEnrollment: !!row?.totp_secret && row?.totp_enabled !== 1,
  }
}

export async function startTwoFactorEnrollment(): Promise<
  | { ok: true; secret: string; otpauthUri: string }
  | { ok: false; error: string }
> {
  const me = await requireAuth()
  // If they're already enrolled, refuse so they have to disable first
  // (prevents an attacker who briefly hijacks a session from rotating
  // the secret silently).
  const cur = sqlite
    .prepare(`SELECT totp_enabled FROM users WHERE id = ?`)
    .get(me.id) as { totp_enabled: number } | undefined
  if (cur?.totp_enabled === 1) {
    return { ok: false, error: "Two-factor is already enabled. Disable it first to re-enroll." }
  }
  const secret = generateTOTPSecret()
  sqlite
    .prepare(`UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?`)
    .run(secret, me.id)
  const userRow = sqlite
    .prepare(`SELECT username FROM users WHERE id = ?`)
    .get(me.id) as { username: string } | undefined
  return {
    ok: true,
    secret,
    otpauthUri: buildOTPAuthURI({
      secret,
      account: userRow?.username ?? "user",
      issuer: ISSUER,
    }),
  }
}

export async function confirmTwoFactorEnrollment(
  code: string,
): Promise<{ ok: true; recoveryCodes: string[] } | { ok: false; error: string }> {
  const me = await requireAuth()
  const row = sqlite
    .prepare(`SELECT totp_secret FROM users WHERE id = ?`)
    .get(me.id) as { totp_secret: string | null } | undefined
  if (!row?.totp_secret) {
    return { ok: false, error: "No enrollment in progress. Click Enable first." }
  }
  if (!verifyTOTPCode(row.totp_secret, code)) {
    return { ok: false, error: "That code didn't match — check the time on your phone and try again." }
  }
  // Generate single-use recovery codes; hash them before storing.
  const codes = generateRecoveryCodes()
  const hashes = codes.map(hashRecoveryCode)
  sqlite
    .prepare(
      `UPDATE users
         SET totp_enabled = 1,
             totp_recovery_hashes = ?,
             updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(JSON.stringify(hashes), me.id)
  return { ok: true, recoveryCodes: codes }
}

export async function disableTwoFactor(
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requireAuth()
  const row = sqlite
    .prepare(
      `SELECT totp_secret, totp_recovery_hashes FROM users WHERE id = ? AND totp_enabled = 1`,
    )
    .get(me.id) as
    | { totp_secret: string | null; totp_recovery_hashes: string | null }
    | undefined
  if (!row || !row.totp_secret) {
    return { ok: false, error: "Two-factor isn't enabled." }
  }
  const { verifyTwoFactorForLogin } = await import("@/lib/auth/two-factor-verify")
  const passes = verifyTwoFactorForLogin(me.id, code)
  if (!passes) {
    return { ok: false, error: "Code didn't match." }
  }
  sqlite
    .prepare(
      `UPDATE users
         SET totp_secret = NULL,
             totp_enabled = 0,
             totp_recovery_hashes = NULL,
             updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(me.id)
  return { ok: true }
}

export async function regenerateRecoveryCodes(
  code: string,
): Promise<{ ok: true; recoveryCodes: string[] } | { ok: false; error: string }> {
  const me = await requireAuth()
  const row = sqlite
    .prepare(`SELECT totp_secret FROM users WHERE id = ? AND totp_enabled = 1`)
    .get(me.id) as { totp_secret: string | null } | undefined
  if (!row?.totp_secret) return { ok: false, error: "Two-factor isn't enabled." }
  if (!verifyTOTPCode(row.totp_secret, code)) {
    return { ok: false, error: "Code didn't match." }
  }
  const codes = generateRecoveryCodes()
  const hashes = codes.map(hashRecoveryCode)
  sqlite
    .prepare(`UPDATE users SET totp_recovery_hashes = ? WHERE id = ?`)
    .run(JSON.stringify(hashes), me.id)
  return { ok: true, recoveryCodes: codes }
}

// Verification (sync) helpers live in `@/lib/auth/two-factor-verify` so
// they can be called from places that aren't "use server" files.
