"use client"

import { useState } from "react"
import { Loader2, KeyRound, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { changeMyPassword } from "@/lib/actions/user-actions"

/**
 * Change-password form. Verifies the current password before accepting a
 * new one; all other sessions for the user are wiped on success so a
 * stolen/compromised device can't keep its existing session.
 */
export function AccountSection() {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (next.length < 8) { setError("New password must be at least 8 characters"); return }
    if (next !== confirm) { setError("New passwords don't match"); return }
    if (next === current) { setError("Pick a different password than your current one"); return }

    setLoading(true)
    try {
      const res = await changeMyPassword(current, next)
      if (!res.ok) {
        setError(res.error)
      } else {
        toast.success("Password changed. Other devices will need to sign in again.")
        setCurrent("")
        setNext("")
        setConfirm("")
      }
    } catch {
      setError("Something went wrong. Try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-4 py-3 rounded-lg border bg-card">
      <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
        <KeyRound className="size-3.5 text-muted-foreground" />
        Change password
      </h3>
      <p className="text-xs text-muted-foreground mb-3">
        After changing, you'll stay signed in on this device. Other devices
        will be signed out and need the new password.
      </p>

      <form onSubmit={handleSubmit} className="space-y-2.5">
        {/* Hidden username for password manager autofill */}
        <input type="text" name="username" autoComplete="username" className="hidden" readOnly value="" />

        <div className="relative">
          <input
            id="current-password"
            type={showPw ? "text" : "password"}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="Current password"
            autoComplete="current-password"
            required
            className="w-full h-9 rounded-md border border-input bg-background px-2.5 pr-9 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPw(!showPw)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground"
          >
            {showPw ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        </div>

        <input
          type={showPw ? "text" : "password"}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="New password (8+ characters)"
          autoComplete="new-password"
          required
          minLength={8}
          className="w-full h-9 rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <input
          type={showPw ? "text" : "password"}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password"
          autoComplete="new-password"
          required
          className="w-full h-9 rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !current || !next || !confirm}
          className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <KeyRound className="size-3.5" />}
          {loading ? "Updating…" : "Change password"}
        </button>
      </form>
    </div>
  )
}
