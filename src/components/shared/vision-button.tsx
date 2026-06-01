"use client"

import { useState, useRef, useEffect } from "react"
import { ScanEye, Loader2, X } from "lucide-react"
import { useAI } from "@/lib/hooks/use-ai"
import { usePreferences } from "@/lib/hooks/use-preferences"
import { useT } from "@/lib/hooks/use-i18n"

// ─── Types ────────────────────────────────────────────────────────────────

interface VisionButtonProps {
  /** Called with the vision model's analysis text */
  onResult?: (text: string) => void
  /** Default prompt to send with the image */
  prompt?: string
  /** Optional custom class */
  className?: string
  /** Size variant */
  size?: "sm" | "md" | "lg"
}

// ─── Component ────────────────────────────────────────────────────────────

export function VisionButton({
  onResult,
  prompt,
  className = "",
  size = "md",
}: VisionButtonProps) {
  const { preferences } = usePreferences()
  const { enabled, connected, analyzeImage } = useAI()
  const { t } = useT()
  const effectivePrompt = prompt ?? t("visbtn.defaultPrompt")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  // Close popover on outside click
  useEffect(() => {
    if (!popoverOpen) return
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setPopoverOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [popoverOpen])

  // Don't render if AI is off or Ollama disconnected
  if (!preferences.aiEnabled || !enabled || !connected) return null

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

  function handleClick() {
    if (result) {
      setPopoverOpen((v) => !v)
    } else {
      fileInputRef.current?.click()
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset input so same file can be re-selected
    e.target.value = ""

    setLoading(true)
    setResult(null)

    try {
      // Read file as base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = reader.result as string
          // Strip the data:image/...;base64, prefix — Ollama expects raw base64
          const base64Data = dataUrl.split(",")[1]
          resolve(base64Data)
        }
        reader.onerror = () => reject(new Error("Failed to read image file"))
        reader.readAsDataURL(file)
      })

      const response = await analyzeImage(base64, effectivePrompt)

      setResult(response.text)
      setPopoverOpen(true)

      if (onResult) {
        onResult(response.text)
      }
    } catch (err) {
      console.error("[VisionButton] Error:", err)
      setResult("Error: " + (err instanceof Error ? err.message : String(err)))
      setPopoverOpen(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative nodrag nopan" onPointerDown={(e) => e.stopPropagation()}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Trigger button */}
      <button
        ref={btnRef}
        type="button"
        disabled={loading}
        title={loading ? t("visbtn.analyzing") : t("visbtn.analyzeWithAI")}
        onClick={handleClick}
        className={`
          inline-flex items-center justify-center rounded-full transition-all
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
          ${sizeClasses[size]}
          ${
            loading
              ? "bg-primary/20 text-primary cursor-wait"
              : popoverOpen
                ? "bg-accent text-foreground"
                : "bg-muted/60 text-muted-foreground hover:bg-accent hover:text-foreground"
          }
          ${className}
        `}
        aria-label={t("visbtn.analyzeAria")}
      >
        {loading ? (
          <Loader2 className={`${iconSizes[size]} animate-spin`} />
        ) : (
          <ScanEye className={iconSizes[size]} />
        )}
      </button>

      {/* Result popover */}
      {popoverOpen && result && (
        <div
          ref={popoverRef}
          className="absolute right-0 top-full mt-1 z-50 w-[320px] max-h-[300px] rounded-lg border bg-popover p-3 text-sm shadow-lg overflow-y-auto"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              {t("visbtn.title")}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setResult(null)
                  setPopoverOpen(false)
                  fileInputRef.current?.click()
                }}
                className="text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-accent transition-colors"
              >
                {t("visbtn.newImage")}
              </button>
              <button
                type="button"
                onClick={() => setPopoverOpen(false)}
                className="text-muted-foreground hover:text-foreground rounded hover:bg-accent transition-colors p-0.5"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>
          <div className="border-t pt-2">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{result}</p>
          </div>
          {onResult && (
            <button
              type="button"
              onClick={() => {
                if (result) onResult(result)
                setPopoverOpen(false)
              }}
              className="mt-2 w-full text-xs text-center py-1.5 rounded-md border hover:bg-accent transition-colors"
            >
              {t("visbtn.insert")}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
