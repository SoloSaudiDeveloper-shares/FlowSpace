"use client"

import { useState } from "react"
import { Handle, Position, NodeResizer, type NodeProps, type Node } from "@xyflow/react"
import { SpeechButton } from "@/components/shared/speech-button"
import { ShapeElement } from "../shapes"
import { useT } from "@/lib/hooks/use-i18n"

type ShapeData = {
  shapeId?: string
  label?: string
  fill?: string
  stroke?: string
}

type ShapeNodeType = Node<ShapeData, "shape">

const PALETTE = [
  { fill: "#6366f133", stroke: "#6366f1" },
  { fill: "#8b5cf633", stroke: "#8b5cf6" },
  { fill: "#ec489933", stroke: "#ec4899" },
  { fill: "#ef444433", stroke: "#ef4444" },
  { fill: "#f9731633", stroke: "#f97316" },
  { fill: "#eab30833", stroke: "#eab308" },
  { fill: "#22c55e33", stroke: "#22c55e" },
  { fill: "#06b6d433", stroke: "#06b6d4" },
  { fill: "#3b82f633", stroke: "#3b82f6" },
  { fill: "#ffffff", stroke: "#94a3b8" },
  { fill: "#1e293b", stroke: "#475569" },
]

export function ShapeNode({ data, selected }: NodeProps<ShapeNodeType>) {
  const { t } = useT()
  const [label, setLabel] = useState(data.label ?? "")
  const [fill, setFill] = useState(data.fill ?? "#6366f133")
  const [stroke, setStroke] = useState(data.stroke ?? "#6366f1")

  return (
    <div className="w-full h-full relative">
      <NodeResizer minWidth={80} minHeight={60} isVisible={selected} />

      {/* SVG shape background */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <ShapeElement shapeId={data.shapeId ?? "rectangle"} fill={fill} stroke={stroke} />
      </svg>

      {/* AI toolbar — outside the node, above it */}
      {selected && (
        <div className="absolute -top-9 right-0 flex gap-0.5 nodrag nopan z-10">
          <SpeechButton
            onTranscript={(transcript) => { const v = label ? `${label} ${transcript}` : transcript; setLabel(v); data.label = v }}
            size="sm"
            showPulse={false}
            tooltip={t("canvas.dictate")}
          />
        </div>
      )}

      {/* Label overlay */}
      <div className="absolute inset-0 flex items-center justify-center p-3 pointer-events-none">
        <div className="w-full pointer-events-auto">
          <textarea
            value={label}
            onChange={(e) => {
              setLabel(e.target.value)
              data.label = e.target.value
            }}
            placeholder={t("canvas.shapeNode.label.ph")}
            rows={2}
            className="w-full bg-transparent text-sm text-center outline-none resize-none placeholder:text-foreground/30 leading-tight"
          />
        </div>
      </div>

      {/* Color palette shown when selected */}
      {selected && (
        <div className="absolute -bottom-8 left-0 flex gap-1 z-10">
          {PALETTE.map((c, i) => (
            <button
              key={i}
              title={t("canvas.shapeNode.setColor")}
              className={`size-4 rounded-full border border-gray-400 transition-transform hover:scale-110 ${
                fill === c.fill ? "ring-2 ring-primary ring-offset-1" : ""
              }`}
              style={{ backgroundColor: c.fill === "#ffffff" ? "#fff" : c.stroke }}
              onClick={() => {
                setFill(c.fill)
                setStroke(c.stroke)
                data.fill = c.fill
                data.stroke = c.stroke
              }}
            />
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Top}    id="src-top"    className="!bg-primary !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} id="src-bottom" className="!bg-primary !w-2 !h-2" />
      <Handle type="source" position={Position.Left}   id="src-left"   className="!bg-primary !w-2 !h-2" />
      <Handle type="source" position={Position.Right}  id="src-right"  className="!bg-primary !w-2 !h-2" />
    </div>
  )
}
