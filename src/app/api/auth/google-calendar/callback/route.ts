/**
 * Google Calendar OAuth callback.
 *
 * Exchanges the auth code for tokens, stores them in
 * `google_calendar_sync`, then redirects the user back to Settings.
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { cookies } from "next/headers"
import { sqlite } from "@/lib/db"
import { getCurrentUser } from "@/lib/actions/user-actions"
import { resolveAppBaseUrl } from "@/lib/auth/google"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.redirect(new URL("/login", req.url))

  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/settings?gcal=error", req.url).toString(),
    )
  }

  const cookieStore = await cookies()
  const stored = cookieStore.get("gcal-oauth-state")?.value
  cookieStore.delete("gcal-oauth-state")
  if (stored !== state) {
    return NextResponse.redirect(
      new URL("/settings?gcal=state_mismatch", req.url).toString(),
    )
  }

  // Exchange the code for tokens. The redirect_uri MUST be byte-identical to
  // the one used in the start request, so resolve it the same way (canonical
  // origin, never the 0.0.0.0 bind address).
  const callback = `${await resolveAppBaseUrl()}/api/auth/google-calendar/callback`
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: callback,
    grant_type: "authorization_code",
  })
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })
  if (!tokenRes.ok) {
    return NextResponse.redirect(
      new URL("/settings?gcal=token_exchange_failed", req.url).toString(),
    )
  }
  const tokens = (await tokenRes.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
  }
  if (!tokens.refresh_token) {
    // Google won't return a refresh token if the user has previously
    // granted this scope without revoking. We pushed prompt=consent so
    // this shouldn't normally happen, but guard anyway.
    return NextResponse.redirect(
      new URL("/settings?gcal=no_refresh_token", req.url).toString(),
    )
  }

  const expires = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null

  sqlite
    .prepare(
      `INSERT INTO google_calendar_sync (user_id, refresh_token, access_token, access_expires_at, calendar_id, enabled)
       VALUES (?, ?, ?, ?, 'primary', 1)
       ON CONFLICT(user_id) DO UPDATE SET
         refresh_token = excluded.refresh_token,
         access_token = excluded.access_token,
         access_expires_at = excluded.access_expires_at,
         enabled = 1`,
    )
    .run(user.id, tokens.refresh_token, tokens.access_token ?? null, expires)

  return NextResponse.redirect(
    new URL("/settings?gcal=connected#calendar-sync", req.url).toString(),
  )
}
