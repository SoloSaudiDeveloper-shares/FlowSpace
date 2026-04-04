"use client"

import { useState } from "react"
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"

type TextData = { label?: string }
type TextNodeType = Node<TextData, "text">

export function TextNode({ data, selected }: NodeProps<TextNodeType>) {
  const [text, setText] = useState(data.label ?? "")

  return (
    <div
      className={`min-w-[100px] ${selected ? "ring-2 ring-primary rounded" : ""}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-primary !w-2 !h-2 !opacity-0 hover:!opacity-100" />
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          data.label = e.target.value
        }}
        placeholder="Type text..."
        className="w-full bg-transparent text-sm outline-none resize-none min-h-[30px] placeholder:text-muted-foreground/50"
      />
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-2 !h-2 !opacity-0 hover:!opacity-100" />
    </div>
  )
}
