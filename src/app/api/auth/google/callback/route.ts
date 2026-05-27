import { NextRequest, NextResponse } from "next/server"
import { cookies, headers } from "next/headers"
import { db, sqlite } from "@/lib/db"
import { users, sessions } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { createId } from "@/lib/utils/ids"
import crypto from "node:crypto"
import bcrypt from "bcrypt"
import { exchangeCodeForProfile, isGoogleConfigured } from "@/lib/auth/google"
import { getSignupsEnabled, getSessionDurationMs } from "@/lib/actions/server-settings-actions"

/**
 * GET /api/auth/google/callback?code=...&state=...
 *
 * Final leg of the OAuth flow:
 * 1. Validate state cookie matches state param
 * 2. Exchange the code for tokens + fetch the Google profile
 * 3. Look up an existing user (google_id first, then email)
 * 4. Create a new user if missing AND signups are enabled
 * 5. Mint a flowspace-session cookie and redirect
 *
 * All redirects build URLs from `publicBaseUrl()` rather than `request.url`,
 * because the container's internal request URL is http://0.0.0.0:3000 — the
 * browser-facing URL is whatever the operator put in PUBLIC_APP_URL.
 */
export async function GET(request: NextRequest) {
  const baseUrl = await publicBaseUrl()
  if (!isGoogleConfigured()) {
    return errorRedirect(baseUrl, "Google sign-in is not configured.")
  }

  const url = request.nextUrl
  const code = url.searchParams.get("code")
  const stateParam = url.searchParams.get("state")
  const oauthError = url.searchParams.get("error")

  if (oauthError) return errorRedirect(baseUrl, `Google: ${oauthError}`)
  if (!code || !stateParam) return errorRedirect(baseUrl, "Missing code or state in callback.")

  // State can be "<state>" or "<state>|<encoded-redirect-path>"
  const [stateOnly, encodedRedirectTo] = stateParam.split("|")
  const redirectTo = encodedRedirectTo ? decodeURIComponent(encodedRedirectTo) : "/"

  const cookieStore = await cookies()
  const cookieState = cookieStore.get("oauth-state")?.value
  const codeVerifier = cookieStore.get("oauth-code-verifier")?.value
  if (!cookieState || !codeVerifier || cookieState !== stateOnly) {
    return errorRedirect(baseUrl, "OAuth state mismatch. Try again.")
  }

  const callbackUrl = `${baseUrl}/api/auth/google/callback`
  const isHttps = baseUrl.startsWith("https://")

  let profile
  try {
    profile = await exchangeCodeForProfile(code, codeVerifier, callbackUrl)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown OAuth error"
    return errorRedirect(baseUrl, msg)
  }
  if (!profile.email_verified) {
    return errorRedirect(baseUrl, "Google account email isn't verified.")
  }

  // Find an existing user by google_id (cleanest) then by email (linking).
  const byGoogle = sqlite
    .prepare(`SELECT * FROM users WHERE google_id = ? LIMIT 1`)
    .get(profile.sub) as { id: string; is_active: number } | undefined

  let userId: string

  if (byGoogle) {
    if (!byGoogle.is_active) return errorRedirect(baseUrl, "Account is deactivated.")
    userId = byGoogle.id
  } else {
    const byEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, profile.email))
      .limit(1)

    if (byEmail.length > 0) {
      if (!byEmail[0].isActive) return errorRedirect(baseUrl, "Account is deactivated.")
      userId = byEmail[0].id
      sqlite
        .prepare(`UPDATE users SET google_id = ?, email_verified = 1 WHERE id = ?`)
        .run(profile.sub, userId)
    } else {
      const userCount = (await db.select({ id: users.id }).from(users).limit(1)).length
      const signupsEnabled = userCount === 0 ? true : await getSignupsEnabled()
      if (!signupsEnabled) {
        return errorRedirect(baseUrl, "Signups are closed. Ask the owner for an invite.")
      }

      const id = createId()
      const now = new Date().toISOString()
      const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12)
      const username = await uniqueUsername(profile.email)
      const role = userCount === 0 ? "owner" : "editor"

      await db.insert(users).values({
        id,
        username,
        displayName: profile.name || profile.given_name || username,
        email: profile.email,
        passwordHash,
        avatarUrl: profile.picture ?? null,
        role,
        createdAt: now,
        updatedAt: now,
      })
      // Google already verified the email — mark our column too so
      // the user doesn't see a "verify your email" banner.
      sqlite
        .prepare(`UPDATE users SET google_id = ?, email_verified = 1 WHERE id = ?`)
        .run(profile.sub, id)

      // Seed showcase templates into the new Google user's workspace.
      try {
        const { seedShowcaseTemplates } = await import("@/lib/db/seed-showcase-templates")
        seedShowcaseTemplates(sqlite, id)
      } catch (err) {
        console.error("[google-oauth] template seed failed for", id, err)
      }

      userId = id
    }
  }

  // Mint a session
  const durationMs = await getSessionDurationMs()
  const sessionId = createId()
  const token = crypto.randomBytes(32).toString("hex")
  const now = new Date()
  const expiresAt = new Date(now.getTime() + durationMs)
  await db.insert(sessions).values({
    id: sessionId,
    userId,
    token,
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
  })
  await db
    .update(users)
    .set({ lastActiveAt: now.toISOString() })
    .where(eq(users.id, userId))

  // Build the redirect response and set both: clear the OAuth ephemerals,
  // set the session cookie. Set directly on the response for reliability.
  const successUrl = new URL(redirectTo.startsWith("/") ? redirectTo : "/", baseUrl)
  const res = NextResponse.redirect(successUrl)
  res.cookies.set("flowspace-session", token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  })
  res.cookies.delete("oauth-state")
  res.cookies.delete("oauth-code-verifier")
  return res
}

async function publicBaseUrl(): Promise<string> {
  const fromEnv = process.env.PUBLIC_APP_URL?.replace(/\/$/, "")
  if (fromEnv) return fromEnv
  const h = await headers()
  const proto = h.get("x-forwarded-proto") || "http"
  const host = h.get("host") || "localhost:3000"
  return `${proto}://${host}`
}

async function uniqueUsername(email: string): Promise<string> {
  const base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_.-]/g, "") || "user"
  let candidate = base
  for (let i = 0; i < 50; i++) {
    const hit = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, candidate))
      .limit(1)
    if (hit.length === 0) return candidate
    candidate = `${base}${i + 1}`
  }
  return `${base}-${crypto.randomBytes(2).toString("hex")}`
}

function errorRedirect(baseUrl: string, message: string): NextResponse {
  const url = new URL("/login", baseUrl)
  url.searchParams.set("error", message)
  const res = NextResponse.redirect(url)
  // Burn ephemeral cookies even on error so retries get fresh ones.
  res.cookies.delete("oauth-state")
  res.cookies.delete("oauth-code-verifier")
  return res
}
