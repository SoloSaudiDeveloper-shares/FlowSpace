/**
 * Google Calendar OAuth start endpoint.
 *
 * This kicks off a second OAuth roundtrip with the Calendar scope. The
 * existing sign-in flow only requests userinfo, so we can't simply
 * promote the existing refresh token — Google requires the user to
 * re-consent for the new scope.
 *
 * Flow:
 *   1. GET /api/auth/google-calendar
 *      → redirects to accounts.google.com with the Calendar scope
 *   2. Google redirects back to /api/auth/google-calendar/callback
 *      with `code`; we exchange it for refresh + access tokens, save
 *      them to `google_calendar_sync`.
 *   3. Settings → Calendar sync section reads the row and shows the
 *      connected status.
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getCurrentUser } from "@/lib/actions/user-actions"
import { isGoogleConfigured, resolveAppBaseUrl } from "@/lib/auth/google"
import crypto from "crypto"

export async function GET(req: NextRequest) {
  if (!isGoogleConfigured()) {
    return new NextResponse(
      "Google OAuth not configured on this server. Ask the admin to set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET.",
      { status: 503 },
    )
  }
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  const state = crypto.randomBytes(16).toString("base64url")

  // Build the callback from the canonical origin (PUBLIC_APP_URL / host
  // header) — NOT req.url, which is the server's 0.0.0.0 bind address and
  // gets rejected by Google as an invalid redirect_uri.
  const baseUrl = await resolveAppBaseUrl()
  const callback = `${baseUrl}/api/auth/google-calendar/callback`

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!)
  url.searchParams.set("redirect_uri", callback)
  url.searchParams.set("response_type", "code")
  url.searchParams.set(
    "scope",
    "https://www.googleapis.com/auth/calendar.events",
  )
  url.searchParams.set("access_type", "offline")
  url.searchParams.set("prompt", "consent")
  url.searchParams.set("state", state)

  // Set the state cookie directly on the redirect response. In Next.js 16,
  // cookies set via the ambient cookies() helper aren't reliably attached to
  // a custom NextResponse — which surfaced as OAuth state mismatches.
  const res = NextResponse.redirect(url.toString())
  res.cookies.set("gcal-oauth-state", state, {
    httpOnly: true,
    secure: baseUrl.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  })
  return res
}
