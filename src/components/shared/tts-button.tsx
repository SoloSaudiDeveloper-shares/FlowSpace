"use client"

import { useState } from "react"
import { Volume2, VolumeX, Loader2 } from "lucide-react"
import { useAI } from "@/lib/hooks/use-ai"
import { usePreferences } from "@/lib/hooks/use-preferences"

interface TTSButtonProps {
  /** Text to read aloud */
  text: string
  /** Optional custom class */
  className?: string
  /** Size variant */
  size?: "sm" | "md" | "lg"
  /** Tooltip text */
  tooltip?: string
}

export function TTSButton({
  text,
  className = "",
  size = "md",
  tooltip = "Read aloud",
}: TTSButtonProps) {
  const { preferences } = usePreferences()
  const { enabled, speak, stopSpeaking, isSpeaking } = useAI()
  const [loading, setLoading] = useState(false)

  if (!preferences.aiEnabled || !enabled) return null
  if (!text.trim()) return null

  const sizeClasses = {
    sm: "size-7",
    md: "size-8",
    lg: "size-10",
  }

  const iconSizes = {
    sm: "size-3",
    md: "size-3.5",
    lg: "size-4",
  }

  async function handleClick() {
    if (isSpeaking) {
      stopSpeaking()
      return
    }

    setLoading(true)
    try {
      await speak({ text })
    } catch (err) {
      console.error("[TTS] Error:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      title={isSpeaking ? "Stop reading" : loading ? "Loading TTS model..." : tooltip}
      className={`
        inline-flex items-center justify-center rounded-full transition-all
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
        ${sizeClasses[size]}
        ${
          isSpeaking
            ? "bg-primary text-primary-foreground hover:bg-primary/80 shadow-md"
            : loading
              ? "bg-muted text-muted-foreground cursor-wait"
              : "bg-muted/60 text-muted-foreground hover:bg-accent hover:text-foreground"
        }
        ${className}
      `}
      aria-label={isSpeaking ? "Stop reading aloud" : "Read aloud"}
    >
      {loading ? (
        <Loader2 className={`${iconSizes[size]} animate-spin`} />
      ) : isSpeaking ? (
        <VolumeX className={iconSizes[size]} />
      ) : (
        <Volume2 className={iconSizes[size]} />
      )}
    </button>
  )
}
