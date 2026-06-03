"use client"

import { useState, useMemo, useEffect } from "react"
import { ImageOff, MessageSquare, Trash2, Send, FolderPlus, Search, X, Loader2 } from "lucide-react"
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
  createAlbum,
  moveImageToAlbum,
  pollGalleryCaptions,
  type GalleryImage,
  type GalleryComment,
  type GalleryAlbum,
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

function Chip({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5 ${
        active ? "bg-primary/15 border-primary/40 text-foreground" : "border-border text-muted-foreground hover:text-foreground hover:bg-accent/50"
      }`}
    >
      {label}
      <span className="text-[10px] tabular-nums opacity-70">{count}</span>
    </button>
  )
}

export function GalleryGrid({ images, albums }: { images: GalleryImage[]; albums: GalleryAlbum[] }) {
  const [items, setItems] = useState<GalleryImage[]>(images)
  const [albumList, setAlbumList] = useState<GalleryAlbum[]>(albums)
  const [filter, setFilter] = useState<string>("all") // "all" | "unsorted" | <albumId>
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<GalleryImage | null>(null)
  const [comments, setComments] = useState<GalleryComment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [newComment, setNewComment] = useState("")
  const [caption, setCaption] = useState("")
  const [busy, setBusy] = useState(false)

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: items.length, unsorted: 0 }
    for (const i of items) {
      if (!i.albumId) m.unsorted++
      else m[i.albumId] = (m[i.albumId] ?? 0) + 1
    }
    return m
  }, [items])

  const filtered = useMemo(() => {
    let list = items
    if (filter === "unsorted") list = list.filter((i) => !i.albumId)
    else if (filter !== "all") list = list.filter((i) => i.albumId === filter)
    const q = query.trim().toLowerCase()
    if (q) list = list.filter((i) => i.search.includes(q))
    return list
  }, [items, filter, query])

  // Live "captioning…" updates: while any image is mid-caption, poll until the
  // background AI fills it in, then update the card without a refresh.
  const pendingKey = useMemo(
    () => items.filter((i) => i.captionStatus === "pending").map((i) => i.id).sort().join(","),
    [items],
  )
  useEffect(() => {
    if (!pendingKey) return
    const pendingIds = pendingKey.split(",")
    let cancelled = false
    const tick = async () => {
      try {
        const updates = await pollGalleryCaptions(pendingIds)
        if (cancelled) return
        const changed = updates.filter((u) => u.captionStatus !== "pending")
        if (changed.length === 0) return
        setItems((prev) =>
          prev.map((i) => {
            const u = changed.find((x) => x.id === i.id)
            return u
              ? {
                  ...i,
                  caption: u.caption,
                  captionStatus: u.captionStatus,
                  search: u.caption ? `${i.search} ${u.caption.toLowerCase()}` : i.search,
                }
              : i
          }),
        )
      } catch {
        /* ignore — try again next tick */
      }
    }
    const t = window.setInterval(tick, 4000)
    void tick()
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [pendingKey])

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

  async function newAlbum() {
    const name = window.prompt("New album name:")?.trim()
    if (!name) return
    const a = await createAlbum(name)
    if (a) {
      setAlbumList((prev) => [...prev, a].sort((x, y) => x.name.localeCompare(y.name)))
      toast.success(`Album "${a.name}" created`)
    }
  }

  async function changeImageAlbum(imageId: string, albumId: string | null) {
    await moveImageToAlbum(imageId, albumId)
    setItems((prev) => prev.map((i) => (i.id === imageId ? { ...i, albumId } : i)))
    setSelected((s) => (s && s.id === imageId ? { ...s, albumId } : s))
  }

  async function submitComment() {
    if (!selected || !newComment.trim() || busy) return
    setBusy(true)
    try {
      const c = await addGalleryComment(selected.id, newComment.trim())
      if (c) {
        setComments((prev) => [...prev, c])
        const added = newComment.trim().toLowerCase()
        setNewComment("")
        setItems((prev) =>
          prev.map((i) =>
            i.id === selected.id
              ? { ...i, commentCount: i.commentCount + 1, search: `${i.search} ${added}` }
              : i,
          ),
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
    setItems((prev) =>
      prev.map((i) =>
        i.id === selected.id ? { ...i, caption: next || null, search: `${i.search} ${next.toLowerCase()}` } : i,
      ),
    )
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

  return (
    <>
      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search captions, comments, albums…"
          className="w-full rounded-lg border bg-background pl-9 pr-9 py-2 text-sm outline-none focus:border-primary/60"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Album filter bar */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        <Chip active={filter === "all"} label="All" count={counts.all} onClick={() => setFilter("all")} />
        <Chip active={filter === "unsorted"} label="Unsorted" count={counts.unsorted} onClick={() => setFilter("unsorted")} />
        {albumList.map((a) => (
          <Chip key={a.id} active={filter === a.id} label={a.name} count={counts[a.id] ?? 0} onClick={() => setFilter(a.id)} />
        ))}
        <button
          onClick={newAlbum}
          className="px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors flex items-center gap-1"
        >
          <FolderPlus className="size-3" /> New album
        </button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground text-center">
          <ImageOff className="size-12 mb-3 opacity-30" />
          <p className="text-sm">Your gallery is empty.</p>
          <p className="text-xs mt-1 max-w-xs">
            Send a photo to your Telegram bot — it'll show up here, the bot will offer to file it into an album, and (if AI is set up) auto-caption it.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-16">
          {query.trim() ? `No images match "${query.trim()}".` : "No images in this album yet."}
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((img) => (
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
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6">
                {img.captionStatus === "pending" ? (
                  <p className="text-[11px] text-white/90 flex items-center gap-1.5">
                    <Loader2 className="size-3 animate-spin" /> Captioning…
                  </p>
                ) : img.caption ? (
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
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-5xl p-0 overflow-hidden gap-0">
          {selected && (
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(360px,1.25fr)] max-h-[88vh]">
              <div className="bg-black/40 flex items-center justify-center min-h-[200px] max-h-[88vh]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/gallery/${selected.id}`}
                  alt={selected.caption ?? "Gallery image"}
                  className="max-h-[88vh] w-full object-contain"
                />
              </div>

              <div className="flex flex-col max-h-[88vh] border-l min-w-0">
                <DialogHeader className="p-4 pb-2 shrink-0">
                  <DialogTitle className="text-sm">Image details</DialogTitle>
                </DialogHeader>

                <div className="px-4 pb-3 shrink-0 space-y-2">
                  <label className="block text-[11px] font-medium text-muted-foreground">Caption</label>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    onBlur={saveCaption}
                    placeholder="Add a caption…"
                    rows={7}
                    className="w-full resize-y min-h-[7rem] max-h-[45vh] rounded-md border bg-background px-2.5 py-2 text-sm leading-relaxed outline-none focus:border-primary/60"
                  />
                  {/* Move to album */}
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-muted-foreground shrink-0">Album</label>
                    <select
                      value={selected.albumId ?? ""}
                      onChange={(e) => changeImageAlbum(selected.id, e.target.value || null)}
                      className="flex-1 rounded-md border bg-background px-2 py-1 text-xs outline-none focus:border-primary/60"
                    >
                      <option value="">Unsorted</option>
                      {albumList.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Saved · {timeAgo(selected.createdAt)}</p>
                </div>

                <div className="h-px w-full bg-border" />

                <div className="flex-1 overflow-auto px-4 py-3 space-y-2">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Comments</p>
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
