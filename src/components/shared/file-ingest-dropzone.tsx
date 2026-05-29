"use client"

/**
 * Tiny file-ingest dropzone.
 *
 * Drag (or click) a PDF / CSV / TSV / TXT / MD → server parses it and
 * creates a Page in the user's workspace; the client redirects there.
 * Optional "summarise via AI" checkbox prepends a model-generated
 * 3-5-bullet summary at the top.
 *
 * Designed to live next to the home page's quick capture but works
 * anywhere a small drop target is useful.
 */

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { FileText, Loader2, Upload, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { ingestFileAsPage } from "@/lib/actions/file-ingest-actions"

const ACCEPT = ".pdf,.csv,.tsv,.txt,.md,application/pdf,text/csv,text/plain,text/markdown"

export function FileIngestDropzone() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [filename, setFilename] = useState<string>("")
  const [summarise, setSummarise] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  async function handleFile(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Too big (max 10 MB).")
      return
    }
    setBusy(true)
    setFilename(file.name)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const url = reader.result as string
          const idx = url.indexOf(",")
          resolve(idx >= 0 ? url.slice(idx + 1) : url)
        }
        reader.onerror = () => reject(new Error("Couldn't read file"))
        reader.readAsDataURL(file)
      })
      const r = await ingestFileAsPage({
        filename: file.name,
        base64,
        mime: file.type,
        summarize: summarise,
      })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(`Imported ${file.name}`)
      router.push(`/pages/${r.pageId}`)
    } finally {
      setBusy(false)
      setFilename("")
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files?.[0]
        if (file) void handleFile(file)
      }}
      className={`rounded-lg border-2 border-dashed transition-colors ${
        dragOver
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/30"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
          e.target.value = ""
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="w-full px-3 py-3 flex items-center gap-3 text-left"
      >
        <div className="size-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          {busy ? (
            <Loader2 className="size-4 text-primary animate-spin" />
          ) : (
            <Upload className="size-4 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {busy ? `Importing ${filename}…` : "Drop a file → make a Page"}
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug">
            PDF · CSV · TSV · TXT · MD · max 10 MB
          </p>
        </div>
      </button>

      <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground px-3 pb-3 cursor-pointer">
        <input
          type="checkbox"
          checked={summarise}
          onChange={(e) => setSummarise(e.target.checked)}
          className="accent-primary"
          disabled={busy}
        />
        <Sparkles className="size-3 text-primary" />
        <span>Add a 3-5 bullet AI summary at the top</span>
      </label>
    </div>
  )
}
