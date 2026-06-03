"use client"

import { useState } from "react"
import { ImageOff, MessageSquare, Trash2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  getGalleryComments,
  addGalleryComment,
  deleteGalleryComment,
  updateGalleryCaption,
  deleteGalleryImage,
  type GalleryImage,
  type GalleryComment,
} from "@/lib/actions/gallery-actions"

function timeAgo(iso: string): string {
  const then = new Date(iso.replace(" ", "T") + (iso.includes("Z") ? "" : "Z")).getTime()
  const diff = Math.max(0, (Date.now() - then) / 1000)
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(iso.replace(" ", "T")).toLocaleDateString()
}

export function GalleryGrid({ images }: { images: GalleryImage[] }) {
  const [items, setItems] = useState<GalleryImage[]>(images)
  const [selected, setSelected] = useState<GalleryImage | null>(null)
  const [comments, setComments] = useState<GalleryComment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [newComment, setNewComment] = useState("")
  const [caption, setCaption] = useState("")
  const [busy, setBusy] = useState(false)

  async function open(img: GalleryImage) {
    setSelected(img)
    setCaption(img.caption ?? "")
    setNewComment("")
    setComments([])
    setLoadingComments(true)
    try {
      setComments(await getGalleryComments(img.id))
    } finally {
      setLoadingComments(false)
    }
  }

  async function submitComment() {
    if (!selected || !newComment.trim() || busy) return
    setBusy(true)
    try {
      const c = await addGalleryComment(selected.id, newComment.trim())
      if (c) {
        setComments((prev) => [...prev, c])
        setNewComment("")
        setItems((prev) =>
          prev.map((i) => (i.id === selected.id ? { ...i, commentCount: i.commentCount + 1 } : i)),
        )
      }
    } finally {
      setBusy(false)
    }
  }

  async function removeComment(id: string) {
    await deleteGalleryComment(id)
    setComments((prev) => prev.filter((c) => c.id !== id))
    if (selected) {
      setItems((prev) =>
        prev.map((i) => (i.id === selected.id ? { ...i, commentCount: Math.max(0, i.commentCount - 1) } : i)),
      )
    }
  }

  async function saveCaption() {
    if (!selected) return
    const next = caption.trim()
    if (next === (selected.caption ?? "")) return
    await updateGalleryCaption(selected.id, next)
    setItems((prev) => prev.map((i) => (i.id === selected.id ? { ...i, caption: next || null } : i)))
    setSelected((s) => (s ? { ...s, caption: next || null } : s))
  }

  async function removeImage() {
    if (!selected) return
    if (!window.confirm("Delete this image and its comments?")) return
    setBusy(true)
    try {
      await deleteGalleryImage(selected.id)
      setItems((prev) => prev.filter((i) => i.id !== selected.id))
      setSelected(null)
      toast.success("Image deleted")
    } finally {
      setBusy(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground text-center">
        <ImageOff className="size-12 mb-3 opacity-30" />
        <p className="text-sm">Your gallery is empty.</p>
        <p className="text-xs mt-1 max-w-xs">
          Send a photo to your Telegram bot and it'll show up here — caption it and add comments to revisit later.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((img) => (
          <button
            key={img.id}
            onClick={() => open(img)}
            className="group relative aspect-square overflow-hidden rounded-xl border bg-card text-left hover:border-foreground/20 hover:shadow-lg transition-all"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/gallery/${img.id}`}
              alt={img.caption ?? "Gallery image"}
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
            {/* gradient + caption */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6">
              {img.caption ? (
                <p className="text-[11px] text-white/90 line-clamp-2">{img.caption}</p>
              ) : (
                <p className="text-[11px] text-white/50 italic">No caption</p>
              )}
            </div>
            {img.commentCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                <MessageSquare className="size-3" />
                {img.commentCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-3xl p-0 overflow-hidden gap-0">
          {selected && (
            <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr] max-h-[85vh]">
              {/* Image */}
              <div className="bg-black/40 flex items-center justify-center min-h-[200px] max-h-[85vh]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/gallery/${selected.id}`}
                  alt={selected.caption ?? "Gallery image"}
                  className="max-h-[85vh] w-full object-contain"
                />
              </div>

              {/* Side panel: caption + comments */}
              <div className="flex flex-col max-h-[85vh] border-l">
                <DialogHeader className="p-4 pb-2 shrink-0">
                  <DialogTitle className="text-sm">Image details</DialogTitle>
                </DialogHeader>

                {/* Caption editor */}
                <div className="px-4 pb-3 shrink-0">
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    onBlur={saveCaption}
                    placeholder="Add a caption…"
                    rows={2}
                    className="w-full resize-none rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary/60"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Saved · {timeAgo(selected.createdAt)}
                  </p>
                </div>

                <Separator />

                {/* Comments */}
                <div className="flex-1 overflow-auto px-4 py-3 space-y-2">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Comments
                  </p>
                  {loadingComments ? (
                    <p className="text-xs text-muted-foreground">Loading…</p>
                  ) : comments.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No comments yet.</p>
                  ) : (
                    comments.map((c) => (
                      <div key={c.id} className="group/c rounded-lg bg-muted/50 px-3 py-2">
                        <p className="text-sm whitespace-pre-wrap break-words">{c.body}</p>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">{timeAgo(c.createdAt)}</span>
                          <button
                            onClick={() => removeComment(c.id)}
                            className="opacity-0 group-hover/c:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                            title="Delete comment"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Add comment */}
                <div className="p-3 border-t shrink-0">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitComment()
                      }}
                      placeholder="Add a comment…  (Ctrl+Enter)"
                      rows={1}
                      className="flex-1 resize-none rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary/60"
                    />
                    <Button size="sm" className="h-8 px-2" onClick={submitComment} disabled={busy || !newComment.trim()}>
                      <Send className="size-3.5" />
                    </Button>
                  </div>
                  <button
                    onClick={removeImage}
                    disabled={busy}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="size-3" /> Delete image
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// Local separator (avoid importing the heavy one in a tight client bundle path)
function Separator() {
  return <div className="h-px w-full bg-border" />
}
