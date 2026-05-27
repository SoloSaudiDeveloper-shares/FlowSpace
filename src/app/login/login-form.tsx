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
}

export function LoginForm({ signupsEnabled }: LoginFormProps) {
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
  const [error, setError] = useState("")
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
