import "server-only"
import nodemailer, { type Transporter } from "nodemailer"

/**
 * Lightweight Gmail SMTP wrapper. Reads credentials from env vars at first
 * use — never at module top so build-time bundling doesn't fail when the
 * vars are absent.
 *
 * Required env (set on the host):
 *   GMAIL_USER         your.address@gmail.com (the sender)
 *   GMAIL_APP_PASSWORD a Gmail App Password (NOT your account password).
 *                      Generate at https://myaccount.google.com/apppasswords
 *                      (requires 2-Step Verification turned on).
 *
 * Optional env:
 *   MAIL_FROM_NAME     defaults to "FlowSpace"
 *   PUBLIC_APP_URL     used to build links in email bodies (e.g.
 *                      https://flowspace.yourname.com). Falls back to
 *                      whatever Host header the request had — set this in
 *                      production so the URL is absolute even when emails
 *                      are sent from cron jobs.
 */

let cachedTransporter: Transporter | null = null

function getTransporter(): Transporter {
  if (cachedTransporter) return cachedTransporter
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) {
    throw new Error(
      "Email not configured: set GMAIL_USER and GMAIL_APP_PASSWORD env vars on the server. " +
      "See https://myaccount.google.com/apppasswords"
    )
  }
  cachedTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  })
  return cachedTransporter
}

export interface EmailMessage {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail(msg: EmailMessage): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const t = getTransporter()
    const fromName = process.env.MAIL_FROM_NAME || "FlowSpace"
    await t.sendMail({
      from: `"${fromName}" <${process.env.GMAIL_USER}>`,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    })
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown email error"
    console.error("[email] send failed:", message)
    return { ok: false, error: message }
  }
}

export function isEmailConfigured(): boolean {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
}
