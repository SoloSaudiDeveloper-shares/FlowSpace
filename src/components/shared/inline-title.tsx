"use client"

import { useState, useRef, useEffect } from "react"
import { updateElement } from "@/lib/actions/element-actions"
import { useT } from "@/lib/hooks/use-i18n"

interface InlineTitleProps {
  elementId: string
  initialTitle: string
  className?: string
}

export function InlineTitle({ elementId, initialTitle, className }: InlineTitleProps) {
  const { t } = useT()
  const [title, setTitle] = useState(initialTitle)
  const inputRef = useRef<HTMLInputElement>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setTitle(initialTitle)
  }, [initialTitle])

  function handleChange(value: string) {
    setTitle(value)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      updateElement(elementId, { title: value || "Untitled" })
    }, 400)
  }

  return (
    <input
      ref={inputRef}
      value={title}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={t("ititle.placeholder")}
      className={`bg-transparent border-none outline-none font-bold text-4xl w-full placeholder:text-muted-foreground/50 ${className ?? ""}`}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          inputRef.current?.blur()
        }
      }}
    />
  )
}
