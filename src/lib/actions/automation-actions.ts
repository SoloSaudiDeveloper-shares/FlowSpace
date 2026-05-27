"use server"

import { db } from "@/lib/db"
import {
  automations,
  automationConditions,
  automationActions,
  automationRuns,
  automationLogs,
  elements,
  tasks,
  taskStatuses,
  notifications,
  taskLabels,
  taskToLabels,
  taskComments,
  reminders,
} from "@/lib/db/schema"
import { createId } from "@/lib/utils/ids"
import { eq, desc, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { createElement } from "@/lib/actions/element-actions"
import { createFromTemplate } from "@/lib/actions/template-actions"

// ─── Automations ────────────────────────────────────────────────────────

export async function createAutomation(data: {
  name: string
  description?: string
  trigger: "task_created" | "task_updated" | "status_changed" | "due_date_reached" | "reminder_triggered" | "comment_added" | "dependency_resolved" | "form_submitted" | "element_linked" | "page_created" | "attachment_uploaded"
  projectId?: string
  createdBy?: string
}) {
  const id = createId()
  const now = new Date().toISOString()

  await db.insert(automations).values({
    id,
    name: data.name,
    description: data.description ?? null,
    trigger: data.trigger,
    isActive: true,
    projectId: data.projectId ?? null,
    createdBy: data.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  })

  revalidatePath("/")
  return id
}

export async function getAutomations(projectId?: string) {
  if (projectId) {
    return db
      .select()
      .from(automations)
      .where(eq(automations.projectId, projectId))
      .orderBy(desc(automations.updatedAt))
  }
  return db
    .select()
    .from(automations)
    .orderBy(desc(automations.updatedAt))
}

export async function getAutomation(id: string) {
  const result = await db
    .select()
    .from(automations)
    .where(eq(automations.id, id))
    .limit(1)

  if (result.length === 0) return null

  const conditions = await db
    .select()
    .from(automationConditions)
    .where(eq(automationConditions.automationId, id))
    .orderBy(automationConditions.sortOrder)

  const actions = await db
    .select()
    .from(automationActions)
    .where(eq(automationActions.automationId, id))
    .orderBy(automationActions.sortOrder)

  return {
    ...result[0],
    conditions,
    actions,
  }
}

export async function updateAutomation(
  id: string,
  data: {
    name?: string
    description?: string
    trigger?: "task_created" | "task_updated" | "status_changed" | "due_date_reached" | "reminder_triggered" | "comment_added" | "dependency_resolved" | "form_submitted" | "element_linked" | "page_created" | "attachment_uploaded"
    projectId?: string
  }
) {
  const now = new Date().toISOString()
  await db
    .update(automations)
    .set({ ...data, updatedAt: now })
    .where(eq(automations.id, id))

  revalidatePath("/")
}

export async function deleteAutomation(id: string) {
  // Clean up logs for each run, then runs, then conditions/actions, then the automation
  const runs = await db
    .select()
    .from(automationRuns)
    .where(eq(automationRuns.automationId, id))

  for (const run of runs) {
    await db.delete(automationLogs).where(eq(automationLogs.runId, run.id))
  }
  await db.delete(automationRuns).where(eq(automationRuns.automationId, id))
  await db.delete(automationActions).where(eq(automationActions.automationId, id))
  await db.delete(automationConditions).where(eq(automationConditions.automationId, id))
  await db.delete(automations).where(eq(automations.id, id))

  revalidatePath("/")
}

export async function toggleAutomation(id: string) {
  const result = await db
    .select()
    .from(automations)
    .where(eq(automations.id, id))
    .limit(1)

  if (result.length === 0) return

  const now = new Date().toISOString()
  await db
    .update(automations)
    .set({ isActive: !result[0].isActive, updatedAt: now })
    .where(eq(automations.id, id))

  revalidatePath("/")
}

// ─── Conditions ─────────────────────────────────────────────────────────

export async function addCondition(
  automationId: string,
  data: {
    field: string
    operator: "equals" | "not_equals" | "contains" | "not_contains" | "greater_than" | "less_than" | "is_empty" | "is_not_empty"
    value: string
    logicGate?: "and" | "or"
  }
) {
  const existing = await db
    .select()
    .from(automationConditions)
    .where(eq(automationConditions.automationId, automationId))

  const maxOrder = existing.length > 0
    ? Math.max(...existing.map((c) => c.sortOrder))
    : -1

  const id = createId()
  await db.insert(automationConditions).values({
    id,
    automationId,
    field: data.field,
    operator: data.operator,
    value: data.value,
    logicGate: data.logicGate ?? "and",
    sortOrder: maxOrder + 1,
  })

  const now = new Date().toISOString()
  await db.update(automations).set({ updatedAt: now }).where(eq(automations.id, automationId))

  revalidatePath("/")
  return id
}

export async function updateCondition(
  id: string,
  data: {
    field?: string
    operator?: "equals" | "not_equals" | "contains" | "not_contains" | "greater_than" | "less_than" | "is_empty" | "is_not_empty"
    value?: string
    logicGate?: "and" | "or"
    sortOrder?: number
  }
) {
  await db.update(automationConditions).set(data).where(eq(automationConditions.id, id))
  revalidatePath("/")
}

export async function removeCondition(id: string) {
  await db.delete(automationConditions).where(eq(automationConditions.id, id))
  revalidatePath("/")
}

// ─── Actions ────────────────────────────────────────────────────────────

export async function addAction(
  automationId: string,
  data: {
    actionType: "create_task" | "update_status" | "assign_user" | "add_label" | "post_notification" | "create_reminder" | "update_priority" | "add_comment" | "duplicate_template"
    config: string
  }
) {
  const existing = await db
    .select()
    .from(automationActions)
    .where(eq(automationActions.automationId, automationId))

  const maxOrder = existing.length > 0
    ? Math.max(...existing.map((a) => a.sortOrder))
    : -1

  const id = createId()
  await db.insert(automationActions).values({
    id,
    automationId,
    actionType: data.actionType,
    config: data.config,
    sortOrder: maxOrder + 1,
  })

  const now = new Date().toISOString()
  await db.update(automations).set({ updatedAt: now }).where(eq(automations.id, automationId))

  revalidatePath("/")
  return id
}

export async function updateAction(
  id: string,
  data: {
    actionType?: "create_task" | "update_status" | "assign_user" | "add_label" | "post_notification" | "create_reminder" | "update_priority" | "add_comment" | "duplicate_template"
    config?: string
    sortOrder?: number
  }
) {
  await db.update(automationActions).set(data).where(eq(automationActions.id, id))
  revalidatePath("/")
}

export async function removeAction(id: string) {
  await db.delete(automationActions).where(eq(automationActions.id, id))
  revalidatePath("/")
}

// ─── Execution Engine ───────────────────────────────────────────────────

function checkConditions(
  conditions: Array<{
    field: string
    operator: string
    value: string
    logicGate: string
  }>,
  triggerData: Record<string, unknown>
): boolean {
  if (conditions.length === 0) return true

  const results: boolean[] = conditions.map((condition) => {
    const actual = triggerData[condition.field]
    const expected = condition.value

    switch (condition.operator) {
      case "equals":
        return String(actual) === expected
      case "not_equals":
        return String(actual) !== expected
      case "contains":
        return String(actual ?? "").includes(expected)
      case "not_contains":
        return !String(actual ?? "").includes(expected)
      case "greater_than":
        return Number(actual) > Number(expected)
      case "less_than":
        return Number(actual) < Number(expected)
      case "is_empty":
        return actual === null || actual === undefined || actual === ""
      case "is_not_empty":
        return actual !== null && actual !== undefined && actual !== ""
      default:
        return false
    }
  })

  // Evaluate with logic gates: first condition always included,
  // subsequent conditions use their logicGate to combine with the running result
  let result = results[0]
  for (let i = 1; i < conditions.length; i++) {
    if (conditions[i].logicGate === "or") {
      result = result || results[i]
    } else {
      result = result && results[i]
    }
  }

  return result
}

async function executeAction(
  action: { actionType: string; config: string },
  triggerData: Record<string, unknown>
): Promise<{ success: boolean; output?: string; error?: string }> {
  const config: Record<string, unknown> = JSON.parse(action.config)

  try {
    switch (action.actionType) {
      case "create_task": {
        const projectId = (config.projectId as string) || (triggerData.projectId as string)
        if (!projectId) {
          return { success: false, error: "No projectId for create_task action" }
        }

        // Find the first status for the project
        let statusId = config.statusId as string | undefined
        if (!statusId) {
          const statuses = await db
            .select()
            .from(taskStatuses)
            .where(eq(taskStatuses.projectId, projectId))
            .orderBy(taskStatuses.sortOrder)
            .limit(1)

          if (statuses.length === 0) {
            return { success: false, error: "No task statuses found for project" }
          }
          statusId = statuses[0].id
        }

        const existingTasks = await db
          .select()
          .from(tasks)
          .where(and(eq(tasks.projectId, projectId), eq(tasks.statusId, statusId)))

        const maxOrder = existingTasks.length > 0
          ? Math.max(...existingTasks.map((t) => t.sortOrder))
          : -1

        const taskId = createId()
        const now = new Date().toISOString()

        await db.insert(tasks).values({
          id: taskId,
          projectId,
          statusId,
          title: (config.title as string) || "Auto-created task",
          description: (config.description as string) ?? null,
          priority: (config.priority as "urgent" | "high" | "medium" | "low" | "none") ?? "none",
          assigneeId: (config.assigneeId as string) ?? null,
          sortOrder: maxOrder + 1,
          createdAt: now,
          updatedAt: now,
        })

        revalidatePath(`/projects/${projectId}`)
        return { success: true, output: JSON.stringify({ taskId }) }
      }

      case "update_status": {
        const taskId = (config.taskId as string) || (triggerData.taskId as string)
        const newStatusId = config.statusId as string
        if (!taskId || !newStatusId) {
          return { success: false, error: "Missing taskId or statusId for update_status" }
        }

        const now = new Date().toISOString()
        await db
          .update(tasks)
          .set({ statusId: newStatusId, updatedAt: now })
          .where(eq(tasks.id, taskId))

        return { success: true, output: JSON.stringify({ taskId, statusId: newStatusId }) }
      }

      case "assign_user": {
        const taskId = (config.taskId as string) || (triggerData.taskId as string)
        const assigneeId = config.assigneeId as string
        if (!taskId || !assigneeId) {
          return { success: false, error: "Missing taskId or assigneeId for assign_user" }
        }

        const now = new Date().toISOString()
        await db
          .update(tasks)
          .set({ assigneeId, updatedAt: now })
          .where(eq(tasks.id, taskId))

        return { success: true, output: JSON.stringify({ taskId, assigneeId }) }
      }

      case "update_priority": {
        const taskId = (config.taskId as string) || (triggerData.taskId as string)
        const priority = config.priority as string
        if (!taskId || !priority) {
          return { success: false, error: "Missing taskId or priority for update_priority" }
        }

        const now = new Date().toISOString()
        await db
          .update(tasks)
          .set({
            priority: priority as "urgent" | "high" | "medium" | "low" | "none",
            updatedAt: now,
          })
          .where(eq(tasks.id, taskId))

        return { success: true, output: JSON.stringify({ taskId, priority }) }
      }

      case "post_notification": {
        const notifId = createId()
        await db.insert(notifications).values({
          id: notifId,
          type: "system",
          title: (config.title as string) || "Automation notification",
          message: (config.message as string) ?? null,
          elementId: (config.elementId as string) ?? (triggerData.elementId as string) ?? null,
          userId: (config.userId as string) ?? null,
        })

        revalidatePath("/notifications")
        return { success: true, output: JSON.stringify({ notificationId: notifId }) }
      }

      case "add_label": {
        const taskId = (config.taskId as string) || (triggerData.taskId as string)
        const labelName = config.label as string
        const labelColor = (config.color as string) || "#6366f1"
        if (!taskId || !labelName) {
          return { success: false, error: "Missing taskId or label name for add_label" }
        }

        // Find existing label by name or create a new one
        const existingLabels = await db
          .select()
          .from(taskLabels)
          .where(eq(taskLabels.name, labelName))
          .limit(1)

        let labelId: string
        if (existingLabels.length > 0) {
          labelId = existingLabels[0].id
        } else {
          labelId = createId()
          await db.insert(taskLabels).values({
            id: labelId,
            name: labelName,
            color: labelColor,
          })
        }

        // Check if the task already has this label
        const existingLink = await db
          .select()
          .from(taskToLabels)
          .where(and(eq(taskToLabels.taskId, taskId), eq(taskToLabels.labelId, labelId)))
          .limit(1)

        if (existingLink.length === 0) {
          await db.insert(taskToLabels).values({
            taskId,
            labelId,
          })
        }

        return { success: true, output: JSON.stringify({ taskId, labelId, labelName }) }
      }

      case "add_comment": {
        const taskId = (config.taskId as string) || (triggerData.taskId as string)
        const content = (config.content as string) || (config.message as string)
        if (!taskId || !content) {
          return { success: false, error: "Missing taskId or content for add_comment" }
        }

        const commentId = createId()
        const now = new Date().toISOString()
        await db.insert(taskComments).values({
          id: commentId,
          taskId,
          content,
          authorId: (config.authorId as string) || "automation",
          createdAt: now,
          updatedAt: now,
        })

        return { success: true, output: JSON.stringify({ commentId, taskId }) }
      }

      case "create_reminder": {
        const reminderTitle = (config.title as string) || "Automation reminder"
        const reminderDescription = (config.description as string) || undefined

        // Calculate remindAt: use config.remindAt directly, or offset from now
        let remindAt: string
        if (config.remindAt) {
          remindAt = config.remindAt as string
        } else {
          // Default to 1 hour from now
          const offsetMs = ((config.offsetMinutes as number) || 60) * 60_000
          remindAt = new Date(Date.now() + offsetMs).toISOString()
        }

        const result = await createElement("reminder", reminderTitle)
        const reminderId = result.id

        // Update the reminder row with the correct time and description
        await db
          .update(reminders)
          .set({ remindAt })
          .where(eq(reminders.id, reminderId))

        // Update the element description if provided
        if (reminderDescription) {
          await db
            .update(elements)
            .set({ description: reminderDescription, updatedAt: new Date().toISOString() })
            .where(eq(elements.id, reminderId))
        }

        revalidatePath("/reminders")
        return { success: true, output: JSON.stringify({ reminderId, remindAt }) }
      }

      case "duplicate_template": {
        const templateId = config.templateId as string
        if (!templateId) {
          return { success: false, error: "Missing templateId for duplicate_template" }
        }

        const overrideTitle = (config.title as string) || undefined
        const projectId = (config.projectId as string) || (triggerData.projectId as string) || undefined

        const created = await createFromTemplate(templateId, {
          title: overrideTitle,
          projectId,
        })

        revalidatePath("/")
        return { success: true, output: JSON.stringify({ createdId: created.id, type: created.type }) }
      }

      default:
        return { success: false, error: `Unknown action type: ${action.actionType}` }
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function executeAutomation(
  automationId: string,
  triggerData: Record<string, unknown>
) {
  const startTime = Date.now()
  const automation = await getAutomation(automationId)

  if (!automation) {
    return { success: false, error: "Automation not found" }
  }

  if (!automation.isActive) {
    // Record a skipped run
    const runId = createId()
    const now = new Date().toISOString()

    await db.insert(automationRuns).values({
      id: runId,
      automationId,
      status: "skipped",
      triggerData: JSON.stringify(triggerData),
      actionsExecuted: 0,
      duration: Date.now() - startTime,
      createdAt: now,
    })

    await db
      .update(automations)
      .set({ runCount: automation.runCount + 1, lastRunAt: now, lastRunStatus: "skipped", updatedAt: now })
      .where(eq(automations.id, automationId))

    return { success: false, runId, status: "skipped" }
  }

  // Check conditions
  const conditionsPassed = checkConditions(automation.conditions, triggerData)

  if (!conditionsPassed) {
    const runId = createId()
    const now = new Date().toISOString()

    await db.insert(automationRuns).values({
      id: runId,
      automationId,
      status: "skipped",
      triggerData: JSON.stringify(triggerData),
      actionsExecuted: 0,
      duration: Date.now() - startTime,
      createdAt: now,
    })

    await db
      .update(automations)
      .set({ runCount: automation.runCount + 1, lastRunAt: now, lastRunStatus: "skipped", updatedAt: now })
      .where(eq(automations.id, automationId))

    return { success: false, runId, status: "skipped" }
  }

  // Execute each action in order
  const runId = createId()
  let actionsExecuted = 0
  let runFailed = false
  let runError: string | undefined

  for (const action of automation.actions) {
    const result = await executeAction(action, triggerData)

    const logId = createId()
    const now = new Date().toISOString()

    await db.insert(automationLogs).values({
      id: logId,
      runId,
      actionType: action.actionType,
      status: result.success ? "success" : "failure",
      input: JSON.stringify({ config: action.config, triggerData }),
      output: result.output ?? null,
      error: result.error ?? null,
      createdAt: now,
    })

    if (result.success) {
      actionsExecuted++
    } else {
      runFailed = true
      runError = result.error
      break
    }
  }

  const now = new Date().toISOString()
  const runStatus = runFailed ? "failure" : "success"

  await db.insert(automationRuns).values({
    id: runId,
    automationId,
    status: runStatus,
    triggerData: JSON.stringify(triggerData),
    actionsExecuted,
    error: runError ?? null,
    duration: Date.now() - startTime,
    createdAt: now,
  })

  await db
    .update(automations)
    .set({
      runCount: automation.runCount + 1,
      lastRunAt: now,
      lastRunStatus: runStatus,
      updatedAt: now,
    })
    .where(eq(automations.id, automationId))

  revalidatePath("/")

  return {
    success: !runFailed,
    runId,
    status: runStatus,
    actionsExecuted,
    error: runError,
  }
}

// ─── Run History & Logs ─────────────────────────────────────────────────

export async function getAutomationRuns(automationId: string, limit = 50) {
  return db
    .select()
    .from(automationRuns)
    .where(eq(automationRuns.automationId, automationId))
    .orderBy(desc(automationRuns.createdAt))
    .limit(limit)
}

export async function getAutomationLogs(runId: string) {
  return db
    .select()
    .from(automationLogs)
    .where(eq(automationLogs.runId, runId))
    .orderBy(automationLogs.createdAt)
}

export async function getFailedRuns(limit = 20) {
  return db
    .select()
    .from(automationRuns)
    .where(eq(automationRuns.status, "failure"))
    .orderBy(desc(automationRuns.createdAt))
    .limit(limit)
}

// ─── Trigger Entry Point ────────────────────────────────────────────────

export async function checkAndExecuteAutomations(
  trigger: "task_created" | "task_updated" | "status_changed" | "due_date_reached" | "reminder_triggered" | "comment_added" | "dependency_resolved" | "form_submitted" | "element_linked" | "page_created" | "attachment_uploaded",
  data: Record<string, unknown>
) {
  // Find all active automations matching this trigger
  const projectId = data.projectId as string | undefined

  let matchingAutomations
  if (projectId) {
    // Match automations scoped to this project OR global automations (no project)
    const projectScoped = await db
      .select()
      .from(automations)
      .where(
        and(
          eq(automations.trigger, trigger),
          eq(automations.isActive, true),
          eq(automations.projectId, projectId)
        )
      )

    const global = await db
      .select()
      .from(automations)
      .where(
        and(
          eq(automations.trigger, trigger),
          eq(automations.isActive, true)
        )
      )

    // Combine: project-scoped + global (those without a projectId)
    const globalOnly = global.filter((a) => !a.projectId)
    matchingAutomations = [...projectScoped, ...globalOnly]

    // Deduplicate by id
    const seen = new Set<string>()
    matchingAutomations = matchingAutomations.filter((a) => {
      if (seen.has(a.id)) return false
      seen.add(a.id)
      return true
    })
  } else {
    matchingAutomations = await db
      .select()
      .from(automations)
      .where(
        and(
          eq(automations.trigger, trigger),
          eq(automations.isActive, true)
        )
      )
  }

  const results = []
  for (const automation of matchingAutomations) {
    const result = await executeAutomation(automation.id, data)
    results.push({ automationId: automation.id, ...result })
  }

  return results
}
