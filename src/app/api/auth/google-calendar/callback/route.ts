/**
 * Google Calendar OAuth callback.
 *
 * Exchanges the auth code for tokens, stores them in
 * `google_calendar_sync`, then redirects the user back to Settings.
 *
 * All redirects are built from the canonical origin (PUBLIC_APP_URL / the
 * forwarded host), NEVER req.url — on the VM req.url is the 0.0.0.0 bind
 * address, which produced an "ERR_ADDRESS_INVALID / can't reach this page"
 * landing after consent.
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { sqlite } from "@/lib/db"
import { getCurrentUser } from "@/lib/actions/user-actions"
import { resolveAppBaseUrl } from "@/lib/auth/google"

export async function GET(req: NextRequest) {
  const base = await resolveAppBaseUrl()
  const toSettings = (q: string) =>
    NextResponse.redirect(`${base}/settings?gcal=${q}#calendar-sync`)

  const user = await getCurrentUser()
  if (!user) return NextResponse.redirect(`${base}/login`)

  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  if (!code || !state) return toSettings("error")

  // Read the CSRF state straight off the incoming request (most reliable in
  // a route handler) and compare to what we stashed in the start step.
  const stored = req.cookies.get("gcal-oauth-state")?.value
  if (!stored || stored !== state) return toSettings("state_mismatch")

  // Exchange the code for tokens. redirect_uri MUST byte-match the start
  // request, so resolve it the same canonical way.
  const callback = `${base}/api/auth/google-calendar/callback`
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
  if (!tokenRes.ok) return toSettings("token_exchange_failed")

  const tokens = (await tokenRes.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
  }
  if (!tokens.refresh_token) {
    // Google omits the refresh token if this scope was already granted
    // without revoking. prompt=consent should prevent it, but guard anyway.
    return toSettings("no_refresh_token")
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

  const res = toSettings("connected")
  res.cookies.delete("gcal-oauth-state")
  return res
}
