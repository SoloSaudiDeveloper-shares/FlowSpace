/**
 * Web clipper endpoint.
 *
 * Accepts a POST with the current page's title + URL + optional
 * selection text, parks it as a pending inbound item (same flow as
 * Email IN), and returns a tiny confirmation.
 *
 * Auth: Bearer token (an API token issued via Settings → Account →
 * API tokens). Lets the clipper run from any browser without copying a
 * session cookie around.
 *
 * Payload:
 *   { "title": "…", "url": "…", "selection": "…?" }
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { sqlite } from "@/lib/db"
import { createId } from "@/lib/utils/ids"
import { authenticateByBearer } from "@/lib/auth/bearer"

export const dynamic = "force-dynamic"

interface ClipPayload {
  title?: string
  url?: string
  selection?: string
}

export async function POST(req: NextRequest) {
  const auth = authenticateByBearer(req.headers.get("authorization"))
  if (!auth) return new NextResponse("Unauthorized", { status: 401 })

  let body: ClipPayload
  try {
    body = (await req.json()) as ClipPayload
  } catch {
    return new NextResponse("Bad JSON", { status: 400 })
  }

  const title = (body.title ?? "Untitled page").slice(0, 300)
  const url = (body.url ?? "").slice(0, 1000)
  const selection = (body.selection ?? "").slice(0, 50_000)

  // Park as an inbound_email row so it shows up in the same bell-badge
  // approval queue. The "from" is the clipper, "subject" is the page
  // title, "body_text" is the URL + optional selection.
  sqlite
    .prepare(
      `INSERT INTO inbound_emails (id, user_id, from_addr, from_name, subject, body_text)
       VALUES (?, ?, 'web-clipper', 'Web clipper', ?, ?)`,
    )
    .run(
      createId(),
      auth.userId,
      title,
      `${url}\n\n${selection}`.trim(),
    )

  return NextResponse.json(
    { ok: true },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    },
  )
}

export async function OPTIONS() {
  // Bookmarklets running on third-party pages need CORS to POST here.
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  })
}
