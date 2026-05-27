"use server"

import { db } from "@/lib/db"
import {
  feedEvents,
  feedSubscriptions,
  feedViews,
  feedFilters,
  feedReadState,
  feedPins,
  users,
  elements,
  tasks,
  teams,
} from "@/lib/db/schema"
import { createId } from "@/lib/utils/ids"
import { eq, and, desc, or, inArray, sql, like } from "drizzle-orm"
import { revalidatePath } from "next/cache"

// ─── Feed Event Types ────────────────────────────────────────────────────

type FeedEventType =
  | "task_created" | "task_updated" | "task_completed" | "task_overdue"
  | "task_assigned" | "comment_added" | "comment_mention" | "page_updated"
  | "canvas_updated" | "process_step_completed" | "reminder_triggered"
  | "dependency_cleared" | "attachment_uploaded" | "approval_requested"
  | "approval_completed" | "template_used" | "form_submitted"
  | "automation_fired" | "project_milestone" | "backup_completed"
  | "backup_failed" | "user_joined" | "permission_changed"

type FeedPriority = "low" | "normal" | "high"
type FeedVisibility = "private" | "team" | "workspace"
type FeedSourceType = "manual" | "system" | "automation" | "form" | "api"
type SubscriptionTargetType = "project" | "element" | "team" | "user" | "label" | "automation"

// ─── Feed Events ─────────────────────────────────────────────────────────

export async function createFeedEvent(data: {
  type: FeedEventType
  actorUserId?: string
  subjectElementId?: string
  subjectTaskId?: string
  parentElementId?: string
  teamId?: string
  projectId?: string
  title: string
  summary?: string
  payload?: string
  priority?: FeedPriority
  visibility?: FeedVisibility
  sourceType?: FeedSourceType
}) {
  const id = createId()
  const now = new Date().toISOString()

  await db.insert(feedEvents).values({
    id,
    type: data.type,
    actorUserId: data.actorUserId ?? null,
    subjectElementId: data.subjectElementId ?? null,
    subjectTaskId: data.subjectTaskId ?? null,
    parentElementId: data.parentElementId ?? null,
    teamId: data.teamId ?? null,
    projectId: data.projectId ?? null,
    title: data.title,
    summary: data.summary ?? null,
    payload: data.payload ?? null,
    priority: data.priority ?? "normal",
    visibility: data.visibility ?? "workspace",
    sourceType: data.sourceType ?? "system",
    createdAt: now,
  })

  revalidatePath("/")
  return id
}

export async function getGlobalFeed(options?: {
  limit?: number
  offset?: number
  types?: FeedEventType[]
  projectId?: string
  priority?: FeedPriority
  sourceType?: FeedSourceType
}) {
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0

  const conditions: ReturnType<typeof eq>[] = []

  if (options?.types && options.types.length > 0) {
    conditions.push(inArray(feedEvents.type, options.types))
  }
  if (options?.projectId) {
    conditions.push(eq(feedEvents.projectId, options.projectId))
  }
  if (options?.priority) {
    conditions.push(eq(feedEvents.priority, options.priority))
  }
  if (options?.sourceType) {
    conditions.push(eq(feedEvents.sourceType, options.sourceType))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const results = await db
    .select({
      event: feedEvents,
      actorDisplayName: users.displayName,
      actorAvatarUrl: users.avatarUrl,
    })
    .from(feedEvents)
    .leftJoin(users, eq(feedEvents.actorUserId, users.id))
    .where(whereClause)
    .orderBy(desc(feedEvents.createdAt))
    .limit(limit)
    .offset(offset)

  return results
}

export async function getMyFeed(userId: string, options?: {
  limit?: number
  offset?: number
}) {
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0

  // Get user's active (non-muted) subscriptions
  const subs = await db
    .select()
    .from(feedSubscriptions)
    .where(
      and(
        eq(feedSubscriptions.userId, userId),
        eq(feedSubscriptions.isMuted, false)
      )
    )

  const projectIds: string[] = []
  const elementIds: string[] = []
  const teamIds: string[] = []
  const userIds: string[] = []

  for (const sub of subs) {
    switch (sub.targetType) {
      case "project":
        projectIds.push(sub.targetId)
        break
      case "element":
        elementIds.push(sub.targetId)
        break
      case "team":
        teamIds.push(sub.targetId)
        break
      case "user":
        userIds.push(sub.targetId)
        break
    }
  }

  // Build OR conditions for relevance
  const relevanceConditions: ReturnType<typeof eq>[] = []

  // Events where the user is the actor
  relevanceConditions.push(eq(feedEvents.actorUserId, userId))

  if (projectIds.length > 0) {
    relevanceConditions.push(inArray(feedEvents.projectId, projectIds))
  }
  if (elementIds.length > 0) {
    relevanceConditions.push(inArray(feedEvents.subjectElementId, elementIds))
  }
  if (teamIds.length > 0) {
    relevanceConditions.push(inArray(feedEvents.teamId, teamIds))
  }
  if (userIds.length > 0) {
    relevanceConditions.push(inArray(feedEvents.actorUserId, userIds))
  }

  const results = await db
    .select({
      event: feedEvents,
      actorDisplayName: users.displayName,
      actorAvatarUrl: users.avatarUrl,
    })
    .from(feedEvents)
    .leftJoin(users, eq(feedEvents.actorUserId, users.id))
    .where(or(...relevanceConditions))
    .orderBy(desc(feedEvents.createdAt))
    .limit(limit)
    .offset(offset)

  return results
}

export async function getProjectFeed(projectId: string, options?: {
  limit?: number
  offset?: number
  types?: FeedEventType[]
}) {
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0

  const conditions: ReturnType<typeof eq>[] = [
    eq(feedEvents.projectId, projectId),
  ]

  if (options?.types && options.types.length > 0) {
    conditions.push(inArray(feedEvents.type, options.types))
  }

  const results = await db
    .select({
      event: feedEvents,
      actorDisplayName: users.displayName,
      actorAvatarUrl: users.avatarUrl,
    })
    .from(feedEvents)
    .leftJoin(users, eq(feedEvents.actorUserId, users.id))
    .where(and(...conditions))
    .orderBy(desc(feedEvents.createdAt))
    .limit(limit)
    .offset(offset)

  return results
}

export async function getElementFeed(elementId: string, options?: {
  limit?: number
  offset?: number
}) {
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0

  const results = await db
    .select({
      event: feedEvents,
      actorDisplayName: users.displayName,
      actorAvatarUrl: users.avatarUrl,
    })
    .from(feedEvents)
    .leftJoin(users, eq(feedEvents.actorUserId, users.id))
    .where(eq(feedEvents.subjectElementId, elementId))
    .orderBy(desc(feedEvents.createdAt))
    .limit(limit)
    .offset(offset)

  return results
}

export async function getTeamFeed(teamId: string, options?: {
  limit?: number
  offset?: number
}) {
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0

  const results = await db
    .select({
      event: feedEvents,
      actorDisplayName: users.displayName,
      actorAvatarUrl: users.avatarUrl,
    })
    .from(feedEvents)
    .leftJoin(users, eq(feedEvents.actorUserId, users.id))
    .where(eq(feedEvents.teamId, teamId))
    .orderBy(desc(feedEvents.createdAt))
    .limit(limit)
    .offset(offset)

  return results
}

export async function getAdminFeed(options?: {
  limit?: number
  offset?: number
}) {
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0

  const adminTypes: FeedEventType[] = [
    "backup_completed",
    "backup_failed",
    "user_joined",
    "permission_changed",
    "automation_fired",
  ]

  const results = await db
    .select({
      event: feedEvents,
      actorDisplayName: users.displayName,
      actorAvatarUrl: users.avatarUrl,
    })
    .from(feedEvents)
    .leftJoin(users, eq(feedEvents.actorUserId, users.id))
    .where(inArray(feedEvents.type, adminTypes))
    .orderBy(desc(feedEvents.createdAt))
    .limit(limit)
    .offset(offset)

  return results
}

// ─── Subscriptions ───────────────────────────────────────────────────────

export async function subscribe(
  userId: string,
  targetType: SubscriptionTargetType,
  targetId: string
) {
  // Check for duplicate
  const existing = await db
    .select()
    .from(feedSubscriptions)
    .where(
      and(
        eq(feedSubscriptions.userId, userId),
        eq(feedSubscriptions.targetType, targetType),
        eq(feedSubscriptions.targetId, targetId)
      )
    )

  if (existing.length > 0) return existing[0].id

  const id = createId()
  await db.insert(feedSubscriptions).values({
    id,
    userId,
    targetType,
    targetId,
    isMuted: false,
    createdAt: new Date().toISOString(),
  })

  revalidatePath("/")
  return id
}

export async function unsubscribe(
  userId: string,
  targetType: SubscriptionTargetType,
  targetId: string
) {
  await db
    .delete(feedSubscriptions)
    .where(
      and(
        eq(feedSubscriptions.userId, userId),
        eq(feedSubscriptions.targetType, targetType),
        eq(feedSubscriptions.targetId, targetId)
      )
    )

  revalidatePath("/")
}

export async function muteSubscription(
  userId: string,
  targetType: SubscriptionTargetType,
  targetId: string
) {
  await db
    .update(feedSubscriptions)
    .set({ isMuted: true })
    .where(
      and(
        eq(feedSubscriptions.userId, userId),
        eq(feedSubscriptions.targetType, targetType),
        eq(feedSubscriptions.targetId, targetId)
      )
    )

  revalidatePath("/")
}

export async function unmuteSubscription(
  userId: string,
  targetType: SubscriptionTargetType,
  targetId: string
) {
  await db
    .update(feedSubscriptions)
    .set({ isMuted: false })
    .where(
      and(
        eq(feedSubscriptions.userId, userId),
        eq(feedSubscriptions.targetType, targetType),
        eq(feedSubscriptions.targetId, targetId)
      )
    )

  revalidatePath("/")
}

export async function getUserSubscriptions(userId: string) {
  return db
    .select()
    .from(feedSubscriptions)
    .where(eq(feedSubscriptions.userId, userId))
    .orderBy(desc(feedSubscriptions.createdAt))
}

export async function isSubscribed(
  userId: string,
  targetType: SubscriptionTargetType,
  targetId: string
): Promise<boolean> {
  const result = await db
    .select()
    .from(feedSubscriptions)
    .where(
      and(
        eq(feedSubscriptions.userId, userId),
        eq(feedSubscriptions.targetType, targetType),
        eq(feedSubscriptions.targetId, targetId)
      )
    )
    .limit(1)

  return result.length > 0
}

// ─── Read State ──────────────────────────────────────────────────────────

export async function markEventRead(userId: string, eventId: string) {
  // Check if already marked
  const existing = await db
    .select()
    .from(feedReadState)
    .where(
      and(
        eq(feedReadState.userId, userId),
        eq(feedReadState.eventId, eventId)
      )
    )

  if (existing.length > 0) return existing[0].id

  const id = createId()
  await db.insert(feedReadState).values({
    id,
    userId,
    eventId,
    readAt: new Date().toISOString(),
  })

  revalidatePath("/")
  return id
}

export async function markAllRead(userId: string, beforeDate?: string) {
  const cutoff = beforeDate ?? new Date().toISOString()

  // Get all unread event ids for this user before the cutoff
  const allEvents = await db
    .select({ id: feedEvents.id })
    .from(feedEvents)
    .where(sql`${feedEvents.createdAt} <= ${cutoff}`)

  const allEventIds = allEvents.map((e) => e.id)
  if (allEventIds.length === 0) return

  // Get already-read event ids for this user
  const alreadyRead = await db
    .select({ eventId: feedReadState.eventId })
    .from(feedReadState)
    .where(eq(feedReadState.userId, userId))

  const alreadyReadSet = new Set(alreadyRead.map((r) => r.eventId))
  const unreadIds = allEventIds.filter((id) => !alreadyReadSet.has(id))

  if (unreadIds.length === 0) return

  const now = new Date().toISOString()
  const values = unreadIds.map((eventId) => ({
    id: createId(),
    userId,
    eventId,
    readAt: now,
  }))

  // Insert in batches to avoid SQLite variable limit
  const batchSize = 100
  for (let i = 0; i < values.length; i += batchSize) {
    const batch = values.slice(i, i + batchSize)
    await db.insert(feedReadState).values(batch)
  }

  revalidatePath("/")
}

export async function getUnreadCount(userId: string): Promise<number> {
  const result = await db
    .select({
      count: sql<number>`count(${feedEvents.id})`,
    })
    .from(feedEvents)
    .leftJoin(
      feedReadState,
      and(
        eq(feedReadState.eventId, feedEvents.id),
        eq(feedReadState.userId, userId)
      )
    )
    .where(sql`${feedReadState.id} IS NULL`)

  return result[0]?.count ?? 0
}

// ─── Pins ────────────────────────────────────────────────────────────────

export async function pinEvent(userId: string, eventId: string) {
  // Check for duplicate
  const existing = await db
    .select()
    .from(feedPins)
    .where(
      and(
        eq(feedPins.userId, userId),
        eq(feedPins.eventId, eventId)
      )
    )

  if (existing.length > 0) return existing[0].id

  const id = createId()
  await db.insert(feedPins).values({
    id,
    userId,
    eventId,
    createdAt: new Date().toISOString(),
  })

  revalidatePath("/")
  return id
}

export async function unpinEvent(userId: string, eventId: string) {
  await db
    .delete(feedPins)
    .where(
      and(
        eq(feedPins.userId, userId),
        eq(feedPins.eventId, eventId)
      )
    )

  revalidatePath("/")
}

export async function getPinnedEvents(userId: string) {
  const results = await db
    .select({
      pin: feedPins,
      event: feedEvents,
      actorDisplayName: users.displayName,
      actorAvatarUrl: users.avatarUrl,
    })
    .from(feedPins)
    .innerJoin(feedEvents, eq(feedPins.eventId, feedEvents.id))
    .leftJoin(users, eq(feedEvents.actorUserId, users.id))
    .where(eq(feedPins.userId, userId))
    .orderBy(desc(feedPins.createdAt))

  return results
}

// ─── Views ───────────────────────────────────────────────────────────────

export async function createFeedView(
  userId: string,
  data: {
    name: string
    filterJson?: string
    isDefault?: boolean
  }
) {
  // If setting as default, unset other defaults for this user
  if (data.isDefault) {
    await db
      .update(feedViews)
      .set({ isDefault: false })
      .where(eq(feedViews.userId, userId))
  }

  const id = createId()
  await db.insert(feedViews).values({
    id,
    userId,
    name: data.name,
    filterJson: data.filterJson ?? null,
    isDefault: data.isDefault ?? false,
    createdAt: new Date().toISOString(),
  })

  revalidatePath("/")
  return id
}

export async function getFeedViews(userId: string) {
  return db
    .select()
    .from(feedViews)
    .where(eq(feedViews.userId, userId))
    .orderBy(desc(feedViews.createdAt))
}

export async function updateFeedView(
  id: string,
  data: {
    name?: string
    filterJson?: string
    isDefault?: boolean
  }
) {
  // If setting as default, find the owner first and unset their other defaults
  if (data.isDefault) {
    const view = await db
      .select()
      .from(feedViews)
      .where(eq(feedViews.id, id))
      .limit(1)

    if (view.length > 0) {
      await db
        .update(feedViews)
        .set({ isDefault: false })
        .where(eq(feedViews.userId, view[0].userId))
    }
  }

  await db.update(feedViews).set(data).where(eq(feedViews.id, id))

  revalidatePath("/")
}

export async function deleteFeedView(id: string) {
  // Filters cascade-delete via FK
  await db.delete(feedViews).where(eq(feedViews.id, id))

  revalidatePath("/")
}

// ─── Helpers ─────────────────────────────────────────────────────────────

export async function publishFeedEvent(
  type: FeedEventType,
  data: {
    actorUserId?: string
    subjectElementId?: string
    subjectTaskId?: string
    parentElementId?: string
    teamId?: string
    projectId?: string
    title: string
    summary?: string
    payload?: Record<string, unknown>
    priority?: FeedPriority
    visibility?: FeedVisibility
    sourceType?: FeedSourceType
  }
) {
  return createFeedEvent({
    type,
    actorUserId: data.actorUserId,
    subjectElementId: data.subjectElementId,
    subjectTaskId: data.subjectTaskId,
    parentElementId: data.parentElementId,
    teamId: data.teamId,
    projectId: data.projectId,
    title: data.title,
    summary: data.summary,
    payload: data.payload ? JSON.stringify(data.payload) : undefined,
    priority: data.priority ?? "normal",
    visibility: data.visibility ?? "workspace",
    sourceType: data.sourceType ?? "system",
  })
}
