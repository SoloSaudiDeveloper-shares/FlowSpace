"use client"

/**
 * Locale switcher + onboarding-replay trigger.
 *
 * Lives in Settings → Look & feel. Two small controls:
 *   - Language picker (English / العربية)
 *   - "Replay onboarding tour" button (resets `onboardingCompletedAt`
 *     so the tour appears on next reload)
 */

import { Globe, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { usePreferences } from "@/lib/hooks/use-preferences"
import { LOCALES } from "@/lib/i18n/strings"

export function LocaleSwitcher() {
  const { preferences, updatePreference } = usePreferences()
  const locale = preferences.locale === "ar" ? "ar" : "en"

  return (
    <div className="space-y-3">
      <div className="px-4 py-3 rounded-lg border bg-card">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="size-3.5 text-muted-foreground" />
          <h3 className="text-sm font-medium">Language</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
          Switches the high-traffic chrome strings (sidebar, login, settings
          tabs, common buttons). Most page content still falls back to
          English for now — full coverage is rolling out.
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

      <div className="px-4 py-3 rounded-lg border bg-card">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="size-3.5 text-muted-foreground" />
          <h3 className="text-sm font-medium">Onboarding tour</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
          The 7-step guided tour that runs the first time you sign in. Replay
          it any time to re-discover what's where.
        </p>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1.5"
          onClick={() => {
            updatePreference("onboardingCompletedAt", "")
            toast.success("Tour will play again on next reload")
            setTimeout(() => window.location.reload(), 800)
          }}
        >
          <Sparkles className="size-3" />
          Replay tour
        </Button>
      </div>
    </div>
  )
}
