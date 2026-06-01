"use client"

import { forwardRef, useState, useCallback, type InputHTMLAttributes } from "react"
import { Input } from "@/components/ui/input"
import { SpeechButton } from "./speech-button"
import { useT } from "@/lib/hooks/use-i18n"

interface SpeechInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  /** Controlled value */
  value: string
  /** Change handler */
  onChange: (value: string) => void
  /** Whether to append or replace text on speech */
  mode?: "append" | "replace"
  /** Speech button size */
  speechSize?: "sm" | "md"
  /** Hide the speech button */
  hideSpeech?: boolean
}

export const SpeechInput = forwardRef<HTMLInputElement, SpeechInputProps>(
  function SpeechInput(
    {
      value,
      onChange,
      mode = "replace",
      speechSize = "sm",
      hideSpeech = false,
      className = "",
      ...inputProps
    },
    ref,
  ) {
    const { t } = useT()
    const [interimPreview, setInterimPreview] = useState("")

    const handleTranscript = useCallback(
      (text: string) => {
        if (mode === "append" && value) {
          onChange(`${value} ${text}`)
        } else {
          onChange(text)
        }
        setInterimPreview("")
      },
      [value, onChange, mode],
    )

    const handleInterim = useCallback((text: string) => {
      setInterimPreview(text)
    }, [])

    const displayValue = interimPreview
      ? mode === "append" && value
        ? `${value} ${interimPreview}`
        : interimPreview
      : value

    return (
      <div className="relative flex items-center gap-1.5 w-full">
        <Input
          ref={ref}
          value={displayValue}
          onChange={(e) => {
            setInterimPreview("")
            onChange(e.target.value)
          }}
          className={`pr-9 ${className}`}
          {...inputProps}
        />
        {!hideSpeech && (
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
            <SpeechButton
              onTranscript={handleTranscript}
              onInterim={handleInterim}
              size={speechSize}
              showPulse={false}
              tooltip={t("speechin.dictate")}
            />
          </div>
        )}
      </div>
    )
  },
)
