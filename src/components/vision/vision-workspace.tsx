"use client"

/**
 * Vision workspace — drag-and-drop image analysis.
 *
 * Flow:
 *  1. User drops or picks an image. We read it as a data URL.
 *  2. They tweak the prompt (or leave the smart default).
 *  3. Click Analyse — sends to their configured AI provider's
 *     /chat/completions endpoint with the vision payload.
 *  4. Result renders below; "Save as Page" persists the analysis +
 *     image as a Page in their workspace.
 *
 * The whole thing is one component — no separate routes — so the user
 * can iterate (change the prompt + re-run) without losing context.
 */

import { useRef, useState } from "react"
import {
  ScanEye,
  Upload,
  X,
  Loader2,
  Sparkles,
  FileText,
  Copy,
  Check,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import {
  analyzeImageWithAI,
  saveVisionAsPage,
} from "@/lib/actions/vision-actions"

const PROMPT_PRESETS = [
  {
    label: "Describe",
    prompt: "Describe what's in this image in 3-5 concise bullets.",
  },
  {
    label: "Transcribe text",
    prompt:
      "Transcribe any text visible in this image. Preserve formatting. If there's no text say 'no visible text'.",
  },
  {
    label: "Receipt → totals",
    prompt:
      "This is a receipt. Extract: merchant name, date, total amount, currency. Return as JSON.",
  },
  {
    label: "Chart → insights",
    prompt:
      "This is a chart. Summarise: what is being measured, the key trend, and any standout data points.",
  },
  {
    label: "Whiteboard → tasks",
    prompt:
      "This is a whiteboard. Pull out any action items as a checklist. Use `- [ ]` markdown style.",
  },
]

export function VisionWorkspace() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [filename, setFilename] = useState<string>("")
  const [prompt, setPrompt] = useState(PROMPT_PRESETS[0].prompt)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pageTitle, setPageTitle] = useState("")
  const [copied, setCopied] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  async function loadFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please pick an image file.")
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image is too big (max 8 MB).")
      return
    }
    setFilename(file.name)
    setResult(null)
    setError(null)
    setPageTitle(file.name.replace(/\.[^.]+$/, ""))
    const url = await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.onerror = () => reject(new Error("Couldn't read the file"))
      r.readAsDataURL(file)
    })
    setDataUrl(url)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void loadFile(file)
  }

  function handlePaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) =>
      i.type.startsWith("image/"),
    )
    if (item) {
      const file = item.getAsFile()
      if (file) {
        void loadFile(file)
        e.preventDefault()
      }
    }
  }

  async function handleAnalyse() {
    if (!dataUrl || analyzing) return
    setAnalyzing(true)
    setError(null)
    setResult(null)
    try {
      const r = await analyzeImageWithAI({ dataUrl, prompt })
      if (!r.ok) {
        setError(r.error)
        return
      }
      setResult(r.text)
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleSave() {
    if (!dataUrl || !result || saving) return
    setSaving(true)
    try {
      const r = await saveVisionAsPage({
        title: pageTitle || filename || "Image analysis",
        dataUrl,
        analysis: result,
      })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success("Saved as a Page")
      router.push(`/pages/${r.pageId}`)
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    setDataUrl(null)
    setFilename("")
    setResult(null)
    setError(null)
    setPageTitle("")
  }

  return (
    <div className="space-y-6" onPaste={handlePaste}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-2">
          <ScanEye className="size-6 text-primary" />
          Vision
        </h1>
        <p className="text-sm text-muted-foreground">
          Drop an image, ask a question. Uses your configured AI provider
          (Settings → AI features). Receipts, charts, whiteboards, text in
          photos — all fair game.
        </p>
      </div>

      {/* Drop zone or image preview */}
      {!dataUrl ? (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-16 px-6 cursor-pointer transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/40 hover:bg-accent/30"
          }`}
        >
          <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Upload className="size-5 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">Drop an image here</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              or click to browse · paste from clipboard works too · max 8 MB
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void loadFile(file)
              e.target.value = ""
            }}
          />
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="relative bg-muted/30 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={dataUrl}
              alt={filename}
              className="max-h-[400px] w-auto"
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute top-2 right-2 size-7"
              onClick={reset}
              aria-label="Remove image"
            >
              <X className="size-3.5" />
            </Button>
          </div>
          <div className="px-3 py-2 border-t text-[11px] text-muted-foreground flex items-center gap-2">
            <FileText className="size-3" />
            <span className="truncate">{filename}</span>
          </div>
        </div>
      )}

      {/* Prompt + presets */}
      {dataUrl && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-muted-foreground">
            Prompt
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {PROMPT_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setPrompt(p.prompt)}
                className={`px-2 py-1 rounded-full text-[11px] border transition-colors ${
                  prompt === p.prompt
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] text-muted-foreground/70">
              Vision-capable model required. Configured in Settings.
            </p>
            <Button onClick={handleAnalyse} disabled={analyzing} size="sm" className="gap-1.5">
              {analyzing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              {analyzing ? "Analysing…" : "Analyse"}
            </Button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-md border border-destructive/40 bg-destructive/5 text-xs text-destructive">
          <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{error}</div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3">
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium flex items-center gap-1.5">
                <Sparkles className="size-3 text-primary" />
                Analysis
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[11px] gap-1"
                onClick={() => {
                  navigator.clipboard.writeText(result).catch(() => undefined)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                }}
              >
                {copied ? (
                  <Check className="size-3" />
                ) : (
                  <Copy className="size-3" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <div className="p-3 text-sm leading-relaxed whitespace-pre-wrap">
              {result}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-3 space-y-2">
            <p className="text-xs font-medium">Save as a Page</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Creates a new Page in your workspace with the image + analysis
              embedded. You can edit it after.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={pageTitle}
                onChange={(e) => setPageTitle(e.target.value)}
                placeholder="Page title"
                className="h-9 flex-1 min-w-[180px]"
              />
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !pageTitle.trim()}
                className="gap-1.5"
              >
                {saving ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <FileText className="size-3.5" />
                )}
                {saving ? "Saving…" : "Save as Page"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
