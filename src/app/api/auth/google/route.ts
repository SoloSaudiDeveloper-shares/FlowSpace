import { NextRequest, NextResponse } from "next/server"
import { cookies, headers } from "next/headers"
import { buildOAuthStart, isGoogleConfigured } from "@/lib/auth/google"

/**
 * GET /api/auth/google[?from=/path]
 *
 * Generates a PKCE state + verifier, stashes them in short-lived cookies,
 * then 302s to Google's authorize endpoint. The callback route picks the
 * cookies back up to verify state and exchange the code.
 */
export async function GET(request: NextRequest) {
  if (!isGoogleConfigured()) {
    return new NextResponse("Google sign-in is not configured on this server.", { status: 503 })
  }

  // Build the callback URL. Prefer PUBLIC_APP_URL (the canonical origin
  // configured by the operator) — Google's OAuth client validates the
  // redirect_uri exactly, so it has to match what's whitelisted in the
  // Cloud Console regardless of which host the user typed in their browser.
  // Fall back to the request's host header for dev convenience.
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

  const cookieStore = await cookies()
  const isHttps = baseUrl.startsWith("https://")
  const baseCookie = {
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 10 * 60, // 10 minutes — plenty for the user to click "Continue"
  }
  cookieStore.set("oauth-state", state, baseCookie)
  cookieStore.set("oauth-code-verifier", codeVerifier, baseCookie)

  return NextResponse.redirect(authorizeUrl)
}
