"use server"

import { db } from "@/lib/db"
import { canvases, canvasNodes, canvasEdges, elements } from "@/lib/db/schema"
import { createId } from "@/lib/utils/ids"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getCanvasData(canvasId: string) {
  const [canvas, nodes, edges] = await Promise.all([
    db.select().from(canvases).where(eq(canvases.id, canvasId)).limit(1),
    db.select().from(canvasNodes).where(eq(canvasNodes.canvasId, canvasId)),
    db.select().from(canvasEdges).where(eq(canvasEdges.canvasId, canvasId)),
  ])
  return {
    canvas: canvas[0] ?? null,
    nodes,
    edges,
  }
}

export async function saveCanvasNodes(
  canvasId: string,
  nodes: Array<{
    id: string
    type: string
    positionX: number
    positionY: number
    width?: number | null
    height?: number | null
    data?: string | null
  }>
) {
  // Delete existing nodes and re-insert
  await db.delete(canvasNodes).where(eq(canvasNodes.canvasId, canvasId))
  if (nodes.length > 0) {
    await db.insert(canvasNodes).values(
      nodes.map((n) => ({
        id: n.id,
        canvasId,
        type: n.type as "card" | "sticky_note" | "element_embed" | "text" | "image" | "group" | "shape",
        positionX: n.positionX,
        positionY: n.positionY,
        width: n.width,
        height: n.height,
        data: n.data,
      }))
    )
  }
  await db
    .update(elements)
    .set({ updatedAt: new Date().toISOString() })
    .where(eq(elements.id, canvasId))
}

export async function saveCanvasEdges(
  canvasId: string,
  edges: Array<{
    id: string
    sourceNodeId: string
    targetNodeId: string
    sourceHandle?: string | null
    targetHandle?: string | null
    label?: string | null
    type?: string | null
    animated?: boolean
  }>
) {
  await db.delete(canvasEdges).where(eq(canvasEdges.canvasId, canvasId))
  if (edges.length > 0) {
    await db.insert(canvasEdges).values(
      edges.map((e) => ({
        id: e.id,
        canvasId,
        sourceNodeId: e.sourceNodeId,
        targetNodeId: e.targetNodeId,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        label: e.label,
        type: e.type,
        animated: e.animated ?? false,
      }))
    )
  }
}

export async function saveCanvasViewport(
  canvasId: string,
  viewport: { x: number; y: number; zoom: number }
) {
  await db
    .update(canvases)
    .set({
      viewportX: viewport.x,
      viewportY: viewport.y,
      viewportZoom: viewport.zoom,
    })
    .where(eq(canvases.id, canvasId))
}

/** Persist user-tweakable canvas display settings (background pattern,
 *  grid snap, minimap visibility, grid gap). Each call patches only the
 *  fields the user changed so the existing viewport state isn't lost. */
export async function saveCanvasConfig(
  canvasId: string,
  patch: {
    backgroundVariant?: "dots" | "lines" | "cross" | "none"
    backgroundGap?: number
    snapToGrid?: boolean
    showMinimap?: boolean
  },
): Promise<{ ok: true }> {
  const update: Record<string, unknown> = {}
  if (patch.backgroundVariant !== undefined) update.backgroundVariant = patch.backgroundVariant
  if (patch.backgroundGap !== undefined) {
    // Clamp to sane bounds so the user can't crash react-flow with gap=0.
    update.backgroundGap = Math.max(8, Math.min(80, Math.round(patch.backgroundGap)))
  }
  if (patch.snapToGrid !== undefined) update.snapToGrid = patch.snapToGrid
  if (patch.showMinimap !== undefined) update.showMinimap = patch.showMinimap
  if (Object.keys(update).length === 0) return { ok: true }
  await db.update(canvases).set(update).where(eq(canvases.id, canvasId))
  return { ok: true }
}

export async function addCanvasNode(
  canvasId: string,
  type: "card" | "sticky_note" | "text",
  positionX: number,
  positionY: number,
  data?: Record<string, unknown>
) {
  const id = createId()
  await db.insert(canvasNodes).values({
    id,
    canvasId,
    type,
    positionX,
    positionY,
    width: type === "sticky_note" ? 200 : 250,
    height: type === "sticky_note" ? 200 : undefined,
    data: data ? JSON.stringify(data) : JSON.stringify({ label: "" }),
  })
  await db
    .update(elements)
    .set({ updatedAt: new Date().toISOString() })
    .where(eq(elements.id, canvasId))

  revalidatePath(`/canvas/${canvasId}`)
  return id
}
