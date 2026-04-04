"use client"

import { useCallback, useRef, useState } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  type Viewport,
  BackgroundVariant,
  Panel,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { useTheme } from "next-themes"
import { Plus, StickyNote, Type, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  saveCanvasNodes,
  saveCanvasEdges,
  saveCanvasViewport,
} from "@/lib/actions/canvas-actions"
import { createId } from "@/lib/utils/ids"
import { CardNode } from "./node-types/card-node"
import { StickyNoteNode } from "./node-types/sticky-note-node"
import { TextNode } from "./node-types/text-node"

const nodeTypes = {
  card: CardNode,
  sticky_note: StickyNoteNode,
  text: TextNode,
}

interface CanvasEditorProps {
  canvasId: string
  initialNodes: Node[]
  initialEdges: Edge[]
  initialViewport: Viewport
}

export function CanvasEditor({
  canvasId,
  initialNodes,
  initialEdges,
  initialViewport,
}: CanvasEditorProps) {
  const { resolvedTheme } = useTheme()
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      saveCanvasNodes(
        canvasId,
        nodes.map((n) => ({
          id: n.id,
          type: n.type || "card",
          positionX: n.position.x,
          positionY: n.position.y,
          width: n.measured?.width ?? n.width ?? null,
          height: n.measured?.height ?? n.height ?? null,
          data: JSON.stringify(n.data),
        }))
      )
      saveCanvasEdges(
        canvasId,
        edges.map((e) => ({
          id: e.id,
          sourceNodeId: e.source,
          targetNodeId: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          label: typeof e.label === "string" ? e.label : null,
          type: e.type,
          animated: e.animated,
        }))
      )
    }, 800)
  }, [canvasId, nodes, edges])

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, id: createId() }, eds))
      setTimeout(debouncedSave, 100)
    },
    [setEdges, debouncedSave]
  )

  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes)
      debouncedSave()
    },
    [onNodesChange, debouncedSave]
  )

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      onEdgesChange(changes)
      debouncedSave()
    },
    [onEdgesChange, debouncedSave]
  )

  function handleMoveEnd(_: unknown, viewport: Viewport) {
    saveCanvasViewport(canvasId, viewport)
  }

  function addNode(type: "card" | "sticky_note" | "text") {
    const id = createId()
    const newNode: Node = {
      id,
      type,
      position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
      data: {
        label: type === "sticky_note" ? "" : "",
        color: type === "sticky_note" ? "#fef08a" : undefined,
      },
    }
    setNodes((nds) => [...nds, newNode])
    setTimeout(debouncedSave, 100)
  }

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onMoveEnd={handleMoveEnd}
        nodeTypes={nodeTypes}
        defaultViewport={initialViewport}
        fitView={initialNodes.length === 0}
        colorMode={resolvedTheme === "dark" ? "dark" : "light"}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={["Backspace", "Delete"]}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls />
        <MiniMap
          zoomable
          pannable
          className="!bg-background !border-border"
        />

        <Panel position="top-left">
          <div className="flex gap-1 bg-background/90 backdrop-blur border rounded-lg p-1 shadow-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => addNode("card")}
              className="gap-1.5"
            >
              <CreditCard className="size-4" />
              Card
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => addNode("sticky_note")}
              className="gap-1.5"
            >
              <StickyNote className="size-4" />
              Note
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => addNode("text")}
              className="gap-1.5"
            >
              <Type className="size-4" />
              Text
            </Button>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  )
}
