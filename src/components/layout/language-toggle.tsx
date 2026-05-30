"use client"

/**
 * Globe-icon language switcher.
 *
 * The "standard websites" pattern: an earth/globe icon that, when
 * clicked, pops up the available languages (with real flags) to choose
 * from. Lives in the sidebar footer next to the theme toggle so it's
 * reachable from every page once signed in.
 *
 * Positioning is delegated to the app's DropdownMenu primitive (base-ui
 * Menu under the hood). That portals the popup to <body> and runs a
 * collision-aware positioner, so the menu can never be clipped by the
 * sidebar's edge/overflow and it auto-flips/shifts to stay on screen —
 * which is exactly what we need on narrow mobile viewports too. We open
 * it upward (side="top") from the footer and align to the trigger.
 *
 * Selecting a language flips the whole app to that locale (and to RTL
 * for Arabic) via the i18n provider, which persists the choice to the
 * user's DB-backed preferences.
 */

import { Globe } from "lucide-react"
import { useT } from "@/lib/hooks/use-i18n"
import { LOCALES, type Locale } from "@/lib/i18n/strings"
import { USFlag, SaudiFlag } from "@/components/shared/flag-icons"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"

const FLAG: Record<Locale, (props: { size?: number }) => React.ReactNode> = {
  en: (p) => <USFlag size={p.size} />,
  ar: (p) => <SaudiFlag size={p.size} />,
}

export function LanguageToggle() {
  const { locale, setLocale } = useT()
  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="p-1.5 rounded-md hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title={`Language: ${current.label}`}
        aria-label={`Language: ${current.label}`}
      >
        <Globe className="size-3.5" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side="top"
        align="end"
        sideOffset={6}
        className="min-w-[180px]"
      >
        {/* Plain div, NOT DropdownMenuLabel — base-ui's GroupLabel throws if
            it isn't wrapped in a Menu.Group, and we don't need a group here. */}
        <div className="px-1.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
          Language
        </div>
        <DropdownMenuRadioGroup
          value={locale}
          onValueChange={(value) => setLocale(value as Locale)}
        >
          {LOCALES.map((l) => (
            <DropdownMenuRadioItem key={l.code} value={l.code} className="gap-2">
              {FLAG[l.code]?.({ size: 18 })}
              <span className="flex-1 text-left">{l.label}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
