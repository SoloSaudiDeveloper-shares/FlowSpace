"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"

type Theme = "light" | "dark" | "system"

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: string
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  setTheme: () => {},
  resolvedTheme: "dark",
})

export function useTheme() {
  return useContext(ThemeContext)
}

function getSystemTheme() {
  if (typeof window === "undefined") return "dark"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function applyTheme(resolved: string) {
  const root = document.documentElement
  root.classList.remove("dark", "light")
  root.classList.add(resolved)
  root.style.colorScheme = resolved
}

export function ThemeProvider({
  children,
  defaultTheme = "dark",
}: {
  children: React.ReactNode
  defaultTheme?: Theme
  attribute?: string
  enableSystem?: boolean
  disableTransitionOnChange?: boolean
}) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme)
  const [resolvedTheme, setResolvedTheme] = useState(() =>
    defaultTheme === "system" ? "dark" : defaultTheme
  )

  // Read stored theme on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme") as Theme | null
      if (stored) {
        setThemeState(stored)
        const resolved = stored === "system" ? getSystemTheme() : stored
        setResolvedTheme(resolved)
        applyTheme(resolved)
      }
    } catch {}
  }, [])

  // Apply theme when it changes
  useEffect(() => {
    const resolved = theme === "system" ? getSystemTheme() : theme
    setResolvedTheme(resolved)
    applyTheme(resolved)
  }, [theme])

  // Listen for system preference changes
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => {
      if (theme !== "system") return
      const resolved = mq.matches ? "dark" : "light"
      setResolvedTheme(resolved)
      applyTheme(resolved)
    }
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [theme])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    try {
      localStorage.setItem("theme", t)
    } catch {}
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
