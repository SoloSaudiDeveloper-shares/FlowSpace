/**
 * Inbound email webhook.
 *
 * Accepts an HTTP POST with email data and parks it in the
 * `inbound_emails` table for the user to approve.
 *
 * Routing: the email's recipient address determines the FlowSpace user.
 * Expected format: `<username>@<your-inbound-domain>` — the username
 * portion matches the `users.username` column. Unknown recipients are
 * silently dropped (200 response so the upstream doesn't retry).
 *
 * Payload format (compatible with Resend, Postmark, SendGrid Parse, and
 * a generic JSON shape):
 *   {
 *     "to":      "alice@inbound.flowspace.app" | [{ "email": "…" }],
 *     "from":    "bob@example.com" | { "email": "…", "name": "Bob" },
 *     "subject": "…",
 *     "text":    "…",
 *     "html":    "…"           (optional)
 *   }
 *
 * Auth: `EMAIL_INBOUND_SECRET` env var. If set, callers must send
 * `X-Inbound-Secret: <value>` or the route returns 401. If unset,
 * the route accepts any caller — convenient for local testing but
 * configure the secret in production.
 *
 * After the row is inserted the recipient sees a new pending item in
 * their bell badge. They tap it to approve (creates a todo) or dismiss.
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { sqlite } from "@/lib/db"
import { createId } from "@/lib/utils/ids"

export const dynamic = "force-dynamic"

interface InboundPayload {
  to?: string | { email?: string; address?: string } | Array<string | { email?: string; address?: string }>
  from?: string | { email?: string; address?: string; name?: string }
  subject?: string
  text?: string
  html?: string
  // Sender-name in some providers
  from_name?: string
  fromName?: string
}

function extractEmail(v: unknown): string | null {
  if (typeof v === "string") return v.trim().toLowerCase() || null
  if (v && typeof v === "object") {
    const o = v as { email?: string; address?: string }
    if (typeof o.email === "string") return o.email.trim().toLowerCase()
    if (typeof o.address === "string") return o.address.trim().toLowerCase()
  }
  return null
}

function localPart(email: string): string | null {
  const at = email.indexOf("@")
  return at > 0 ? email.slice(0, at) : null
}

export async function POST(req: NextRequest) {
  // Shared-secret check. In production the secret is REQUIRED (fail closed) so
  // an unconfigured deployment can't have spoofed mail injected into anyone's
  // approval queue. In development it's optional for convenience.
  const expected = process.env.EMAIL_INBOUND_SECRET?.trim()
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("Inbound email not configured", { status: 503 })
    }
  } else {
    const got = req.headers.get("x-inbound-secret")?.trim()
    if (got !== expected) {
      return new NextResponse("Unauthorized", { status: 401 })
    }
  }

  let body: InboundPayload
  try {
    body = (await req.json()) as InboundPayload
  } catch {
    return new NextResponse("Bad JSON", { status: 400 })
  }

  // Normalize recipient list — providers send single or array
  const recipients: string[] = []
  if (Array.isArray(body.to)) {
    for (const t of body.to) {
      const e = extractEmail(t)
      if (e) recipients.push(e)
    }
  } else {
    const e = extractEmail(body.to)
    if (e) recipients.push(e)
  }
  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, accepted: 0 })
  }

  const subject = (body.subject ?? "").slice(0, 500)
  const text = (body.text ?? "").slice(0, 50_000)
  const html = body.html ? body.html.slice(0, 200_000) : null
  const fromAddr = extractEmail(body.from) ?? ""
  const fromName =
    typeof body.from === "object" && body.from
      ? (body.from as { name?: string }).name?.slice(0, 200)
      : body.from_name?.slice(0, 200) ?? body.fromName?.slice(0, 200)

  let accepted = 0
  for (const to of recipients) {
    const local = localPart(to)
    if (!local) continue
    const userRow = sqlite
      .prepare(`SELECT id FROM users WHERE LOWER(username) = ? LIMIT 1`)
      .get(local) as { id: string } | undefined
    if (!userRow) continue
    sqlite
      .prepare(
        `INSERT INTO inbound_emails
           (id, user_id, from_addr, from_name, subject, body_text, body_html)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        createId(),
        userRow.id,
        fromAddr,
        fromName ?? null,
        subject,
        text,
        html,
      )
    accepted++
  }

  return NextResponse.json({ ok: true, accepted })
}
