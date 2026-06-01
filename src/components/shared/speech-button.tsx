"use client"

import { useEffect, useRef, useId } from "react"
import { Mic, MicOff, Loader2 } from "lucide-react"
import { useSpeechRecognition } from "@/lib/hooks/use-speech-recognition"
import { usePreferences } from "@/lib/hooks/use-preferences"
import { useT } from "@/lib/hooks/use-i18n"

interface SpeechButtonProps {
  /** Called with final transcribed text */
  onTranscript: (text: string) => void
  /** Called with interim (partial) text while speaking */
  onInterim?: (text: string) => void
  /** Optional custom class */
  className?: string
  /** Size variant */
  size?: "sm" | "md" | "lg"
  /** Show pulse animation when listening */
  showPulse?: boolean
  /** Tooltip text */
  tooltip?: string
  /**
   * When true, the button bypasses the streaming Web Speech path
   * (Chrome's free but less-accurate engine) and forces the configured
   * engine — usually Groq Whisper. Trades word-by-word feedback for a
   * dramatically more accurate final transcript. Use on capture
   * surfaces where the user is dictating a few sentences and accuracy
   * matters more than seeing each word as it's spoken.
   */
  preferAccuracy?: boolean
}

export function SpeechButton({
  onTranscript,
  onInterim,
  className = "",
  size = "md",
  showPulse = true,
  tooltip,
  preferAccuracy = false,
}: SpeechButtonProps) {
  const { preferences } = usePreferences()
  const { t } = useT()
  const buttonId = useId()
  const {
    status,
    isListening,
    interimText,
    transcript,
    error,
    activeButtonId,
    toggleListening,
  } = useSpeechRecognition()

  const lastTranscriptRef = useRef("")
  const isActive = activeButtonId === buttonId

  // Emit new transcript segments ONLY if this button initiated the recording
  useEffect(() => {
    if (!isActive) return
    if (preferences.speechEnabled && transcript && transcript !== lastTranscriptRef.current) {
      const newText = transcript.startsWith(lastTranscriptRef.current)
        ? transcript.slice(lastTranscriptRef.current.length).trim()
        : transcript
      if (newText) {
        onTranscript(newText)
      }
      lastTranscriptRef.current = transcript
    }
  }, [transcript, onTranscript, preferences.speechEnabled, isActive])

  // Emit interim text only for the active button
  useEffect(() => {
    if (!isActive) return
    if (preferences.speechEnabled && interimText && onInterim) {
      onInterim(interimText)
    }
  }, [interimText, onInterim, preferences.speechEnabled, isActive])

  // Global kill switch — render nothing when speech is disabled in settings
  if (!preferences.speechEnabled) return null

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

  const isLoading = status === "loading" && isActive
  const hasError = status === "error"
  // Another button is recording — disable this one
  const isBusy = isListening && !isActive

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => toggleListening(buttonId, { preferAccuracy })}
        disabled={isLoading || isBusy}
        title={
          hasError
            ? error?.message ?? t("shared.speech.error")
            : isLoading
              ? t("shared.speech.loadingModel")
              : isActive && isListening
                ? t("shared.speech.stopListening")
                : isBusy
                  ? t("shared.speech.anotherRecording")
                  : tooltip ?? t("shared.speech.voiceInput")
        }
        className={`
          inline-flex items-center justify-center rounded-full transition-all
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
          ${sizeClasses[size]}
          ${
            isActive && isListening
              ? "bg-red-500 text-white hover:bg-red-600 shadow-md"
              : isLoading
                ? "bg-muted text-muted-foreground cursor-wait"
                : hasError
                  ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                  : isBusy
                    ? "bg-muted/40 text-muted-foreground/50 cursor-not-allowed"
                    : "bg-muted/60 text-muted-foreground hover:bg-accent hover:text-foreground"
          }
          ${className}
        `}
        aria-label={isActive && isListening ? "Stop voice input" : "Start voice input"}
      >
        {isLoading ? (
          <Loader2 className={`${iconSizes[size]} animate-spin`} />
        ) : isActive && isListening ? (
          <MicOff className={iconSizes[size]} />
        ) : (
          <Mic className={iconSizes[size]} />
        )}
      </button>

      {/* Pulse ring only on the active button */}
      {isActive && isListening && showPulse && (
        <span className="absolute inset-0 rounded-full animate-ping bg-red-500/30 pointer-events-none" />
      )}
    </div>
  )
}
