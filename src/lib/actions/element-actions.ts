"use server"

import { db } from "@/lib/db"
import { elements, pages, projects, taskStatuses, canvases, todoLists, processes, reminders } from "@/lib/db/schema"
import type { ElementType } from "@/lib/db/schema"
import { createId } from "@/lib/utils/ids"
import { eq, desc, and, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"

const ELEMENT_ICONS: Record<ElementType, string> = {
  project: "FolderKanban",
  page: "FileText",
  canvas: "Layout",
  todo_list: "ListTodo",
  reminder: "Bell",
  process: "GitBranch",
}

const ELEMENT_COLORS: Record<ElementType, string> = {
  project: "#6366f1",
  page: "#8b5cf6",
  canvas: "#06b6d4",
  todo_list: "#22c55e",
  reminder: "#f59e0b",
  process: "#ec4899",
}

export async function createElement(type: ElementType, title?: string, parentId?: string) {
  const id = createId()
  const now = new Date().toISOString()

  await db.insert(elements).values({
    id,
    type,
    title: title || "Untitled",
    icon: ELEMENT_ICONS[type],
    color: ELEMENT_COLORS[type],
    parentId: parentId ?? null,
    createdAt: now,
    updatedAt: now,
  })

  // Create type-specific record
  switch (type) {
    case "page":
      await db.insert(pages).values({ id })
      break
    case "project":
      await db.insert(projects).values({ id })
      // Create default task statuses
      const statuses = [
        { name: "To Do", color: "#94a3b8", sortOrder: 0, isDoneState: false },
        { name: "In Progress", color: "#3b82f6", sortOrder: 1, isDoneState: false },
        { name: "Done", color: "#22c55e", sortOrder: 2, isDoneState: true },
      ]
      for (const s of statuses) {
        await db.insert(taskStatuses).values({
          id: createId(),
          projectId: id,
          name: s.name,
          color: s.color,
          sortOrder: s.sortOrder,
          isDoneState: s.isDoneState,
        })
      }
      break
    case "canvas":
      await db.insert(canvases).values({ id })
      break
    case "todo_list":
      await db.insert(todoLists).values({ id })
      break
    case "reminder":
      await db.insert(reminders).values({
        id,
        remindAt: new Date(Date.now() + 3600000).toISOString(),
      })
      break
    case "process":
      await db.insert(processes).values({ id })
      break
  }

  revalidatePath("/")
  return { id, type }
}

export async function getElements() {
  return db
    .select()
    .from(elements)
    .where(
      and(
        eq(elements.isDeleted, false),
        eq(elements.isArchived, false)
      )
    )
    .orderBy(desc(elements.updatedAt))
}

export async function getElementsByType(type: ElementType) {
  return db
    .select()
    .from(elements)
    .where(
      and(
        eq(elements.type, type),
        eq(elements.isDeleted, false),
        eq(elements.isArchived, false)
      )
    )
    .orderBy(desc(elements.updatedAt))
}

export async function getElement(id: string) {
  const result = await db
    .select()
    .from(elements)
    .where(eq(elements.id, id))
    .limit(1)
  return result[0] ?? null
}

export async function updateElement(
  id: string,
  data: {
    title?: string
    description?: string
    icon?: string
    color?: string
    isFavorite?: boolean
  }
) {
  await db
    .update(elements)
    .set({
      ...data,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(elements.id, id))

  revalidatePath("/")
}

/**
 * Bulk-update sort_order for the given element ids. Order in the array
 * determines the new position (first element gets sort_order=0, etc.).
 * Used by the sidebar drag-to-reorder. Caller is responsible for passing
 * a coherent set (e.g. all siblings of the same type / same parent).
 */
export async function reorderElements(orderedIds: string[]) {
  if (orderedIds.length === 0) return
  const updatedAt = new Date().toISOString()
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(elements)
      .set({ sortOrder: i, updatedAt })
      .where(eq(elements.id, orderedIds[i]))
  }
  revalidatePath("/")
}

export async function deleteElement(id: string) {
  await db
    .update(elements)
    .set({
      isDeleted: true,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(elements.id, id))

  revalidatePath("/")
}

export async function archiveElement(id: string) {
  await db
    .update(elements)
    .set({
      isArchived: true,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(elements.id, id))

  revalidatePath("/")
}

export async function restoreElement(id: string) {
  await db
    .update(elements)
    .set({
      isDeleted: false,
      isArchived: false,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(elements.id, id))

  revalidatePath("/")
  revalidatePath("/trash")
}

export async function permanentlyDeleteElement(id: string) {
  await db.delete(elements).where(eq(elements.id, id))
  revalidatePath("/")
  revalidatePath("/trash")
}

export async function getDeletedElements() {
  return db
    .select()
    .from(elements)
    .where(eq(elements.isDeleted, true))
    .orderBy(desc(elements.updatedAt))
}

export async function getArchivedElements() {
  return db
    .select()
    .from(elements)
    .where(and(eq(elements.isArchived, true), eq(elements.isDeleted, false)))
    .orderBy(desc(elements.updatedAt))
}

export async function toggleFavorite(id: string) {
  const element = await getElement(id)
  if (!element) return

  await db
    .update(elements)
    .set({
      isFavorite: !element.isFavorite,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(elements.id, id))

  revalidatePath("/")
}

export async function getRecentElements(limit = 10) {
  return db
    .select()
    .from(elements)
    .where(
      and(
        eq(elements.isDeleted, false),
        eq(elements.isArchived, false)
      )
    )
    .orderBy(desc(elements.updatedAt))
    .limit(limit)
}

export async function getFavoriteElements() {
  return db
    .select()
    .from(elements)
    .where(
      and(
        eq(elements.isFavorite, true),
        eq(elements.isDeleted, false),
        eq(elements.isArchived, false)
      )
    )
    .orderBy(desc(elements.updatedAt))
}
