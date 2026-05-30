"use client"

/**
 * Globe-icon language switcher.
 *
 * The "standard websites" pattern: an earth/globe icon that, when
 * clicked, pops up the available languages (with real flags) to choose
 * from. Lives in the sidebar footer next to the theme toggle so it's
 * reachable from every page once signed in.
 *
 * Selecting a language flips the whole app to that locale (and to RTL
 * for Arabic) via the i18n provider, which persists the choice to the
 * user's DB-backed preferences.
 */

import { useEffect, useRef, useState } from "react"
import { Globe, Check } from "lucide-react"
import { useT } from "@/lib/hooks/use-i18n"
import { LOCALES, type Locale } from "@/lib/i18n/strings"
import { USFlag, SaudiFlag } from "@/components/shared/flag-icons"

const FLAG: Record<Locale, (props: { size?: number }) => React.ReactNode> = {
  en: (p) => <USFlag size={p.size} />,
  ar: (p) => <SaudiFlag size={p.size} />,
}

export function LanguageToggle() {
  const { locale, setLocale } = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0]

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-md hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        title={`Language: ${current.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Globe className="size-3.5" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-full mb-1 right-0 z-50 min-w-[160px] rounded-lg border border-border bg-popover shadow-xl p-1 animate-in fade-in-0 zoom-in-95"
        >
          <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
            Language
          </p>
          {LOCALES.map((l) => {
            const active = l.code === locale
            return (
              <button
                key={l.code}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setLocale(l.code)
                  setOpen(false)
                }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }`}
              >
                {FLAG[l.code]?.({ size: 18 })}
                <span className="flex-1 text-left">{l.label}</span>
                {active && <Check className="size-3.5 text-primary" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
