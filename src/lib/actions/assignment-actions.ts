"use server"

import { db } from "@/lib/db"
import {
  taskAssignments,
  watchers,
  mentions,
  tasks,
  users,
  elements,
  notifications,
  taskComments,
} from "@/lib/db/schema"
import { createId } from "@/lib/utils/ids"
import { eq, and, desc } from "drizzle-orm"
import { revalidatePath } from "next/cache"

// ─── Task Assignments ──────────────────────────────────────────────────

export async function assignUser(
  taskId: string,
  userId: string,
  role: "assignee" | "watcher" | "contributor" = "assignee",
  assignedBy?: string,
) {
  const id = createId()

  await db.insert(taskAssignments).values({
    id,
    taskId,
    userId,
    role,
    assignedBy: assignedBy ?? null,
  })

  // Create a notification for the assigned user
  const task = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1)

  const taskTitle = task[0]?.title ?? "a task"

  await db.insert(notifications).values({
    id: createId(),
    type: "assignment",
    title: `You were assigned to "${taskTitle}"`,
    message: `You have been assigned as ${role} on "${taskTitle}"`,
    userId,
    actorId: assignedBy ?? null,
  })

  if (task[0]?.projectId) {
    revalidatePath(`/projects/${task[0].projectId}`)
  }
  revalidatePath("/notifications")

  return id
}

export async function unassignUser(taskId: string, userId: string) {
  await db
    .delete(taskAssignments)
    .where(
      and(
        eq(taskAssignments.taskId, taskId),
        eq(taskAssignments.userId, userId),
      ),
    )

  const task = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1)

  if (task[0]?.projectId) {
    revalidatePath(`/projects/${task[0].projectId}`)
  }
}

export async function getTaskAssignments(taskId: string) {
  return db
    .select({
      assignment: taskAssignments,
      user: {
        id: users.id,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(taskAssignments)
    .innerJoin(users, eq(taskAssignments.userId, users.id))
    .where(eq(taskAssignments.taskId, taskId))
}

export async function getUserAssignments(userId: string) {
  return db
    .select({
      assignment: taskAssignments,
      task: {
        id: tasks.id,
        title: tasks.title,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        isCompleted: tasks.isCompleted,
        projectId: tasks.projectId,
        statusId: tasks.statusId,
      },
    })
    .from(taskAssignments)
    .innerJoin(tasks, eq(taskAssignments.taskId, tasks.id))
    .where(eq(taskAssignments.userId, userId))
}

export async function getAssignedTasks(userId: string) {
  return db
    .select({ task: tasks })
    .from(taskAssignments)
    .innerJoin(tasks, eq(taskAssignments.taskId, tasks.id))
    .where(
      and(
        eq(taskAssignments.userId, userId),
        eq(taskAssignments.role, "assignee"),
      ),
    )
    .orderBy(tasks.dueDate)
}

export async function updateAssignmentRole(
  taskId: string,
  userId: string,
  newRole: "assignee" | "watcher" | "contributor",
) {
  await db
    .update(taskAssignments)
    .set({ role: newRole })
    .where(
      and(
        eq(taskAssignments.taskId, taskId),
        eq(taskAssignments.userId, userId),
      ),
    )

  const task = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1)

  if (task[0]?.projectId) {
    revalidatePath(`/projects/${task[0].projectId}`)
  }
}

// ─── Watchers ──────────────────────────────────────────────────────────

export async function watchElement(elementId: string, userId: string) {
  // Check for duplicates first
  const existing = await db
    .select()
    .from(watchers)
    .where(
      and(
        eq(watchers.elementId, elementId),
        eq(watchers.userId, userId),
      ),
    )
    .limit(1)

  if (existing.length > 0) {
    return existing[0].id
  }

  const id = createId()
  await db.insert(watchers).values({
    id,
    elementId,
    userId,
  })

  revalidatePath("/")
  return id
}

export async function unwatchElement(elementId: string, userId: string) {
  await db
    .delete(watchers)
    .where(
      and(
        eq(watchers.elementId, elementId),
        eq(watchers.userId, userId),
      ),
    )

  revalidatePath("/")
}

export async function getElementWatchers(elementId: string) {
  return db
    .select({
      watcher: watchers,
      user: {
        id: users.id,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(watchers)
    .innerJoin(users, eq(watchers.userId, users.id))
    .where(eq(watchers.elementId, elementId))
}

export async function isWatching(
  elementId: string,
  userId: string,
): Promise<boolean> {
  const result = await db
    .select()
    .from(watchers)
    .where(
      and(
        eq(watchers.elementId, elementId),
        eq(watchers.userId, userId),
      ),
    )
    .limit(1)

  return result.length > 0
}

// ─── Mentions ──────────────────────────────────────────────────────────

export async function createMention(data: {
  userId: string
  mentionedBy: string
  elementId?: string
  taskId?: string
  commentId?: string
  context?: string
}) {
  const id = createId()

  await db.insert(mentions).values({
    id,
    userId: data.userId,
    mentionedBy: data.mentionedBy,
    elementId: data.elementId ?? null,
    taskId: data.taskId ?? null,
    commentId: data.commentId ?? null,
    context: data.context ?? null,
  })

  // Create a notification for the mentioned user
  const mentioner = await db
    .select()
    .from(users)
    .where(eq(users.id, data.mentionedBy))
    .limit(1)

  const mentionerName = mentioner[0]?.displayName ?? "Someone"

  await db.insert(notifications).values({
    id: createId(),
    type: "mention",
    title: `${mentionerName} mentioned you`,
    message: data.context ?? `You were mentioned by ${mentionerName}`,
    elementId: data.elementId ?? null,
    userId: data.userId,
    actorId: data.mentionedBy,
  })

  revalidatePath("/notifications")
  return id
}

export async function getUserMentions(userId: string, unreadOnly?: boolean) {
  const baseConditions = unreadOnly
    ? and(eq(mentions.userId, userId), eq(mentions.isRead, false))
    : eq(mentions.userId, userId)

  return db
    .select({
      mention: mentions,
      mentionedByUser: {
        id: users.id,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(mentions)
    .innerJoin(users, eq(mentions.mentionedBy, users.id))
    .where(baseConditions)
    .orderBy(desc(mentions.createdAt))
}

export async function markMentionRead(id: string) {
  await db
    .update(mentions)
    .set({ isRead: true })
    .where(eq(mentions.id, id))

  revalidatePath("/notifications")
}

export async function markAllMentionsRead(userId: string) {
  await db
    .update(mentions)
    .set({ isRead: true })
    .where(
      and(
        eq(mentions.userId, userId),
        eq(mentions.isRead, false),
      ),
    )

  revalidatePath("/notifications")
}

export function parseMentions(text: string): string[] {
  const pattern = /@([a-zA-Z0-9_]+)/g
  const usernames: string[] = []
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (!usernames.includes(match[1])) {
      usernames.push(match[1])
    }
  }

  return usernames
}

export async function processMentionsInText(
  text: string,
  mentionedBy: string,
  context: { elementId?: string; taskId?: string; commentId?: string },
) {
  const usernames = parseMentions(text)

  for (const username of usernames) {
    const matchedUsers = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1)

    if (matchedUsers.length > 0) {
      await createMention({
        userId: matchedUsers[0].id,
        mentionedBy,
        elementId: context.elementId,
        taskId: context.taskId,
        commentId: context.commentId,
        context: text,
      })
    }
  }
}
