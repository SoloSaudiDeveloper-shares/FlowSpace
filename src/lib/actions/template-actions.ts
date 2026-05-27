"use server"

import { db } from "@/lib/db"
import {
  templates,
  templateItems,
  elements,
  pages,
  projects,
  taskStatuses,
  canvases,
  processes,
  processSteps,
  todoLists,
  tasks,
} from "@/lib/db/schema"
import { createId } from "@/lib/utils/ids"
import { eq, desc, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"

// ─── Template CRUD ──────────────────────────────────────────────────────

export async function createTemplate(data: {
  name: string
  description?: string
  type: "project" | "task" | "checklist" | "page" | "canvas" | "process" | "dashboard" | "form"
  icon?: string
  color?: string
  content?: string
  createdBy?: string
}) {
  const id = createId()
  const now = new Date().toISOString()

  await db.insert(templates).values({
    id,
    name: data.name,
    description: data.description ?? null,
    type: data.type,
    icon: data.icon ?? null,
    color: data.color ?? null,
    content: data.content ?? null,
    createdBy: data.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  })

  revalidatePath("/")
  return id
}

export async function getTemplates(type?: string) {
  if (type) {
    return db
      .select()
      .from(templates)
      .where(
        and(
          eq(templates.isPublished, true),
          eq(templates.type, type as typeof templates.$inferSelect["type"])
        )
      )
      .orderBy(desc(templates.usageCount), desc(templates.createdAt))
  }

  return db
    .select()
    .from(templates)
    .where(eq(templates.isPublished, true))
    .orderBy(desc(templates.usageCount), desc(templates.createdAt))
}

export async function getTemplate(id: string) {
  const result = await db
    .select()
    .from(templates)
    .where(eq(templates.id, id))
    .limit(1)

  const template = result[0] ?? null
  if (!template) return null

  const items = await db
    .select()
    .from(templateItems)
    .where(eq(templateItems.templateId, id))
    .orderBy(templateItems.sortOrder)

  return { ...template, items }
}

export async function updateTemplate(
  id: string,
  data: {
    name?: string
    description?: string
    icon?: string
    color?: string
    content?: string
    isPublished?: boolean
  }
) {
  await db
    .update(templates)
    .set({
      ...data,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(templates.id, id))

  revalidatePath("/")
}

export async function deleteTemplate(id: string) {
  await db.delete(templateItems).where(eq(templateItems.templateId, id))
  await db.delete(templates).where(eq(templates.id, id))
  revalidatePath("/")
}

export async function toggleTemplateFavorite(id: string) {
  const result = await db
    .select()
    .from(templates)
    .where(eq(templates.id, id))
    .limit(1)

  const template = result[0]
  if (!template) return

  await db
    .update(templates)
    .set({
      isFavorite: !template.isFavorite,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(templates.id, id))

  revalidatePath("/")
}

// ─── Template Items ─────────────────────────────────────────────────────

export async function addTemplateItem(
  templateId: string,
  data: {
    itemType: "task" | "subtask" | "checklist" | "checklist_item" | "label" | "status" | "step" | "field"
    title: string
    description?: string
    config?: string
    sortOrder?: number
    parentItemId?: string
  }
) {
  const id = createId()

  let sortOrder = data.sortOrder
  if (sortOrder === undefined) {
    const existing = await db
      .select()
      .from(templateItems)
      .where(eq(templateItems.templateId, templateId))
    sortOrder =
      existing.length > 0
        ? Math.max(...existing.map((i) => i.sortOrder)) + 1
        : 0
  }

  await db.insert(templateItems).values({
    id,
    templateId,
    itemType: data.itemType,
    title: data.title,
    description: data.description ?? null,
    config: data.config ?? null,
    sortOrder,
    parentItemId: data.parentItemId ?? null,
  })

  revalidatePath("/")
  return id
}

export async function updateTemplateItem(
  id: string,
  data: {
    itemType?: "task" | "subtask" | "checklist" | "checklist_item" | "label" | "status" | "step" | "field"
    title?: string
    description?: string
    config?: string
    sortOrder?: number
    parentItemId?: string
  }
) {
  await db
    .update(templateItems)
    .set(data)
    .where(eq(templateItems.id, id))

  revalidatePath("/")
}

export async function removeTemplateItem(id: string) {
  await db.delete(templateItems).where(eq(templateItems.id, id))
  revalidatePath("/")
}

export async function getTemplateItems(templateId: string) {
  return db
    .select()
    .from(templateItems)
    .where(eq(templateItems.templateId, templateId))
    .orderBy(templateItems.sortOrder)
}

// ─── Create from Template ───────────────────────────────────────────────

export async function createFromTemplate(
  templateId: string,
  overrides?: { title?: string; projectId?: string }
): Promise<{ id: string; type: string }> {
  const result = await db
    .select()
    .from(templates)
    .where(eq(templates.id, templateId))
    .limit(1)

  const template = result[0]
  if (!template) throw new Error("Template not found")

  const items = await db
    .select()
    .from(templateItems)
    .where(eq(templateItems.templateId, templateId))
    .orderBy(templateItems.sortOrder)

  const now = new Date().toISOString()
  const title = overrides?.title || template.name
  let contentJson: Record<string, unknown> = {}

  if (template.content) {
    try {
      contentJson = JSON.parse(template.content)
    } catch {
      // ignore malformed JSON
    }
  }

  let createdId: string
  let createdType: string = template.type

  switch (template.type) {
    case "project": {
      const id = createId()

      // Insert element
      await db.insert(elements).values({
        id,
        type: "project",
        title,
        icon: template.icon || "FolderKanban",
        color: template.color || "#6366f1",
        createdAt: now,
        updatedAt: now,
      })

      // Insert project record
      await db.insert(projects).values({ id })

      // Create statuses from content JSON or template items
      const statusItems = items.filter((i) => i.itemType === "status")
      const contentStatuses = (contentJson.statuses as { name: string; color: string }[]) || []

      const statusIdMap: string[] = []

      if (contentStatuses.length > 0) {
        for (let i = 0; i < contentStatuses.length; i++) {
          const statusId = createId()
          statusIdMap.push(statusId)
          await db.insert(taskStatuses).values({
            id: statusId,
            projectId: id,
            name: contentStatuses[i].name,
            color: contentStatuses[i].color,
            sortOrder: i,
            isDoneState: i === contentStatuses.length - 1,
          })
        }
      } else if (statusItems.length > 0) {
        for (let i = 0; i < statusItems.length; i++) {
          const statusId = createId()
          statusIdMap.push(statusId)
          let statusColor = "#94a3b8"
          try {
            const cfg = statusItems[i].config ? JSON.parse(statusItems[i].config!) : null
            if (cfg?.color) statusColor = cfg.color
          } catch {}
          await db.insert(taskStatuses).values({
            id: statusId,
            projectId: id,
            name: statusItems[i].title,
            color: statusColor,
            sortOrder: i,
            isDoneState: i === statusItems.length - 1,
          })
        }
      } else {
        // Default statuses
        const defaults = [
          { name: "To Do", color: "#94a3b8", isDoneState: false },
          { name: "In Progress", color: "#3b82f6", isDoneState: false },
          { name: "Done", color: "#22c55e", isDoneState: true },
        ]
        for (let i = 0; i < defaults.length; i++) {
          const statusId = createId()
          statusIdMap.push(statusId)
          await db.insert(taskStatuses).values({
            id: statusId,
            projectId: id,
            name: defaults[i].name,
            color: defaults[i].color,
            sortOrder: i,
            isDoneState: defaults[i].isDoneState,
          })
        }
      }

      // Create tasks from content JSON
      const contentTasks = (contentJson.tasks as { title: string; priority?: string; statusIndex?: number }[]) || []
      if (contentTasks.length > 0 && statusIdMap.length > 0) {
        for (let i = 0; i < contentTasks.length; i++) {
          const taskStatusIndex = contentTasks[i].statusIndex ?? 0
          const statusId = statusIdMap[Math.min(taskStatusIndex, statusIdMap.length - 1)]
          await db.insert(tasks).values({
            id: createId(),
            projectId: id,
            statusId,
            title: contentTasks[i].title,
            priority: (contentTasks[i].priority as "urgent" | "high" | "medium" | "low" | "none") || "none",
            sortOrder: i,
            createdAt: now,
            updatedAt: now,
          })
        }
      }

      // Create tasks from template items
      const taskItems = items.filter((i) => i.itemType === "task")
      if (contentTasks.length === 0 && taskItems.length > 0 && statusIdMap.length > 0) {
        for (let i = 0; i < taskItems.length; i++) {
          let priority: "urgent" | "high" | "medium" | "low" | "none" = "none"
          let statusIndex = 0
          try {
            const cfg = taskItems[i].config ? JSON.parse(taskItems[i].config!) : null
            if (cfg?.priority) priority = cfg.priority
            if (cfg?.statusIndex !== undefined) statusIndex = cfg.statusIndex
          } catch {}
          const statusId = statusIdMap[Math.min(statusIndex, statusIdMap.length - 1)]
          await db.insert(tasks).values({
            id: createId(),
            projectId: id,
            statusId,
            title: taskItems[i].title,
            description: taskItems[i].description ?? null,
            priority,
            sortOrder: i,
            createdAt: now,
            updatedAt: now,
          })
        }
      }

      createdId = id
      break
    }

    case "page": {
      const id = createId()

      await db.insert(elements).values({
        id,
        type: "page",
        title,
        icon: template.icon || "FileText",
        color: template.color || "#8b5cf6",
        createdAt: now,
        updatedAt: now,
      })

      await db.insert(pages).values({
        id,
        content: template.content ?? null,
      })

      createdId = id
      break
    }

    case "canvas": {
      const id = createId()

      await db.insert(elements).values({
        id,
        type: "canvas",
        title,
        icon: template.icon || "Layout",
        color: template.color || "#06b6d4",
        createdAt: now,
        updatedAt: now,
      })

      await db.insert(canvases).values({ id })

      createdId = id
      break
    }

    case "process": {
      const id = createId()

      await db.insert(elements).values({
        id,
        type: "process",
        title,
        icon: template.icon || "GitBranch",
        color: template.color || "#ec4899",
        createdAt: now,
        updatedAt: now,
      })

      await db.insert(processes).values({ id })

      // Create steps from template items
      const stepItems = items.filter((i) => i.itemType === "step")
      for (let i = 0; i < stepItems.length; i++) {
        await db.insert(processSteps).values({
          id: createId(),
          processId: id,
          title: stepItems[i].title,
          description: stepItems[i].description ?? null,
          sortOrder: i,
          createdAt: now,
        })
      }

      createdId = id
      break
    }

    case "task": {
      // Tasks are created within a project, return the config for the caller to use
      createdId = templateId
      createdType = "task"

      // Increment usage and return early
      await db
        .update(templates)
        .set({
          usageCount: template.usageCount + 1,
          lastUsedAt: now,
          updatedAt: now,
        })
        .where(eq(templates.id, templateId))

      revalidatePath("/")
      return {
        id: createdId,
        type: createdType,
        ...(contentJson as object),
      } as { id: string; type: string }
    }

    case "checklist": {
      // Checklists are embedded in tasks, return the items config
      const checklistItems = items.filter(
        (i) => i.itemType === "checklist_item" || i.itemType === "checklist"
      )
      createdId = templateId
      createdType = "checklist"

      await db
        .update(templates)
        .set({
          usageCount: template.usageCount + 1,
          lastUsedAt: now,
          updatedAt: now,
        })
        .where(eq(templates.id, templateId))

      revalidatePath("/")
      return {
        id: createdId,
        type: createdType,
        items: checklistItems.map((i) => ({
          title: i.title,
          description: i.description,
          config: i.config,
        })),
      } as { id: string; type: string }
    }

    default: {
      // dashboard, form, or any future types - create a generic element-like stub
      createdId = templateId
      createdType = template.type

      await db
        .update(templates)
        .set({
          usageCount: template.usageCount + 1,
          lastUsedAt: now,
          updatedAt: now,
        })
        .where(eq(templates.id, templateId))

      revalidatePath("/")
      return { id: createdId, type: createdType }
    }
  }

  // Increment usage count and set lastUsedAt
  await db
    .update(templates)
    .set({
      usageCount: template.usageCount + 1,
      lastUsedAt: now,
      updatedAt: now,
    })
    .where(eq(templates.id, templateId))

  revalidatePath("/")
  return { id: createdId, type: createdType }
}

// ─── Duplicate Template ─────────────────────────────────────────────────

export async function duplicateTemplate(id: string) {
  const result = await db
    .select()
    .from(templates)
    .where(eq(templates.id, id))
    .limit(1)

  const template = result[0]
  if (!template) return null

  const newId = createId()
  const now = new Date().toISOString()

  await db.insert(templates).values({
    id: newId,
    name: `${template.name} (Copy)`,
    description: template.description,
    type: template.type,
    icon: template.icon,
    color: template.color,
    content: template.content,
    isFavorite: false,
    isPublished: false,
    usageCount: 0,
    createdBy: template.createdBy,
    lastUsedAt: null,
    createdAt: now,
    updatedAt: now,
  })

  // Clone template items
  const items = await db
    .select()
    .from(templateItems)
    .where(eq(templateItems.templateId, id))
    .orderBy(templateItems.sortOrder)

  // Map old item IDs to new IDs for parentItemId references
  const idMap: Record<string, string> = {}
  for (const item of items) {
    idMap[item.id] = createId()
  }

  for (const item of items) {
    await db.insert(templateItems).values({
      id: idMap[item.id],
      templateId: newId,
      itemType: item.itemType,
      title: item.title,
      description: item.description,
      config: item.config,
      sortOrder: item.sortOrder,
      parentItemId: item.parentItemId ? (idMap[item.parentItemId] ?? null) : null,
    })
  }

  revalidatePath("/")
  return newId
}

// ─── Query Helpers ──────────────────────────────────────────────────────

export async function getRecentTemplates(limit = 10) {
  return db
    .select()
    .from(templates)
    .where(eq(templates.isPublished, true))
    .orderBy(desc(templates.lastUsedAt))
    .limit(limit)
}

export async function getFavoriteTemplates() {
  return db
    .select()
    .from(templates)
    .where(
      and(
        eq(templates.isFavorite, true),
        eq(templates.isPublished, true)
      )
    )
    .orderBy(desc(templates.updatedAt))
}
