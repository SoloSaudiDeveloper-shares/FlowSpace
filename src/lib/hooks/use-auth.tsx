"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react"
import type { User } from "@/lib/db/schema"
import {
  login as loginAction,
  logout as logoutAction,
  getCurrentUser,
} from "@/lib/actions/user-actions"

// ─── Types ────────────────────────────────────────────────────────────────

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  needsSetup: boolean
  login: (
    username: string,
    password: string,
    twoFactorCode?: string,
  ) => Promise<{ success: boolean; error?: string; needsTwoFactor?: boolean }>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

// ─── Context ──────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────

export function AuthProvider({
  children,
  initialUser,
  initialNeedsSetup,
}: {
  children: ReactNode
  initialUser: User | null
  initialNeedsSetup: boolean
}) {
  const [user, setUser] = useState<User | null>(initialUser)
  const [isLoading, setIsLoading] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(initialNeedsSetup)

  const isAuthenticated = !!user

  const refreshUser = useCallback(async () => {
    try {
      setIsLoading(true)
      const currentUser = await getCurrentUser()
      setUser(currentUser)
      if (currentUser) {
        setNeedsSetup(false)
      }
    } catch {
      // ignore errors during refresh
    } finally {
      setIsLoading(false)
    }
  }, [])

  const login = useCallback(
    async (
      username: string,
      password: string,
      twoFactorCode?: string,
    ): Promise<{ success: boolean; error?: string; needsTwoFactor?: boolean }> => {
      try {
        setIsLoading(true)
        const result = await loginAction(username, password, twoFactorCode)
        if (result.success && result.user) {
          setUser(result.user)
          setNeedsSetup(false)
        }
        return {
          success: result.success,
          error: result.error,
          needsTwoFactor: result.needsTwoFactor,
        }
      } catch {
        return { success: false, error: "An unexpected error occurred" }
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const logout = useCallback(async () => {
    try {
      setIsLoading(true)
      await logoutAction()
      setUser(null)
      window.location.href = "/login"
    } catch {
      // ignore errors during logout
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Refresh user on mount if initialUser is null but a cookie might exist
  useEffect(() => {
    if (!initialUser && !initialNeedsSetup) {
      refreshUser()
    }
  }, [initialUser, initialNeedsSetup, refreshUser])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        needsSetup,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
