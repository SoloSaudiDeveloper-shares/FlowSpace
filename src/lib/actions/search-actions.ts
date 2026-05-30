"use server"

/**
 * Global search across everything the signed-in user owns.
 *
 * Backed by a unified, owner-scoped FTS5 virtual table (`search_index`)
 * that's kept in sync via triggers on elements / tasks / todo_items.
 * That fixes a pre-existing leak where the per-table _fts indexes
 * didn't filter by `created_by`, so a search could return another
 * user's elements as long as you couldn't actually open them.
 *
 * The previous public surface (fullTextSearch + scopedSearch) is
 * preserved so the command palette doesn't need to change.
 */

import { sqlite } from "@/lib/db"
import { currentUserId } from "@/lib/auth/scope"

export type SearchResult = {
  id: string
  title: string
  type: "element" | "task" | "comment" | "feed" | "todo"
  elementType?: string
  description?: string | null
  projectId?: string
  projectTitle?: string
  taskId?: string
  rank: number
}

/** Build a FTS5-safe MATCH query: tokenise, drop symbols, prefix-match
 *  each surviving term, cap to 8 terms. Empty input → null (caller
 *  short-circuits). */
function buildMatchQuery(raw: string): string | null {
  const cleaned = raw.trim().replace(/[\\"]/g, " ")
  if (!cleaned) return null
  const tokens = cleaned.split(/\s+/).slice(0, 8)
  const expr = tokens
    .map((t) => t.replace(/[^\p{L}\p{N}_+\-]/gu, ""))
    .filter((t) => t.length > 0)
    .map((t) => `${t}*`)
    .join(" ")
  return expr || null
}

export async function fullTextSearch(
  query: string,
  limit = 20
): Promise<SearchResult[]> {
  const uid = await currentUserId()
  if (!uid) return []
  const expr = buildMatchQuery(query)
  if (!expr) return []

  const rows = sqlite
    .prepare(
      `SELECT
         entity_kind  AS kind,
         entity_id    AS id,
         type_label   AS typeLabel,
         title,
         snippet(search_index, 5, '', '', '…', 12) AS snip,
         rank
       FROM search_index
      WHERE search_index MATCH ?
        AND owner_user_id = ?
      ORDER BY rank
      LIMIT ?`
    )
    .all(expr, uid, limit) as Array<{
      kind: "element" | "task" | "todo"
      id: string
      typeLabel: string
      title: string
      snip: string | null
      rank: number
    }>
  if (rows.length === 0) return []

  // For tasks, look up project title in a single round-trip so the
  // command palette can show "task — in <project>". For todos, same
  // idea but the parent is the list.
  const taskRows = rows.filter((r) => r.kind === "task")
  const taskIds = taskRows.map((r) => r.id)
  const projectByTask = new Map<string, { id: string; title: string }>()
  if (taskIds.length > 0) {
    const placeholders = taskIds.map(() => "?").join(",")
    const projRows = sqlite
      .prepare(
        `SELECT t.id AS taskId, e.id AS projectId, e.title AS projectTitle
           FROM tasks t INNER JOIN elements e ON e.id = t.project_id
          WHERE t.id IN (${placeholders})`,
      )
      .all(...taskIds) as { taskId: string; projectId: string; projectTitle: string }[]
    for (const p of projRows) {
      projectByTask.set(p.taskId, { id: p.projectId, title: p.projectTitle })
    }
  }

  return rows.map((row) => {
    const description = row.snip && row.snip !== row.title ? row.snip : null
    if (row.kind === "task") {
      const proj = projectByTask.get(row.id)
      return {
        id: row.id,
        title: row.title,
        type: "task" as const,
        description,
        projectId: proj?.id,
        projectTitle: proj?.title ?? "Unknown Project",
        rank: row.rank,
      }
    }
    if (row.kind === "todo") {
      return {
        id: row.id,
        title: row.title,
        type: "todo" as const,
        description,
        rank: row.rank,
      }
    }
    return {
      id: row.id,
      title: row.title,
      type: "element" as const,
      elementType: row.typeLabel,
      description,
      rank: row.rank,
    }
  })
}

// Scoped search: filter by entity kind (elements / tasks / todos).
// Comments + feed live in their own per-table FTS indexes and aren't
// in the unified search_index yet — they return empty until reindexed.
export async function scopedSearch(
  query: string,
  scope: "elements" | "tasks" | "comments" | "feed",
  limit = 20
): Promise<SearchResult[]> {
  if (scope === "comments" || scope === "feed") return []
  const uid = await currentUserId()
  if (!uid) return []
  const expr = buildMatchQuery(query)
  if (!expr) return []
  const kindFilter = scope === "elements" ? "element" : "task"
  const rows = sqlite
    .prepare(
      `SELECT entity_id AS id, type_label AS typeLabel, title,
              snippet(search_index, 5, '', '', '…', 12) AS snip, rank
         FROM search_index
        WHERE search_index MATCH ?
          AND owner_user_id = ?
          AND entity_kind = ?
        ORDER BY rank
        LIMIT ?`,
    )
    .all(expr, uid, kindFilter, limit) as Array<{
      id: string
      typeLabel: string
      title: string
      snip: string | null
      rank: number
    }>
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    type: scope === "elements" ? ("element" as const) : ("task" as const),
    elementType: scope === "elements" ? row.typeLabel : undefined,
    description: row.snip && row.snip !== row.title ? row.snip : null,
    rank: row.rank,
  }))
}
