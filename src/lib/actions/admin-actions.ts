"use server"

import { db, sqlite } from "@/lib/db"
import { serverEvents, sessions } from "@/lib/db/schema"
import { createId } from "@/lib/utils/ids"
import { eq, desc, lt, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"

import { getDataDir } from "@/lib/utils/data-dir"

const DATA_DIR = getDataDir()
const DB_PATH = path.join(DATA_DIR, "app.db")
const UPLOADS_DIR = path.join(DATA_DIR, "uploads")
const BACKUPS_DIR = path.join(DATA_DIR, "backups")

function getDirSize(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0

  let totalSize = 0
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isFile()) {
      totalSize += fs.statSync(fullPath).size
    } else if (entry.isDirectory()) {
      totalSize += getDirSize(fullPath)
    }
  }

  return totalSize
}

export async function getServerHealth(): Promise<{
  status: string
  uptime: number
  memoryUsage: NodeJS.MemoryUsage
  platform: string
  nodeVersion: string
  dbSize: number
  uploadsSize: number
  backupsSize: number
}> {
  const dbSize = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0
  const uploadsSize = getDirSize(UPLOADS_DIR)
  const backupsSize = getDirSize(BACKUPS_DIR)

  return {
    status: "healthy",
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    platform: process.platform,
    nodeVersion: process.version,
    dbSize,
    uploadsSize,
    backupsSize,
  }
}

export async function getDatabaseStats(): Promise<{
  tables: Array<{ name: string; rowCount: number }>
}> {
  const tableNames = [
    "elements",
    "tasks",
    "task_statuses",
    "task_labels",
    "task_to_labels",
    "pages",
    "canvases",
    "canvas_nodes",
    "canvas_edges",
    "todo_lists",
    "todo_items",
    "reminders",
    "processes",
    "process_steps",
    "task_checklists",
    "task_checklist_items",
    "task_dependencies",
    "task_comments",
    "task_attachments",
    "dashboard_widgets",
    "tags",
    "element_tags",
    "element_links",
    "users",
    "sessions",
    "teams",
    "team_members",
    "notifications",
    "activity_log",
    "view_preferences",
    "server_events",
    "backups",
  ]

  const tables: Array<{ name: string; rowCount: number }> = []

  for (const name of tableNames) {
    try {
      const result = sqlite
        .prepare(`SELECT COUNT(*) as count FROM ${name}`)
        .get() as { count: number } | undefined
      tables.push({ name, rowCount: result?.count ?? 0 })
    } catch {
      // Table might not exist yet
      tables.push({ name, rowCount: 0 })
    }
  }

  return { tables }
}

export async function getActiveSessionCount(): Promise<number> {
  const now = new Date().toISOString()
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(sessions)
    .where(sql`${sessions.expiresAt} > ${now}`)
  return result[0]?.count ?? 0
}

export async function getRecentServerEvents(limit = 50) {
  return db
    .select()
    .from(serverEvents)
    .orderBy(desc(serverEvents.createdAt))
    .limit(limit)
}

export async function logServerEvent(data: {
  type:
    | "server_start"
    | "server_stop"
    | "backup_completed"
    | "backup_failed"
    | "user_login"
    | "user_logout"
    | "user_created"
    | "permission_changed"
    | "error"
    | "warning"
    | "info"
  title: string
  message?: string
  userId?: string
  metadata?: Record<string, unknown>
}) {
  const id = createId()
  await db.insert(serverEvents).values({
    id,
    type: data.type,
    title: data.title,
    message: data.message ?? null,
    userId: data.userId ?? null,
    metadata: data.metadata ? JSON.stringify(data.metadata) : null,
  })
  revalidatePath("/settings")
  return id
}

export async function getStorageBreakdown() {
  const dbSize = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0
  const uploadsSize = getDirSize(UPLOADS_DIR)
  const backupsSize = getDirSize(BACKUPS_DIR)
  const totalSize = dbSize + uploadsSize + backupsSize

  // Count files in each directory
  const uploadsCount = fs.existsSync(UPLOADS_DIR)
    ? fs.readdirSync(UPLOADS_DIR).length
    : 0
  const backupsCount = fs.existsSync(BACKUPS_DIR)
    ? fs.readdirSync(BACKUPS_DIR).length
    : 0

  return {
    database: {
      size: dbSize,
      path: DB_PATH,
    },
    uploads: {
      size: uploadsSize,
      fileCount: uploadsCount,
      path: UPLOADS_DIR,
    },
    backups: {
      size: backupsSize,
      fileCount: backupsCount,
      path: BACKUPS_DIR,
    },
    total: totalSize,
  }
}

export async function cleanupExpiredSessions() {
  const now = new Date().toISOString()
  const result = sqlite
    .prepare(`DELETE FROM sessions WHERE expires_at < ?`)
    .run(now)
  revalidatePath("/settings")
  return { deletedCount: result.changes }
}

export async function getSystemInfo() {
  const cpus = os.cpus()

  return {
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    hostname: os.hostname(),
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    uptime: os.uptime(),
    cpuModel: cpus[0]?.model ?? "Unknown",
    cpuCores: cpus.length,
    nodeVersion: process.version,
    processUptime: process.uptime(),
    processMemory: process.memoryUsage(),
  }
}
