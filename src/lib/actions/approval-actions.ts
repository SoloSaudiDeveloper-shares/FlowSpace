"use server"

import { db } from "@/lib/db"
import { approvals, users, elements, tasks, notifications } from "@/lib/db/schema"
import { createId } from "@/lib/utils/ids"
import { eq, and, desc, or } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { getCurrentUser } from "./user-actions"

export async function createApproval(data: {
  elementId?: string
  taskId?: string
  assignedTo: string
  comment?: string
}) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Not authenticated")

  const id = createId()
  const now = new Date().toISOString()

  await db.insert(approvals).values({
    id,
    elementId: data.elementId ?? null,
    taskId: data.taskId ?? null,
    requestedBy: user.id,
    assignedTo: data.assignedTo,
    status: "pending",
    comment: data.comment ?? null,
    createdAt: now,
  })

  // Create notification for the assignee
  const subject = data.elementId
    ? (await db.select().from(elements).where(eq(elements.id, data.elementId)).limit(1))[0]
    : data.taskId
      ? (await db.select().from(tasks).where(eq(tasks.id, data.taskId)).limit(1))[0]
      : null

  await db.insert(notifications).values({
    id: createId(),
    type: "approval_request",
    title: `Approval requested by ${user.displayName}`,
    message: subject ? `Please review: ${("title" in subject ? subject.title : "")}` : "You have a new approval request",
    elementId: data.elementId ?? null,
    userId: data.assignedTo,
    actorId: user.id,
    createdAt: now,
  })

  revalidatePath("/approvals")
  return id
}

export async function getApprovals(filter?: "pending" | "approved" | "rejected" | "changes_requested" | "all") {
  const all = await db
    .select({
      approval: approvals,
      requester: users,
    })
    .from(approvals)
    .innerJoin(users, eq(approvals.requestedBy, users.id))
    .orderBy(desc(approvals.createdAt))

  if (!filter || filter === "all") return all
  return all.filter((a) => a.approval.status === filter)
}

export async function getMyApprovals() {
  const user = await getCurrentUser()
  if (!user) return []

  return db
    .select({
      approval: approvals,
      requester: users,
    })
    .from(approvals)
    .innerJoin(users, eq(approvals.requestedBy, users.id))
    .where(
      or(
        eq(approvals.assignedTo, user.id),
        eq(approvals.requestedBy, user.id)
      )
    )
    .orderBy(desc(approvals.createdAt))
}

export async function getApproval(id: string) {
  const result = await db
    .select()
    .from(approvals)
    .where(eq(approvals.id, id))
    .limit(1)
  return result[0] ?? null
}

export async function resolveApproval(
  id: string,
  status: "approved" | "rejected" | "changes_requested",
  comment?: string
) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Not authenticated")

  const now = new Date().toISOString()

  await db
    .update(approvals)
    .set({
      status,
      comment: comment ?? null,
      resolvedAt: now,
    })
    .where(eq(approvals.id, id))

  // Notify the requester
  const approval = await getApproval(id)
  if (approval) {
    const statusLabel = status === "approved" ? "approved" : status === "rejected" ? "rejected" : "requested changes on"

    await db.insert(notifications).values({
      id: createId(),
      type: "approval_request",
      title: `${user.displayName} ${statusLabel} your request`,
      message: comment || undefined,
      elementId: approval.elementId ?? null,
      userId: approval.requestedBy,
      actorId: user.id,
      createdAt: now,
    })
  }

  revalidatePath("/approvals")
}

export async function deleteApproval(id: string) {
  await db.delete(approvals).where(eq(approvals.id, id))
  revalidatePath("/approvals")
}

export async function getPendingApprovalCount() {
  const user = await getCurrentUser()
  if (!user) return 0

  const pending = await db
    .select()
    .from(approvals)
    .where(
      and(
        eq(approvals.assignedTo, user.id),
        eq(approvals.status, "pending")
      )
    )
  return pending.length
}
