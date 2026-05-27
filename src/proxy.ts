import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Public paths that don't require authentication
const PUBLIC_PATHS = ["/login", "/api/auth", "/forgot-password", "/reset-password", "/verify-email"]
// Static asset patterns
const STATIC_PATTERNS = [
  "/_next",
  "/favicon.ico",
  "/api/attachments",
]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow static assets and public API routes through
  if (STATIC_PATTERNS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Check for session cookie
  const sessionToken = request.cookies.get("flowspace-session")?.value

  if (!sessionToken) {
    // No session — redirect to login
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("from", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Session exists — allow through (actual session validation happens server-side)
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (browser icon)
     * - public files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
