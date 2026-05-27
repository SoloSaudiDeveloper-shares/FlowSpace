import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { buildOAuthStart, isGoogleConfigured } from "@/lib/auth/google"

/**
 * GET /api/auth/google[?from=/path]
 *
 * Generates a PKCE state + verifier, attaches them to the redirect response
 * as short-lived cookies, then 302s to Google's authorize endpoint. The
 * callback route picks the cookies back up to verify state and exchange the
 * code.
 */
export async function GET(request: NextRequest) {
  if (!isGoogleConfigured()) {
    return new NextResponse("Google sign-in is not configured on this server.", { status: 503 })
  }

  // Build the callback URL. Prefer PUBLIC_APP_URL (the canonical origin
  // configured by the operator). Google validates the redirect_uri byte-for-
  // byte against the Cloud Console allowlist, so it MUST match exactly
  // regardless of which host the user typed in their browser.
  let baseUrl = process.env.PUBLIC_APP_URL?.replace(/\/$/, "")
  if (!baseUrl) {
    const h = await headers()
    const proto = h.get("x-forwarded-proto") || "http"
    const host = h.get("host") || "localhost:3000"
    baseUrl = `${proto}://${host}`
  }
  const callbackUrl = `${baseUrl}/api/auth/google/callback`
  const redirectTo = request.nextUrl.searchParams.get("from") || "/"

  const { authorizeUrl, state, codeVerifier } = buildOAuthStart({ callbackUrl, redirectTo })

  // Set the state + verifier cookies DIRECTLY on the response, not via the
  // ambient cookies() helper. In Next.js 16 route handlers that return a
  // custom NextResponse, cookies set via cookies().set() are not reliably
  // attached — leading to "OAuth state mismatch" errors on the callback.
  const isHttps = baseUrl.startsWith("https://")
  const cookieOptions = {
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 10 * 60, // 10 minutes
  }
  const res = NextResponse.redirect(authorizeUrl)
  res.cookies.set("oauth-state", state, cookieOptions)
  res.cookies.set("oauth-code-verifier", codeVerifier, cookieOptions)
  return res
}
