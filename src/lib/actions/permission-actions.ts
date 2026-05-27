"use server"

import { db } from "@/lib/db"
import {
  elementPermissions,
  elements,
  users,
  teams,
  teamMembers,
} from "@/lib/db/schema"
import { createId } from "@/lib/utils/ids"
import { eq, and, or, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"

// ─── Types ─────────────────────────────────────────────────────────────

type PermissionSet = {
  canView: boolean
  canEdit: boolean
  canComment: boolean
  canDelete: boolean
  canManage: boolean
}

const FULL_ACCESS: PermissionSet = {
  canView: true,
  canEdit: true,
  canComment: true,
  canDelete: true,
  canManage: true,
}

const NO_ACCESS: PermissionSet = {
  canView: false,
  canEdit: false,
  canComment: false,
  canDelete: false,
  canManage: false,
}

// ─── Helpers ───────────────────────────────────────────────────────────

function workspaceRoleDefaults(role: string): PermissionSet {
  switch (role) {
    case "owner":
    case "admin":
      return FULL_ACCESS
    case "editor":
      return { canView: true, canEdit: true, canComment: true, canDelete: false, canManage: false }
    case "commenter":
      return { canView: true, canEdit: false, canComment: true, canDelete: false, canManage: false }
    case "viewer":
      return { canView: true, canEdit: false, canComment: false, canDelete: false, canManage: false }
    default:
      return NO_ACCESS
  }
}

function mergePermissions(a: PermissionSet, b: PermissionSet): PermissionSet {
  return {
    canView: a.canView || b.canView,
    canEdit: a.canEdit || b.canEdit,
    canComment: a.canComment || b.canComment,
    canDelete: a.canDelete || b.canDelete,
    canManage: a.canManage || b.canManage,
  }
}

function permFromRow(row: {
  canView: boolean
  canEdit: boolean
  canComment: boolean
  canDelete: boolean
  canManage: boolean
}): PermissionSet {
  return {
    canView: row.canView,
    canEdit: row.canEdit,
    canComment: row.canComment,
    canDelete: row.canDelete,
    canManage: row.canManage,
  }
}

// ─── 1. resolvePermissions ─────────────────────────────────────────────

export async function resolvePermissions(
  userId: string,
  elementId: string
): Promise<PermissionSet> {
  // (a) Get user's workspace role
  const userRows = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (userRows.length === 0) return NO_ACCESS
  const workspaceRole = userRows[0].role

  // (b) Owner or admin -> full access
  if (workspaceRole === "owner" || workspaceRole === "admin") {
    return FULL_ACCESS
  }

  // Get the element to check visibility and creator
  const elementRows = await db
    .select({
      visibility: elements.visibility,
      createdBy: elements.createdBy,
    })
    .from(elements)
    .where(eq(elements.id, elementId))
    .limit(1)

  if (elementRows.length === 0) return NO_ACCESS
  const element = elementRows[0]

  // Creator of a private element gets full access
  if (element.createdBy === userId) {
    return FULL_ACCESS
  }

  // (c) Check direct element permission for this user
  const directPerms = await db
    .select()
    .from(elementPermissions)
    .where(
      and(
        eq(elementPermissions.elementId, elementId),
        eq(elementPermissions.userId, userId)
      )
    )
    .limit(1)

  if (directPerms.length > 0) {
    return permFromRow(directPerms[0])
  }

  // (d) Check team-based permissions
  const userTeams = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId))

  if (userTeams.length > 0) {
    const teamIds = userTeams.map((t) => t.teamId)
    const teamPerms = await db
      .select()
      .from(elementPermissions)
      .where(
        and(
          eq(elementPermissions.elementId, elementId),
          or(...teamIds.map((tid) => eq(elementPermissions.teamId, tid)))
        )
      )

    if (teamPerms.length > 0) {
      // Merge all team permissions (most permissive wins)
      let merged = NO_ACCESS
      for (const tp of teamPerms) {
        merged = mergePermissions(merged, permFromRow(tp))
      }
      return merged
    }
  }

  // (f) Check element visibility
  if (element.visibility === "private") {
    // Only creator (handled above) and explicitly permitted users can access
    return NO_ACCESS
  }

  if (element.visibility === "team") {
    // User must be a member of at least one team to see team-visible elements
    // If they have no team permissions set, they get view-only from team membership
    if (userTeams.length > 0) {
      return { canView: true, canEdit: false, canComment: false, canDelete: false, canManage: false }
    }
    return NO_ACCESS
  }

  // (e) Workspace visibility -> fall back to workspace role defaults
  return workspaceRoleDefaults(workspaceRole)
}

// ─── 2. grantPermission ───────────────────────────────────────────────

export async function grantPermission(data: {
  elementId: string
  userId?: string | null
  teamId?: string | null
  role: "editor" | "commenter" | "viewer"
  canView?: boolean
  canEdit?: boolean
  canComment?: boolean
  canDelete?: boolean
  canManage?: boolean
}) {
  if (!data.userId && !data.teamId) {
    throw new Error("Either userId or teamId must be provided")
  }

  // Determine boolean flags from role if not explicitly provided
  const roleDefaults = workspaceRoleDefaults(data.role)
  const canView = data.canView ?? roleDefaults.canView
  const canEdit = data.canEdit ?? roleDefaults.canEdit
  const canComment = data.canComment ?? roleDefaults.canComment
  const canDelete = data.canDelete ?? roleDefaults.canDelete
  const canManage = data.canManage ?? roleDefaults.canManage

  // Check for existing permission to update instead of duplicating
  const conditions = [eq(elementPermissions.elementId, data.elementId)]
  if (data.userId) {
    conditions.push(eq(elementPermissions.userId, data.userId))
  }
  if (data.teamId) {
    conditions.push(eq(elementPermissions.teamId, data.teamId))
  }

  const existing = await db
    .select({ id: elementPermissions.id })
    .from(elementPermissions)
    .where(and(...conditions))
    .limit(1)

  if (existing.length > 0) {
    // Update existing permission
    await db
      .update(elementPermissions)
      .set({
        role: data.role,
        canView,
        canEdit,
        canComment,
        canDelete,
        canManage,
      })
      .where(eq(elementPermissions.id, existing[0].id))

    revalidatePath("/")
    return { id: existing[0].id }
  }

  // Create new permission
  const id = createId()
  await db.insert(elementPermissions).values({
    id,
    elementId: data.elementId,
    userId: data.userId ?? null,
    teamId: data.teamId ?? null,
    role: data.role,
    canView,
    canEdit,
    canComment,
    canDelete,
    canManage,
  })

  revalidatePath("/")
  return { id }
}

// ─── 3. revokePermission ──────────────────────────────────────────────

export async function revokePermission(id: string) {
  await db
    .delete(elementPermissions)
    .where(eq(elementPermissions.id, id))

  revalidatePath("/")
}

// ─── 4. getElementPermissions ─────────────────────────────────────────

export async function getElementPermissions(elementId: string) {
  const perms = await db
    .select({
      id: elementPermissions.id,
      elementId: elementPermissions.elementId,
      userId: elementPermissions.userId,
      teamId: elementPermissions.teamId,
      role: elementPermissions.role,
      canView: elementPermissions.canView,
      canEdit: elementPermissions.canEdit,
      canComment: elementPermissions.canComment,
      canDelete: elementPermissions.canDelete,
      canManage: elementPermissions.canManage,
      inheritedFrom: elementPermissions.inheritedFrom,
      createdAt: elementPermissions.createdAt,
      userName: users.displayName,
      userEmail: users.email,
      teamName: teams.name,
      teamColor: teams.color,
    })
    .from(elementPermissions)
    .leftJoin(users, eq(elementPermissions.userId, users.id))
    .leftJoin(teams, eq(elementPermissions.teamId, teams.id))
    .where(eq(elementPermissions.elementId, elementId))

  return perms
}

// ─── 5. updateElementVisibility ───────────────────────────────────────

export async function updateElementVisibility(
  elementId: string,
  visibility: "private" | "team" | "workspace"
) {
  await db
    .update(elements)
    .set({
      visibility,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(elements.id, elementId))

  revalidatePath("/")
}

// ─── 6. canUserPerform ────────────────────────────────────────────────

export async function canUserPerform(
  userId: string,
  elementId: string,
  action: "view" | "edit" | "comment" | "delete" | "manage"
): Promise<boolean> {
  const perms = await resolvePermissions(userId, elementId)

  switch (action) {
    case "view":
      return perms.canView
    case "edit":
      return perms.canEdit
    case "comment":
      return perms.canComment
    case "delete":
      return perms.canDelete
    case "manage":
      return perms.canManage
    default:
      return false
  }
}

// ─── 7. getAccessibleElements ─────────────────────────────────────────

export async function getAccessibleElements(userId: string): Promise<string[]> {
  // Get user's workspace role
  const userRows = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (userRows.length === 0) return []
  const workspaceRole = userRows[0].role

  // Owners and admins can see everything
  if (workspaceRole === "owner" || workspaceRole === "admin") {
    const allElements = await db
      .select({ id: elements.id })
      .from(elements)
      .where(eq(elements.isDeleted, false))
    return allElements.map((e) => e.id)
  }

  // Get user's team IDs
  const userTeams = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId))
  const teamIds = userTeams.map((t) => t.teamId)

  // Workspace-visible elements are accessible to all workspace members
  const workspaceElements = await db
    .select({ id: elements.id })
    .from(elements)
    .where(
      and(
        eq(elements.isDeleted, false),
        eq(elements.visibility, "workspace")
      )
    )

  // Elements created by this user
  const ownedElements = await db
    .select({ id: elements.id })
    .from(elements)
    .where(
      and(
        eq(elements.isDeleted, false),
        eq(elements.createdBy, userId)
      )
    )

  // Elements with direct user permissions
  const directPermElements = await db
    .select({ elementId: elementPermissions.elementId })
    .from(elementPermissions)
    .where(
      and(
        eq(elementPermissions.userId, userId),
        eq(elementPermissions.canView, true)
      )
    )

  // Elements with team permissions
  let teamPermElements: { elementId: string }[] = []
  if (teamIds.length > 0) {
    teamPermElements = await db
      .select({ elementId: elementPermissions.elementId })
      .from(elementPermissions)
      .where(
        and(
          or(...teamIds.map((tid) => eq(elementPermissions.teamId, tid))),
          eq(elementPermissions.canView, true)
        )
      )
  }

  // Team-visible elements (if user is in any team)
  let teamVisibleElements: { id: string }[] = []
  if (teamIds.length > 0) {
    teamVisibleElements = await db
      .select({ id: elements.id })
      .from(elements)
      .where(
        and(
          eq(elements.isDeleted, false),
          eq(elements.visibility, "team")
        )
      )
  }

  // Deduplicate
  const idSet = new Set<string>()
  for (const e of workspaceElements) idSet.add(e.id)
  for (const e of ownedElements) idSet.add(e.id)
  for (const e of directPermElements) idSet.add(e.elementId)
  for (const e of teamPermElements) idSet.add(e.elementId)
  for (const e of teamVisibleElements) idSet.add(e.id)

  return Array.from(idSet)
}

// ─── 8. propagatePermissions ──────────────────────────────────────────

export async function propagatePermissions(parentElementId: string) {
  // Get all permissions on the parent element (excluding inherited ones to avoid loops)
  const parentPerms = await db
    .select()
    .from(elementPermissions)
    .where(
      and(
        eq(elementPermissions.elementId, parentElementId),
        sql`${elementPermissions.inheritedFrom} IS NULL`
      )
    )

  if (parentPerms.length === 0) return

  // Get child elements
  const children = await db
    .select({ id: elements.id })
    .from(elements)
    .where(
      and(
        eq(elements.parentId, parentElementId),
        eq(elements.isDeleted, false)
      )
    )

  if (children.length === 0) return

  for (const child of children) {
    // Remove old inherited permissions from this parent
    await db
      .delete(elementPermissions)
      .where(
        and(
          eq(elementPermissions.elementId, child.id),
          eq(elementPermissions.inheritedFrom, parentElementId)
        )
      )

    // Create new inherited permissions
    for (const perm of parentPerms) {
      await db.insert(elementPermissions).values({
        id: createId(),
        elementId: child.id,
        userId: perm.userId,
        teamId: perm.teamId,
        role: perm.role,
        canView: perm.canView,
        canEdit: perm.canEdit,
        canComment: perm.canComment,
        canDelete: perm.canDelete,
        canManage: perm.canManage,
        inheritedFrom: parentElementId,
      })
    }

    // Recursively propagate to grandchildren
    await propagatePermissions(child.id)
  }

  revalidatePath("/")
}
