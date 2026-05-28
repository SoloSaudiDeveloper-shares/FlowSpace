"use client"

import { useEffect, useState, useCallback } from "react"

/**
 * The admin-controlled workspace name shown in the sidebar header.
 *
 * Strategy mirrors usePreferences: read a localStorage cache for instant
 * render, then fetch the authoritative value from the server. When the
 * owner edits it in Settings, we dispatch a `workspaceNameChanged` event
 * so every mounted instance (sidebar, settings page, etc.) re-fetches
 * without a full reload.
 */

const CACHE_KEY = "flowspace-workspace-name"
const EVENT_NAME = "flowspace:workspace-name-changed"
const DEFAULT_NAME = "FlowSpace"

export function useWorkspaceName(): {
  workspaceName: string
  setWorkspaceName: (name: string) => Promise<void>
  refresh: () => Promise<void>
} {
  const [workspaceName, setName] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_NAME
    try {
      return localStorage.getItem(CACHE_KEY) || DEFAULT_NAME
    } catch {
      return DEFAULT_NAME
    }
  })

  const refresh = useCallback(async () => {
    try {
      const { getWorkspaceName } = await import("@/lib/actions/server-settings-actions")
      const name = await getWorkspaceName()
      setName(name)
      try { localStorage.setItem(CACHE_KEY, name) } catch {}
    } catch {
      // network/auth issue — keep the cache value
    }
  }, [])

  // Fetch on mount + listen for in-tab changes broadcast via custom event.
  useEffect(() => {
    refresh()
    function onChange() { refresh() }
    window.addEventListener(EVENT_NAME, onChange)
    return () => window.removeEventListener(EVENT_NAME, onChange)
  }, [refresh])

  const setWorkspaceName = useCallback(async (name: string) => {
    const trimmed = name.trim().slice(0, 40)
    if (!trimmed) return
    const { setWorkspaceName: serverSet } = await import("@/lib/actions/server-settings-actions")
    await serverSet(trimmed)
    setName(trimmed)
    try { localStorage.setItem(CACHE_KEY, trimmed) } catch {}
    window.dispatchEvent(new CustomEvent(EVENT_NAME))
  }, [])

  return { workspaceName, setWorkspaceName, refresh }
}
