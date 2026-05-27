"use server"

import { db } from "@/lib/db"
import { users, sessions, teams, teamMembers } from "@/lib/db/schema"
import type { User } from "@/lib/db/schema"
import { createId } from "@/lib/utils/ids"
import { eq, and, desc, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import crypto from "node:crypto"

// ─── Password Utilities ────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(8).toString("hex")
  const hash = crypto
    .createHash("sha256")
    .update(salt + password)
    .digest("hex")
  return `${salt}:${hash}`
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  const [salt, hash] = storedHash.split(":")
  if (!salt || !hash) return false
  const computed = crypto
    .createHash("sha256")
    .update(salt + password)
    .digest("hex")
  return computed === hash
}

// ─── User CRUD ─────────────────────────────────────────────────────────

export async function createUser(data: {
  username: string
  displayName: string
  email?: string
  password: string
  role?: User["role"]
}): Promise<{ id: string; error?: string }> {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.username, data.username))
    .limit(1)

  if (existing.length > 0) {
    return { id: "", error: "Username already exists" }
  }

  const passwordHash = await hashPassword(data.password)
  const id = createId()
  const now = new Date().toISOString()

  // First user ever gets the owner role
  const allUsers = await db.select({ id: users.id }).from(users).limit(1)
  const role = allUsers.length === 0 ? "owner" : (data.role ?? "editor")

  await db.insert(users).values({
    id,
    username: data.username,
    displayName: data.displayName,
    email: data.email ?? null,
    passwordHash,
    role,
    createdAt: now,
    updatedAt: now,
  })

  revalidatePath("/settings")
  return { id }
}

export async function getUsers() {
  return db.select().from(users).orderBy(desc(users.createdAt))
}

export async function getUser(id: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1)
  return result[0] ?? null
}

export async function getUserByUsername(username: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1)
  return result[0] ?? null
}

export async function updateUser(
  id: string,
  data: {
    displayName?: string
    email?: string
    avatarUrl?: string
    role?: User["role"]
    isActive?: boolean
  }
) {
  const now = new Date().toISOString()
  await db
    .update(users)
    .set({ ...data, updatedAt: now })
    .where(eq(users.id, id))

  revalidatePath("/settings")
}

export async function deleteUser(id: string) {
  const user = await getUser(id)
  if (!user) return
  if (user.role === "owner") return

  const now = new Date().toISOString()
  await db
    .update(users)
    .set({ isActive: false, updatedAt: now })
    .where(eq(users.id, id))

  revalidatePath("/settings")
}

// ─── Authentication ────────────────────────────────────────────────────

export async function login(
  username: string,
  password: string
): Promise<{ success: boolean; error?: string; user?: User }> {
  const user = await getUserByUsername(username)
  if (!user) {
    return { success: false, error: "Invalid username or password" }
  }

  if (!user.isActive) {
    return { success: false, error: "Account is deactivated" }
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    return { success: false, error: "Invalid username or password" }
  }

  // Create session
  const sessionId = createId()
  const token = crypto.randomBytes(32).toString("hex")
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days

  await db.insert(sessions).values({
    id: sessionId,
    userId: user.id,
    token,
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
  })

  // Update last active
  await db
    .update(users)
    .set({ lastActiveAt: now.toISOString() })
    .where(eq(users.id, user.id))

  // Set cookie
  const cookieStore = await cookies()
  cookieStore.set("flowspace-session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  })

  revalidatePath("/")
  return { success: true, user }
}

export async function logout() {
  const session = await getSession()
  if (session) {
    await db.delete(sessions).where(eq(sessions.id, session.id))
  }

  const cookieStore = await cookies()
  cookieStore.set("flowspace-session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })

  revalidatePath("/")
}

export async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get("flowspace-session")?.value
  if (!token) return null

  const result = await db
    .select()
    .from(sessions)
    .where(eq(sessions.token, token))
    .limit(1)

  if (result.length === 0) return null

  const session = result[0]
  const now = new Date()
  if (new Date(session.expiresAt) < now) {
    await db.delete(sessions).where(eq(sessions.id, session.id))
    return null
  }

  return session
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession()
  if (!session) return null

  const user = await getUser(session.userId)
  if (!user || !user.isActive) return null

  return user
}

// ─── Teams ─────────────────────────────────────────────────────────────

export async function createTeam(data: {
  name: string
  description?: string
  color?: string
  icon?: string
}) {
  const currentUser = await getCurrentUser()
  const id = createId()
  const now = new Date().toISOString()

  await db.insert(teams).values({
    id,
    name: data.name,
    description: data.description ?? null,
    color: data.color ?? null,
    icon: data.icon ?? null,
    createdBy: currentUser?.id ?? null,
    createdAt: now,
    updatedAt: now,
  })

  revalidatePath("/settings")
  return id
}

export async function getTeams() {
  return db.select().from(teams).orderBy(desc(teams.createdAt))
}

export async function getTeam(id: string) {
  const teamResult = await db
    .select()
    .from(teams)
    .where(eq(teams.id, id))
    .limit(1)

  if (teamResult.length === 0) return null

  const members = await getTeamMembers(id)
  return { ...teamResult[0], members }
}

export async function updateTeam(
  id: string,
  data: {
    name?: string
    description?: string
    color?: string
    icon?: string
  }
) {
  const now = new Date().toISOString()
  await db
    .update(teams)
    .set({ ...data, updatedAt: now })
    .where(eq(teams.id, id))

  revalidatePath("/settings")
}

export async function deleteTeam(id: string) {
  await db.delete(teamMembers).where(eq(teamMembers.teamId, id))
  await db.delete(teams).where(eq(teams.id, id))

  revalidatePath("/settings")
}

// ─── Team Members ──────────────────────────────────────────────────────

export async function addTeamMember(
  teamId: string,
  userId: string,
  role?: "lead" | "member"
) {
  const existing = await db
    .select()
    .from(teamMembers)
    .where(
      and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId))
    )

  if (existing.length > 0) return existing[0].id

  const id = createId()
  await db.insert(teamMembers).values({
    id,
    teamId,
    userId,
    role: role ?? "member",
  })

  revalidatePath("/settings")
  return id
}

export async function removeTeamMember(teamId: string, userId: string) {
  await db
    .delete(teamMembers)
    .where(
      and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId))
    )

  revalidatePath("/settings")
}

export async function getTeamMembers(teamId: string) {
  return db
    .select({
      member: teamMembers,
      user: users,
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamId, teamId))
}

export async function getUserTeams(userId: string) {
  return db
    .select({
      membership: teamMembers,
      team: teams,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.userId, userId))
}
