"use server"

import { db } from "@/lib/db"
import { mentions, users } from "@/lib/db/schema"
import { createId } from "@/lib/utils/ids"
import { eq, and, desc } from "drizzle-orm"
import { revalidatePath } from "next/cache"

/**
 * Parse @username patterns from text and return an array of usernames found.
 */
function parseMentions(text: string): string[] {
  const pattern = /@([a-zA-Z0-9_-]+)/g
  const matches: string[] = []
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    matches.push(match[1])
  }
  return [...new Set(matches)]
}

/**
 * Create mention records for all @username references found in text.
 * Resolves usernames to user IDs and inserts mention rows.
 */
export async function createMentionsFromText(
  text: string,
  mentionedBy: string,
  context: {
    elementId?: string
    taskId?: string
    commentId?: string
  }
) {
  const usernames = parseMentions(text)
  if (usernames.length === 0) return []

  const createdMentions: string[] = []

  for (const username of usernames) {
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1)

    if (userResult.length === 0) continue
    const targetUser = userResult[0]

    // Don't create a mention for the author mentioning themselves
    if (targetUser.id === mentionedBy) continue

    const id = createId()
    await db.insert(mentions).values({
      id,
      userId: targetUser.id,
      mentionedBy,
      elementId: context.elementId ?? null,
      taskId: context.taskId ?? null,
      commentId: context.commentId ?? null,
      context: text.length > 200 ? text.slice(0, 200) + "..." : text,
      isRead: false,
      createdAt: new Date().toISOString(),
    })
    createdMentions.push(id)
  }

  return createdMentions
}

/**
 * Get all unread mentions for a user.
 */
export async function getUnreadMentions(userId: string) {
  return db
    .select()
    .from(mentions)
    .where(and(eq(mentions.userId, userId), eq(mentions.isRead, false)))
    .orderBy(desc(mentions.createdAt))
}

/**
 * Get all mentions for a user.
 */
export async function getMentions(userId: string, limit = 50) {
  return db
    .select()
    .from(mentions)
    .where(eq(mentions.userId, userId))
    .orderBy(desc(mentions.createdAt))
    .limit(limit)
}

/**
 * Mark a mention as read.
 */
export async function markMentionRead(mentionId: string) {
  await db
    .update(mentions)
    .set({ isRead: true })
    .where(eq(mentions.id, mentionId))
  revalidatePath("/")
}

/**
 * Mark all mentions as read for a user.
 */
export async function markAllMentionsRead(userId: string) {
  await db
    .update(mentions)
    .set({ isRead: true })
    .where(eq(mentions.userId, userId))
  revalidatePath("/")
}
