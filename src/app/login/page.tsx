"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/hooks/use-auth"
import { createUser } from "@/lib/actions/user-actions"
import { useRouter } from "next/navigation"
import { Loader2, LogIn, UserPlus, Eye, EyeOff, Zap } from "lucide-react"

export default function LoginPage() {
  const { login, needsSetup, isAuthenticated } = useAuth()
  const router = useRouter()

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Derive setup mode from auth context
  const isSetupMode = needsSetup

  // If already authenticated, redirect to home
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/")
    }
  }, [isAuthenticated, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    // Basic validation
    if (!username.trim()) {
      setError("Username is required")
      return
    }
    if (!password) {
      setError("Password is required")
      return
    }
    if (password.length < 4) {
      setError("Password must be at least 4 characters")
      return
    }

    if (isSetupMode) {
      // Setup mode validations
      if (!displayName.trim()) {
        setError("Display name is required")
        return
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match")
        return
      }

      setIsLoading(true)
      try {
        // Create the first user
        const result = await createUser({
          username: username.trim(),
          displayName: displayName.trim(),
          password,
        })

        if (result.error) {
          setError(result.error)
          setIsLoading(false)
          return
        }

        // Now log in with the new account
        const loginResult = await login(username.trim(), password)
        if (!loginResult.success) {
          setError(loginResult.error ?? "Failed to log in after account creation")
        } else {
          router.push("/")
        }
      } catch {
        setError("An unexpected error occurred")
      } finally {
        setIsLoading(false)
      }
    } else {
      // Login mode
      setIsLoading(true)
      try {
        const result = await login(username.trim(), password)
        if (!result.success) {
          setError(result.error ?? "Invalid credentials")
        } else {
          router.push("/")
        }
      } catch {
        setError("An unexpected error occurred")
      } finally {
        setIsLoading(false)
      }
    }
  }

  // Don't render if already authenticated (will redirect)
  if (isAuthenticated) {
    return null
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4">
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
            <Zap className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">FlowSpace</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isSetupMode
              ? "Create your account to get started"
              : "Sign in to your workspace"}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Setup mode: display name */}
            {isSetupMode && (
              <div className="space-y-2">
                <label
                  htmlFor="displayName"
                  className="text-sm font-medium text-foreground"
                >
                  Display Name
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
                />
              </div>
            )}

            {/* Username */}
            <div className="space-y-2">
              <label
                htmlFor="username"
                className="text-sm font-medium text-foreground"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                autoComplete="username"
                autoFocus
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-foreground"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSetupMode ? "Choose a password" : "Enter your password"}
                  autoComplete={isSetupMode ? "new-password" : "current-password"}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 pr-10 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm password (setup mode only) */}
            {isSetupMode && (
              <div className="space-y-2">
                <label
                  htmlFor="confirmPassword"
                  className="text-sm font-medium text-foreground"
                >
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
                />
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isSetupMode ? (
                <UserPlus className="w-4 h-4" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {isLoading
                ? isSetupMode
                  ? "Creating account..."
                  : "Signing in..."
                : isSetupMode
                  ? "Create Account"
                  : "Sign In"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          {isSetupMode
            ? "This will be the owner account for your workspace."
            : "Your personal productivity workspace."}
        </p>
      </div>
    </div>
  )
}
