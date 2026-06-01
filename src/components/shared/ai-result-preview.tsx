"use client"

/**
 * Preview-before-apply dialog for AI writing actions.
 *
 * Nothing touches the document until the user clicks Apply. The result is
 * editable; for Summarize there's a strength picker (one line / short /
 * detailed). Advanced users can edit the system prompt, regenerate, and save
 * it as their default. A footer checkbox controls whether this preview shows
 * every time or actions apply directly.
 */

import { useState } from "react"
import { Loader2, RefreshCw, Check, Sparkles, ChevronDown, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { usePreferences } from "@/lib/hooks/use-preferences"
import { useT } from "@/lib/hooks/use-i18n"
import {
  type AIAction,
  type SummaryStrength,
  ACTION_LABELS,
  DEFAULT_SYSTEM_PROMPTS,
  STRENGTH_PROMPTS,
  STRENGTH_LABELS,
} from "@/lib/ai/ai-actions"

const STRENGTHS: SummaryStrength[] = ["one_line", "short", "detailed"]

export interface AIPreviewState {
  action: AIAction
  original: string
  result: string
}

export function AIResultPreview({
  state,
  busy,
  onRegenerate,
  onApply,
  onClose,
}: {
  state: AIPreviewState
  /** True while a regeneration request is in flight. */
  busy: boolean
  /** Re-run generation with the given system prompt + strength; parent updates `state.result`. */
  onRegenerate: (systemPrompt: string, strength: SummaryStrength) => void
  /** Apply the (possibly edited) text to the document. */
  onApply: (text: string) => void
  onClose: () => void
}) {
  const { preferences, updatePreference } = usePreferences()
  const { t } = useT()
  const { action, original, result } = state
  const isSummarize = action === "summarize"

  const savedPrompt = preferences.aiSystemPrompts?.[action]
  const savedIsCustom =
    !!savedPrompt && savedPrompt !== DEFAULT_SYSTEM_PROMPTS[action]

  const [strength, setStrength] = useState<SummaryStrength>(
    preferences.aiSummaryStrength ?? "short",
  )
  const [systemPrompt, setSystemPrompt] = useState<string>(() => {
    if (isSummarize) {
      return savedIsCustom
        ? (savedPrompt as string)
        : STRENGTH_PROMPTS[preferences.aiSummaryStrength ?? "short"]
    }
    return savedPrompt || DEFAULT_SYSTEM_PROMPTS[action]
  })
  const [showAdvanced, setShowAdvanced] = useState(false)

  // The result is editable; mirror parent `result` into a draft, resyncing
  // whenever a regeneration replaces it (render-time pattern, no effect).
  const [draft, setDraft] = useState(result)
  const [prevResult, setPrevResult] = useState(result)
  if (result !== prevResult) {
    setPrevResult(result)
    setDraft(result)
  }

  function chooseStrength(s: SummaryStrength) {
    setStrength(s)
    const p = STRENGTH_PROMPTS[s]
    setSystemPrompt(p)
    onRegenerate(p, s)
  }

  function saveAsDefault() {
    const prompts = { ...(preferences.aiSystemPrompts ?? {}) }
    prompts[action] = systemPrompt
    updatePreference("aiSystemPrompts", prompts)
    if (isSummarize) updatePreference("aiSummaryStrength", strength)
    toast.success(t("shared.ai.savedDefault"))
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <div className="flex items-center gap-1.5 pr-8">
          <Sparkles className="size-3.5 text-primary" />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium">
            {ACTION_LABELS[action]} · {t("shared.ai.previewSuffix")}
          </span>
        </div>
        <DialogTitle className="text-base">{t("shared.ai.reviewTitle")}</DialogTitle>
        <p className="text-xs text-muted-foreground -mt-1">
          {t("shared.ai.reviewNote")} <strong>{t("shared.ai.applyWord")}</strong>.
        </p>

        {/* Strength picker (summarize only) */}
        {isSummarize && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-muted-foreground">{t("shared.ai.strength")}</span>
            <div className="inline-flex rounded-md border border-border/60 p-0.5">
              {STRENGTHS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={() => chooseStrength(s)}
                  className={`px-2.5 py-1 text-[11px] rounded transition-colors ${
                    strength === s
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {STRENGTH_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Result (editable) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              {t("shared.ai.resultEditable")}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11px] gap-1.5"
              disabled={busy}
              onClick={() => onRegenerate(systemPrompt, strength)}
            >
              {busy ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
              {t("shared.ai.regenerate")}
            </Button>
          </div>
          <div className="relative">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={8}
              className="w-full rounded-md border border-input bg-background p-3 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y min-h-[140px]"
            />
            {busy && (
              <div className="absolute inset-0 grid place-items-center rounded-md bg-background/60">
                <Loader2 className="size-5 animate-spin text-primary" />
              </div>
            )}
          </div>
        </div>

        {/* Original (collapsed) */}
        <details className="rounded-md border border-border/60 bg-muted/20 text-xs">
          <summary className="cursor-pointer select-none px-3 py-1.5 text-muted-foreground hover:text-foreground">
            {t("shared.ai.showOriginal").replace(
              "{count}",
              original.split(/\s+/).filter(Boolean).length.toLocaleString(),
            )}
          </summary>
          <div className="max-h-40 overflow-y-auto px-3 pb-3 whitespace-pre-wrap text-muted-foreground/80 leading-relaxed">
            {original}
          </div>
        </details>

        {/* Advanced — custom prompt + save default */}
        <div className="rounded-md border border-border/60">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex w-full items-center gap-1.5 px-3 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={`size-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
            {t("shared.ai.advanced")}
          </button>
          {showAdvanced && (
            <div className="px-3 pb-3 space-y-2">
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-input bg-background p-2 text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                placeholder={t("shared.ai.systemPromptPh")}
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px] gap-1.5"
                  disabled={busy}
                  onClick={() => onRegenerate(systemPrompt, strength)}
                >
                  <RefreshCw className="size-3" />
                  {t("shared.ai.applyPromptRegenerate")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px] gap-1.5 text-muted-foreground"
                  onClick={saveAsDefault}
                >
                  <Save className="size-3" />
                  {t("shared.ai.saveAsDefault")}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              className="accent-primary"
              checked={preferences.aiPreviewBeforeApply}
              onChange={(e) => updatePreference("aiPreviewBeforeApply", e.target.checked)}
            />
            {t("shared.ai.askPreviewEveryTime")}
          </label>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={onClose}>
              {t("shared.ai.cancel")}
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5"
              disabled={busy || !draft.trim()}
              onClick={() => onApply(draft)}
            >
              <Check className="size-3.5" />
              {t("shared.ai.apply")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
