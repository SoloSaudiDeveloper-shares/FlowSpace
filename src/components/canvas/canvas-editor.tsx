"use client"

import { useCallback, useRef, useState } from "react"
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  MiniMap,
  addEdge,
  reconnectEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ConnectionMode,
  type Connection,
  type Node,
  type Edge,
  type Viewport,
  BackgroundVariant,
  Panel,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { useTheme } from "@/components/theme-provider"
import {
  ZoomIn, ZoomOut, Maximize2, StickyNote, Type, CreditCard, Copy, Trash2,
  ArrowUp, ArrowDown, Shapes, ImageIcon, Group, Link2,
  Layers, Settings as SettingsIcon, AlignStartVertical, AlignEndVertical, AlignCenterVertical,
  AlignStartHorizontal, AlignEndHorizontal, AlignCenterHorizontal,
  Eye, EyeOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  saveCanvasNodes,
  saveCanvasEdges,
  saveCanvasViewport,
} from "@/lib/actions/canvas-actions"
import { createId } from "@/lib/utils/ids"
import { CardNode } from "./node-types/card-node"
import { StickyNoteNode } from "./node-types/sticky-note-node"
import { TextNode } from "./node-types/text-node"
import { ShapeNode } from "./node-types/shape-node"
import { ImageNode } from "./node-types/image-node"
import { GroupNode } from "./node-types/group-node"
import { EmbedNode } from "./node-types/embed-node"
import { ShapePicker } from "./shape-picker"
import { ContextMenu, useContextMenu, type ContextMenuEntry } from "@/components/shared/context-menu"

const nodeTypes = {
  card: CardNode,
  sticky_note: StickyNoteNode,
  text: TextNode,
  shape: ShapeNode,
  image: ImageNode,
  group: GroupNode,
  embed: EmbedNode,
}

interface CanvasEditorProps {
  canvasId: string
  initialNodes: Node[]
  initialEdges: Edge[]
  initialViewport: Viewport
  initialConfig?: {
    backgroundVariant: "dots" | "lines" | "cross" | "none"
    backgroundGap: number
    snapToGrid: boolean
    showMinimap: boolean
  }
}

interface DropMenuState {
  x: number
  y: number
  sourceId: string
  sourceHandle: string | null
}

function DropMenu({
  x,
  y,
  onDismiss,
  onCreate,
}: {
  x: number
  y: number
  onDismiss: () => void
  onCreate: (type: "card" | "sticky_note" | "text" | "image" | "embed") => void
}) {
  return (
    <div>
      <div className="fixed inset-0 z-40" onMouseDown={onDismiss} />
      <div
        className="fixed z-50 min-w-[140px] bg-background border rounded-lg shadow-lg p-1 flex flex-col gap-0.5"
        style={{ left: x, top: y }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent text-left w-full"
          onClick={() => onCreate("card")}
        >
          <CreditCard className="size-4 text-muted-foreground" />
          Card
        </button>
        <button
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent text-left w-full"
          onClick={() => onCreate("sticky_note")}
        >
          <StickyNote className="size-4 text-muted-foreground" />
          Sticky Note
        </button>
        <button
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent text-left w-full"
          onClick={() => onCreate("text")}
        >
          <Type className="size-4 text-muted-foreground" />
          Text
        </button>
        <button
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent text-left w-full"
          onClick={() => onCreate("image")}
        >
          <ImageIcon className="size-4 text-muted-foreground" />
          Image
        </button>
        <button
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent text-left w-full"
          onClick={() => onCreate("embed")}
        >
          <Link2 className="size-4 text-muted-foreground" />
          Embed
        </button>
      </div>
    </div>
  )
}

function CanvasEditorInner({
  canvasId,
  initialNodes,
  initialEdges,
  initialViewport,
  initialConfig,
}: CanvasEditorProps) {
  const { resolvedTheme } = useTheme()
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [dropMenu, setDropMenu] = useState<DropMenuState | null>(null)
  const [showShapePicker, setShowShapePicker] = useState(false)
  const [showLayerPanel, setShowLayerPanel] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  // Canvas display config — optimistic local state, persisted to the DB
  // on change via saveCanvasConfig.
  const [config, setConfig] = useState({
    backgroundVariant: initialConfig?.backgroundVariant ?? "dots",
    backgroundGap: initialConfig?.backgroundGap ?? 20,
    snapToGrid: initialConfig?.snapToGrid ?? false,
    showMinimap: initialConfig?.showMinimap ?? true,
  })
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { zoomIn, zoomOut, fitView, screenToFlowPosition, getNodes, getEdges } = useReactFlow()
  const { menu: ctxMenu, open: openCtx, close: closeCtx } = useContextMenu()

  function updateConfig(patch: Partial<typeof config>) {
    setConfig((c) => {
      const next = { ...c, ...patch }
      // Fire-and-forget — UI updates instantly, server catches up.
      import("@/lib/actions/canvas-actions")
        .then((m) => m.saveCanvasConfig(canvasId, patch))
        .catch(() => undefined)
      return next
    })
  }

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
          width: (n.style?.width !== undefined ? Number(n.style.width) : undefined) ?? n.measured?.width ?? null,
          height: (n.style?.height !== undefined ? Number(n.style.height) : undefined) ?? n.measured?.height ?? null,
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

  // ─── Edge reconnection ──────────────────────────────────────────────
  // Two ways to redirect an edge:
  //  1. Native: hover an edge and drag either endpoint onto another node's
  //     handle (React Flow fires onReconnect).
  //  2. Right-click → "Reconnect nearest end": releases the endpoint closest
  //     to the cursor; the next node you click becomes the new attachment.
  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds))
      setTimeout(debouncedSave, 100)
    },
    [setEdges, debouncedSave]
  )

  const [reconnecting, setReconnecting] = useState<
    { edgeId: string; end: "source" | "target" } | null
  >(null)

  const startReconnect = useCallback(
    (edge: Edge, cx: number, cy: number) => {
      const click = screenToFlowPosition({ x: cx, y: cy })
      const all = getNodes()
      const centerOf = (id: string) => {
        const n = all.find((node) => node.id === id)
        if (!n) return null
        return {
          x: n.position.x + (Number(n.style?.width) || n.measured?.width || 150) / 2,
          y: n.position.y + (Number(n.style?.height) || n.measured?.height || 100) / 2,
        }
      }
      const distTo = (p: { x: number; y: number } | null) =>
        p ? Math.hypot(p.x - click.x, p.y - click.y) : Infinity
      const end: "source" | "target" =
        distTo(centerOf(edge.source)) <= distTo(centerOf(edge.target))
          ? "source"
          : "target"
      setReconnecting({ edgeId: edge.id, end })
      toast.info(
        `Click a node to reattach the ${end === "source" ? "start" : "end"} of this edge — or click empty space to cancel.`,
      )
    },
    [screenToFlowPosition, getNodes]
  )

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (!reconnecting) return
      setEdges((eds) =>
        eds.map((ed) =>
          ed.id === reconnecting.edgeId
            ? { ...ed, [reconnecting.end]: node.id }
            : ed,
        ),
      )
      setReconnecting(null)
      toast.success("Edge reconnected")
      setTimeout(debouncedSave, 100)
    },
    [reconnecting, setEdges, debouncedSave]
  )

  const cancelReconnect = useCallback(() => {
    if (reconnecting) setReconnecting(null)
  }, [reconnecting])

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

  type NodeType = "card" | "sticky_note" | "text" | "image" | "group" | "embed"

  function addNode(
    type: NodeType,
    position?: { x: number; y: number }
  ): string {
    const id = createId()
    const defaults: Record<string, Record<string, unknown>> = {
      sticky_note: { label: "", color: "#fef08a" },
      image: { src: "", label: "" },
      group: { label: "", color: "#6366f120" },
      embed: { label: "" },
    }
    const sizeDefaults: Record<string, { width: number; height: number }> = {
      image: { width: 250, height: 200 },
      group: { width: 400, height: 300 },
      embed: { width: 220, height: 100 },
    }
    const newNode: Node = {
      id,
      type,
      position: position ?? { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
      data: defaults[type] ?? { label: "" },
      ...(sizeDefaults[type] ? { style: { width: sizeDefaults[type].width, height: sizeDefaults[type].height } } : {}),
      ...(type === "group" ? { zIndex: -1 } : {}),
    }
    setNodes((nds) => [...nds, newNode])
    setTimeout(debouncedSave, 100)
    return id
  }

  function addShapeNode(shapeId: string): string {
    const id = createId()
    const position = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
    const newNode: Node = {
      id,
      type: "shape",
      position: { x: position.x - 75, y: position.y - 75 },
      style: { width: 150, height: 150 },
      data: {
        shapeId,
        label: "",
        fill: "#6366f133",
        stroke: "#6366f1",
      },
    }
    setNodes((nds) => [...nds, newNode])
    setShowShapePicker(false)
    setTimeout(debouncedSave, 100)
    return id
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent, connectionState: any) => {
    if (connectionState.fromNode && !connectionState.toNode) {
      const clientX = "changedTouches" in event
        ? (event as TouchEvent).changedTouches[0].clientX
        : (event as MouseEvent).clientX
      const clientY = "changedTouches" in event
        ? (event as TouchEvent).changedTouches[0].clientY
        : (event as MouseEvent).clientY
      setDropMenu({
        x: clientX,
        y: clientY,
        sourceId: connectionState.fromNode.id,
        sourceHandle: connectionState.fromHandle?.id ?? null,
      })
    }
  }, [])

  const OPPOSITE_HANDLE: Record<string, string> = {
    "src-left":   "src-right",
    "src-right":  "src-left",
    "src-top":    "src-bottom",
    "src-bottom": "src-top",
  }

  function handleDropCreate(type: NodeType) {
    if (!dropMenu) return
    const position = screenToFlowPosition({ x: dropMenu.x, y: dropMenu.y })
    const newId = addNode(type, position)
    const targetHandle = dropMenu.sourceHandle ? (OPPOSITE_HANDLE[dropMenu.sourceHandle] ?? null) : null
    setEdges((eds) => [
      ...eds,
      {
        id: createId(),
        source: dropMenu.sourceId,
        sourceHandle: dropMenu.sourceHandle,
        target: newId,
        targetHandle,
      },
    ])
    setDropMenu(null)
    setTimeout(debouncedSave, 100)
  }

  function handlePaneContextMenu(e: MouseEvent | React.MouseEvent) {
    e.preventDefault()
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const items: ContextMenuEntry[] = [
      { label: "Add Card", icon: CreditCard, onClick: () => addNode("card", position) },
      { label: "Add Sticky Note", icon: StickyNote, onClick: () => addNode("sticky_note", position) },
      { label: "Add Text", icon: Type, onClick: () => addNode("text", position) },
      { label: "Add Image", icon: ImageIcon, onClick: () => addNode("image", position) },
      { label: "Add Group", icon: Group, onClick: () => addNode("group", position) },
      { label: "Add Embed", icon: Link2, onClick: () => addNode("embed", position) },
      { separator: true },
      { label: "Select All", onClick: () => setNodes((nds) => nds.map((n) => ({ ...n, selected: true }))) },
      { label: "Fit View", icon: Maximize2, onClick: () => fitView({ duration: 300 }) },
    ]
    openCtx(e as React.MouseEvent, items)
  }

  function handleNodeContextMenu(e: React.MouseEvent, node: Node) {
    const items: ContextMenuEntry[] = [
      {
        label: "Duplicate",
        icon: Copy,
        onClick: () => {
          const newId = createId()
          setNodes((nds) => [
            ...nds,
            { ...node, id: newId, position: { x: node.position.x + 30, y: node.position.y + 30 }, selected: false },
          ])
          setTimeout(debouncedSave, 100)
        },
      },
      {
        label: "Bring to Front",
        icon: ArrowUp,
        onClick: () => setNodes((nds) => {
          const maxZ = Math.max(0, ...nds.map((n) => n.zIndex ?? 0))
          return nds.map((n) => n.id === node.id ? { ...n, zIndex: maxZ + 1 } : n)
        }),
      },
      {
        label: "Send to Back",
        icon: ArrowDown,
        onClick: () => setNodes((nds) => {
          const minZ = Math.min(0, ...nds.map((n) => n.zIndex ?? 0))
          return nds.map((n) => n.id === node.id ? { ...n, zIndex: minZ - 1 } : n)
        }),
      },
      { separator: true },
      {
        label: "Delete",
        icon: Trash2,
        variant: "destructive",
        onClick: () => {
          setNodes((nds) => nds.filter((n) => n.id !== node.id))
          setEdges((eds) => eds.filter((edge) => edge.source !== node.id && edge.target !== node.id))
          setTimeout(debouncedSave, 100)
        },
      },
    ]
    openCtx(e, items)
  }

  // ─── Alignment Tools ──────────────────────────────────────────────
  function alignNodes(direction: "left" | "right" | "center-h" | "top" | "bottom" | "center-v") {
    const selected = nodes.filter((n) => n.selected)
    if (selected.length < 2) return

    setNodes((nds) => {
      const sel = nds.filter((n) => n.selected)
      if (sel.length < 2) return nds

      let target: number
      switch (direction) {
        case "left":
          target = Math.min(...sel.map((n) => n.position.x))
          return nds.map((n) => n.selected ? { ...n, position: { ...n.position, x: target } } : n)
        case "right":
          target = Math.max(...sel.map((n) => n.position.x + (Number(n.style?.width) || n.measured?.width || 150)))
          return nds.map((n) => n.selected ? { ...n, position: { ...n.position, x: target - (Number(n.style?.width) || n.measured?.width || 150) } } : n)
        case "center-h": {
          const minX = Math.min(...sel.map((n) => n.position.x))
          const maxX = Math.max(...sel.map((n) => n.position.x + (Number(n.style?.width) || n.measured?.width || 150)))
          const centerX = (minX + maxX) / 2
          return nds.map((n) => n.selected ? { ...n, position: { ...n.position, x: centerX - (Number(n.style?.width) || n.measured?.width || 150) / 2 } } : n)
        }
        case "top":
          target = Math.min(...sel.map((n) => n.position.y))
          return nds.map((n) => n.selected ? { ...n, position: { ...n.position, y: target } } : n)
        case "bottom":
          target = Math.max(...sel.map((n) => n.position.y + (Number(n.style?.height) || n.measured?.height || 100)))
          return nds.map((n) => n.selected ? { ...n, position: { ...n.position, y: target - (Number(n.style?.height) || n.measured?.height || 100) } } : n)
        case "center-v": {
          const minY = Math.min(...sel.map((n) => n.position.y))
          const maxY = Math.max(...sel.map((n) => n.position.y + (Number(n.style?.height) || n.measured?.height || 100)))
          const centerY = (minY + maxY) / 2
          return nds.map((n) => n.selected ? { ...n, position: { ...n.position, y: centerY - (Number(n.style?.height) || n.measured?.height || 100) / 2 } } : n)
        }
      }
    })
    setTimeout(debouncedSave, 100)
  }

  const selectedCount = nodes.filter((n) => n.selected).length

  function handleEdgeContextMenu(e: React.MouseEvent, edge: Edge) {
    const cx = e.clientX
    const cy = e.clientY
    const items: ContextMenuEntry[] = [
      {
        label: "Reconnect nearest end",
        icon: Link2,
        onClick: () => startReconnect(edge, cx, cy),
      },
      { separator: true },
      {
        label: edge.animated ? "Remove Animation" : "Animate Edge",
        onClick: () => {
          setEdges((eds) => eds.map((ed) => ed.id === edge.id ? { ...ed, animated: !ed.animated } : ed))
          setTimeout(debouncedSave, 100)
        },
      },
      { separator: true },
      {
        label: "Delete Edge",
        icon: Trash2,
        variant: "destructive",
        onClick: () => {
          setEdges((eds) => eds.filter((ed) => ed.id !== edge.id))
          setTimeout(debouncedSave, 100)
        },
      },
    ]
    openCtx(e, items)
  }

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        onReconnect={onReconnect}
        onNodeClick={handleNodeClick}
        onPaneClick={cancelReconnect}
        onMoveEnd={handleMoveEnd}
        onPaneContextMenu={handlePaneContextMenu}
        onNodeContextMenu={handleNodeContextMenu}
        onEdgeContextMenu={handleEdgeContextMenu}
        nodeTypes={nodeTypes}
        defaultViewport={initialViewport}
        fitView={initialNodes.length === 0}
        colorMode={resolvedTheme === "dark" ? "dark" : "light"}
        connectionMode={ConnectionMode.Loose}
        panOnDrag={[1]}
        selectionOnDrag
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={["Backspace", "Delete"]}
        snapToGrid={config.snapToGrid}
        snapGrid={[config.backgroundGap, config.backgroundGap]}
      >
        {config.backgroundVariant !== "none" && (
          <Background
            variant={
              config.backgroundVariant === "lines"
                ? BackgroundVariant.Lines
                : config.backgroundVariant === "cross"
                  ? BackgroundVariant.Cross
                  : BackgroundVariant.Dots
            }
            gap={config.backgroundGap}
            size={1}
          />
        )}
        {config.showMinimap && (
          <MiniMap
            zoomable
            pannable
            className="!bg-background !border-border"
            // Render each node in the minimap with its real colour (sticky
            // notes / groups store it in data.color); fall back to a neutral
            // tone for plain cards so they're still visible.
            nodeColor={(n) => {
              const c = (n.data as { color?: string } | undefined)?.color
              if (typeof c === "string" && c) return c
              return resolvedTheme === "dark" ? "#52525b" : "#d4d4d8"
            }}
            nodeStrokeColor={resolvedTheme === "dark" ? "#27272a" : "#e4e4e7"}
            nodeStrokeWidth={2}
            maskColor={resolvedTheme === "dark" ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.6)"}
          />
        )}

        <Panel position="top-left">
          <div className="flex gap-1 bg-background/90 backdrop-blur border rounded-lg p-1 shadow-sm">
            <Button variant="ghost" size="sm" onClick={() => addNode("card")} className="gap-1.5">
              <CreditCard className="size-4" />
              Card
            </Button>
            <Button variant="ghost" size="sm" onClick={() => addNode("sticky_note")} className="gap-1.5">
              <StickyNote className="size-4" />
              Note
            </Button>
            <Button variant="ghost" size="sm" onClick={() => addNode("text")} className="gap-1.5">
              <Type className="size-4" />
              Text
            </Button>
            <Button variant="ghost" size="sm" onClick={() => addNode("image")} className="gap-1.5">
              <ImageIcon className="size-4" />
              Image
            </Button>
            <Button variant="ghost" size="sm" onClick={() => addNode("group")} className="gap-1.5">
              <Group className="size-4" />
              Group
            </Button>
            <Button variant="ghost" size="sm" onClick={() => addNode("embed")} className="gap-1.5">
              <Link2 className="size-4" />
              Embed
            </Button>
            <Button
              variant={showShapePicker ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setShowShapePicker((v) => !v)}
              className="gap-1.5"
            >
              <Shapes className="size-4" />
              Shapes
            </Button>
          </div>
        </Panel>

        {/* Alignment toolbar - shows when 2+ nodes selected */}
        {selectedCount >= 2 && (
          <Panel position="top-center">
            <div className="flex gap-0.5 bg-background/90 backdrop-blur border rounded-lg p-1 shadow-sm">
              <Button variant="ghost" size="icon" className="size-7" onClick={() => alignNodes("left")} title="Align left">
                <AlignStartVertical className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => alignNodes("center-h")} title="Align center horizontal">
                <AlignCenterVertical className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => alignNodes("right")} title="Align right">
                <AlignEndVertical className="size-4" />
              </Button>
              <div className="w-px bg-border mx-0.5" />
              <Button variant="ghost" size="icon" className="size-7" onClick={() => alignNodes("top")} title="Align top">
                <AlignStartHorizontal className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => alignNodes("center-v")} title="Align center vertical">
                <AlignCenterHorizontal className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => alignNodes("bottom")} title="Align bottom">
                <AlignEndHorizontal className="size-4" />
              </Button>
            </div>
          </Panel>
        )}

        <Panel position="bottom-left">
          <div className="flex flex-col gap-0.5 bg-background/90 backdrop-blur border rounded-lg p-1 shadow-sm">
            <Button variant="ghost" size="icon" className="size-7" onClick={() => zoomIn({ duration: 200 })} title="Zoom in">
              <ZoomIn className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => zoomOut({ duration: 200 })} title="Zoom out">
              <ZoomOut className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => fitView({ duration: 300 })} title="Fit view">
              <Maximize2 className="size-4" />
            </Button>
            <div className="w-full h-px bg-border my-0.5" />
            <Button
              variant={showLayerPanel ? "secondary" : "ghost"}
              size="icon"
              className="size-7"
              onClick={() => setShowLayerPanel((v) => !v)}
              title="Layer panel"
            >
              <Layers className="size-4" />
            </Button>
            <Button
              variant={showSettings ? "secondary" : "ghost"}
              size="icon"
              className="size-7"
              onClick={() => setShowSettings((v) => !v)}
              title="Canvas settings"
            >
              <SettingsIcon className="size-4" />
            </Button>
          </div>
        </Panel>

        {/* Canvas settings popover */}
        {showSettings && (
          <Panel position="bottom-left" className="!bottom-2 !left-12">
            <div className="bg-background/95 backdrop-blur border rounded-lg shadow-lg w-64 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Canvas settings</span>
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="size-5 rounded text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              {/* Background pattern */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium mb-1.5">
                  Background
                </p>
                <div className="grid grid-cols-4 gap-1">
                  {(["dots", "lines", "cross", "none"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => updateConfig({ backgroundVariant: v })}
                      className={`px-1.5 py-1 rounded text-[11px] border transition-colors capitalize ${
                        config.backgroundVariant === v
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              {/* Grid gap */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
                    Grid gap
                  </p>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {config.backgroundGap}px
                  </span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={80}
                  step={4}
                  value={config.backgroundGap}
                  onChange={(e) => updateConfig({ backgroundGap: Number(e.target.value) })}
                  className="w-full accent-primary"
                />
              </div>
              {/* Toggles */}
              <label className="flex items-center justify-between text-xs cursor-pointer">
                <span>Snap to grid</span>
                <input
                  type="checkbox"
                  checked={config.snapToGrid}
                  onChange={(e) => updateConfig({ snapToGrid: e.target.checked })}
                  className="accent-primary"
                />
              </label>
              <label className="flex items-center justify-between text-xs cursor-pointer">
                <span>Show minimap</span>
                <input
                  type="checkbox"
                  checked={config.showMinimap}
                  onChange={(e) => updateConfig({ showMinimap: e.target.checked })}
                  className="accent-primary"
                />
              </label>
              <p className="text-[10px] text-muted-foreground/60 leading-snug">
                Saved per-canvas. Restored next time you open this canvas.
              </p>
            </div>
          </Panel>
        )}

        {/* Layer Panel */}
        {showLayerPanel && (
          <Panel position="bottom-right">
            <div className="bg-background/95 backdrop-blur border rounded-lg shadow-lg w-56 max-h-64 overflow-hidden flex flex-col">
              <div className="px-3 py-2 border-b flex items-center justify-between">
                <span className="text-xs font-semibold">Layers</span>
                <span className="text-[10px] text-muted-foreground">{nodes.length} nodes</span>
              </div>
              <div className="flex-1 overflow-y-auto p-1">
                {[...nodes].reverse().map((node) => {
                  const typeLabel = node.type === "sticky_note" ? "Note" : (node.type || "node")
                  const title = (node.data as Record<string, string>)?.label || (node.data as Record<string, string>)?.elementTitle || typeLabel
                  return (
                    <div
                      key={node.id}
                      className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs cursor-pointer transition-colors ${
                        node.selected ? "bg-accent" : "hover:bg-accent/50"
                      }`}
                      onClick={() => {
                        setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === node.id })))
                      }}
                    >
                      <span className="text-muted-foreground capitalize shrink-0 w-12 truncate">{typeLabel}</span>
                      <span className="truncate flex-1">{title}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setNodes((nds) => nds.map((n) => n.id === node.id ? { ...n, hidden: !n.hidden } : n))
                          setTimeout(debouncedSave, 100)
                        }}
                        className="p-0.5 rounded hover:bg-muted shrink-0"
                      >
                        {node.hidden
                          ? <EyeOff className="size-3 text-muted-foreground" />
                          : <Eye className="size-3 text-muted-foreground" />
                        }
                      </button>
                    </div>
                  )
                })}
                {nodes.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No nodes</p>
                )}
              </div>
            </div>
          </Panel>
        )}
      </ReactFlow>

      {dropMenu && (
        <DropMenu
          x={dropMenu.x}
          y={dropMenu.y}
          onDismiss={() => setDropMenu(null)}
          onCreate={handleDropCreate}
        />
      )}

      {showShapePicker && (
        <ShapePicker
          onSelect={addShapeNode}
          onClose={() => setShowShapePicker(false)}
        />
      )}

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxMenu.items}
          onClose={closeCtx}
        />
      )}
    </div>
  )
}

export function CanvasEditor(props: CanvasEditorProps) {
  return (
    <ReactFlowProvider>
      <CanvasEditorInner {...props} />
    </ReactFlowProvider>
  )
}
