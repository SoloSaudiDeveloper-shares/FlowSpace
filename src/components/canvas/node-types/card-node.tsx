"use client"

import { useState, useCallback } from "react"
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"

type CardData = { label?: string; description?: string }
type CardNodeType = Node<CardData, "card">

export function CardNode({ data, selected }: NodeProps<CardNodeType>) {
  const [label, setLabel] = useState(data.label ?? "")
  const [description, setDescription] = useState(data.description ?? "")

  return (
    <div
      className={`rounded-lg border bg-card shadow-sm min-w-[200px] max-w-[300px] ${
        selected ? "ring-2 ring-primary" : ""
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-primary !w-2 !h-2" />
      <div className="p-3 space-y-1.5">
        <input
          value={label}
          onChange={(e) => {
            setLabel(e.target.value)
            data.label = e.target.value
          }}
          placeholder="Card title"
          className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground/50"
        />
        <textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value)
            data.description = e.target.value
          }}
          placeholder="Description..."
          className="w-full bg-transparent text-xs text-muted-foreground outline-none resize-none min-h-[40px] placeholder:text-muted-foreground/30"
        />
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-2 !h-2" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-primary !w-2 !h-2" />
      <Handle type="target" position={Position.Left} id="left" className="!bg-primary !w-2 !h-2" />
    </div>
  )
}
