"use client"

/**
 * Translatable page-header title.
 *
 * Page headers live in server components (each route's page.tsx), but
 * translation needs the client-side i18n context (the locale only
 * resolves after the user's preference loads). This tiny client island
 * bridges the gap: drop it into any server-rendered header and it renders
 * the localized string, falling back to the English `fallback` until the
 * dictionary resolves (so SSR output stays sensible and there's no flash
 * of a raw key).
 */

import { useT } from "@/lib/hooks/use-i18n"
import { cn } from "@/lib/utils"

export function PageTitle({
  titleKey,
  fallback,
  className,
}: {
  titleKey: string
  fallback: string
  className?: string
}) {
  const { t } = useT()
  const translated = t(titleKey)
  // translate() returns the key itself when nothing matched — in that
  // case prefer the human-readable English fallback the caller passed.
  const text = translated === titleKey ? fallback : translated
  return <h1 className={cn("text-lg font-semibold", className)}>{text}</h1>
}
