"use server"

import { db } from "@/lib/db"
import { watchers, elements, users } from "@/lib/db/schema"
import { createId } from "@/lib/utils/ids"
import { eq, and, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function toggleWatch(elementId: string, userId: string) {
  const existing = await db
    .select()
    .from(watchers)
    .where(and(eq(watchers.elementId, elementId), eq(watchers.userId, userId)))
    .limit(1)

  if (existing.length > 0) {
    await db.delete(watchers).where(eq(watchers.id, existing[0].id))
  } else {
    await db.insert(watchers).values({
      id: createId(),
      elementId,
      userId,
      createdAt: new Date().toISOString(),
    })
  }

  revalidatePath("/")
  return { watching: existing.length === 0 }
}

export async function getWatchers(elementId: string) {
  return db
    .select({
      watcher: watchers,
      user: users,
    })
    .from(watchers)
    .innerJoin(users, eq(watchers.userId, users.id))
    .where(eq(watchers.elementId, elementId))
}

export async function isWatching(elementId: string, userId: string) {
  const result = await db
    .select()
    .from(watchers)
    .where(and(eq(watchers.elementId, elementId), eq(watchers.userId, userId)))
    .limit(1)
  return result.length > 0
}

export async function getWatcherCount(elementId: string) {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(watchers)
    .where(eq(watchers.elementId, elementId))
  return result[0]?.count ?? 0
}

export async function getWatchedElements(userId: string) {
  return db
    .select({
      watcher: watchers,
      element: elements,
    })
    .from(watchers)
    .innerJoin(elements, eq(watchers.elementId, elements.id))
    .where(eq(watchers.userId, userId))
}
