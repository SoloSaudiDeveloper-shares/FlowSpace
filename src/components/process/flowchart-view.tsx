"use client"

import { useMemo } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  type Node,
  type Edge,
  Position,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { useTheme } from "@/components/theme-provider"
import type { processSteps } from "@/lib/db/schema"

type ProcessStep = typeof processSteps.$inferSelect

interface FlowchartViewProps {
  processId: string
  steps: ProcessStep[]
}

export function FlowchartView({ processId, steps }: FlowchartViewProps) {
  const { resolvedTheme } = useTheme()

  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []

    // Start node
    nodes.push({
      id: "start",
      type: "input",
      position: { x: 200, y: 0 },
      data: { label: "Start" },
      style: {
        background: "#22c55e",
        color: "white",
        border: "none",
        borderRadius: "9999px",
        padding: "8px 24px",
        fontWeight: 600,
        fontSize: "13px",
      },
      sourcePosition: Position.Bottom,
    })

    // Step nodes
    steps.forEach((step, index) => {
      const nodeId = `step-${step.id}`
      nodes.push({
        id: nodeId,
        position: { x: 150, y: (index + 1) * 100 },
        data: { label: step.title },
        style: {
          background: step.isCompleted
            ? resolvedTheme === "dark" ? "#1a3a2a" : "#dcfce7"
            : resolvedTheme === "dark" ? "#262626" : "#ffffff",
          border: step.isCompleted ? "2px solid #22c55e" : "1px solid #555",
          borderRadius: "8px",
          padding: "10px 20px",
          fontSize: "13px",
          minWidth: "180px",
          textAlign: "center" as const,
          color: resolvedTheme === "dark" ? "#e5e5e5" : "#171717",
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      })

      // Edge from previous
      const sourceId = index === 0 ? "start" : `step-${steps[index - 1].id}`
      edges.push({
        id: `e-${sourceId}-${nodeId}`,
        source: sourceId,
        target: nodeId,
        animated: !step.isCompleted,
        style: { stroke: step.isCompleted ? "#22c55e" : "#888" },
      })
    })

    // End node
    if (steps.length > 0) {
      nodes.push({
        id: "end",
        type: "output",
        position: { x: 200, y: (steps.length + 1) * 100 },
        data: { label: "End" },
        style: {
          background: "#ef4444",
          color: "white",
          border: "none",
          borderRadius: "9999px",
          padding: "8px 24px",
          fontWeight: 600,
          fontSize: "13px",
        },
        targetPosition: Position.Top,
      })
      edges.push({
        id: `e-last-end`,
        source: `step-${steps[steps.length - 1].id}`,
        target: "end",
        style: { stroke: "#888" },
      })
    }

    return { nodes, edges }
  }, [steps, resolvedTheme])

  return (
    <div className="h-[500px] rounded-lg border bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        colorMode={resolvedTheme === "dark" ? "dark" : "light"}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
