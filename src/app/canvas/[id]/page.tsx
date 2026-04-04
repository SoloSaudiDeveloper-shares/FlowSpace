import { getElement } from "@/lib/actions/element-actions"
import { getCanvasData } from "@/lib/actions/canvas-actions"
import { notFound } from "next/navigation"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Layout } from "lucide-react"
import { InlineTitle } from "@/components/shared/inline-title"
import { CanvasEditor } from "@/components/canvas/canvas-editor"
import type { Node, Edge, Viewport } from "@xyflow/react"

export default async function CanvasPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [element, canvasData] = await Promise.all([
    getElement(id),
    getCanvasData(id),
  ])
  if (!element || element.type !== "canvas") notFound()

  const initialNodes: Node[] = canvasData.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: { x: n.positionX, y: n.positionY },
    data: n.data ? JSON.parse(n.data) : { label: "" },
    width: n.width ?? undefined,
    height: n.height ?? undefined,
  }))

  const initialEdges: Edge[] = canvasData.edges.map((e) => ({
    id: e.id,
    source: e.sourceNodeId,
    target: e.targetNodeId,
    sourceHandle: e.sourceHandle ?? undefined,
    targetHandle: e.targetHandle ?? undefined,
    label: e.label ?? undefined,
    type: e.type ?? undefined,
    animated: e.animated,
  }))

  const initialViewport: Viewport = {
    x: canvasData.canvas?.viewportX ?? 0,
    y: canvasData.canvas?.viewportY ?? 0,
    zoom: canvasData.canvas?.viewportZoom ?? 1,
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <span style={{ color: element.color ?? undefined }}>
          <Layout className="size-4" />
        </span>
        <InlineTitle
          elementId={element.id}
          initialTitle={element.title}
          className="!text-lg !font-semibold"
        />
      </header>
      <div className="flex-1">
        <CanvasEditor
          canvasId={element.id}
          initialNodes={initialNodes}
          initialEdges={initialEdges}
          initialViewport={initialViewport}
        />
      </div>
    </div>
  )
}
