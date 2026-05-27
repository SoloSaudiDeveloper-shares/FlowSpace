"use server"

import { sqlite } from "@/lib/db"
import { db } from "@/lib/db"
import { elements, tasks, taskStatuses } from "@/lib/db/schema"
import { eq, and, inArray } from "drizzle-orm"

export type SearchResult = {
  id: string
  title: string
  type: "element" | "task" | "comment" | "feed"
  elementType?: string
  description?: string | null
  projectId?: string
  projectTitle?: string
  taskId?: string
  rank: number
}

export async function fullTextSearch(
  query: string,
  limit = 20
): Promise<SearchResult[]> {
  if (!query || query.trim().length === 0) return []

  const sanitized = query.replace(/['"]/g, "").trim()
  if (!sanitized) return []

  // FTS5 query with prefix matching
  const ftsQuery = sanitized
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `"${w}"*`)
    .join(" ")

  const results: SearchResult[] = []

  // Search elements
  try {
    const elementRows = sqlite
      .prepare(
        `SELECT id, title, description, type, rank
         FROM elements_fts
         WHERE elements_fts MATCH ?
         ORDER BY rank
         LIMIT ?`
      )
      .all(ftsQuery, limit) as Array<{
      id: string
      title: string
      description: string | null
      type: string
      rank: number
    }>

    // Filter out deleted/archived
    if (elementRows.length > 0) {
      const ids = elementRows.map((r) => r.id)
      const activeElements = await db
        .select({ id: elements.id })
        .from(elements)
        .where(
          and(
            inArray(elements.id, ids),
            eq(elements.isDeleted, false),
            eq(elements.isArchived, false)
          )
        )
      const activeIds = new Set(activeElements.map((e) => e.id))

      for (const row of elementRows) {
        if (activeIds.has(row.id)) {
          results.push({
            id: row.id,
            title: row.title,
            type: "element",
            elementType: row.type,
            description: row.description,
            rank: row.rank,
          })
        }
      }
    }
  } catch {
    // Fallback to LIKE search if FTS fails
    const fallback = await db
      .select()
      .from(elements)
      .where(
        and(eq(elements.isDeleted, false), eq(elements.isArchived, false))
      )

    const q = sanitized.toLowerCase()
    for (const el of fallback) {
      if (el.title.toLowerCase().includes(q)) {
        results.push({
          id: el.id,
          title: el.title,
          type: "element",
          elementType: el.type,
          description: el.description,
          rank: 0,
        })
      }
    }
  }

  // Search tasks
  try {
    const taskRows = sqlite
      .prepare(
        `SELECT id, title, description, project_id, rank
         FROM tasks_fts
         WHERE tasks_fts MATCH ?
         ORDER BY rank
         LIMIT ?`
      )
      .all(ftsQuery, limit) as Array<{
      id: string
      title: string
      description: string | null
      project_id: string
      rank: number
    }>

    if (taskRows.length > 0) {
      // Get project titles for context
      const projectIds = [...new Set(taskRows.map((r) => r.project_id))]
      const projectElements = await db
        .select({ id: elements.id, title: elements.title })
        .from(elements)
        .where(inArray(elements.id, projectIds))
      const projectMap = new Map(projectElements.map((p) => [p.id, p.title]))

      for (const row of taskRows) {
        results.push({
          id: row.id,
          title: row.title,
          type: "task",
          description: row.description,
          projectId: row.project_id,
          projectTitle: projectMap.get(row.project_id) ?? "Unknown Project",
          rank: row.rank,
        })
      }
    }
  } catch {
    // Tasks FTS fallback - skip silently
  }

  // Search comments
  try {
    const commentRows = sqlite
      .prepare(
        `SELECT id, content, task_id, rank
         FROM comments_fts
         WHERE comments_fts MATCH ?
         ORDER BY rank
         LIMIT ?`
      )
      .all(ftsQuery, Math.floor(limit / 2)) as Array<{
      id: string
      content: string
      task_id: string
      rank: number
    }>

    for (const row of commentRows) {
      results.push({
        id: row.id,
        title: row.content.slice(0, 80) + (row.content.length > 80 ? "..." : ""),
        type: "comment",
        taskId: row.task_id,
        rank: row.rank,
      })
    }
  } catch {
    // Comments FTS fallback - skip silently
  }

  // Search feed events
  try {
    const feedRows = sqlite
      .prepare(
        `SELECT id, title, summary, type, rank
         FROM feed_fts
         WHERE feed_fts MATCH ?
         ORDER BY rank
         LIMIT ?`
      )
      .all(ftsQuery, Math.floor(limit / 2)) as Array<{
      id: string
      title: string
      summary: string | null
      type: string
      rank: number
    }>

    for (const row of feedRows) {
      results.push({
        id: row.id,
        title: row.title,
        type: "feed",
        description: row.summary,
        elementType: row.type,
        rank: row.rank,
      })
    }
  } catch {
    // Feed FTS fallback - skip silently
  }

  // Sort by rank (lower is better in FTS5)
  results.sort((a, b) => a.rank - b.rank)

  return results.slice(0, limit)
}

// Scoped search: search only within a specific type
export async function scopedSearch(
  query: string,
  scope: "elements" | "tasks" | "comments" | "feed",
  limit = 20
): Promise<SearchResult[]> {
  if (!query || query.trim().length === 0) return []

  const sanitized = query.replace(/['"]/g, "").trim()
  if (!sanitized) return []

  const ftsQuery = sanitized
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `"${w}"*`)
    .join(" ")

  const results: SearchResult[] = []

  try {
    switch (scope) {
      case "elements": {
        const rows = sqlite
          .prepare(
            `SELECT id, title, description, type, rank FROM elements_fts WHERE elements_fts MATCH ? ORDER BY rank LIMIT ?`
          )
          .all(ftsQuery, limit) as Array<{
          id: string; title: string; description: string | null; type: string; rank: number
        }>
        for (const row of rows) {
          results.push({
            id: row.id, title: row.title, type: "element",
            elementType: row.type, description: row.description, rank: row.rank,
          })
        }
        break
      }
      case "tasks": {
        const rows = sqlite
          .prepare(
            `SELECT id, title, description, project_id, rank FROM tasks_fts WHERE tasks_fts MATCH ? ORDER BY rank LIMIT ?`
          )
          .all(ftsQuery, limit) as Array<{
          id: string; title: string; description: string | null; project_id: string; rank: number
        }>
        for (const row of rows) {
          results.push({
            id: row.id, title: row.title, type: "task",
            description: row.description, projectId: row.project_id, rank: row.rank,
          })
        }
        break
      }
      case "comments": {
        const rows = sqlite
          .prepare(
            `SELECT id, content, task_id, rank FROM comments_fts WHERE comments_fts MATCH ? ORDER BY rank LIMIT ?`
          )
          .all(ftsQuery, limit) as Array<{
          id: string; content: string; task_id: string; rank: number
        }>
        for (const row of rows) {
          results.push({
            id: row.id,
            title: row.content.slice(0, 80) + (row.content.length > 80 ? "..." : ""),
            type: "comment", taskId: row.task_id, rank: row.rank,
          })
        }
        break
      }
      case "feed": {
        const rows = sqlite
          .prepare(
            `SELECT id, title, summary, type, rank FROM feed_fts WHERE feed_fts MATCH ? ORDER BY rank LIMIT ?`
          )
          .all(ftsQuery, limit) as Array<{
          id: string; title: string; summary: string | null; type: string; rank: number
        }>
        for (const row of rows) {
          results.push({
            id: row.id, title: row.title, type: "feed",
            description: row.summary, elementType: row.type, rank: row.rank,
          })
        }
        break
      }
    }
  } catch {
    // Silently handle FTS errors
  }

  return results
}
