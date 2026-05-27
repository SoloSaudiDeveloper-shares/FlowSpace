"use server"

import { db, sqlite } from "@/lib/db"
import {
  backups,
  elements,
  tasks,
  taskStatuses,
  taskLabels,
  taskToLabels,
  todoItems,
  processSteps,
  pages,
  canvases,
  canvasNodes,
  canvasEdges,
  taskChecklists,
  taskChecklistItems,
  taskDependencies,
  taskComments,
  taskAttachments,
  reminders,
  processes,
  todoLists,
  dashboardWidgets,
  tags,
  elementTags,
  elementLinks,
  users,
  teams,
  teamMembers,
  notifications,
  activityLog,
  viewPreferences,
  serverEvents,
} from "@/lib/db/schema"
import { createId } from "@/lib/utils/ids"
import { eq, desc } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import fs from "node:fs"
import path from "node:path"
import { getDataDir } from "@/lib/utils/data-dir"

const BACKUP_DIR = path.join(getDataDir(), "backups")

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
  }
}

export async function createBackup(data?: {
  name?: string
  description?: string
  type?: "full" | "selective" | "scheduled"
}): Promise<{ id: string; error?: string }> {
  const id = createId()
  const now = new Date().toISOString()
  const timestamp = Date.now()
  const fileName = `backup-${id}-${timestamp}.json`
  const filePath = path.join(BACKUP_DIR, fileName)

  try {
    ensureBackupDir()

    // Create backup record with in_progress status
    await db.insert(backups).values({
      id,
      name: data?.name ?? `Backup ${new Date().toLocaleDateString()}`,
      description: data?.description ?? null,
      filePath,
      type: data?.type ?? "full",
      status: "in_progress",
      startedAt: now,
    })

    // Collect all table data
    const backupData = {
      version: "2.0",
      createdAt: now,
      tables: {
        elements: await db.select().from(elements),
        tasks: await db.select().from(tasks),
        taskStatuses: await db.select().from(taskStatuses),
        taskLabels: await db.select().from(taskLabels),
        taskToLabels: await db.select().from(taskToLabels),
        todoItems: await db.select().from(todoItems),
        processSteps: await db.select().from(processSteps),
        pages: await db.select().from(pages),
        canvases: await db.select().from(canvases),
        canvasNodes: await db.select().from(canvasNodes),
        canvasEdges: await db.select().from(canvasEdges),
        taskChecklists: await db.select().from(taskChecklists),
        taskChecklistItems: await db.select().from(taskChecklistItems),
        taskDependencies: await db.select().from(taskDependencies),
        taskComments: await db.select().from(taskComments),
        taskAttachments: await db.select().from(taskAttachments),
        reminders: await db.select().from(reminders),
        processes: await db.select().from(processes),
        todoLists: await db.select().from(todoLists),
        dashboardWidgets: await db.select().from(dashboardWidgets),
        tags: await db.select().from(tags),
        elementTags: await db.select().from(elementTags),
        elementLinks: await db.select().from(elementLinks),
        users: await db.select().from(users),
        teams: await db.select().from(teams),
        teamMembers: await db.select().from(teamMembers),
        notifications: await db.select().from(notifications),
        activityLog: await db.select().from(activityLog),
        viewPreferences: await db.select().from(viewPreferences),
        serverEvents: await db.select().from(serverEvents),
      },
    }

    const jsonContent = JSON.stringify(backupData, null, 2)
    fs.writeFileSync(filePath, jsonContent, "utf-8")

    const fileSize = fs.statSync(filePath).size

    // Update backup record as completed
    await db
      .update(backups)
      .set({
        status: "completed",
        fileSize,
        completedAt: new Date().toISOString(),
      })
      .where(eq(backups.id, id))

    revalidatePath("/settings")
    return { id }
  } catch (error) {
    // Mark backup as failed
    await db
      .update(backups)
      .set({
        status: "failed",
        completedAt: new Date().toISOString(),
        metadata: JSON.stringify({
          error: error instanceof Error ? error.message : "Unknown error",
        }),
      })
      .where(eq(backups.id, id))

    return {
      id,
      error: error instanceof Error ? error.message : "Failed to create backup",
    }
  }
}

export async function getBackups() {
  return db.select().from(backups).orderBy(desc(backups.startedAt))
}

export async function getBackup(id: string) {
  const result = await db
    .select()
    .from(backups)
    .where(eq(backups.id, id))
    .limit(1)
  return result[0] ?? null
}

export async function deleteBackup(id: string) {
  const backup = await getBackup(id)
  if (!backup) return

  // Delete file from disk if it exists
  if (fs.existsSync(backup.filePath)) {
    fs.unlinkSync(backup.filePath)
  }

  // Delete record from DB
  await db.delete(backups).where(eq(backups.id, id))

  revalidatePath("/settings")
}

export async function restoreBackup(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const backup = await getBackup(id)
  if (!backup) {
    return { success: false, error: "Backup not found" }
  }

  if (!fs.existsSync(backup.filePath)) {
    return { success: false, error: "Backup file not found on disk" }
  }

  try {
    const raw = fs.readFileSync(backup.filePath, "utf-8")
    const data = JSON.parse(raw)

    if (!data.version || !data.tables) {
      return { success: false, error: "Invalid backup format" }
    }

    // Create a safety-net backup before restoring
    await createBackup({
      name: `Pre-restore safety backup`,
      description: `Automatic backup created before restoring backup "${backup.name}"`,
      type: "full",
    })

    // Use a transaction to restore all data
    sqlite.exec("BEGIN TRANSACTION")

    try {
      // Delete in correct order: children before parents to avoid FK violations
      // Level 3 children (deepest)
      sqlite.exec("DELETE FROM task_checklist_items")
      sqlite.exec("DELETE FROM task_to_labels")
      sqlite.exec("DELETE FROM element_tags")

      // Level 2 children
      sqlite.exec("DELETE FROM canvas_edges")
      sqlite.exec("DELETE FROM canvas_nodes")
      sqlite.exec("DELETE FROM task_checklists")
      sqlite.exec("DELETE FROM task_dependencies")
      sqlite.exec("DELETE FROM task_comments")
      sqlite.exec("DELETE FROM task_attachments")
      sqlite.exec("DELETE FROM todo_items")
      sqlite.exec("DELETE FROM process_steps")
      sqlite.exec("DELETE FROM dashboard_widgets")
      sqlite.exec("DELETE FROM activity_log")
      sqlite.exec("DELETE FROM notifications")
      sqlite.exec("DELETE FROM view_preferences")
      sqlite.exec("DELETE FROM team_members")
      sqlite.exec("DELETE FROM element_links")

      // Level 1 children
      sqlite.exec("DELETE FROM tasks")
      sqlite.exec("DELETE FROM task_statuses")
      sqlite.exec("DELETE FROM task_labels")
      sqlite.exec("DELETE FROM pages")
      sqlite.exec("DELETE FROM canvases")
      sqlite.exec("DELETE FROM todo_lists")
      sqlite.exec("DELETE FROM reminders")
      sqlite.exec("DELETE FROM processes")
      sqlite.exec("DELETE FROM tags")
      sqlite.exec("DELETE FROM server_events")
      sqlite.exec("DELETE FROM teams")
      sqlite.exec("DELETE FROM users")

      // Root level
      sqlite.exec("DELETE FROM elements")

      const t = data.tables

      // Insert in correct order: parents before children
      // Root level
      if (t.users?.length) {
        for (const row of t.users) {
          await db.insert(users).values(row)
        }
      }
      if (t.teams?.length) {
        for (const row of t.teams) {
          await db.insert(teams).values(row)
        }
      }
      if (t.elements?.length) {
        for (const row of t.elements) {
          await db.insert(elements).values(row)
        }
      }
      if (t.tags?.length) {
        for (const row of t.tags) {
          await db.insert(tags).values(row)
        }
      }
      if (t.taskLabels?.length) {
        for (const row of t.taskLabels) {
          await db.insert(taskLabels).values(row)
        }
      }

      // Level 1 children
      if (t.pages?.length) {
        for (const row of t.pages) {
          await db.insert(pages).values(row)
        }
      }
      if (t.canvases?.length) {
        for (const row of t.canvases) {
          await db.insert(canvases).values(row)
        }
      }
      if (t.todoLists?.length) {
        for (const row of t.todoLists) {
          await db.insert(todoLists).values(row)
        }
      }
      if (t.reminders?.length) {
        for (const row of t.reminders) {
          await db.insert(reminders).values(row)
        }
      }
      if (t.processes?.length) {
        for (const row of t.processes) {
          await db.insert(processes).values(row)
        }
      }
      if (t.taskStatuses?.length) {
        for (const row of t.taskStatuses) {
          await db.insert(taskStatuses).values(row)
        }
      }
      if (t.teamMembers?.length) {
        for (const row of t.teamMembers) {
          await db.insert(teamMembers).values(row)
        }
      }

      // Level 2 children
      if (t.tasks?.length) {
        for (const row of t.tasks) {
          await db.insert(tasks).values(row)
        }
      }
      if (t.canvasNodes?.length) {
        for (const row of t.canvasNodes) {
          await db.insert(canvasNodes).values(row)
        }
      }
      if (t.todoItems?.length) {
        for (const row of t.todoItems) {
          await db.insert(todoItems).values(row)
        }
      }
      if (t.processSteps?.length) {
        for (const row of t.processSteps) {
          await db.insert(processSteps).values(row)
        }
      }
      if (t.dashboardWidgets?.length) {
        for (const row of t.dashboardWidgets) {
          await db.insert(dashboardWidgets).values(row)
        }
      }
      if (t.elementLinks?.length) {
        for (const row of t.elementLinks) {
          await db.insert(elementLinks).values(row)
        }
      }
      if (t.elementTags?.length) {
        for (const row of t.elementTags) {
          await db.insert(elementTags).values(row)
        }
      }
      if (t.notifications?.length) {
        for (const row of t.notifications) {
          await db.insert(notifications).values(row)
        }
      }
      if (t.activityLog?.length) {
        for (const row of t.activityLog) {
          await db.insert(activityLog).values(row)
        }
      }
      if (t.viewPreferences?.length) {
        for (const row of t.viewPreferences) {
          await db.insert(viewPreferences).values(row)
        }
      }
      if (t.serverEvents?.length) {
        for (const row of t.serverEvents) {
          await db.insert(serverEvents).values(row)
        }
      }

      // Level 3 children
      if (t.canvasEdges?.length) {
        for (const row of t.canvasEdges) {
          await db.insert(canvasEdges).values(row)
        }
      }
      if (t.taskChecklists?.length) {
        for (const row of t.taskChecklists) {
          await db.insert(taskChecklists).values(row)
        }
      }
      if (t.taskDependencies?.length) {
        for (const row of t.taskDependencies) {
          await db.insert(taskDependencies).values(row)
        }
      }
      if (t.taskComments?.length) {
        for (const row of t.taskComments) {
          await db.insert(taskComments).values(row)
        }
      }
      if (t.taskAttachments?.length) {
        for (const row of t.taskAttachments) {
          await db.insert(taskAttachments).values(row)
        }
      }
      if (t.taskToLabels?.length) {
        for (const row of t.taskToLabels) {
          await db.insert(taskToLabels).values(row)
        }
      }

      // Deepest children
      if (t.taskChecklistItems?.length) {
        for (const row of t.taskChecklistItems) {
          await db.insert(taskChecklistItems).values(row)
        }
      }

      sqlite.exec("COMMIT")

      revalidatePath("/")
      return { success: true }
    } catch (txError) {
      sqlite.exec("ROLLBACK")

      // Log a server event on failure
      await db.insert(serverEvents).values({
        id: createId(),
        type: "error",
        title: "Backup restore failed",
        message:
          txError instanceof Error ? txError.message : "Unknown restore error",
        metadata: JSON.stringify({ backupId: id }),
      })

      return {
        success: false,
        error:
          txError instanceof Error
            ? txError.message
            : "Failed to restore backup",
      }
    }
  } catch (error) {
    // Log a server event on failure
    await db.insert(serverEvents).values({
      id: createId(),
      type: "error",
      title: "Backup restore failed",
      message: error instanceof Error ? error.message : "Unknown error",
      metadata: JSON.stringify({ backupId: id }),
    })

    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to restore backup",
    }
  }
}

export async function getBackupFile(id: string) {
  const backup = await getBackup(id)
  if (!backup) return null

  if (!fs.existsSync(backup.filePath)) return null

  return fs.readFileSync(backup.filePath, "utf-8")
}

export async function validateBackup(
  id: string
): Promise<{ valid: boolean; error?: string }> {
  const backup = await getBackup(id)
  if (!backup) {
    return { valid: false, error: "Backup record not found" }
  }

  if (!fs.existsSync(backup.filePath)) {
    return { valid: false, error: "Backup file not found on disk" }
  }

  try {
    const raw = fs.readFileSync(backup.filePath, "utf-8")
    const data = JSON.parse(raw)

    if (!data.version) {
      return { valid: false, error: "Missing version field" }
    }

    if (!data.tables || typeof data.tables !== "object") {
      return { valid: false, error: "Missing or invalid tables field" }
    }

    if (!data.createdAt) {
      return { valid: false, error: "Missing createdAt field" }
    }

    // Check for required table keys
    const requiredTables = ["elements", "tasks", "taskStatuses"]
    for (const table of requiredTables) {
      if (!Array.isArray(data.tables[table])) {
        return {
          valid: false,
          error: `Missing or invalid table: ${table}`,
        }
      }
    }

    return { valid: true }
  } catch (error) {
    return {
      valid: false,
      error:
        error instanceof Error
          ? `Failed to parse backup: ${error.message}`
          : "Failed to parse backup file",
    }
  }
}
