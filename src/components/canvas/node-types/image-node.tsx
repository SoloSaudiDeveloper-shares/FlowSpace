"use client"

import { useState, useRef } from "react"
import { Handle, Position, NodeResizer, type NodeProps, type Node } from "@xyflow/react"
import { ImageIcon, Upload } from "lucide-react"

type ImageData = { src?: string; label?: string; objectFit?: "cover" | "contain" | "fill" }
type ImageNodeType = Node<ImageData, "image">

export function ImageNode({ data, selected }: NodeProps<ImageNodeType>) {
  const [src, setSrc] = useState(data.src ?? "")
  const [label, setLabel] = useState(data.label ?? "")
  const [objectFit, setObjectFit] = useState<"cover" | "contain" | "fill">(data.objectFit ?? "cover")
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result as string
      setSrc(result)
      data.src = result
    }
    reader.readAsDataURL(file)
  }

  function handleUrlPaste() {
    const url = prompt("Enter image URL:")
    if (url) {
      setSrc(url)
      data.src = url
    }
  }

  function cycleFit() {
    const next = objectFit === "cover" ? "contain" : objectFit === "contain" ? "fill" : "cover"
    setObjectFit(next)
    data.objectFit = next
  }

  return (
    <div
      className={`rounded-lg border bg-card shadow-sm w-full h-full overflow-hidden ${
        selected ? "ring-2 ring-primary" : ""
      }`}
    >
      <NodeResizer minWidth={100} minHeight={80} isVisible={selected} />
      <Handle type="source" position={Position.Top} id="src-top" className="!bg-primary !w-2 !h-2" />

      {src ? (
        <div className="w-full h-full relative group">
          <img
            src={src}
            alt={label}
            className="w-full h-full"
            style={{ objectFit }}
            draggable={false}
          />
          {/* Overlay controls on hover */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end justify-between opacity-0 group-hover:opacity-100 p-2">
            <input
              value={label}
              onChange={(e) => {
                setLabel(e.target.value)
                data.label = e.target.value
              }}
              placeholder="Caption..."
              className="bg-black/50 text-white text-xs rounded px-2 py-1 outline-none w-2/3 placeholder:text-white/50"
            />
            <button
              onClick={cycleFit}
              className="bg-black/50 text-white text-[10px] rounded px-2 py-1"
            >
              {objectFit}
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4">
          <ImageIcon className="size-8 text-muted-foreground/40" />
          <div className="flex gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border hover:bg-accent transition-colors"
            >
              <Upload className="size-3" /> Upload
            </button>
            <button
              onClick={handleUrlPaste}
              className="px-2 py-1 text-xs rounded-md border hover:bg-accent transition-colors"
            >
              URL
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
        </div>
      )}

      <Handle type="source" position={Position.Bottom} id="src-bottom" className="!bg-primary !w-2 !h-2" />
      <Handle type="source" position={Position.Right} id="src-right" className="!bg-primary !w-2 !h-2" />
      <Handle type="source" position={Position.Left} id="src-left" className="!bg-primary !w-2 !h-2" />
    </div>
  )
}
