"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useAuth } from "@/lib/hooks/use-auth"
import { createUser } from "@/lib/actions/user-actions"
import { useRouter } from "next/navigation"
import { Loader2, LogIn, UserPlus, Eye, EyeOff, Zap } from "lucide-react"

type Mode = "login" | "register"

interface LoginFormProps {
  /** From server: are non-owner signups currently allowed? */
  signupsEnabled: boolean
  /** From server: are GOOGLE_CLIENT_ID / SECRET env vars set? */
  googleConfigured: boolean
  /** Error message passed via ?error= from the OAuth callback redirect. */
  initialError?: string
}

/** Multi-color Google "G" mark, kept inline so we don't pull in a third-party icon pkg. */
function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" fill="#EA4335"/>
    </svg>
  )
}

export function LoginForm({ signupsEnabled, googleConfigured, initialError }: LoginFormProps) {
  const { login, needsSetup, isAuthenticated } = useAuth()
  const router = useRouter()

  // First-ever setup forces register mode. Otherwise the user picks.
  const isSetupMode = needsSetup
  const [mode, setMode] = useState<Mode>(isSetupMode ? "register" : "login")
  // If the server says signups closed AND we're not in setup, force login mode
  // regardless of what the user clicks.
  const canRegister = isSetupMode || signupsEnabled
  const effectiveMode: Mode = canRegister ? mode : "login"

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [error, setError] = useState(initialError ?? "")
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (isAuthenticated) router.push("/")
  }, [isAuthenticated, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!username.trim()) { setError("Username is required"); return }
    if (!password) { setError("Password is required"); return }
    if (password.length < 4) { setError("Password must be at least 4 characters"); return }

    if (effectiveMode === "register") {
      if (!displayName.trim()) { setError("Display name is required"); return }
      if (password !== confirmPassword) { setError("Passwords do not match"); return }

      setIsLoading(true)
      try {
        const result = await createUser({
          username: username.trim(),
          displayName: displayName.trim(),
          password,
        })
        if (result.error) { setError(result.error); setIsLoading(false); return }
        // Auto-login after register
        const loginResult = await login(username.trim(), password)
        if (!loginResult.success) {
          setError(loginResult.error ?? "Account created — please sign in.")
        } else {
          // refresh() invalidates the cached layout payload so the parent
          // RootLayout re-runs with the new session and renders the sidebar.
          // Without this, the layout keeps its unauth render and you see
          // the SidebarInset with no AppSidebar — looks like a black page.
          router.refresh()
          router.push("/")
        }
      } catch {
        setError("An unexpected error occurred")
      } finally {
        setIsLoading(false)
      }
    } else {
      setIsLoading(true)
      try {
        const result = await login(username.trim(), password)
        if (!result.success) {
          setError(result.error ?? "Invalid credentials")
        } else {
          // refresh() invalidates the cached layout payload so the parent
          // RootLayout re-runs with the new session and renders the sidebar.
          // Without this, the layout keeps its unauth render and you see
          // the SidebarInset with no AppSidebar — looks like a black page.
          router.refresh()
          router.push("/")
        }
      } catch {
        setError("An unexpected error occurred")
      } finally {
        setIsLoading(false)
      }
    }
  }

  if (isAuthenticated) return null

  const subtitle =
    isSetupMode
      ? "Create your account to get started"
      : effectiveMode === "register"
        ? "Create your workspace"
        : "Sign in to your workspace"

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4">
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
            <Zap className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">FlowSpace</h1>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 shadow-lg">
          {/* Google sign-in / sign-up — only shown if the server has OAuth credentials */}
          {googleConfigured && (
            <>
              <a
                href="/api/auth/google"
                className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-lg border border-input bg-background text-sm font-medium hover:bg-accent transition-colors"
              >
                <GoogleLogo className="size-4" />
                Continue with Google
              </a>
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            </>
          )}

          {/* Mode tabs — only when registration is actually allowed and we're not in initial setup */}
          {canRegister && !isSetupMode && (
            <div className="flex p-0.5 rounded-lg bg-muted/50 mb-5 text-sm">
              {(["login", "register"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setError("") }}
                  className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${
                    effectiveMode === m
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "login" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {effectiveMode === "register" && (
              <div className="space-y-2">
                <label htmlFor="displayName" className="text-sm font-medium text-foreground">Display Name</label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                />
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium text-foreground">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                autoComplete="username"
                autoFocus
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={effectiveMode === "register" ? "Choose a password" : "Enter your password"}
                  autoComplete={effectiveMode === "register" ? "new-password" : "current-password"}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 pr-10 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {effectiveMode === "register" && (
              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                />
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            >
              {isLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : effectiveMode === "register"
                  ? <UserPlus className="w-4 h-4" />
                  : <LogIn className="w-4 h-4" />}
              {isLoading
                ? (effectiveMode === "register" ? "Creating account..." : "Signing in...")
                : (effectiveMode === "register" ? "Create Account" : "Sign In")}
            </button>

            {effectiveMode === "login" && !isSetupMode && (
              <div className="text-center pt-1">
                <Link
                  href="/forgot-password"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
            )}
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          {isSetupMode
            ? "This will be the owner account for your workspace."
            : !canRegister
              ? "New signups are currently closed. Ask the owner for an invite."
              : "Your personal productivity workspace."}
        </p>
      </div>
    </div>
  )
}
