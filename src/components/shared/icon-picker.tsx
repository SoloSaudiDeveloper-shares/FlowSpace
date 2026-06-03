"use client"

import { useRef, useState } from "react"
import { Search, Upload, X, Trash2 } from "lucide-react"
import { EMOJI_CATEGORIES, searchEmoji } from "@/lib/emoji"

/** Resize an uploaded image to a small square PNG data URL (cover-fit). Keeps
 *  the stored icon tiny so it can live inline in the DB row, no file serving. */
function fileToIconDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const size = 72
      const canvas = document.createElement("canvas")
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error("no canvas"))
        return
      }
      const scale = Math.max(size / img.width, size / img.height)
      const w = img.width * scale
      const h = img.height * scale
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL("image/png"))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("bad image"))
    }
    img.src = url
  })
}

/** Render an icon value: emoji string or a data:image URL. */
export function TodoIcon({ icon, className = "" }: { icon: string | null | undefined; className?: string }) {
  if (!icon) return null
  if (icon.startsWith("data:")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={icon} alt="" className={`size-5 rounded object-cover ${className}`} />
  }
  return <span className={`leading-none ${className}`}>{icon}</span>
}

export function IconPicker({
  value,
  onPick,
  onClose,
}: {
  value?: string | null
  onPick: (icon: string | null) => void
  onClose?: () => void
}) {
  const [query, setQuery] = useState("")
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const results = query.trim() ? searchEmoji(query) : null

  async function handleFile(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith("image/")) return
    setBusy(true)
    try {
      const dataUrl = await fileToIconDataUrl(file)
      onPick(dataUrl)
      onClose?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full">
      {/* Search + actions */}
      <div className="flex items-center gap-1.5 mb-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search icons…"
            className="w-full rounded-md border bg-background pl-7 pr-2 py-1 text-xs outline-none focus:border-primary/60"
          />
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Upload your own"
        >
          <Upload className="size-3" /> Upload
        </button>
        {value && (
          <button
            type="button"
            onClick={() => { onPick(null); onClose?.() }}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors"
            title="Remove icon"
          >
            <Trash2 className="size-3" />
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="size-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center"
            aria-label="Close"
          >
            <X className="size-3" />
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      {/* Emoji grid (scrollable) */}
      <div className="max-h-56 overflow-auto pr-1">
        {results ? (
          results.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No icons match “{query}”.</p>
          ) : (
            <div className="flex flex-wrap gap-0.5">
              {results.map((e) => (
                <EmojiButton key={e.c} char={e.c} active={value === e.c} onClick={() => { onPick(e.c); onClose?.() }} />
              ))}
            </div>
          )
        ) : (
          EMOJI_CATEGORIES.map((cat) => (
            <div key={cat.id} className="mb-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium px-1 mb-0.5 sticky top-0 bg-background/95 backdrop-blur-sm">
                {cat.label}
              </p>
              <div className="flex flex-wrap gap-0.5">
                {cat.emojis.map((e) => (
                  <EmojiButton key={e.c} char={e.c} active={value === e.c} onClick={() => { onPick(e.c); onClose?.() }} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function EmojiButton({ char, active, onClick }: { char: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`size-8 rounded-md text-lg flex items-center justify-center hover:bg-accent transition-colors ${
        active ? "bg-primary/15 ring-1 ring-primary/40" : ""
      }`}
    >
      {char}
    </button>
  )
}
