"use client"

/**
 * I18n provider — wraps the app, listens to the user's locale
 * preference, and exposes `useT()` for components.
 *
 * On locale change we also flip `<html lang>` and `<html dir>` so the
 * whole app re-lays-out RTL when Arabic is picked. The change happens
 * client-side; the initial server render uses lang="en" dir="ltr" until
 * the user's preference loads.
 */

import { createContext, useContext, useEffect, type ReactNode } from "react"
import { translate, localeDirection, type Locale } from "@/lib/i18n/strings"
import { usePreferences } from "@/lib/hooks/use-preferences"

interface I18nContextValue {
  locale: Locale
  t: (key: string) => string
  setLocale: (l: Locale) => void
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const { preferences, updatePreference } = usePreferences()
  const locale: Locale = preferences.locale === "ar" ? "ar" : "en"

  useEffect(() => {
    if (typeof document === "undefined") return
    document.documentElement.lang = locale
    document.documentElement.dir = localeDirection(locale)
  }, [locale])

  return (
    <I18nContext.Provider
      value={{
        locale,
        t: (key) => translate(locale, key),
        setLocale: (l) => updatePreference("locale", l),
      }}
    >
      {children}
    </I18nContext.Provider>
  )
}

export function useT() {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    // Allow components to be used outside the provider — they fall back
    // to English. Avoids a crash on storybook/test setups.
    return {
      locale: "en" as Locale,
      t: (key: string) => translate("en", key),
      setLocale: () => undefined,
    }
  }
  return ctx
}
