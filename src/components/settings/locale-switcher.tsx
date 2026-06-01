"use client"

/**
 * Locale switcher + onboarding-replay trigger.
 *
 * Lives in Settings → Look & feel. Two small controls:
 *   - Language picker (English / العربية)
 *   - "Replay onboarding tour" button (resets `onboardingCompletedAt`
 *     so the tour appears on next reload)
 */

import { Globe, Sparkles, Type } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  usePreferences,
  ARABIC_FONT_OPTIONS,
  ARABIC_FONT_CSS,
  type ArabicFont,
} from "@/lib/hooks/use-preferences"
import { LOCALES } from "@/lib/i18n/strings"
import { useT } from "@/lib/hooks/use-i18n"

export function LocaleSwitcher() {
  const { t } = useT()
  const { preferences, updatePreference } = usePreferences()
  const locale = preferences.locale === "ar" ? "ar" : "en"
  const arabicFont = preferences.arabicFont ?? "cairo"

  return (
    <div className="space-y-3">
      <div className="px-4 py-3 rounded-lg border bg-card">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="size-3.5 text-muted-foreground" />
          <h3 className="text-sm font-medium">{t("settings.locale.language")}</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
          {t("settings.locale.languageHelp")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {LOCALES.map((l) => {
            const isActive = locale === l.code
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => updatePreference("locale", l.code)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors border-2 ${
                  isActive
                    ? "border-primary bg-primary/5 text-foreground font-medium"
                    : "border-border hover:border-primary/30 hover:bg-accent/30 text-muted-foreground"
                }`}
              >
                <span className="font-medium">{l.label}</span>
                <span className="text-[10px] uppercase tracking-wider opacity-60">
                  {l.code} · {l.dir}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Arabic font picker */}
      <div className="px-4 py-3 rounded-lg border bg-card">
        <div className="flex items-center gap-2 mb-2">
          <Type className="size-3.5 text-muted-foreground" />
          <h3 className="text-sm font-medium">{t("settings.locale.arabicFont")}</h3>
          {locale !== "ar" && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
              {t("settings.locale.appliesInArabic")}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
          {t("settings.locale.arabicFontHelp")}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ARABIC_FONT_OPTIONS.map((font) => {
            const isActive = arabicFont === font.value
            return (
              <button
                key={font.value}
                type="button"
                onClick={() => updatePreference("arabicFont", font.value as ArabicFont)}
                className={`text-left px-3 py-2.5 rounded-lg border-2 transition-all ${
                  isActive
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30 hover:bg-accent/30"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{font.label}</span>
                  {isActive && (
                    <span className="text-[10px] uppercase tracking-wider text-primary font-medium">
                      {t("settings.locale.active")}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mb-1.5">
                  {font.description}
                </p>
                <p
                  dir="rtl"
                  className="text-lg leading-tight"
                  style={{ fontFamily: ARABIC_FONT_CSS[font.value] }}
                >
                  {font.preview}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      <div className="px-4 py-3 rounded-lg border bg-card">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="size-3.5 text-muted-foreground" />
          <h3 className="text-sm font-medium">{t("settings.locale.tour")}</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
          {t("settings.locale.tourHelp")}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1.5"
          onClick={() => {
            updatePreference("onboardingCompletedAt", "")
            toast.success(t("settings.locale.tourReplayToast"))
            setTimeout(() => window.location.reload(), 800)
          }}
        >
          <Sparkles className="size-3" />
          {t("settings.locale.replayTour")}
        </Button>
      </div>
    </div>
  )
}
