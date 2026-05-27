"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2, Mail, ArrowLeft, Zap } from "lucide-react"
import { requestPasswordReset } from "@/lib/actions/password-reset-actions"

export function ForgotPasswordForm({ emailConfigured }: { emailConfigured: boolean }) {
  const [identifier, setIdentifier] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!identifier.trim()) return
    setIsLoading(true)
    try {
      await requestPasswordReset(identifier.trim())
      setSubmitted(true)
    } catch {
      // Server action exceptions are swallowed — generic UI handles it
      setSubmitted(true)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
            <Zap className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Forgot password</h1>
          <p className="text-sm text-muted-foreground mt-1">
            We&apos;ll email you a one-time link to set a new one.
          </p>
        </div>

        <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 shadow-lg">
          {!emailConfigured && (
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
              Email isn&apos;t configured on this server. Ask the owner to set the
              <code className="mx-1 px-1 rounded bg-black/30">GMAIL_USER</code>
              and
              <code className="mx-1 px-1 rounded bg-black/30">GMAIL_APP_PASSWORD</code>
              environment variables.
            </div>
          )}

          {submitted ? (
            <div className="text-center space-y-3">
              <div className="mx-auto w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Mail className="size-5 text-emerald-500" />
              </div>
              <p className="text-sm text-foreground">
                If an account exists for that username or email, a reset link is on its way.
              </p>
              <p className="text-xs text-muted-foreground">
                The link expires in 1 hour. Check your spam folder if you don&apos;t see it.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="identifier" className="text-sm font-medium">
                  Username or email
                </label>
                <input
                  id="identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="admin or you@example.com"
                  autoComplete="username"
                  autoFocus
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || !identifier.trim()}
                className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                {isLoading ? "Sending..." : "Send reset link"}
              </button>
            </form>
          )}
        </div>

        <Link
          href="/login"
          className="mt-6 inline-flex items-center justify-center gap-1.5 w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3" />
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
