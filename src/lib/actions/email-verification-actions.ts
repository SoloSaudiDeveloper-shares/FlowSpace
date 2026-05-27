"use server"

import { sqlite, db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { createId } from "@/lib/utils/ids"
import crypto from "node:crypto"
import { headers } from "next/headers"
import { sendEmail, isEmailConfigured } from "@/lib/email/send"
import { requireAuth } from "@/lib/auth/scope"

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Generates a verification token + emails the link. Returns ok regardless
 * of whether the user actually had an email (don't reveal account state).
 * Skipped silently when SMTP isn't configured — the page UI will warn.
 */
export async function requestEmailVerification(userId?: string): Promise<{ ok: true; sent: boolean }> {
  // If no userId passed, verify the CURRENT user's email
  let resolvedUserId = userId
  if (!resolvedUserId) {
    const me = await requireAuth()
    resolvedUserId = me.id
  }

  const row = await db.select().from(users).where(eq(users.id, resolvedUserId)).limit(1)
  if (row.length === 0 || !row[0].email) return { ok: true, sent: false }
  const user = row[0]

  // Already verified — no-op
  const verifiedRow = sqlite
    .prepare(`SELECT email_verified FROM users WHERE id = ?`)
    .get(user.id) as { email_verified: number } | undefined
  if (verifiedRow?.email_verified === 1) return { ok: true, sent: false }

  if (!isEmailConfigured()) return { ok: true, sent: false }

  const token = crypto.randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString()
  // One active token per user — wipe any stale ones first.
  sqlite.prepare(`DELETE FROM email_verification_tokens WHERE user_id = ?`).run(user.id)
  sqlite
    .prepare(
      `INSERT INTO email_verification_tokens (id, user_id, email, token, expires_at) VALUES (?, ?, ?, ?, ?)`
    )
    .run(createId(), user.id, user.email!, token, expiresAt)

  let baseUrl = process.env.PUBLIC_APP_URL?.replace(/\/$/, "")
  if (!baseUrl) {
    const h = await headers()
    const host = h.get("host") || "localhost:3000"
    const proto = h.get("x-forwarded-proto") || "http"
    baseUrl = `${proto}://${host}`
  }
  const link = `${baseUrl}/verify-email/${token}`

  await sendEmail({
    to: user.email!,
    subject: "Verify your FlowSpace email",
    text: `Click to confirm your email address on FlowSpace:\n\n${link}\n\nLink expires in 24 hours.`,
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
        <h2 style="font-size:18px;font-weight:600;margin-bottom:16px;">Confirm your email</h2>
        <p style="line-height:1.5;color:#555;">
          Welcome to FlowSpace, <strong>${user.displayName}</strong>. Tap below to confirm
          this email address so you can recover your account if you ever lose your password.
        </p>
        <p style="margin:24px 0;">
          <a href="${link}" style="display:inline-block;background:#6366f1;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:500;">Confirm email</a>
        </p>
        <p style="font-size:13px;color:#888;line-height:1.5;">
          Or paste this link into your browser:<br>
          <span style="word-break:break-all;color:#6366f1;">${link}</span>
        </p>
        <p style="font-size:13px;color:#888;margin-top:24px;">
          This link expires in 24 hours. If you didn't sign up for FlowSpace, ignore this email.
        </p>
      </div>
    `,
  })

  return { ok: true, sent: true }
}

/**
 * Consumes a verification token, marks the user as verified. Returns
 * {ok:true, userId} on success so the page can show a personalised "all set" state.
 */
export async function completeEmailVerification(
  token: string
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  if (!token || token.length < 32) return { ok: false, error: "Invalid token" }
  const row = sqlite
    .prepare(`SELECT id, user_id, email, expires_at, used_at FROM email_verification_tokens WHERE token = ?`)
    .get(token) as { id: string; user_id: string; email: string; expires_at: string; used_at: string | null } | undefined

  if (!row) return { ok: false, error: "This verification link is not valid." }
  if (row.used_at) return { ok: false, error: "This link has already been used." }
  if (new Date(row.expires_at) < new Date()) return { ok: false, error: "This link has expired. Sign in and request a new one." }

  sqlite
    .prepare(`UPDATE users SET email_verified = 1, updated_at = datetime('now') WHERE id = ?`)
    .run(row.user_id)
  sqlite
    .prepare(`UPDATE email_verification_tokens SET used_at = datetime('now') WHERE id = ?`)
    .run(row.id)

  return { ok: true, userId: row.user_id }
}

/** Lookup-only — feeds the verify page's initial state. */
export async function isVerifyTokenValid(token: string): Promise<boolean> {
  const row = sqlite
    .prepare(`SELECT expires_at, used_at FROM email_verification_tokens WHERE token = ?`)
    .get(token) as { expires_at: string; used_at: string | null } | undefined
  if (!row || row.used_at) return false
  return new Date(row.expires_at) >= new Date()
}

/** Current user's verification state — drives the in-app banner. */
export async function isCurrentUserVerified(): Promise<boolean> {
  const me = await requireAuth()
  const row = sqlite
    .prepare(`SELECT email_verified FROM users WHERE id = ?`)
    .get(me.id) as { email_verified: number } | undefined
  return row?.email_verified === 1
}
