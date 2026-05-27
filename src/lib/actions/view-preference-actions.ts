"use server"

import { db } from "@/lib/db"
import { viewPreferences } from "@/lib/db/schema"
import { createId } from "@/lib/utils/ids"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getViewPreference(
  elementId: string,
  viewType: "board" | "list" | "table"
) {
  const result = await db
    .select()
    .from(viewPreferences)
    .where(
      and(
        eq(viewPreferences.elementId, elementId),
        eq(viewPreferences.viewType, viewType)
      )
    )
    .limit(1)
  return result[0] ?? null
}

export async function getViewPreferences(elementId: string) {
  return db
    .select()
    .from(viewPreferences)
    .where(eq(viewPreferences.elementId, elementId))
}

export async function saveViewPreference(data: {
  elementId: string
  viewType: "board" | "list" | "table"
  hiddenFields?: string[]
  sortField?: string
  sortDirection?: "asc" | "desc"
  groupBy?: string
  filterJson?: string
}) {
  const existing = await getViewPreference(data.elementId, data.viewType)

  if (existing) {
    await db
      .update(viewPreferences)
      .set({
        hiddenFields: data.hiddenFields
          ? JSON.stringify(data.hiddenFields)
          : existing.hiddenFields,
        sortField: data.sortField ?? existing.sortField,
        sortDirection: data.sortDirection ?? existing.sortDirection,
        groupBy: data.groupBy ?? existing.groupBy,
        filterJson: data.filterJson ?? existing.filterJson,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(viewPreferences.id, existing.id))
  } else {
    await db.insert(viewPreferences).values({
      id: createId(),
      elementId: data.elementId,
      viewType: data.viewType,
      hiddenFields: data.hiddenFields
        ? JSON.stringify(data.hiddenFields)
        : null,
      sortField: data.sortField ?? null,
      sortDirection: data.sortDirection ?? null,
      groupBy: data.groupBy ?? null,
      filterJson: data.filterJson ?? null,
    })
  }

  revalidatePath("/")
}

export async function deleteViewPreference(id: string) {
  await db.delete(viewPreferences).where(eq(viewPreferences.id, id))
  revalidatePath("/")
}
