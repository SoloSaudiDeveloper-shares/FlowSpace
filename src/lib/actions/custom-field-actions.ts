"use server"

import { db } from "@/lib/db"
import {
  customFieldDefinitions,
  customFieldOptions,
  customFieldValues,
  customFieldScopes,
} from "@/lib/db/schema"
import { createId } from "@/lib/utils/ids"
import { eq, and, desc, or, asc, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"

// ─── Field Definitions ──────────────────────────────────────────────────

export async function createField(data: {
  name: string
  fieldType: string
  description?: string
  icon?: string
  color?: string
  config?: string
  isRequired?: boolean
  groupName?: string
  createdBy?: string
}) {
  const id = createId()
  const now = new Date().toISOString()

  await db.insert(customFieldDefinitions).values({
    id,
    name: data.name,
    fieldType: data.fieldType as typeof customFieldDefinitions.$inferInsert.fieldType,
    description: data.description ?? null,
    icon: data.icon ?? null,
    color: data.color ?? null,
    config: data.config ?? null,
    isRequired: data.isRequired ?? false,
    groupName: data.groupName ?? null,
    createdBy: data.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  })

  revalidatePath("/")
  return id
}

export async function getFields(scopeType?: string, scopeValue?: string) {
  if (scopeType) {
    // Get field IDs matching the scope
    const conditions = scopeValue
      ? and(
          eq(customFieldScopes.scopeType, scopeType as typeof customFieldScopes.$inferSelect.scopeType),
          eq(customFieldScopes.scopeValue, scopeValue),
        )
      : eq(customFieldScopes.scopeType, scopeType as typeof customFieldScopes.$inferSelect.scopeType)

    const scopes = await db
      .select({ fieldId: customFieldScopes.fieldId })
      .from(customFieldScopes)
      .where(conditions)

    if (scopes.length === 0) return []

    const fieldIds = scopes.map((s) => s.fieldId)
    const fields = await db
      .select()
      .from(customFieldDefinitions)
      .where(inArray(customFieldDefinitions.id, fieldIds))
      .orderBy(asc(customFieldDefinitions.sortOrder))

    // Attach options to each field
    const result = []
    for (const field of fields) {
      const options = await db
        .select()
        .from(customFieldOptions)
        .where(eq(customFieldOptions.fieldId, field.id))
        .orderBy(asc(customFieldOptions.sortOrder))
      result.push({ ...field, options })
    }
    return result
  }

  // No scope filter — return all fields
  const fields = await db
    .select()
    .from(customFieldDefinitions)
    .orderBy(asc(customFieldDefinitions.sortOrder))

  const result = []
  for (const field of fields) {
    const options = await db
      .select()
      .from(customFieldOptions)
      .where(eq(customFieldOptions.fieldId, field.id))
      .orderBy(asc(customFieldOptions.sortOrder))
    result.push({ ...field, options })
  }
  return result
}

export async function getField(id: string) {
  const fieldResult = await db
    .select()
    .from(customFieldDefinitions)
    .where(eq(customFieldDefinitions.id, id))
    .limit(1)

  const field = fieldResult[0] ?? null
  if (!field) return null

  const options = await db
    .select()
    .from(customFieldOptions)
    .where(eq(customFieldOptions.fieldId, id))
    .orderBy(asc(customFieldOptions.sortOrder))

  const scopes = await db
    .select()
    .from(customFieldScopes)
    .where(eq(customFieldScopes.fieldId, id))

  return { ...field, options, scopes }
}

export async function updateField(
  id: string,
  data: {
    name?: string
    description?: string | null
    fieldType?: string
    icon?: string | null
    color?: string | null
    config?: string | null
    isRequired?: boolean
    sortOrder?: number
    groupName?: string | null
  },
) {
  const updateData: Record<string, unknown> = {
    ...data,
    updatedAt: new Date().toISOString(),
  }

  await db
    .update(customFieldDefinitions)
    .set(updateData)
    .where(eq(customFieldDefinitions.id, id))

  revalidatePath("/")
}

export async function deleteField(id: string) {
  // Cascade handled by FK constraints, but delete explicitly for safety
  await db.delete(customFieldValues).where(eq(customFieldValues.fieldId, id))
  await db.delete(customFieldOptions).where(eq(customFieldOptions.fieldId, id))
  await db.delete(customFieldScopes).where(eq(customFieldScopes.fieldId, id))
  await db.delete(customFieldDefinitions).where(eq(customFieldDefinitions.id, id))

  revalidatePath("/")
}

export async function reorderFields(updates: Array<{ id: string; sortOrder: number }>) {
  for (const update of updates) {
    await db
      .update(customFieldDefinitions)
      .set({ sortOrder: update.sortOrder, updatedAt: new Date().toISOString() })
      .where(eq(customFieldDefinitions.id, update.id))
  }

  revalidatePath("/")
}

// ─── Field Options ──────────────────────────────────────────────────────

export async function addFieldOption(
  fieldId: string,
  data: { label: string; color?: string; sortOrder?: number },
) {
  const id = createId()

  let sortOrder = data.sortOrder
  if (sortOrder === undefined) {
    const existing = await db
      .select()
      .from(customFieldOptions)
      .where(eq(customFieldOptions.fieldId, fieldId))
    sortOrder =
      existing.length > 0
        ? Math.max(...existing.map((o) => o.sortOrder)) + 1
        : 0
  }

  await db.insert(customFieldOptions).values({
    id,
    fieldId,
    label: data.label,
    color: data.color ?? null,
    sortOrder,
  })

  revalidatePath("/")
  return id
}

export async function updateFieldOption(
  id: string,
  data: { label?: string; color?: string | null; sortOrder?: number },
) {
  await db
    .update(customFieldOptions)
    .set(data)
    .where(eq(customFieldOptions.id, id))

  revalidatePath("/")
}

export async function removeFieldOption(id: string) {
  await db.delete(customFieldOptions).where(eq(customFieldOptions.id, id))
  revalidatePath("/")
}

export async function getFieldOptions(fieldId: string) {
  return db
    .select()
    .from(customFieldOptions)
    .where(eq(customFieldOptions.fieldId, fieldId))
    .orderBy(asc(customFieldOptions.sortOrder))
}

// ─── Field Values ───────────────────────────────────────────────────────

export async function setFieldValue(data: {
  fieldId: string
  entityType: "element" | "task"
  entityId: string
  value: string | null
}) {
  const now = new Date().toISOString()

  // Check for existing value
  const existing = await db
    .select()
    .from(customFieldValues)
    .where(
      and(
        eq(customFieldValues.fieldId, data.fieldId),
        eq(customFieldValues.entityType, data.entityType),
        eq(customFieldValues.entityId, data.entityId),
      ),
    )
    .limit(1)

  if (existing.length > 0) {
    // Update existing value
    await db
      .update(customFieldValues)
      .set({ value: data.value, updatedAt: now })
      .where(eq(customFieldValues.id, existing[0].id))

    revalidatePath("/")
    return existing[0].id
  }

  // Insert new value
  const id = createId()
  await db.insert(customFieldValues).values({
    id,
    fieldId: data.fieldId,
    entityType: data.entityType,
    entityId: data.entityId,
    value: data.value,
    createdAt: now,
    updatedAt: now,
  })

  revalidatePath("/")
  return id
}

export async function getFieldValues(entityType: string, entityId: string) {
  const values = await db
    .select({
      value: customFieldValues,
      field: customFieldDefinitions,
    })
    .from(customFieldValues)
    .innerJoin(
      customFieldDefinitions,
      eq(customFieldValues.fieldId, customFieldDefinitions.id),
    )
    .where(
      and(
        eq(customFieldValues.entityType, entityType as typeof customFieldValues.$inferSelect.entityType),
        eq(customFieldValues.entityId, entityId),
      ),
    )
    .orderBy(asc(customFieldDefinitions.sortOrder))

  return values
}

export async function getFieldValuesByField(fieldId: string) {
  return db
    .select()
    .from(customFieldValues)
    .where(eq(customFieldValues.fieldId, fieldId))
    .orderBy(desc(customFieldValues.updatedAt))
}

export async function deleteFieldValue(id: string) {
  await db.delete(customFieldValues).where(eq(customFieldValues.id, id))
  revalidatePath("/")
}

// ─── Field Scopes ───────────────────────────────────────────────────────

export async function addFieldScope(
  fieldId: string,
  scopeType: string,
  scopeValue?: string,
) {
  const id = createId()

  await db.insert(customFieldScopes).values({
    id,
    fieldId,
    scopeType: scopeType as typeof customFieldScopes.$inferInsert.scopeType,
    scopeValue: scopeValue ?? null,
  })

  revalidatePath("/")
  return id
}

export async function removeFieldScope(id: string) {
  await db.delete(customFieldScopes).where(eq(customFieldScopes.id, id))
  revalidatePath("/")
}

// ─── Composite Queries ──────────────────────────────────────────────────

export async function getFieldsForProject(projectId: string) {
  // Get fields scoped to this project OR globally scoped
  const scopes = await db
    .select({ fieldId: customFieldScopes.fieldId })
    .from(customFieldScopes)
    .where(
      or(
        eq(customFieldScopes.scopeType, "global"),
        and(
          eq(customFieldScopes.scopeType, "project"),
          eq(customFieldScopes.scopeValue, projectId),
        ),
      ),
    )

  if (scopes.length === 0) {
    // Also return fields with no scope (implicitly global)
    const allFields = await db
      .select()
      .from(customFieldDefinitions)
      .orderBy(asc(customFieldDefinitions.sortOrder))

    const result = []
    for (const field of allFields) {
      const fieldScopes = await db
        .select()
        .from(customFieldScopes)
        .where(eq(customFieldScopes.fieldId, field.id))

      // Include fields that have no scopes (implicitly available everywhere)
      if (fieldScopes.length === 0) {
        const options = await db
          .select()
          .from(customFieldOptions)
          .where(eq(customFieldOptions.fieldId, field.id))
          .orderBy(asc(customFieldOptions.sortOrder))
        result.push({ ...field, options })
      }
    }
    return result
  }

  const fieldIds = [...new Set(scopes.map((s) => s.fieldId))]

  // Also include fields with no scopes
  const allFields = await db
    .select()
    .from(customFieldDefinitions)
    .orderBy(asc(customFieldDefinitions.sortOrder))

  const unscopedFieldIds: string[] = []
  for (const field of allFields) {
    const fieldScopes = await db
      .select()
      .from(customFieldScopes)
      .where(eq(customFieldScopes.fieldId, field.id))
    if (fieldScopes.length === 0) {
      unscopedFieldIds.push(field.id)
    }
  }

  const combinedIds = [...new Set([...fieldIds, ...unscopedFieldIds])]
  if (combinedIds.length === 0) return []

  const fields = await db
    .select()
    .from(customFieldDefinitions)
    .where(inArray(customFieldDefinitions.id, combinedIds))
    .orderBy(asc(customFieldDefinitions.sortOrder))

  const result = []
  for (const field of fields) {
    const options = await db
      .select()
      .from(customFieldOptions)
      .where(eq(customFieldOptions.fieldId, field.id))
      .orderBy(asc(customFieldOptions.sortOrder))
    result.push({ ...field, options })
  }
  return result
}

export async function getFieldsForEntity(
  entityType: string,
  entityId: string,
  projectId?: string,
) {
  // Get applicable fields
  let fields: Awaited<ReturnType<typeof getFields>>

  if (projectId) {
    fields = await getFieldsForProject(projectId)
  } else {
    fields = await getFields()
  }

  // Get current values for this entity
  const values = await db
    .select()
    .from(customFieldValues)
    .where(
      and(
        eq(customFieldValues.entityType, entityType as typeof customFieldValues.$inferSelect.entityType),
        eq(customFieldValues.entityId, entityId),
      ),
    )

  const valueMap = new Map(values.map((v) => [v.fieldId, v]))

  return fields.map((field) => ({
    ...field,
    currentValue: valueMap.get(field.id) ?? null,
  }))
}
