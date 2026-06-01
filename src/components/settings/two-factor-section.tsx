"use client"

/**
 * Two-factor authentication panel.
 *
 * Empty state          → "Enable" button → starts enrollment
 * Enrollment in progress → shows secret + otpauth URI + code prompt
 * Enabled              → "Disable" + "Show new recovery codes" actions
 *
 * The QR code is rendered client-side as an SVG (no external service).
 * If the user can't scan, they paste the base32 secret into their app's
 * manual-entry flow.
 */

import { useEffect, useState } from "react"
import { ShieldCheck, ShieldOff, Loader2, Copy, Check, RotateCw, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  getTwoFactorStatus,
  startTwoFactorEnrollment,
  confirmTwoFactorEnrollment,
  disableTwoFactor,
  regenerateRecoveryCodes,
} from "@/lib/actions/two-factor-actions"
import { useT } from "@/lib/hooks/use-i18n"

type Stage =
  | { name: "loading" }
  | { name: "off" }
  | { name: "enrolling"; secret: string; otpauthUri: string; code: string; error?: string }
  | { name: "on"; recoveryShown?: string[] }
  | { name: "disabling"; code: string; error?: string }
  | { name: "regenerating"; code: string; error?: string }

export function TwoFactorSection() {
  const { t } = useT()
  const [stage, setStage] = useState<Stage>({ name: "loading" })

  useEffect(() => {
    getTwoFactorStatus()
      .then((s) => {
        setStage(s.enabled ? { name: "on" } : { name: "off" })
      })
      .catch(() => setStage({ name: "off" }))
  }, [])

  async function handleEnable() {
    const r = await startTwoFactorEnrollment()
    if (!r.ok) {
      toast.error(r.error)
      return
    }
    setStage({ name: "enrolling", secret: r.secret, otpauthUri: r.otpauthUri, code: "" })
  }

  async function handleConfirmEnrollment() {
    if (stage.name !== "enrolling") return
    const r = await confirmTwoFactorEnrollment(stage.code)
    if (!r.ok) {
      setStage({ ...stage, error: r.error })
      return
    }
    setStage({ name: "on", recoveryShown: r.recoveryCodes })
    toast.success(t("settings.twofa.enabled"))
  }

  async function handleDisable() {
    if (stage.name !== "disabling") return
    const r = await disableTwoFactor(stage.code)
    if (!r.ok) {
      setStage({ ...stage, error: r.error })
      return
    }
    setStage({ name: "off" })
    toast.success(t("settings.twofa.disabled"))
  }

  async function handleRegenerate() {
    if (stage.name !== "regenerating") return
    const r = await regenerateRecoveryCodes(stage.code)
    if (!r.ok) {
      setStage({ ...stage, error: r.error })
      return
    }
    setStage({ name: "on", recoveryShown: r.recoveryCodes })
    toast.success(t("settings.twofa.regenerated"))
  }

  if (stage.name === "loading") {
    return (
      <div className="px-4 py-3 rounded-lg border bg-card">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="px-4 py-3 rounded-lg border bg-card space-y-3">
      <div className="flex items-center gap-2">
        {stage.name === "on" ? (
          <ShieldCheck className="size-4 text-emerald-400" />
        ) : (
          <ShieldOff className="size-4 text-muted-foreground" />
        )}
        <h3 className="text-sm font-medium">{t("settings.twofa.title")}</h3>
        {stage.name === "on" && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/15 text-emerald-300">
            {t("settings.twofa.on")}
          </span>
        )}
      </div>

      {stage.name === "off" && (
        <>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("settings.twofa.offHelp")}
          </p>
          <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleEnable}>
            <ShieldCheck className="size-3.5" />
            {t("settings.twofa.enable")}
          </Button>
        </>
      )}

      {stage.name === "enrolling" && (
        <Enrollment
          secret={stage.secret}
          otpauthUri={stage.otpauthUri}
          code={stage.code}
          error={stage.error}
          onChangeCode={(c) => setStage({ ...stage, code: c, error: undefined })}
          onConfirm={handleConfirmEnrollment}
          onCancel={() => setStage({ name: "off" })}
        />
      )}

      {stage.name === "on" && (
        <>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("settings.twofa.activeHelp")}
          </p>
          {stage.recoveryShown && (
            <RecoveryCodesBlock codes={stage.recoveryShown} />
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5"
              onClick={() => setStage({ name: "regenerating", code: "" })}
            >
              <RotateCw className="size-3.5" />
              {t("settings.twofa.newRecovery")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive"
              onClick={() => setStage({ name: "disabling", code: "" })}
            >
              <ShieldOff className="size-3.5" />
              {t("settings.twofa.disable")}
            </Button>
          </div>
        </>
      )}

      {(stage.name === "disabling" || stage.name === "regenerating") && (
        <CodeGate
          title={
            stage.name === "disabling"
              ? t("settings.twofa.confirmDisable")
              : t("settings.twofa.confirmRegen")
          }
          description={
            stage.name === "disabling"
              ? t("settings.twofa.confirmDisableDesc")
              : t("settings.twofa.confirmRegenDesc")
          }
          code={stage.code}
          error={stage.error}
          submitLabel={stage.name === "disabling" ? t("settings.twofa.disableLabel") : t("settings.twofa.regenerateLabel")}
          onChangeCode={(c) => setStage({ ...stage, code: c, error: undefined })}
          onCancel={() => setStage({ name: "on" })}
          onSubmit={stage.name === "disabling" ? handleDisable : handleRegenerate}
        />
      )}
    </div>
  )
}

function Enrollment({
  secret,
  otpauthUri,
  code,
  error,
  onChangeCode,
  onConfirm,
  onCancel,
}: {
  secret: string
  otpauthUri: string
  code: string
  error?: string
  onChangeCode: (c: string) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useT()
  const [copied, setCopied] = useState(false)
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-md border border-amber-500/30 bg-amber-500/5">
        <AlertTriangle className="size-3.5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-200/90 leading-relaxed">
          {t("settings.twofa.enroll.warn")}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3 items-start">
        <div className="flex items-center justify-center p-2 bg-white rounded-md">
          <QRCode value={otpauthUri} size={120} />
        </div>
        <div className="space-y-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium mb-1">
              {t("settings.twofa.enroll.manualKey")}
            </p>
            <div className="flex items-center gap-1.5">
              <code className="flex-1 font-mono text-xs px-2 py-1.5 rounded bg-muted/60 break-all">
                {secret.match(/.{1,4}/g)?.join(" ") ?? secret}
              </code>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={() => {
                  navigator.clipboard.writeText(secret).catch(() => undefined)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                }}
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium mb-1.5">{t("settings.twofa.enroll.codePrompt")}</p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => onChangeCode(e.target.value)}
            placeholder="000000"
            className="w-32 h-10 rounded-md border border-input bg-background px-3 text-center font-mono tracking-widest text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            autoFocus
          />
          <Button size="sm" className="h-9 text-xs" onClick={onConfirm} disabled={code.length !== 6}>
            {t("settings.twofa.confirm")}
          </Button>
          <Button size="sm" variant="ghost" className="h-9 text-xs" onClick={onCancel}>
            {t("settings.twofa.cancel")}
          </Button>
        </div>
        {error && <p className="text-[11px] text-destructive mt-1.5">{error}</p>}
      </div>
    </div>
  )
}

function CodeGate({
  title,
  description,
  code,
  error,
  submitLabel,
  onChangeCode,
  onCancel,
  onSubmit,
}: {
  title: string
  description: string
  code: string
  error?: string
  submitLabel: string
  onChangeCode: (c: string) => void
  onCancel: () => void
  onSubmit: () => void
}) {
  const { t } = useT()
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          maxLength={12}
          value={code}
          onChange={(e) => onChangeCode(e.target.value)}
          placeholder="code"
          className="w-40 h-9 rounded-md border border-input bg-background px-3 text-center font-mono tracking-widest text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          autoFocus
        />
        <Button size="sm" className="h-9 text-xs" onClick={onSubmit} disabled={code.trim().length < 6}>
          {submitLabel}
        </Button>
        <Button size="sm" variant="ghost" className="h-9 text-xs" onClick={onCancel}>
          {t("settings.twofa.cancel")}
        </Button>
      </div>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  )
}

function RecoveryCodesBlock({ codes }: { codes: string[] }) {
  const { t } = useT()
  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <AlertTriangle className="size-3.5 text-amber-400" />
        <p className="text-xs font-medium text-amber-200">
          {t("settings.twofa.recovery.title")}
        </p>
      </div>
      <p className="text-[11px] text-amber-200/80 leading-relaxed">
        {t("settings.twofa.recovery.help")}
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {codes.map((c) => (
          <code
            key={c}
            className="font-mono text-xs px-2 py-1 rounded bg-background/60 text-center tracking-wider"
          >
            {c}
          </code>
        ))}
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-[11px] gap-1.5 w-full"
        onClick={() => {
          navigator.clipboard.writeText(codes.join("\n")).catch(() => undefined)
          toast.success(t("settings.twofa.recovery.copied"))
        }}
      >
        <Copy className="size-3" /> {t("settings.twofa.recovery.copyAll")}
      </Button>
    </div>
  )
}

// ─── QR code (uses `qrcode` npm) ──────────────────────────────────────

function QRCode({ value, size }: { value: string; size: number }) {
  const { t } = useT()
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    // Dynamic import keeps the dep out of the initial bundle for users
    // who never touch 2FA.
    import("qrcode")
      .then((mod) =>
        mod.toDataURL(value, {
          width: size,
          margin: 1,
          errorCorrectionLevel: "M",
        }),
      )
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [value, size])
  if (!dataUrl) {
    return (
      <div
        className="flex items-center justify-center bg-neutral-100 text-neutral-500 text-[10px] font-mono"
        style={{ width: size, height: size }}
      >
        QR…
      </div>
    )
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={dataUrl} alt={t("settings.twofa.qrAlt")} width={size} height={size} />
}
