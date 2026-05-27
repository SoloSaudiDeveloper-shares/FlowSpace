"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Users,
  UserPlus,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  createUser,
  createTeam,
  addTeamMember,
  removeTeamMember,
  getTeamMembers,
} from "@/lib/actions/user-actions"
import type { users, teams, teamMembers } from "@/lib/db/schema"

type User = typeof users.$inferSelect
type Team = typeof teams.$inferSelect
type TeamMember = typeof teamMembers.$inferSelect

interface PeopleContentProps {
  users: User[]
  teams: Team[]
}

// ─── Role badge colors ────────────────────────────────────────────────

const roleBadgeClasses: Record<string, string> = {
  owner: "bg-purple-500/10 text-purple-500",
  admin: "bg-blue-500/10 text-blue-500",
  editor: "bg-green-500/10 text-green-500",
  commenter: "bg-yellow-500/10 text-yellow-500",
  viewer: "bg-gray-500/10 text-gray-500",
}

// ─── Preset colors for teams ──────────────────────────────────────────

const presetColors = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#6b7280",
]

// ─── Helpers ──────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function stringToColor(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-cyan-500",
    "bg-blue-500",
    "bg-violet-500",
    "bg-pink-500",
  ]
  return colors[Math.abs(hash) % colors.length]
}

// ─── Invite User Modal ────────────────────────────────────────────────

function InviteUserModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    username: "",
    displayName: "",
    email: "",
    password: "",
    role: "editor" as User["role"],
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.username.trim() || !form.displayName.trim() || !form.password.trim()) {
      toast.error("Username, display name, and password are required")
      return
    }
    setLoading(true)
    try {
      const result = await createUser({
        username: form.username.trim(),
        displayName: form.displayName.trim(),
        email: form.email.trim() || undefined,
        password: form.password,
        role: form.role,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("User created successfully")
        router.refresh()
        onClose()
      }
    } catch {
      toast.error("Failed to create user")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border bg-popover p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Invite User</h2>
          <button
            onClick={onClose}
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Username *
            </label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="johndoe"
              className="mt-1 w-full bg-background border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Display Name *
            </label>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              placeholder="John Doe"
              className="mt-1 w-full bg-background border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="john@example.com"
              className="mt-1 w-full bg-background border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Password *
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Enter a password"
              className="mt-1 w-full bg-background border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Role
            </label>
            <select
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value as User["role"] })
              }
              className="mt-1 w-full bg-background border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="viewer">Viewer</option>
              <option value="commenter">Commenter</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create User"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Create Team Modal ────────────────────────────────────────────────

function CreateTeamModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: "",
    description: "",
    color: presetColors[5],
    icon: "users",
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error("Team name is required")
      return
    }
    setLoading(true)
    try {
      await createTeam({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        color: form.color,
        icon: form.icon,
      })
      toast.success("Team created successfully")
      router.refresh()
      onClose()
    } catch {
      toast.error("Failed to create team")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border bg-popover p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Create Team</h2>
          <button
            onClick={onClose}
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Team Name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Engineering"
              className="mt-1 w-full bg-background border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Description
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What does this team do?"
              className="mt-1 w-full bg-background border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Color
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {presetColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm({ ...form, color })}
                  className={`size-8 rounded-full transition-all ${
                    form.color === color
                      ? "ring-2 ring-ring ring-offset-2 ring-offset-background"
                      : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Team"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── User Card ────────────────────────────────────────────────────────

function UserCard({ user }: { user: User }) {
  const colorClass = stringToColor(user.displayName)
  const initials = getInitials(user.displayName)

  return (
    <div className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/30">
      <div
        className={`size-12 rounded-full ${colorClass} flex items-center justify-center text-white text-sm font-semibold mb-3`}
      >
        {initials}
      </div>
      <p className="text-sm font-semibold truncate">{user.displayName}</p>
      <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
      {user.email && (
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {user.email}
        </p>
      )}
      <div className="flex items-center gap-2 mt-3">
        <span
          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
            roleBadgeClasses[user.role] ?? roleBadgeClasses.viewer
          }`}
        >
          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <span
            className={`inline-block size-2 rounded-full ${
              user.isActive ? "bg-green-500" : "bg-gray-400"
            }`}
          />
          {user.isActive ? "Active" : "Inactive"}
        </span>
      </div>
    </div>
  )
}

// ─── Team Card ────────────────────────────────────────────────────────

type TeamMemberRow = {
  member: TeamMember
  user: User
}

function TeamCard({
  team,
  allUsers,
}: {
  team: Team
  allUsers: User[]
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [members, setMembers] = useState<TeamMemberRow[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [addingUser, setAddingUser] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState("")

  useEffect(() => {
    if (expanded && members.length === 0) {
      loadMembers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded])

  async function loadMembers() {
    setLoadingMembers(true)
    try {
      const data = await getTeamMembers(team.id)
      setMembers(data)
    } catch {
      toast.error("Failed to load team members")
    } finally {
      setLoadingMembers(false)
    }
  }

  async function handleAddMember() {
    if (!selectedUserId) return
    setAddingUser(true)
    try {
      await addTeamMember(team.id, selectedUserId)
      toast.success("Member added")
      setSelectedUserId("")
      await loadMembers()
      router.refresh()
    } catch {
      toast.error("Failed to add member")
    } finally {
      setAddingUser(false)
    }
  }

  async function handleRemoveMember(userId: string) {
    try {
      await removeTeamMember(team.id, userId)
      toast.success("Member removed")
      setMembers((prev) => prev.filter((m) => m.user.id !== userId))
      router.refresh()
    } catch {
      toast.error("Failed to remove member")
    }
  }

  const memberIds = new Set(members.map((m) => m.user.id))
  const availableUsers = allUsers.filter((u) => !memberIds.has(u.id))

  return (
    <div className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/30">
      <div className="flex items-start gap-3">
        <div
          className="size-10 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: team.color ?? "#3b82f6" }}
        >
          <Users className="size-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{team.name}</p>
          {team.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
              {team.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Users className="size-3" />
          {members.length > 0
            ? `${members.length} member${members.length !== 1 ? "s" : ""}`
            : "No members yet"}
        </span>
        <Button
          variant="outline"
          size="xs"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>
              <ChevronUp className="size-3" />
              Hide
            </>
          ) : (
            <>
              <ChevronDown className="size-3" />
              Manage
            </>
          )}
        </Button>
      </div>

      {expanded && (
        <div className="mt-3 border-t pt-3 space-y-3">
          {/* Add member row */}
          <div className="flex items-center gap-2">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="flex-1 bg-background border rounded-md px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select a user to add...</option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName} (@{u.username})
                </option>
              ))}
            </select>
            <Button
              size="xs"
              disabled={!selectedUserId || addingUser}
              onClick={handleAddMember}
            >
              <Plus className="size-3" />
              Add
            </Button>
          </div>

          {/* Members list */}
          {loadingMembers ? (
            <p className="text-xs text-muted-foreground text-center py-2">
              Loading members...
            </p>
          ) : members.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">
              No members in this team yet
            </p>
          ) : (
            <div className="space-y-1">
              {members.map(({ user, member }) => (
                <div
                  key={user.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50"
                >
                  <div
                    className={`size-6 rounded-full ${stringToColor(user.displayName)} flex items-center justify-center text-white text-[10px] font-semibold shrink-0`}
                  >
                    {getInitials(user.displayName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {user.displayName}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground capitalize">
                    {member.role}
                  </span>
                  <button
                    onClick={() => handleRemoveMember(user.id)}
                    className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Content ─────────────────────────────────────────────────────

export function PeopleContent({ users, teams }: PeopleContentProps) {
  const [tab, setTab] = useState<"people" | "teams">("people")
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false)

  return (
    <div className="animate-page-enter">
      {/* Tab bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-1 rounded-lg border p-1">
          <button
            onClick={() => setTab("people")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === "people"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            People
          </button>
          <button
            onClick={() => setTab("teams")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === "teams"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Teams
          </button>
        </div>

        {tab === "people" ? (
          <Button onClick={() => setShowInviteModal(true)}>
            <UserPlus className="size-4" />
            Invite User
          </Button>
        ) : (
          <Button onClick={() => setShowCreateTeamModal(true)}>
            <Plus className="size-4" />
            Create Team
          </Button>
        )}
      </div>

      {/* People tab */}
      {tab === "people" && (
        <div>
          {users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="size-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                No users yet. Invite someone to get started.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {users.map((user) => (
                <UserCard key={user.id} user={user} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Teams tab */}
      {tab === "teams" && (
        <div>
          {teams.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="size-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                No teams yet. Create one to organize your workspace.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {teams.map((team) => (
                <TeamCard key={team.id} team={team} allUsers={users} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showInviteModal && (
        <InviteUserModal onClose={() => setShowInviteModal(false)} />
      )}
      {showCreateTeamModal && (
        <CreateTeamModal onClose={() => setShowCreateTeamModal(false)} />
      )}
    </div>
  )
}
