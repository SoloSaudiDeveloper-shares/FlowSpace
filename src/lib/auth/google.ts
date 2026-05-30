import "server-only"
import crypto from "node:crypto"

/**
 * Tiny homegrown Google OAuth 2.0 client. PKCE flow because the server
 * stores the client_secret, but we still benefit from the extra binding
 * between the auth request and the code exchange.
 *
 * Required env (on the server):
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *
 * Optional env:
 *   PUBLIC_APP_URL   used to build the callback URL when emails / auth
 *                    require an absolute URL. Falls back to the request's
 *                    host header.
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

export function isGoogleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

/**
 * Resolve the canonical app origin for building OAuth redirect URIs.
 *
 * Google validates redirect_uri byte-for-byte against the Cloud Console
 * allowlist, so it MUST be a real, stable origin — never the server's bind
 * address. We prefer the operator-set PUBLIC_APP_URL; otherwise we derive it
 * from the request's forwarded host. The dev server binds to 0.0.0.0, which
 * leaks into `req.url`; the `host` header carries what the browser actually
 * typed (e.g. localhost:3000), so we use that and defensively rewrite any
 * stray 0.0.0.0 to localhost.
 */
export async function resolveAppBaseUrl(): Promise<string> {
  const env = process.env.PUBLIC_APP_URL?.replace(/\/$/, "")
  if (env) return env
  const { headers } = await import("next/headers")
  const h = await headers()
  const proto = h.get("x-forwarded-proto") || "http"
  let host = h.get("host") || "localhost:3000"
  if (host.startsWith("0.0.0.0")) host = host.replace("0.0.0.0", "localhost")
  return `${proto}://${host}`
}

/** Build a base64url string from random bytes (URL-safe, no padding). */
function randomB64Url(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url")
}

/** PKCE: SHA-256 of the verifier, base64url-encoded. */
function pkceChallengeFromVerifier(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url")
}

export interface OAuthStartParams {
  callbackUrl: string
  /** Where to send the user after a successful login (e.g. "/" or "/projects/123"). */
  redirectTo?: string
}

export interface OAuthStartResult {
  authorizeUrl: string
  /** Stored in a short-lived cookie and validated on callback. */
  state: string
  /** PKCE code_verifier — same cookie, used to exchange the code. */
  codeVerifier: string
}

export function buildOAuthStart({ callbackUrl, redirectTo }: OAuthStartParams): OAuthStartResult {
  const state = randomB64Url(16)
  const codeVerifier = randomB64Url(32)
  const codeChallenge = pkceChallengeFromVerifier(codeVerifier)

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
    state: redirectTo ? `${state}|${encodeURIComponent(redirectTo)}` : state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  })

  return {
    authorizeUrl: `${GOOGLE_AUTH_URL}?${params.toString()}`,
    state,
    codeVerifier,
  }
}

export interface GoogleProfile {
  sub: string          // Stable Google user ID
  email: string
  email_verified: boolean
  name?: string
  given_name?: string
  picture?: string
}

/**
 * Exchange the one-time auth code for tokens, then fetch the profile.
 * Throws on any HTTP error so the caller can fail cleanly.
 */
export async function exchangeCodeForProfile(
  code: string,
  codeVerifier: string,
  callbackUrl: string
): Promise<GoogleProfile> {
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: callbackUrl,
      code_verifier: codeVerifier,
    }),
  })
  if (!tokenRes.ok) {
    const errBody = await tokenRes.text()
    throw new Error(`Google token exchange failed (${tokenRes.status}): ${errBody}`)
  }
  const tokenJson = (await tokenRes.json()) as { access_token: string; id_token: string }

  const profileRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  })
  if (!profileRes.ok) {
    const errBody = await profileRes.text()
    throw new Error(`Google userinfo fetch failed (${profileRes.status}): ${errBody}`)
  }
  return (await profileRes.json()) as GoogleProfile
}
