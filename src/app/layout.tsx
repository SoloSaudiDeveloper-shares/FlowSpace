import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Inter, Plus_Jakarta_Sans, DM_Sans } from "next/font/google"
import {
  Cairo,
  Tajawal,
  IBM_Plex_Sans_Arabic,
  Noto_Kufi_Arabic,
  Amiri,
} from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { PreferencesProvider } from "@/lib/hooks/use-preferences"
import { SpeechProvider } from "@/lib/hooks/use-speech-recognition"
import { AIProvider } from "@/lib/hooks/use-ai"
import { AuthProvider } from "@/lib/hooks/use-auth"
import { I18nProvider } from "@/lib/hooks/use-i18n"

import { TooltipProvider } from "@/components/ui/tooltip"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { CommandPalette } from "@/components/layout/command-palette"
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts"
import { TopbarClock } from "@/components/layout/topbar-clock"
import { TaskTimerWidget } from "@/components/layout/task-timer-widget"
import { MainShell } from "@/components/layout/main-shell"
import { PWABootstrap } from "@/components/layout/pwa-bootstrap"
import { OnboardingTour } from "@/components/layout/onboarding-tour"
import { PomodoroWidget } from "@/components/layout/pomodoro-widget"
import { PlatformChatDrawer } from "@/components/layout/platform-chat-drawer"
import { Toaster } from "sonner"
import { getElements, getFavoriteElements } from "@/lib/actions/element-actions"
import { getCurrentUser, hasAnyUsers } from "@/lib/actions/user-actions"
import { getMyPreferences } from "@/lib/actions/preferences-actions"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
})

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
})

// ── Arabic webfonts ───────────────────────────────────────────────────────
// The Latin UI fonts above only ship Latin glyphs, so Arabic text falls
// back to the OS default (ugly on Windows/Chrome). These carry real Arabic
// glyphs; the user picks one in Settings → Look & feel and it's applied via
// the --font-sans variable whenever the locale is Arabic.
const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
})
const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700"],
})
const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-ibm-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
})
const notoKufiArabic = Noto_Kufi_Arabic({
  variable: "--font-noto-kufi",
  subsets: ["arabic"],
})
const amiri = Amiri({
  variable: "--font-amiri",
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
})

export const metadata: Metadata = {
  title: "FlowSpace",
  description: "Your personal productivity workspace",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FlowSpace",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    apple: "/icons/icon-192.svg",
  },
}

// Next.js 15: themeColor belongs in the viewport export, not metadata.
export const viewport: Viewport = {
  themeColor: "#0a0a0a",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [currentUser, anyUsers, savedPrefs] = await Promise.all([
    getCurrentUser().catch(() => null),
    hasAnyUsers().catch(() => false),
    getMyPreferences().catch(() => null) as Promise<
      { locale?: string; arabicFont?: string } | null
    >,
  ])

  // Resolve the locale server-side so the very first paint already has the
  // correct lang + direction (no flash of LTR for Arabic users, and SSR
  // matches what the I18nProvider will set on the client).
  const locale = savedPrefs?.locale === "ar" ? "ar" : "en"
  const dir = locale === "ar" ? "rtl" : "ltr"

  // Pre-seed the Arabic font on the first paint too, so Arabic text doesn't
  // briefly render in the (glyph-less) Latin UI font before the client
  // PreferencesProvider applies the user's choice.
  const arabicFontVar: Record<string, string> = {
    cairo: "--font-cairo",
    tajawal: "--font-tajawal",
    "ibm-arabic": "--font-ibm-arabic",
    "noto-kufi": "--font-noto-kufi",
    amiri: "--font-amiri",
  }
  const htmlStyle =
    locale === "ar"
      ? ({
          "--font-sans": `var(${arabicFontVar[savedPrefs?.arabicFont ?? "cairo"] ?? "--font-cairo"}), system-ui, sans-serif`,
        } as React.CSSProperties)
      : undefined

  // Only fetch sidebar data when the user is actually authenticated. Anyone
  // hitting /login or another public route should never see workspace
  // content leak through the sidebar.
  const [allElements, favorites] = currentUser
    ? await Promise.all([getElements(), getFavoriteElements()])
    : [[], []]

  const needsSetup = !anyUsers

  return (
    <html
      lang={locale}
      dir={dir}
      style={htmlStyle}
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${plusJakarta.variable} ${dmSans.variable} ${cairo.variable} ${tajawal.variable} ${ibmPlexArabic.variable} ${notoKufiArabic.variable} ${amiri.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ThemeProvider defaultTheme="dark">
          <AuthProvider initialUser={currentUser} initialNeedsSetup={needsSetup}>
          <PreferencesProvider>
            <I18nProvider>
            <SpeechProvider>
            <AIProvider>
            <TooltipProvider>
              {/* SidebarProvider is always present so pages using
                  useSidebar() (e.g. SidebarTrigger) don't crash at
                  prerender time. The sidebar + floating widgets only
                  render when the user is actually signed in. */}
              <SidebarProvider>
                {currentUser && (
                  <AppSidebar elements={allElements} favorites={favorites} />
                )}
                <SidebarInset>
                  {currentUser ? (
                    <MainShell>{children}</MainShell>
                  ) : (
                    children
                  )}
                </SidebarInset>
                {currentUser && (
                  <>
                    <TopbarClock />
                    <TaskTimerWidget />
                    <CommandPalette />
                    <KeyboardShortcuts />
                    <OnboardingTour />
                    <PomodoroWidget />
                    <PlatformChatDrawer />
                  </>
                )}
              </SidebarProvider>
              <Toaster richColors position="bottom-right" />
              <PWABootstrap />
            </TooltipProvider>
            </AIProvider>
            </SpeechProvider>
            </I18nProvider>
          </PreferencesProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
