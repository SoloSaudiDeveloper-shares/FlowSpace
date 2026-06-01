"use client"

import { useState } from "react"
import { NodeResizer, type NodeProps, type Node } from "@xyflow/react"
import { SpeechButton } from "@/components/shared/speech-button"
import { useT } from "@/lib/hooks/use-i18n"

type GroupData = { label?: string; color?: string }
type GroupNodeType = Node<GroupData, "group">

const GROUP_COLORS = [
  { value: "#6366f120", border: "#6366f160", label: "Indigo" },
  { value: "#22c55e20", border: "#22c55e60", label: "Green" },
  { value: "#f59e0b20", border: "#f59e0b60", label: "Amber" },
  { value: "#ef444420", border: "#ef444460", label: "Red" },
  { value: "#06b6d420", border: "#06b6d460", label: "Cyan" },
  { value: "#a855f720", border: "#a855f760", label: "Purple" },
]

export function GroupNode({ data, selected }: NodeProps<GroupNodeType>) {
  const { t } = useT()
  const [label, setLabel] = useState(data.label ?? "")
  const [color, setColor] = useState(data.color ?? GROUP_COLORS[0].value)

  const borderColor = GROUP_COLORS.find((c) => c.value === color)?.border ?? "#6366f160"

  return (
    <div
      className={`rounded-xl w-full h-full ${selected ? "ring-2 ring-primary" : ""}`}
      style={{
        backgroundColor: color,
        border: `2px dashed ${borderColor}`,
        minWidth: 200,
        minHeight: 150,
      }}
    >
      <NodeResizer minWidth={200} minHeight={150} isVisible={selected} />

      {/* AI toolbar — outside the node, above it */}
      {selected && (
        <div className="absolute -top-9 right-0 flex gap-0.5 nodrag nopan z-10">
          <SpeechButton
            onTranscript={(text) => {
              const v = label ? `${label} ${text}` : text
              setLabel(v)
              data.label = v
            }}
            size="sm"
            showPulse={false}
            tooltip={t("canvas.group.dictateLabel")}
          />
        </div>
      )}

      <div className="px-3 py-2 flex items-center gap-2">
        <div className="flex-1">
          <input
            value={label}
            onChange={(e) => {
              setLabel(e.target.value)
              data.label = e.target.value
            }}
            placeholder={t("canvas.group.label.ph")}
            className="w-full bg-transparent text-xs font-semibold uppercase tracking-wider outline-none placeholder:text-muted-foreground/40"
          />
        </div>
        {selected && (
          <div className="flex gap-1">
            {GROUP_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => {
                  setColor(c.value)
                  data.color = c.value
                }}
                className={`size-4 rounded-full border-2 transition-transform ${
                  color === c.value ? "scale-125 border-foreground" : "border-transparent"
                }`}
                style={{ backgroundColor: c.border }}
                title={t("canvas.color." + c.label.toLowerCase())}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
