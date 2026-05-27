"use server"

import { db } from "@/lib/db"
import {
  forms,
  formFields,
  formSubmissions,
  formMappings,
  elements,
  tasks,
  taskStatuses,
} from "@/lib/db/schema"
import { createId } from "@/lib/utils/ids"
import { eq, desc, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"

// ─── Forms ──────────────────────────────────────────────────────────────

export async function createForm(data: {
  title: string
  description?: string
  icon?: string
  color?: string
  type: "task_intake" | "project_request" | "issue_report" | "approval_request" | "checklist_submission"
  isAnonymous?: boolean
  confirmationMessage?: string
  createdBy?: string
}) {
  const id = createId()
  const now = new Date().toISOString()

  await db.insert(forms).values({
    id,
    title: data.title,
    description: data.description ?? null,
    icon: data.icon ?? null,
    color: data.color ?? null,
    type: data.type,
    isAnonymous: data.isAnonymous ?? false,
    confirmationMessage: data.confirmationMessage ?? null,
    createdBy: data.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  })

  revalidatePath("/")
  return id
}

export async function getForms() {
  return db
    .select()
    .from(forms)
    .orderBy(desc(forms.updatedAt))
}

export async function getForm(id: string) {
  const formResult = await db
    .select()
    .from(forms)
    .where(eq(forms.id, id))
    .limit(1)

  if (formResult.length === 0) return null

  const fields = await db
    .select()
    .from(formFields)
    .where(eq(formFields.formId, id))
    .orderBy(formFields.sortOrder)

  const mappings = await db
    .select()
    .from(formMappings)
    .where(eq(formMappings.formId, id))

  return {
    ...formResult[0],
    fields,
    mappings,
  }
}

export async function updateForm(
  id: string,
  data: {
    title?: string
    description?: string
    icon?: string
    color?: string
    type?: "task_intake" | "project_request" | "issue_report" | "approval_request" | "checklist_submission"
    isAnonymous?: boolean
    confirmationMessage?: string
  }
) {
  const now = new Date().toISOString()
  await db
    .update(forms)
    .set({ ...data, updatedAt: now })
    .where(eq(forms.id, id))

  revalidatePath("/")
}

export async function deleteForm(id: string) {
  await db.delete(formSubmissions).where(eq(formSubmissions.formId, id))
  await db.delete(formFields).where(eq(formFields.formId, id))
  await db.delete(formMappings).where(eq(formMappings.formId, id))
  await db.delete(forms).where(eq(forms.id, id))

  revalidatePath("/")
}

export async function publishForm(id: string) {
  const now = new Date().toISOString()
  await db
    .update(forms)
    .set({ isPublished: true, updatedAt: now })
    .where(eq(forms.id, id))

  revalidatePath("/")
}

export async function unpublishForm(id: string) {
  const now = new Date().toISOString()
  await db
    .update(forms)
    .set({ isPublished: false, updatedAt: now })
    .where(eq(forms.id, id))

  revalidatePath("/")
}

// ─── Form Fields ────────────────────────────────────────────────────────

export async function addFormField(
  formId: string,
  data: {
    label: string
    fieldType: "text" | "long_text" | "number" | "date" | "select" | "multi_select" | "checkbox" | "email" | "url" | "phone" | "file" | "user" | "rating"
    placeholder?: string
    helpText?: string
    isRequired?: boolean
    options?: string
    config?: string
  }
) {
  const existing = await db
    .select()
    .from(formFields)
    .where(eq(formFields.formId, formId))

  const maxOrder = existing.length > 0
    ? Math.max(...existing.map((f) => f.sortOrder))
    : -1

  const id = createId()
  await db.insert(formFields).values({
    id,
    formId,
    label: data.label,
    fieldType: data.fieldType,
    placeholder: data.placeholder ?? null,
    helpText: data.helpText ?? null,
    isRequired: data.isRequired ?? false,
    options: data.options ?? null,
    config: data.config ?? null,
    sortOrder: maxOrder + 1,
  })

  const now = new Date().toISOString()
  await db.update(forms).set({ updatedAt: now }).where(eq(forms.id, formId))

  revalidatePath("/")
  return id
}

export async function updateFormField(
  id: string,
  data: {
    label?: string
    fieldType?: "text" | "long_text" | "number" | "date" | "select" | "multi_select" | "checkbox" | "email" | "url" | "phone" | "file" | "user" | "rating"
    placeholder?: string
    helpText?: string
    isRequired?: boolean
    options?: string
    config?: string
    sortOrder?: number
  }
) {
  await db.update(formFields).set(data).where(eq(formFields.id, id))
  revalidatePath("/")
}

export async function removeFormField(id: string) {
  await db.delete(formFields).where(eq(formFields.id, id))
  revalidatePath("/")
}

export async function reorderFormFields(
  updates: Array<{ id: string; sortOrder: number }>
) {
  for (const update of updates) {
    await db
      .update(formFields)
      .set({ sortOrder: update.sortOrder })
      .where(eq(formFields.id, update.id))
  }
  revalidatePath("/")
}

export async function getFormFields(formId: string) {
  return db
    .select()
    .from(formFields)
    .where(eq(formFields.formId, formId))
    .orderBy(formFields.sortOrder)
}

// ─── Form Submissions ───────────────────────────────────────────────────

export async function submitForm(
  formId: string,
  data: Record<string, unknown>,
  submittedBy?: string
) {
  const id = createId()
  const now = new Date().toISOString()

  await db.insert(formSubmissions).values({
    id,
    formId,
    data: JSON.stringify(data),
    submittedBy: submittedBy ?? null,
    status: "pending",
    createdAt: now,
  })

  // Increment submission count
  const formResult = await db
    .select()
    .from(forms)
    .where(eq(forms.id, formId))
    .limit(1)

  if (formResult.length > 0) {
    await db
      .update(forms)
      .set({
        submissionCount: formResult[0].submissionCount + 1,
        updatedAt: now,
      })
      .where(eq(forms.id, formId))
  }

  // Process mappings
  const mappings = await db
    .select()
    .from(formMappings)
    .where(eq(formMappings.formId, formId))

  for (const mapping of mappings) {
    if (mapping.action === "create_task" && mapping.targetProjectId) {
      const fieldMap: Record<string, string> = mapping.fieldMapping
        ? JSON.parse(mapping.fieldMapping)
        : {}

      // Resolve mapped field values from submission data
      const taskTitle = fieldMap.title ? (data[fieldMap.title] as string) : "Untitled Task"
      const taskDescription = fieldMap.description
        ? (data[fieldMap.description] as string)
        : undefined

      // Find the status to use
      let statusId = mapping.defaultStatusId
      if (!statusId) {
        const statuses = await db
          .select()
          .from(taskStatuses)
          .where(eq(taskStatuses.projectId, mapping.targetProjectId))
          .orderBy(taskStatuses.sortOrder)
          .limit(1)

        if (statuses.length > 0) {
          statusId = statuses[0].id
        }
      }

      if (statusId) {
        const taskId = createId()
        const existingTasks = await db
          .select()
          .from(tasks)
          .where(
            and(
              eq(tasks.projectId, mapping.targetProjectId),
              eq(tasks.statusId, statusId)
            )
          )

        const maxOrder = existingTasks.length > 0
          ? Math.max(...existingTasks.map((t) => t.sortOrder))
          : -1

        await db.insert(tasks).values({
          id: taskId,
          projectId: mapping.targetProjectId,
          statusId,
          title: taskTitle || "Untitled Task",
          description: taskDescription ?? null,
          assigneeId: mapping.defaultAssigneeId ?? null,
          sortOrder: maxOrder + 1,
          createdAt: now,
          updatedAt: now,
        })

        // Update the project element timestamp
        await db
          .update(elements)
          .set({ updatedAt: now })
          .where(eq(elements.id, mapping.targetProjectId))

        // Link submission to created task
        await db
          .update(formSubmissions)
          .set({ resultTaskId: taskId, status: "processed", processedAt: now })
          .where(eq(formSubmissions.id, id))

        revalidatePath(`/projects/${mapping.targetProjectId}`)
      }
    }
  }

  revalidatePath("/")
  return id
}

export async function getFormSubmissions(formId: string) {
  return db
    .select()
    .from(formSubmissions)
    .where(eq(formSubmissions.formId, formId))
    .orderBy(desc(formSubmissions.createdAt))
}

export async function processSubmission(id: string) {
  const now = new Date().toISOString()
  await db
    .update(formSubmissions)
    .set({ status: "processed", processedAt: now })
    .where(eq(formSubmissions.id, id))

  revalidatePath("/")
}

export async function rejectSubmission(id: string) {
  const now = new Date().toISOString()
  await db
    .update(formSubmissions)
    .set({ status: "rejected", processedAt: now })
    .where(eq(formSubmissions.id, id))

  revalidatePath("/")
}

// ─── Form Mappings ──────────────────────────────────────────────────────

export async function setFormMapping(
  formId: string,
  data: {
    action: "create_task" | "create_page" | "create_reminder" | "create_process"
    targetProjectId?: string
    defaultStatusId?: string
    defaultAssigneeId?: string
    fieldMapping?: string
    config?: string
  }
) {
  // Check if a mapping already exists for this form + action
  const existing = await db
    .select()
    .from(formMappings)
    .where(and(eq(formMappings.formId, formId), eq(formMappings.action, data.action)))

  if (existing.length > 0) {
    await db
      .update(formMappings)
      .set({
        targetProjectId: data.targetProjectId ?? null,
        defaultStatusId: data.defaultStatusId ?? null,
        defaultAssigneeId: data.defaultAssigneeId ?? null,
        fieldMapping: data.fieldMapping ?? null,
        config: data.config ?? null,
      })
      .where(eq(formMappings.id, existing[0].id))

    revalidatePath("/")
    return existing[0].id
  }

  const id = createId()
  await db.insert(formMappings).values({
    id,
    formId,
    action: data.action,
    targetProjectId: data.targetProjectId ?? null,
    defaultStatusId: data.defaultStatusId ?? null,
    defaultAssigneeId: data.defaultAssigneeId ?? null,
    fieldMapping: data.fieldMapping ?? null,
    config: data.config ?? null,
  })

  revalidatePath("/")
  return id
}

export async function removeFormMapping(id: string) {
  await db.delete(formMappings).where(eq(formMappings.id, id))
  revalidatePath("/")
}
