import "server-only"
import nodemailer, { type Transporter } from "nodemailer"

/**
 * Email sender. Tries Resend first (recommended — better deliverability,
 * higher quotas, real API), falls back to Gmail SMTP if no Resend key
 * is configured. Returns a generic {ok} shape so callers don't care
 * about the transport.
 *
 * Env vars (server-side only — never sent to the client):
 *   RESEND_API_KEY        Preferred. Sign up at https://resend.com.
 *   MAIL_FROM             Optional. e.g. "FlowSpace <noreply@yourdomain.com>".
 *                         Defaults to Resend's onboarding sender so it
 *                         works out of the box during testing.
 *
 *   GMAIL_USER            Fallback. your.address@gmail.com (sender)
 *   GMAIL_APP_PASSWORD    Fallback. 16-char Gmail App Password.
 *                         See https://myaccount.google.com/apppasswords
 *
 *   MAIL_FROM_NAME        "FlowSpace" by default. Display name only.
 *   PUBLIC_APP_URL        Used by callers to build absolute links inside
 *                         email bodies (set in env, not here).
 */

export interface EmailAttachment {
  filename: string
  /** Buffer (preferred for binary like xlsx/pdf) or a UTF-8 string. */
  content: Buffer | string
  /** MIME type. Resend infers it from filename but supplying it is safer. */
  contentType?: string
}

export interface EmailMessage {
  to: string
  subject: string
  html: string
  text?: string
  attachments?: EmailAttachment[]
}

export type SendResult = { ok: true } | { ok: false; error: string }

// ── Resend (preferred) ────────────────────────────────────────────

function fromAddress(): string {
  if (process.env.MAIL_FROM) return process.env.MAIL_FROM
  const name = process.env.MAIL_FROM_NAME || "FlowSpace"
  // Resend ships with onboarding@resend.dev which works without domain
  // verification — perfect for getting started. Swap to your own domain
  // by setting MAIL_FROM=... once you've verified one in Resend.
  return `${name} <onboarding@resend.dev>`
}

async function sendViaResend(msg: EmailMessage): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY!
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        attachments: msg.attachments?.map((a) => ({
          filename: a.filename,
          // Resend wants base64-encoded content over JSON. We accept
          // either a Buffer (binary like xlsx/pdf) or a UTF-8 string.
          content:
            typeof a.content === "string"
              ? Buffer.from(a.content, "utf8").toString("base64")
              : Buffer.from(a.content).toString("base64"),
          contentType: a.contentType,
        })),
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      const err = `Resend ${res.status}: ${body.slice(0, 300)}`
      console.error("[email]", err)
      return { ok: false, error: err }
    }
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Resend error"
    console.error("[email] Resend send failed:", message)
    return { ok: false, error: message }
  }
}

// ── Gmail SMTP (fallback) ─────────────────────────────────────────

let cachedTransporter: Transporter | null = null

function getGmailTransporter(): Transporter {
  if (cachedTransporter) return cachedTransporter
  const user = process.env.GMAIL_USER!
  const pass = process.env.GMAIL_APP_PASSWORD!
  cachedTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  })
  return cachedTransporter
}

async function sendViaGmail(msg: EmailMessage): Promise<SendResult> {
  try {
    const t = getGmailTransporter()
    const fromName = process.env.MAIL_FROM_NAME || "FlowSpace"
    await t.sendMail({
      from: `"${fromName}" <${process.env.GMAIL_USER}>`,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      attachments: msg.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    })
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown email error"
    console.error("[email] Gmail send failed:", message)
    return { ok: false, error: message }
  }
}

// ── Public API ────────────────────────────────────────────────────

export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  if (process.env.RESEND_API_KEY) {
    return sendViaResend(msg)
  }
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return sendViaGmail(msg)
  }
  return {
    ok: false,
    error:
      "Email not configured. Set RESEND_API_KEY (recommended) or " +
      "GMAIL_USER + GMAIL_APP_PASSWORD in the server env.",
  }
}

export function isEmailConfigured(): boolean {
  return !!(
    process.env.RESEND_API_KEY ||
    (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
  )
}

export function emailProviderName(): "resend" | "gmail" | "none" {
  if (process.env.RESEND_API_KEY) return "resend"
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) return "gmail"
  return "none"
}
