"use server"

import { db, sqlite } from "@/lib/db"
import { users, sessions, teams, teamMembers } from "@/lib/db/schema"
import type { User } from "@/lib/db/schema"
import { createId } from "@/lib/utils/ids"
import { eq, and, desc, sql, or, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { cookies, headers } from "next/headers"
import crypto from "node:crypto"
import bcrypt from "bcrypt"
import { checkLoginRateLimit, recordFailedLogin, clearLoginAttempts } from "@/lib/auth/rate-limit"

// ─── Password Utilities ────────────────────────────────────────────────
//
// Storage format: bcrypt's standard `$2b$12$...` strings. Older accounts
// created before this commit are stored as `<salt-hex>:<sha256-hex>` —
// verifyPassword detects that and accepts both, transparently re-hashing
// to bcrypt on the next successful login (see verifyPasswordAndMaybeUpgrade
// below).

const BCRYPT_COST = 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST)
}

/**
 * Plain compare. Use this from non-login contexts (e.g. password-change
 * forms confirming the old password). Login itself calls
 * verifyPasswordAndMaybeUpgrade to opportunistically migrate legacy hashes.
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  if (storedHash.startsWith("$2")) {
    return bcrypt.compare(password, storedHash)
  }
  // Legacy SHA-256 fallback (pre-bcrypt accounts)
  const [salt, hash] = storedHash.split(":")
  if (!salt || !hash) return false
  const computed = crypto.createHash("sha256").update(salt + password).digest("hex")
  return computed === hash
}

/**
 * Verifies the password and silently upgrades the stored hash to bcrypt
 * if the stored value is still in the legacy SHA-256 format. Safe to call
 * on every login.
 */
async function verifyPasswordAndMaybeUpgrade(
  userId: string,
  password: string,
  storedHash: string
): Promise<boolean> {
  const ok = await verifyPassword(password, storedHash)
  if (!ok) return false
  if (!storedHash.startsWith("$2")) {
    // Upgrade silently — user keeps their password, we just store a stronger hash.
    try {
      const newHash = await bcrypt.hash(password, BCRYPT_COST)
      await db
        .update(users)
        .set({ passwordHash: newHash, updatedAt: new Date().toISOString() })
        .where(eq(users.id, userId))
    } catch {
      // Don't fail login just because the upgrade write failed — log and continue.
      // The next successful login will retry.
    }
  }
  return true
}

// ─── User CRUD ─────────────────────────────────────────────────────────

export async function createUser(data: {
  username: string
  displayName: string
  email?: string
  password: string
  role?: User["role"]
}): Promise<{ id: string; error?: string }> {
  // Signup gate: anyone can create the FIRST account (initial owner
  // setup), but additional accounts are only allowed when the owner has
  // explicitly enabled signups.
  const userCount = (await db.select({ id: users.id }).from(users).limit(1)).length
  if (userCount > 0) {
    const { getSignupsEnabled } = await import("./server-settings-actions")
    const signupsEnabled = await getSignupsEnabled()
    if (!signupsEnabled) {
      return { id: "", error: "Signups are closed. Ask the owner to enable them." }
    }
  }

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

  // Seed showcase templates into the new user's workspace so they have
  // something to explore on first login. Failure here doesn't block
  // signup — it's a nice-to-have, not load-bearing.
  try {
    const { sqlite } = await import("@/lib/db")
    const { seedShowcaseTemplates } = await import("@/lib/db/seed-showcase-templates")
    seedShowcaseTemplates(sqlite, id)
  } catch (err) {
    console.error("[signup] template seed failed for", id, err)
  }

  // Send an email verification link in the background. Only if the user
  // gave an email AND SMTP is configured on the server. Doesn't block.
  if (data.email) {
    try {
      const { requestEmailVerification } = await import("./email-verification-actions")
      await requestEmailVerification(id)
    } catch (err) {
      console.error("[signup] verification email failed for", id, err)
    }
  }

  revalidatePath("/settings")
  return { id }
}

/**
 * Owner-only directory of every user in the workspace. Throws "Forbidden"
 * if the caller isn't the owner — defense in depth in case anything other
 * than the admin panel imports this. Other callers should use
 * getVisibleUsers() which scopes to the caller's own teams.
 */
export async function getUsers() {
  const me = await getCurrentUser()
  if (!me || me.role !== "owner") throw new Error("Forbidden")
  return db.select().from(users).orderBy(desc(users.createdAt))
}

/**
 * Change the current user's password. Verifies the old password first,
 * hashes the new one with bcrypt (cost 12), wipes all OTHER sessions
 * for this user so a stale device can't keep its session with the old
 * credential context.
 */
export async function changeMyPassword(
  currentPassword: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: "Not signed in" }
  if (!newPassword || newPassword.length < 8) {
    return { ok: false, error: "New password must be at least 8 characters" }
  }
  if (currentPassword === newPassword) {
    return { ok: false, error: "Pick a different password than your current one" }
  }
  const stored = await db.select().from(users).where(eq(users.id, me.id)).limit(1)
  if (stored.length === 0) return { ok: false, error: "User not found" }
  const ok = await verifyPassword(currentPassword, stored[0].passwordHash)
  if (!ok) return { ok: false, error: "Current password is incorrect" }

  const newHash = await bcrypt.hash(newPassword, 12)
  await db
    .update(users)
    .set({ passwordHash: newHash, updatedAt: new Date().toISOString() })
    .where(eq(users.id, me.id))

  // Invalidate other sessions but keep the current one alive so the user
  // doesn't get bounced out mid-flow. Best-effort.
  try {
    const cookieStore = await cookies()
    const currentToken = cookieStore.get("flowspace-session")?.value
    if (currentToken) {
      await db.delete(sessions).where(
        and(eq(sessions.userId, me.id), sql`token != ${currentToken}`)
      )
    } else {
      await db.delete(sessions).where(eq(sessions.userId, me.id))
    }
  } catch {
    // non-fatal
  }

  return { ok: true }
}

/**
 * Cheap "does any user exist?" probe used by the layout to decide whether
 * to force initial setup. Doesn't return any user data.
 */
export async function hasAnyUsers(): Promise<boolean> {
  const row = await db.select({ id: users.id }).from(users).limit(1)
  return row.length > 0
}

/**
 * What the current user is allowed to see on the People page. Default
 * behaviour: only themselves. Once teams are wired up they'll also see
 * everyone in any team they're a member of. No global directory leak.
 */
export async function getVisibleUsers() {
  const me = await getCurrentUser()
  if (!me) return []

  // Collect every user id that shares a team with `me`.
  const teamIds = (
    await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, me.id))
  ).map((r) => r.teamId)

  if (teamIds.length === 0) {
    // Solo user — see only yourself.
    return db.select().from(users).where(eq(users.id, me.id))
  }

  const memberIds = (
    await db
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .where(inArray(teamMembers.teamId, teamIds))
  ).map((r) => r.userId)

  // De-dup and always include self
  const idSet = new Set<string>([me.id, ...memberIds])
  return db
    .select()
    .from(users)
    .where(inArray(users.id, Array.from(idSet)))
    .orderBy(desc(users.createdAt))
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
  password: string,
  twoFactorCode?: string,
): Promise<{ success: boolean; error?: string; user?: User; needsTwoFactor?: boolean }> {
  // Pull the caller's IP from the request headers (proxied behind Caddy)
  const h = await headers()
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"

  // Block first — never reveal whether the username exists when throttled
  const limit = checkLoginRateLimit(ip, username)
  if (limit.blocked) {
    return { success: false, error: limit.reason }
  }

  const user = await getUserByUsername(username)
  if (!user) {
    recordFailedLogin(ip, username)
    return { success: false, error: "Invalid username or password" }
  }

  if (!user.isActive) {
    recordFailedLogin(ip, username)
    return { success: false, error: "Account is deactivated" }
  }

  const valid = await verifyPasswordAndMaybeUpgrade(user.id, password, user.passwordHash)
  if (!valid) {
    recordFailedLogin(ip, username)
    return { success: false, error: "Invalid username or password" }
  }

  // 2FA challenge — if the user has TOTP enabled, gate session creation
  // on a valid code. We use the same rate-limit record so brute-forcing
  // codes burns into the per-(IP,username) failure budget.
  const twoFactorRow = sqlite
    .prepare(`SELECT totp_enabled FROM users WHERE id = ?`)
    .get(user.id) as { totp_enabled: number } | undefined
  if (twoFactorRow?.totp_enabled === 1) {
    if (!twoFactorCode) {
      // Don't record a failure — they passed the password check; this
      // is just a UI prompt.
      return { success: false, needsTwoFactor: true, error: "Two-factor code required" }
    }
    const { verifyTwoFactorForLogin } = await import("@/lib/auth/two-factor-verify")
    if (!verifyTwoFactorForLogin(user.id, twoFactorCode)) {
      recordFailedLogin(ip, username)
      return { success: false, needsTwoFactor: true, error: "Two-factor code didn't match" }
    }
  }

  // Successful login — clear the per-(IP,username) record so the user
  // doesn't carry forward fail counts after they finally typed the right pw.
  clearLoginAttempts(ip, username)

  // Create session — duration comes from the admin-configurable setting
  // (defaults to 7 days). Setting it to e.g. 3 minutes is allowed but UX
  // will be painful; the owner toggle exposes a slider so they can pick.
  const { getSessionDurationMs } = await import("./server-settings-actions")
  const durationMs = await getSessionDurationMs()
  const sessionId = createId()
  const token = crypto.randomBytes(32).toString("hex")
  const now = new Date()
  const expiresAt = new Date(now.getTime() + durationMs)

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

  // Decide whether to set the cookie's `secure` flag. We can't blindly
  // use NODE_ENV=production because the VM may serve over plain HTTP —
  // `secure:true` would make the browser drop the cookie on every HTTP
  // request, breaking refresh. Detect TLS from the actual request.
  const proto =
    h.get("x-forwarded-proto") ||
    (h.get("host")?.startsWith("localhost") ? "http" : "http")
  const isHttps = proto === "https"

  const cookieStore = await cookies()
  cookieStore.set("flowspace-session", token, {
    httpOnly: true,
    secure: isHttps,
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

/**
 * Returns only teams the current user is a member of. Owner role sees
 * all teams since they administer the whole workspace.
 */
export async function getTeams() {
  const me = await getCurrentUser()
  if (!me) return []
  if (me.role === "owner") {
    return db.select().from(teams).orderBy(desc(teams.createdAt))
  }
  const myTeamIds = (
    await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, me.id))
  ).map((r) => r.teamId)
  if (myTeamIds.length === 0) return []
  return db
    .select()
    .from(teams)
    .where(inArray(teams.id, myTeamIds))
    .orderBy(desc(teams.createdAt))
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
