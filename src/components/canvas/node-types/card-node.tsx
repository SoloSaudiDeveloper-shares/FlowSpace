"use client"

import { useState, useCallback } from "react"
import { Handle, Position, NodeResizer, type NodeProps, type Node } from "@xyflow/react"
import { SpeechButton } from "@/components/shared/speech-button"

type CardData = { label?: string; description?: string }
type CardNodeType = Node<CardData, "card">

export function CardNode({ data, selected }: NodeProps<CardNodeType>) {
  const [label, setLabel] = useState(data.label ?? "")
  const [description, setDescription] = useState(data.description ?? "")

  return (
    <div
      className={`rounded-lg border bg-card shadow-sm w-full h-full ${
        selected ? "ring-2 ring-primary" : ""
      }`}
    >
      <NodeResizer minWidth={180} minHeight={80} isVisible={selected} />
      <Handle type="source" position={Position.Top} id="src-top" className="!bg-primary !w-2 !h-2" />

      {/* AI toolbar — outside the node, above it */}
      {selected && (
        <div className="absolute -top-9 right-0 flex gap-0.5 nodrag nopan z-10">
          <SpeechButton
            onTranscript={(text) => { const v = label ? `${label} ${text}` : text; setLabel(v); data.label = v }}
            size="sm"
            showPulse={false}
            tooltip="Dictate title"
          />
          <SpeechButton
            onTranscript={(text) => { const v = description ? `${description} ${text}` : text; setDescription(v); data.description = v }}
            size="sm"
            showPulse={false}
            tooltip="Dictate description"
          />
        </div>
      )}

      <div className="p-3 space-y-1.5 h-full flex flex-col">
        <input
          value={label}
          onChange={(e) => {
            setLabel(e.target.value)
            data.label = e.target.value
          }}
          placeholder="Card title"
          className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground/50"
        />
        <div className="flex-1">
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              data.description = e.target.value
            }}
            placeholder="Description..."
            className="w-full h-full bg-transparent text-xs text-muted-foreground outline-none resize-none placeholder:text-muted-foreground/30"
          />
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} id="src-bottom" className="!bg-primary !w-2 !h-2" />
      <Handle type="source" position={Position.Right} id="src-right" className="!bg-primary !w-2 !h-2" />
      <Handle type="source" position={Position.Left} id="src-left" className="!bg-primary !w-2 !h-2" />
    </div>
  )
}
