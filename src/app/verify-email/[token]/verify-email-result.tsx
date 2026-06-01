"use client"

import Link from "next/link"
import { CheckCircle2, AlertCircle, Zap } from "lucide-react"
import { useT } from "@/lib/hooks/use-i18n"

export function VerifyEmailResult({
  result,
}: {
  result: { ok: true } | { ok: false; error: string } | null
}) {
  const { t } = useT()
  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
          <Zap className="w-6 h-6 text-primary" />
        </div>

        {result?.ok ? (
          <>
            <div className="inline-flex items-center justify-center size-14 rounded-full bg-emerald-500/10 mb-4">
              <CheckCircle2 className="size-7 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{t("auth.verify.okTitle")}</h1>
            <p className="text-sm text-muted-foreground mt-2">
              {t("auth.verify.okSubtitle")}
            </p>
          </>
        ) : (
          <>
            <div className="inline-flex items-center justify-center size-14 rounded-full bg-destructive/10 mb-4">
              <AlertCircle className="size-7 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{t("auth.verify.failTitle")}</h1>
            <p className="text-sm text-muted-foreground mt-2">
              {result?.error ?? t("auth.verify.failGeneric")}
            </p>
          </>
        )}

        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          {t("auth.verify.openApp")}
        </Link>
      </div>
    </div>
  )
}
