"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, KeyRound, Zap, AlertCircle, Eye, EyeOff } from "lucide-react"
import { completePasswordReset } from "@/lib/actions/password-reset-actions"
import { useT } from "@/lib/hooks/use-i18n"

export function ResetPasswordForm({
  token,
  initialValid,
}: {
  token: string
  initialValid: boolean
}) {
  const { t } = useT()
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (password.length < 8) { setError(t("auth.reset.errTooShort")); return }
    if (password !== confirm) { setError(t("auth.reset.errMismatch")); return }

    setIsLoading(true)
    try {
      const res = await completePasswordReset(token, password)
      if (!res.ok) {
        setError(res.error)
      } else {
        setDone(true)
        setTimeout(() => router.push("/login"), 2000)
      }
    } catch {
      setError(t("auth.reset.errGeneric"))
    } finally {
      setIsLoading(false)
    }
  }

  if (!initialValid) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] px-4">
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-destructive/10 mb-4">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{t("auth.reset.invalidTitle")}</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {t("auth.reset.invalidSubtitle")}
          </p>
          <Link
            href="/forgot-password"
            className="mt-6 inline-flex items-center justify-center w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            {t("auth.reset.requestNew")}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
            <Zap className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{t("auth.reset.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("auth.reset.subtitle")}
          </p>
        </div>

        <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 shadow-lg">
          {done ? (
            <div className="text-center space-y-2">
              <p className="text-sm text-foreground">{t("auth.reset.doneTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("auth.reset.doneHelp")}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  {t("auth.reset.newPasswordLabel")}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("auth.reset.newPasswordPh")}
                    autoComplete="new-password"
                    autoFocus
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
              <div className="space-y-2">
                <label htmlFor="confirm" className="text-sm font-medium">
                  {t("auth.reset.confirmLabel")}
                </label>
                <input
                  id="confirm"
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                />
              </div>
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
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                {isLoading ? t("auth.reset.submitting") : t("auth.reset.submit")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
