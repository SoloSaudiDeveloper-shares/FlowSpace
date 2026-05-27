import { NextRequest, NextResponse } from "next/server"
import { cookies, headers } from "next/headers"
import { db, sqlite } from "@/lib/db"
import { users, sessions } from "@/lib/db/schema"
import { eq, or } from "drizzle-orm"
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
 */
export async function GET(request: NextRequest) {
  if (!isGoogleConfigured()) {
    return errorRedirect(request, "Google sign-in is not configured.")
  }

  const url = request.nextUrl
  const code = url.searchParams.get("code")
  const stateParam = url.searchParams.get("state")
  const oauthError = url.searchParams.get("error")

  if (oauthError) return errorRedirect(request, `Google: ${oauthError}`)
  if (!code || !stateParam) return errorRedirect(request, "Missing code or state in callback.")

  // State can be either "<state>" or "<state>|<encoded-redirect-path>"
  const [stateOnly, encodedRedirectTo] = stateParam.split("|")
  const redirectTo = encodedRedirectTo ? decodeURIComponent(encodedRedirectTo) : "/"

  const cookieStore = await cookies()
  const cookieState = cookieStore.get("oauth-state")?.value
  const codeVerifier = cookieStore.get("oauth-code-verifier")?.value
  if (!cookieState || !codeVerifier || cookieState !== stateOnly) {
    return errorRedirect(request, "OAuth state mismatch. Try again.")
  }
  // Burn the one-time cookies regardless of outcome
  cookieStore.delete("oauth-state")
  cookieStore.delete("oauth-code-verifier")

  // Build callback URL the same way as in /route.ts so the token exchange
  // uses the identical redirect_uri (Google validates this byte-for-byte).
  let baseUrl = process.env.PUBLIC_APP_URL?.replace(/\/$/, "")
  let isHttps = false
  if (baseUrl) {
    isHttps = baseUrl.startsWith("https://")
  } else {
    const h = await headers()
    const proto = h.get("x-forwarded-proto") || "http"
    const host = h.get("host") || "localhost:3000"
    baseUrl = `${proto}://${host}`
    isHttps = proto === "https"
  }
  const callbackUrl = `${baseUrl}/api/auth/google/callback`

  let profile
  try {
    profile = await exchangeCodeForProfile(code, codeVerifier, callbackUrl)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown OAuth error"
    return errorRedirect(request, msg)
  }
  if (!profile.email_verified) {
    return errorRedirect(request, "Google account email isn't verified.")
  }

  // Find an existing user by google_id (cleanest) then by email (linking).
  const byGoogle = sqlite
    .prepare(`SELECT * FROM users WHERE google_id = ? LIMIT 1`)
    .get(profile.sub) as { id: string; is_active: number } | undefined

  let userId: string

  if (byGoogle) {
    if (!byGoogle.is_active) return errorRedirect(request, "Account is deactivated.")
    userId = byGoogle.id
  } else {
    // Try to match an existing local account by email.
    const byEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, profile.email))
      .limit(1)

    if (byEmail.length > 0) {
      if (!byEmail[0].isActive) return errorRedirect(request, "Account is deactivated.")
      userId = byEmail[0].id
      // Link Google sub to existing local account so future Google sign-ins
      // hit the fast path. One-time only.
      sqlite.prepare(`UPDATE users SET google_id = ? WHERE id = ?`).run(profile.sub, userId)
    } else {
      // New user — gated by the workspace signup toggle (unless this is the
      // very first user in the system).
      const userCount = (await db.select({ id: users.id }).from(users).limit(1)).length
      const signupsEnabled = userCount === 0 ? true : await getSignupsEnabled()
      if (!signupsEnabled) {
        return errorRedirect(request, "Signups are closed. Ask the owner for an invite.")
      }

      const id = createId()
      const now = new Date().toISOString()
      // Generate a random unguessable password. Google users won't use it;
      // if they ever want a password they go through /forgot-password.
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
      sqlite.prepare(`UPDATE users SET google_id = ? WHERE id = ?`).run(profile.sub, id)
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

  cookieStore.set("flowspace-session", token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  })

  return NextResponse.redirect(new URL(redirectTo, request.url))
}

/** Username uniqueness: derive from email local-part, then suffix on collisions. */
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
  // Fallback — should never trigger in practice
  return `${base}-${crypto.randomBytes(2).toString("hex")}`
}

function errorRedirect(request: NextRequest, message: string): NextResponse {
  const url = new URL("/login", request.url)
  url.searchParams.set("error", message)
  return NextResponse.redirect(url)
}
