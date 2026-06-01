"use client"

import { useState } from "react"
import { Handle, Position, NodeResizer, type NodeProps, type Node } from "@xyflow/react"
import { SpeechButton } from "@/components/shared/speech-button"
import { TTSButton } from "@/components/shared/tts-button"
import { AIActionButton } from "@/components/shared/ai-action-button"
import { useT } from "@/lib/hooks/use-i18n"

type TextData = { label?: string }
type TextNodeType = Node<TextData, "text">

export function TextNode({ data, selected }: NodeProps<TextNodeType>) {
  const { t } = useT()
  const [text, setText] = useState(data.label ?? "")

  return (
    <div
      className={`w-full h-full ${selected ? "ring-2 ring-primary rounded" : ""}`}
    >
      <NodeResizer minWidth={80} minHeight={30} isVisible={selected} />
      <Handle type="target" position={Position.Top} className="!bg-primary !w-2 !h-2 !opacity-0 hover:!opacity-100" />

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

      <div className="w-full h-full">
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            data.label = e.target.value
          }}
          placeholder={t("canvas.text.ph")}
          className="w-full h-full bg-transparent text-sm outline-none resize-none placeholder:text-muted-foreground/50"
        />
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-2 !h-2 !opacity-0 hover:!opacity-100" />
    </div>
  )
}
