import type { Metadata } from "next"
import { Geist, Geist_Mono, Inter, Plus_Jakarta_Sans, DM_Sans } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { PreferencesProvider } from "@/lib/hooks/use-preferences"
import { SpeechProvider } from "@/lib/hooks/use-speech-recognition"
import { AIProvider } from "@/lib/hooks/use-ai"
import { AuthProvider } from "@/lib/hooks/use-auth"

import { TooltipProvider } from "@/components/ui/tooltip"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { CommandPalette } from "@/components/layout/command-palette"
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts"
import { TopbarClock } from "@/components/layout/topbar-clock"
import { TaskTimerWidget } from "@/components/layout/task-timer-widget"
import { MainShell } from "@/components/layout/main-shell"
import { Toaster } from "sonner"
import { getElements, getFavoriteElements } from "@/lib/actions/element-actions"
import { getCurrentUser, hasAnyUsers } from "@/lib/actions/user-actions"

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

export const metadata: Metadata = {
  title: "FlowSpace",
  description: "Your personal productivity workspace",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [currentUser, anyUsers] = await Promise.all([
    getCurrentUser().catch(() => null),
    hasAnyUsers().catch(() => false),
  ])

  // Only fetch sidebar data when the user is actually authenticated. Anyone
  // hitting /login or another public route should never see workspace
  // content leak through the sidebar.
  const [allElements, favorites] = currentUser
    ? await Promise.all([getElements(), getFavoriteElements()])
    : [[], []]

  const needsSetup = !anyUsers

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${plusJakarta.variable} ${dmSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ThemeProvider defaultTheme="dark">
          <AuthProvider initialUser={currentUser} initialNeedsSetup={needsSetup}>
          <PreferencesProvider>
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
                  </>
                )}
              </SidebarProvider>
              <Toaster richColors position="bottom-right" />
            </TooltipProvider>
            </AIProvider>
            </SpeechProvider>
          </PreferencesProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
