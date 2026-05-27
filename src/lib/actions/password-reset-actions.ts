"use server"

import { sqlite, db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq, or } from "drizzle-orm"
import { createId } from "@/lib/utils/ids"
import crypto from "node:crypto"
import bcrypt from "bcrypt"
import { headers } from "next/headers"
import { sendEmail, isEmailConfigured } from "@/lib/email/send"

const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour
const BCRYPT_COST = 12

/**
 * Generates a single-use, time-limited reset token and emails it. The
 * response is intentionally generic ("if an account exists, an email was
 * sent") so an attacker can't enumerate valid usernames/emails by watching
 * the response shape.
 *
 * Rate limiting / abuse mitigation is light-touch — only one active token
 * per user. Older tokens for the same user are deleted on each request.
 */
export async function requestPasswordReset(
  identifier: string
): Promise<{ ok: true; emailConfigured: boolean }> {
  // Look up by username or email (either works).
  const trimmed = identifier.trim().toLowerCase()
  if (!trimmed) return { ok: true, emailConfigured: isEmailConfigured() }

  const found = await db
    .select()
    .from(users)
    .where(or(eq(users.username, trimmed), eq(users.email, trimmed)))
    .limit(1)

  if (found.length === 0 || !found[0].email) {
    // Generic response — don't reveal account existence
    return { ok: true, emailConfigured: isEmailConfigured() }
  }

  const user = found[0]
  const token = crypto.randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString()

  // Wipe previous tokens for this user (idempotent reset request)
  sqlite.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?").run(user.id)
  sqlite
    .prepare(
      "INSERT INTO password_reset_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)"
    )
    .run(createId(), user.id, token, expiresAt)

  // Build absolute URL. PUBLIC_APP_URL is preferred; otherwise derive from
  // the current request's host header.
  let baseUrl = process.env.PUBLIC_APP_URL?.replace(/\/$/, "")
  if (!baseUrl) {
    const h = await headers()
    const host = h.get("host") || "localhost:3000"
    const proto = h.get("x-forwarded-proto") || "http"
    baseUrl = `${proto}://${host}`
  }
  const link = `${baseUrl}/reset-password/${token}`

  await sendEmail({
    to: user.email!,
    subject: "Reset your FlowSpace password",
    text: `A password reset was requested for your FlowSpace account.\n\nClick to reset:\n${link}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
        <h2 style="font-size:18px;font-weight:600;margin-bottom:16px;">Reset your FlowSpace password</h2>
        <p style="line-height:1.5;color:#555;">
          A password reset was requested for the FlowSpace account
          <strong>${user.username}</strong>. If that was you, click below to set a new password:
        </p>
        <p style="margin:24px 0;">
          <a href="${link}" style="display:inline-block;background:#6366f1;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:500;">Reset password</a>
        </p>
        <p style="font-size:13px;color:#888;line-height:1.5;">
          Or paste this link into your browser:<br>
          <span style="word-break:break-all;color:#6366f1;">${link}</span>
        </p>
        <p style="font-size:13px;color:#888;margin-top:24px;">
          This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  })

  return { ok: true, emailConfigured: isEmailConfigured() }
}

/**
 * Consumes a reset token and updates the user's password. The token must
 * exist, be unused, and not be expired.
 */
export async function completePasswordReset(
  token: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!token || token.length < 32) return { ok: false, error: "Invalid token" }
  if (!newPassword || newPassword.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters" }
  }

  const row = sqlite
    .prepare("SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token = ?")
    .get(token) as { id: string; user_id: string; expires_at: string; used_at: string | null } | undefined

  if (!row) return { ok: false, error: "This reset link is not valid." }
  if (row.used_at) return { ok: false, error: "This link has already been used." }
  if (new Date(row.expires_at) < new Date()) {
    return { ok: false, error: "This link has expired. Request a new one." }
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST)

  // Update password + mark token used in one go.
  sqlite
    .prepare(
      "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
    )
    .run(passwordHash, row.user_id)
  sqlite
    .prepare("UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?")
    .run(row.id)

  // Also wipe all other active sessions for this user — forces re-login
  // with the new password on every device.
  sqlite.prepare("DELETE FROM sessions WHERE user_id = ?").run(row.user_id)

  return { ok: true }
}

/**
 * Lookup-only — used by the reset-password page to render an informative
 * "this link is bad" state before the user types their new password.
 */
export async function isResetTokenValid(token: string): Promise<boolean> {
  const row = sqlite
    .prepare("SELECT expires_at, used_at FROM password_reset_tokens WHERE token = ?")
    .get(token) as { expires_at: string; used_at: string | null } | undefined
  if (!row || row.used_at) return false
  return new Date(row.expires_at) >= new Date()
}
