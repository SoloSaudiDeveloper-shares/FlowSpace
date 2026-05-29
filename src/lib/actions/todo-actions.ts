"use server"

import { db } from "@/lib/db"
import { todoItems, elements } from "@/lib/db/schema"
import { createId } from "@/lib/utils/ids"
import { eq, asc } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getTodoItems(listId: string) {
  return db
    .select()
    .from(todoItems)
    .where(eq(todoItems.listId, listId))
    .orderBy(asc(todoItems.sortOrder))
}

export async function createTodoItem(listId: string, title: string) {
  const existing = await getTodoItems(listId)
  const maxOrder = existing.length > 0
    ? Math.max(...existing.map((t) => t.sortOrder))
    : -1

  const id = createId()
  await db.insert(todoItems).values({
    id,
    listId,
    title,
    sortOrder: maxOrder + 1,
    createdAt: new Date().toISOString(),
  })
  await db
    .update(elements)
    .set({ updatedAt: new Date().toISOString() })
    .where(eq(elements.id, listId))

  revalidatePath(`/todos/${listId}`)
  return id
}

export async function updateTodoItem(
  id: string,
  listId: string,
  data: {
    title?: string
    isCompleted?: boolean
    sortOrder?: number
    dueDate?: string | null
    notes?: string | null
    /** "urgent" | "high" | "medium" | "low" | null. */
    priority?: "urgent" | "high" | "medium" | "low" | null
  }
) {
  const updateData: Record<string, unknown> = { ...data }
  if (data.isCompleted !== undefined) {
    updateData.completedAt = data.isCompleted ? new Date().toISOString() : null
  }

  await db.update(todoItems).set(updateData).where(eq(todoItems.id, id))
  await db
    .update(elements)
    .set({ updatedAt: new Date().toISOString() })
    .where(eq(elements.id, listId))

  revalidatePath(`/todos/${listId}`)
}

export async function deleteTodoItem(id: string, listId: string) {
  await db.delete(todoItems).where(eq(todoItems.id, id))
  await db
    .update(elements)
    .set({ updatedAt: new Date().toISOString() })
    .where(eq(elements.id, listId))

  revalidatePath(`/todos/${listId}`)
}
