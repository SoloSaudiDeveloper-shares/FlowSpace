"use client"

import { useState } from "react"
import { Handle, Position, NodeResizer, type NodeProps, type Node } from "@xyflow/react"
import { SpeechButton } from "@/components/shared/speech-button"
import { TTSButton } from "@/components/shared/tts-button"
import { AIActionButton } from "@/components/shared/ai-action-button"
import { useT } from "@/lib/hooks/use-i18n"

type StickyData = { label?: string; color?: string }
type StickyNodeType = Node<StickyData, "sticky_note">

const COLORS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fecdd3", "#e9d5ff", "#fed7aa"]

export function StickyNoteNode({ data, selected }: NodeProps<StickyNodeType>) {
  const { t } = useT()
  const [text, setText] = useState(data.label ?? "")
  const [color, setColor] = useState(data.color ?? "#fef08a")
  const [showColors, setShowColors] = useState(false)

  return (
    <div
      className={`rounded-md shadow-md w-full h-full ${
        selected ? "ring-2 ring-primary" : ""
      }`}
      style={{ backgroundColor: color }}
    >
      <NodeResizer minWidth={160} minHeight={120} isVisible={selected} />
      <Handle type="source" position={Position.Top} id="src-top" className="!bg-gray-600 !w-2 !h-2" />

      {/* AI toolbar — outside the node, above it */}
      {selected && (
        <div className="absolute -top-9 right-0 flex gap-0.5 nodrag nopan z-10">
          <AIActionButton
            text={text}
            onResult={(result, action) => {
              if (action === "continue" || action === "expand") {
                const v = text ? `${text}\n\n${result}` : result; setText(v); data.label = v
              } else {
                setText(result); data.label = result
              }
            }}
            actions={["summarize", "expand", "fix_grammar", "improve", "continue"]}
            size="sm"
          />
          <TTSButton text={text} size="sm" tooltip={t("canvas.readAloud")} />
          <SpeechButton
            onTranscript={(transcript) => { const v = text ? `${text} ${transcript}` : transcript; setText(v); data.label = v }}
            size="sm"
            showPulse={false}
            tooltip={t("canvas.dictate")}
          />
        </div>
      )}

      <div className="p-3 h-full flex flex-col">
        <div className="flex-1">
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              data.label = e.target.value
            }}
            placeholder={t("canvas.sticky.ph")}
            className="w-full h-full bg-transparent text-sm text-gray-800 outline-none resize-none placeholder:text-gray-400"
          />
        </div>
      </div>
      {selected && (
        <div className="absolute -bottom-8 left-0 flex gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`size-4 rounded-full border border-gray-300 ${
                c === color ? "ring-2 ring-primary" : ""
              }`}
              style={{ backgroundColor: c }}
              onClick={() => {
                setColor(c)
                data.color = c
              }}
            />
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} id="src-bottom" className="!bg-gray-600 !w-2 !h-2" />
      <Handle type="source" position={Position.Right} id="src-right" className="!bg-gray-600 !w-2 !h-2" />
      <Handle type="source" position={Position.Left} id="src-left" className="!bg-gray-600 !w-2 !h-2" />
    </div>
  )
}
