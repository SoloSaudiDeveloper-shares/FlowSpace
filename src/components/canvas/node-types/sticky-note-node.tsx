"use client"

import { useState } from "react"
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"

type StickyData = { label?: string; color?: string }
type StickyNodeType = Node<StickyData, "sticky_note">

const COLORS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fecdd3", "#e9d5ff", "#fed7aa"]

export function StickyNoteNode({ data, selected }: NodeProps<StickyNodeType>) {
  const [text, setText] = useState(data.label ?? "")
  const [color, setColor] = useState(data.color ?? "#fef08a")
  const [showColors, setShowColors] = useState(false)

  return (
    <div
      className={`rounded-md shadow-md min-w-[180px] min-h-[150px] ${
        selected ? "ring-2 ring-primary" : ""
      }`}
      style={{ backgroundColor: color }}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-600 !w-2 !h-2" />
      <div className="p-3 h-full">
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            data.label = e.target.value
          }}
          placeholder="Write something..."
          className="w-full h-full bg-transparent text-sm text-gray-800 outline-none resize-none min-h-[120px] placeholder:text-gray-400"
        />
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
      <Handle type="source" position={Position.Bottom} className="!bg-gray-600 !w-2 !h-2" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-gray-600 !w-2 !h-2" />
      <Handle type="target" position={Position.Left} id="left" className="!bg-gray-600 !w-2 !h-2" />
    </div>
  )
}
