"use client"

import { useState } from "react"
import { Handle, Position, NodeResizer, type NodeProps, type Node } from "@xyflow/react"
import { useT } from "@/lib/hooks/use-i18n"
import {
  FolderKanban,
  FileText,
  Layout,
  ListTodo,
  Bell,
  GitBranch,
  Link2,
  ExternalLink,
} from "lucide-react"

type EmbedData = {
  elementId?: string
  elementTitle?: string
  elementType?: string
  label?: string
}
type EmbedNodeType = Node<EmbedData, "embed">

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  project: FolderKanban,
  page: FileText,
  canvas: Layout,
  todo_list: ListTodo,
  reminder: Bell,
  process: GitBranch,
}

const TYPE_COLORS: Record<string, string> = {
  project: "border-indigo-500/40 bg-indigo-500/5",
  page: "border-violet-500/40 bg-violet-500/5",
  canvas: "border-cyan-500/40 bg-cyan-500/5",
  todo_list: "border-green-500/40 bg-green-500/5",
  reminder: "border-amber-500/40 bg-amber-500/5",
  process: "border-pink-500/40 bg-pink-500/5",
}

export function EmbedNode({ data, selected }: NodeProps<EmbedNodeType>) {
  const { t } = useT()
  const [label, setLabel] = useState(data.label ?? "")

  const Icon = (data.elementType && TYPE_ICONS[data.elementType]) || Link2
  const colorClass = (data.elementType && TYPE_COLORS[data.elementType]) || "border-border bg-card"

  return (
    <div
      className={`rounded-lg border-2 shadow-sm w-full h-full ${colorClass} ${
        selected ? "ring-2 ring-primary" : ""
      }`}
    >
      <NodeResizer minWidth={160} minHeight={60} isVisible={selected} />
      <Handle type="source" position={Position.Top} id="src-top" className="!bg-primary !w-2 !h-2" />

      <div className="p-3 h-full flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-xs font-semibold truncate flex-1">
            {data.elementTitle || t("canvas.embed.noElement")}
          </span>
          {data.elementId && (
            <ExternalLink className="size-3 text-muted-foreground shrink-0" />
          )}
        </div>
        {data.elementType && (
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {data.elementType.replace("_", " ")}
          </span>
        )}
        <input
          value={label}
          onChange={(e) => {
            setLabel(e.target.value)
            data.label = e.target.value
          }}
          placeholder={t("canvas.embed.note.ph")}
          className="w-full bg-transparent text-xs text-muted-foreground outline-none placeholder:text-muted-foreground/30 mt-auto"
        />
      </div>

      <Handle type="source" position={Position.Bottom} id="src-bottom" className="!bg-primary !w-2 !h-2" />
      <Handle type="source" position={Position.Right} id="src-right" className="!bg-primary !w-2 !h-2" />
      <Handle type="source" position={Position.Left} id="src-left" className="!bg-primary !w-2 !h-2" />
    </div>
  )
}
