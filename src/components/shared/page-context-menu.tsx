"use client"

import { type ReactNode } from "react"
import { BrainCircuit, Mic, Cpu } from "lucide-react"
import { ContextMenu, useContextMenu, type ContextMenuEntry } from "@/components/shared/context-menu"
import { useAI } from "@/lib/hooks/use-ai"
import { useSpeechRecognition } from "@/lib/hooks/use-speech-recognition"
import { usePreferences } from "@/lib/hooks/use-preferences"

interface PageContextMenuProps {
  children: ReactNode
  className?: string
}

export function PageContextMenu({ children, className }: PageContextMenuProps) {
  const { menu, open, close } = useContextMenu()
  const { disposeAll, modelStates } = useAI()
  const { status: speechStatus, unloadModel } = useSpeechRecognition()
  const { preferences } = usePreferences()

  const speechLoaded = speechStatus === "ready" || speechStatus === "listening"
  // Only meaningful when models are actually loaded IN THE BROWSER. With an
  // API-key provider (OpenAI / Gemini / etc.) nothing is loaded locally, so
  // there's nothing to unload — don't show the option.
  const aiModelsLoaded = modelStates.size > 0

  function handleContextMenu(e: React.MouseEvent) {
    // Let native context menu through on text inputs for copy/paste
    const target = e.target as HTMLElement
    const tag = target.tagName
    if (
      tag === "INPUT" || tag === "TEXTAREA" ||
      target.isContentEditable ||
      target.closest("[contenteditable]")
    ) {
      return
    }

    const items: ContextMenuEntry[] = []

    if (preferences.speechEnabled && speechLoaded) {
      items.push({
        label: "Unload Speech Model",
        icon: Mic,
        onClick: () => unloadModel(),
      })
    }

    // Only when something is actually loaded locally (not for API providers).
    if (preferences.aiEnabled && aiModelsLoaded) {
      items.push({
        label: "Unload AI Models",
        icon: Cpu,
        onClick: () => disposeAll(),
      })
    }

    if (items.length >= 2) {
      items.push({ separator: true })
      items.push({
        label: "Unload All Models",
        icon: BrainCircuit,
        onClick: () => {
          if (speechLoaded) unloadModel()
          disposeAll()
        },
      })
    }

    if (items.length === 0) return

    open(e, items)
  }

  return (
    <>
      <div className={className} onContextMenu={handleContextMenu}>
        {children}
      </div>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menu.items}
          onClose={close}
        />
      )}
    </>
  )
}
