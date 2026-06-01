/**
 * Lightweight i18n.
 *
 * Translations live in per-area modules under `./dicts/` (one `{ en, ar }`
 * file per area), merged in `./dicts/index.ts`. Components call `t("area.key")`
 * via `useT()`; missing keys fall back to English, then to the key itself, so
 * partial coverage never crashes a page. The I18nProvider flips `<html dir>`
 * to RTL when the locale is Arabic.
 */

import { EN, AR } from "./dicts"

export type Locale = "en" | "ar"

export const LOCALES: { code: Locale; label: string; dir: "ltr" | "rtl" }[] = [
  { code: "en", label: "English",  dir: "ltr" },
  { code: "ar", label: "العربية",  dir: "rtl" },
]

type Dict = Record<string, string>


const DICTS: Record<Locale, Dict> = { en: EN, ar: AR }

/** Translate a key. Falls back to English, then to the key itself. */
export function translate(locale: Locale, key: string): string {
  return DICTS[locale]?.[key] ?? EN[key] ?? key
}

/** Direction for a given locale. */
export function localeDirection(locale: Locale): "ltr" | "rtl" {
  return LOCALES.find((l) => l.code === locale)?.dir ?? "ltr"
}
