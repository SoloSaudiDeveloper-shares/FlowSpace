"use server"

import { db } from "@/lib/db"
import { processSteps, elements } from "@/lib/db/schema"
import { createId } from "@/lib/utils/ids"
import { eq, asc } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getProcessSteps(processId: string) {
  return db
    .select()
    .from(processSteps)
    .where(eq(processSteps.processId, processId))
    .orderBy(asc(processSteps.sortOrder))
}

export async function createProcessStep(processId: string, title: string) {
  const existing = await getProcessSteps(processId)
  const maxOrder = existing.length > 0
    ? Math.max(...existing.map((s) => s.sortOrder))
    : -1

  const id = createId()
  await db.insert(processSteps).values({
    id,
    processId,
    title,
    sortOrder: maxOrder + 1,
    createdAt: new Date().toISOString(),
  })
  await db
    .update(elements)
    .set({ updatedAt: new Date().toISOString() })
    .where(eq(elements.id, processId))

  revalidatePath(`/process/${processId}`)
  return id
}

export async function updateProcessStep(
  id: string,
  processId: string,
  data: {
    title?: string
    description?: string
    isCompleted?: boolean
    sortOrder?: number
  }
) {
  const updateData: Record<string, unknown> = { ...data }
  if (data.isCompleted !== undefined) {
    updateData.completedAt = data.isCompleted ? new Date().toISOString() : null
  }

  await db.update(processSteps).set(updateData).where(eq(processSteps.id, id))
  await db
    .update(elements)
    .set({ updatedAt: new Date().toISOString() })
    .where(eq(elements.id, processId))

  revalidatePath(`/process/${processId}`)
}

export async function deleteProcessStep(id: string, processId: string) {
  await db.delete(processSteps).where(eq(processSteps.id, id))
  await db
    .update(elements)
    .set({ updatedAt: new Date().toISOString() })
    .where(eq(elements.id, processId))

  revalidatePath(`/process/${processId}`)
}
