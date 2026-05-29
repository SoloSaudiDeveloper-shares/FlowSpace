import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core"
import { sql } from "drizzle-orm"

// ─── Universal Element System ───────────────────────────────────────────

export const elements = sqliteTable("elements", {
  id: text("id").primaryKey(),
  type: text("type", {
    enum: ["project", "page", "canvas", "todo_list", "reminder", "process"],
  }).notNull(),
  title: text("title").notNull().default("Untitled"),
  description: text("description"),
  icon: text("icon"),
  color: text("color"),
  isFavorite: integer("is_favorite", { mode: "boolean" }).notNull().default(false),
  isArchived: integer("is_archived", { mode: "boolean" }).notNull().default(false),
  isDeleted: integer("is_deleted", { mode: "boolean" }).notNull().default(false),
  parentId: text("parent_id").references((): ReturnType<typeof text> => elements.id),
  sortOrder: real("sort_order").notNull().default(0),
  createdBy: text("created_by"),
  lastEditedBy: text("last_edited_by"),
  version: integer("version").notNull().default(1),
  visibility: text("visibility", {
    enum: ["private", "team", "workspace"],
  }).notNull().default("workspace"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const elementLinks = sqliteTable("element_links", {
  id: text("id").primaryKey(),
  sourceId: text("source_id")
    .notNull()
    .references(() => elements.id, { onDelete: "cascade" }),
  targetId: text("target_id")
    .notNull()
    .references(() => elements.id, { onDelete: "cascade" }),
  linkType: text("link_type", {
    enum: ["reference", "dependency", "contains", "blocks", "relates_to"],
  }).notNull(),
  metadata: text("metadata"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  color: text("color"),
})

export const elementTags = sqliteTable("element_tags", {
  elementId: text("element_id")
    .notNull()
    .references(() => elements.id, { onDelete: "cascade" }),
  tagId: text("tag_id")
    .notNull()
    .references(() => tags.id, { onDelete: "cascade" }),
})

// ─── Projects & Tasks ───────────────────────────────────────────────────

export const projects = sqliteTable("projects", {
  id: text("id")
    .primaryKey()
    .references(() => elements.id, { onDelete: "cascade" }),
  status: text("status", {
    enum: ["active", "paused", "completed", "archived"],
  })
    .notNull()
    .default("active"),
  startDate: text("start_date"),
  dueDate: text("due_date"),
  progress: integer("progress").notNull().default(0),
})

export const taskStatuses = sqliteTable("task_statuses", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => elements.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull(),
  sortOrder: real("sort_order").notNull().default(0),
  isDoneState: integer("is_done_state", { mode: "boolean" }).notNull().default(false),
})

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => elements.id, { onDelete: "cascade" }),
  statusId: text("status_id")
    .notNull()
    .references(() => taskStatuses.id),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority", {
    enum: ["urgent", "high", "medium", "low", "none"],
  })
    .notNull()
    .default("none"),
  startDate: text("start_date"),
  dueDate: text("due_date"),
  sortOrder: real("sort_order").notNull().default(0),
  parentTaskId: text("parent_task_id"),
  timeEstimate: integer("time_estimate"),
  timeTracked: integer("time_tracked").notNull().default(0),
  isCompleted: integer("is_completed", { mode: "boolean" }).notNull().default(false),
  completedAt: text("completed_at"),
  createdBy: text("created_by"),
  assigneeId: text("assignee_id"),
  lastEditedBy: text("last_edited_by"),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const taskLabels = sqliteTable("task_labels", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull(),
})

export const taskToLabels = sqliteTable("task_to_labels", {
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  labelId: text("label_id")
    .notNull()
    .references(() => taskLabels.id, { onDelete: "cascade" }),
})

// ─── Pages ──────────────────────────────────────────────────────────────

export const pages = sqliteTable("pages", {
  id: text("id")
    .primaryKey()
    .references(() => elements.id, { onDelete: "cascade" }),
  content: text("content"),
  coverImage: text("cover_image"),
  isTemplate: integer("is_template", { mode: "boolean" }).notNull().default(false),
})

// ─── Canvas ─────────────────────────────────────────────────────────────

export const canvases = sqliteTable("canvases", {
  id: text("id")
    .primaryKey()
    .references(() => elements.id, { onDelete: "cascade" }),
  viewportX: real("viewport_x").notNull().default(0),
  viewportY: real("viewport_y").notNull().default(0),
  viewportZoom: real("viewport_zoom").notNull().default(1),
})

export const canvasNodes = sqliteTable("canvas_nodes", {
  id: text("id").primaryKey(),
  canvasId: text("canvas_id")
    .notNull()
    .references(() => elements.id, { onDelete: "cascade" }),
  type: text("type", {
    enum: ["card", "sticky_note", "element_embed", "text", "image", "group", "shape"],
  }).notNull(),
  positionX: real("position_x").notNull(),
  positionY: real("position_y").notNull(),
  width: real("width"),
  height: real("height"),
  data: text("data"),
  elementRefId: text("element_ref_id").references(() => elements.id),
  style: text("style"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const canvasEdges = sqliteTable("canvas_edges", {
  id: text("id").primaryKey(),
  canvasId: text("canvas_id")
    .notNull()
    .references(() => elements.id, { onDelete: "cascade" }),
  sourceNodeId: text("source_node_id")
    .notNull()
    .references(() => canvasNodes.id, { onDelete: "cascade" }),
  targetNodeId: text("target_node_id")
    .notNull()
    .references(() => canvasNodes.id, { onDelete: "cascade" }),
  sourceHandle: text("source_handle"),
  targetHandle: text("target_handle"),
  type: text("type").default("default"),
  label: text("label"),
  style: text("style"),
  animated: integer("animated", { mode: "boolean" }).notNull().default(false),
})

// ─── Todo Lists ─────────────────────────────────────────────────────────

export const todoLists = sqliteTable("todo_lists", {
  id: text("id")
    .primaryKey()
    .references(() => elements.id, { onDelete: "cascade" }),
})

export const todoItems = sqliteTable("todo_items", {
  id: text("id").primaryKey(),
  listId: text("list_id")
    .notNull()
    .references(() => elements.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  isCompleted: integer("is_completed", { mode: "boolean" }).notNull().default(false),
  sortOrder: real("sort_order").notNull().default(0),
  dueDate: text("due_date"),
  notes: text("notes"),
  priority: text("priority", {
    enum: ["urgent", "high", "medium", "low"],
  }),
  completedAt: text("completed_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── Reminders ──────────────────────────────────────────────────────────

export const reminders = sqliteTable("reminders", {
  id: text("id")
    .primaryKey()
    .references(() => elements.id, { onDelete: "cascade" }),
  remindAt: text("remind_at").notNull(),
  repeatRule: text("repeat_rule"),
  isDismissed: integer("is_dismissed", { mode: "boolean" }).notNull().default(false),
  snoozedUntil: text("snoozed_until"),
})

// ─── Task Checklists ───────────────────────────────────────────────────

export const taskChecklists = sqliteTable("task_checklists", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  sortOrder: real("sort_order").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const taskChecklistItems = sqliteTable("task_checklist_items", {
  id: text("id").primaryKey(),
  checklistId: text("checklist_id")
    .notNull()
    .references(() => taskChecklists.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  isCompleted: integer("is_completed", { mode: "boolean" }).notNull().default(false),
  sortOrder: real("sort_order").notNull().default(0),
  completedAt: text("completed_at"),
})

// ─── Task Dependencies ────────────────────────────────────────────────

export const taskDependencies = sqliteTable("task_dependencies", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  dependsOnTaskId: text("depends_on_task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  type: text("type", {
    enum: ["blocks", "blocked_by", "relates_to"],
  }).notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── Processes ──────────────────────────────────────────────────────────

export const processes = sqliteTable("processes", {
  id: text("id")
    .primaryKey()
    .references(() => elements.id, { onDelete: "cascade" }),
})

export const processSteps = sqliteTable("process_steps", {
  id: text("id").primaryKey(),
  processId: text("process_id")
    .notNull()
    .references(() => elements.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  sortOrder: real("sort_order").notNull().default(0),
  isCompleted: integer("is_completed", { mode: "boolean" }).notNull().default(false),
  completedAt: text("completed_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── Dashboard Widgets ──────────────────────────────────────────────────

export const dashboardWidgets = sqliteTable("dashboard_widgets", {
  id: text("id").primaryKey(),
  widgetType: text("widget_type", {
    enum: [
      "recent_elements",
      "favorites",
      "project_summary",
      "task_board_mini",
      "calendar",
      "quick_capture",
      "element_embed",
      "my_tasks",
      "reminders",
      "activity_feed",
    ],
  }).notNull(),
  title: text("title"),
  config: text("config"),
  positionX: integer("position_x").notNull(),
  positionY: integer("position_y").notNull(),
  width: integer("width").notNull().default(1),
  height: integer("height").notNull().default(1),
  elementRefId: text("element_ref_id").references(() => elements.id),
})

// ─── Task Comments ─────────────────────────────────────────────────────

export const taskComments = sqliteTable("task_comments", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  authorId: text("author_id"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── Activity Log ──────────────────────────────────────────────────────

export const activityLog = sqliteTable("activity_log", {
  id: text("id").primaryKey(),
  elementId: text("element_id")
    .notNull()
    .references(() => elements.id, { onDelete: "cascade" }),
  userId: text("user_id"),
  action: text("action", {
    enum: [
      "created", "updated", "deleted", "completed", "reopened",
      "status_changed", "priority_changed", "assigned_label",
      "removed_label", "added_dependency", "removed_dependency",
      "added_subtask", "added_comment", "added_checklist",
      "started_timer", "stopped_timer",
      "assigned_user", "removed_user", "permission_changed",
      "mentioned_user", "approval_requested", "approval_resolved",
    ],
  }).notNull(),
  details: text("details"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── Task Attachments ──────────────────────────────────────────────────

export const taskAttachments = sqliteTable("task_attachments", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── Notifications ────────────────────────────────────────────────────

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  type: text("type", {
    enum: [
      "reminder_due",
      "task_overdue",
      "task_due_soon",
      "project_milestone",
      "system",
      "mention",
      "assignment",
      "approval_request",
      "comment_reply",
      "permission_change",
    ],
  }).notNull(),
  title: text("title").notNull(),
  message: text("message"),
  elementId: text("element_id").references(() => elements.id, {
    onDelete: "cascade",
  }),
  userId: text("user_id"),
  actorId: text("actor_id"),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── View Preferences ────────────────────────────────────────────────

export const viewPreferences = sqliteTable("view_preferences", {
  id: text("id").primaryKey(),
  elementId: text("element_id")
    .notNull()
    .references(() => elements.id, { onDelete: "cascade" }),
  viewType: text("view_type", {
    enum: ["board", "list", "table"],
  }).notNull(),
  hiddenFields: text("hidden_fields"),
  sortField: text("sort_field"),
  sortDirection: text("sort_direction", { enum: ["asc", "desc"] }),
  groupBy: text("group_by"),
  filterJson: text("filter_json"),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── Users & Identity ──────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  email: text("email"),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  role: text("role", {
    enum: ["owner", "admin", "editor", "commenter", "viewer"],
  })
    .notNull()
    .default("editor"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  lastActiveAt: text("last_active_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const teams = sqliteTable("teams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color"),
  icon: text("icon"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const teamMembers = sqliteTable("team_members", {
  id: text("id").primaryKey(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role", {
    enum: ["lead", "member"],
  })
    .notNull()
    .default("member"),
  joinedAt: text("joined_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── Permissions ───────────────────────────────────────────────────────

export const elementPermissions = sqliteTable("element_permissions", {
  id: text("id").primaryKey(),
  elementId: text("element_id")
    .notNull()
    .references(() => elements.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  teamId: text("team_id").references(() => teams.id, { onDelete: "cascade" }),
  role: text("role", {
    enum: ["editor", "commenter", "viewer"],
  })
    .notNull()
    .default("viewer"),
  canView: integer("can_view", { mode: "boolean" }).notNull().default(true),
  canEdit: integer("can_edit", { mode: "boolean" }).notNull().default(false),
  canComment: integer("can_comment", { mode: "boolean" }).notNull().default(false),
  canDelete: integer("can_delete", { mode: "boolean" }).notNull().default(false),
  canManage: integer("can_manage", { mode: "boolean" }).notNull().default(false),
  inheritedFrom: text("inherited_from").references(() => elements.id),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── Assignments & Collaboration ──────────────────────────────────────

export const taskAssignments = sqliteTable("task_assignments", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role", {
    enum: ["assignee", "watcher", "contributor"],
  })
    .notNull()
    .default("assignee"),
  assignedBy: text("assigned_by").references(() => users.id),
  assignedAt: text("assigned_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const watchers = sqliteTable("watchers", {
  id: text("id").primaryKey(),
  elementId: text("element_id")
    .notNull()
    .references(() => elements.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const mentions = sqliteTable("mentions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  mentionedBy: text("mentioned_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  elementId: text("element_id").references(() => elements.id, { onDelete: "cascade" }),
  taskId: text("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  commentId: text("comment_id").references(() => taskComments.id, { onDelete: "cascade" }),
  context: text("context"),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── Edit Sessions & Real-Time ────────────────────────────────────────

export const editSessions = sqliteTable("edit_sessions", {
  id: text("id").primaryKey(),
  elementId: text("element_id")
    .notNull()
    .references(() => elements.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  startedAt: text("started_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  lastActivity: text("last_activity")
    .notNull()
    .default(sql`(datetime('now'))`),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
})

// ─── Approvals ────────────────────────────────────────────────────────

export const approvals = sqliteTable("approvals", {
  id: text("id").primaryKey(),
  elementId: text("element_id").references(() => elements.id, { onDelete: "cascade" }),
  taskId: text("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  requestedBy: text("requested_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  assignedTo: text("assigned_to")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status", {
    enum: ["pending", "approved", "rejected", "changes_requested"],
  })
    .notNull()
    .default("pending"),
  comment: text("comment"),
  resolvedAt: text("resolved_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── Backups ──────────────────────────────────────────────────────────

export const backups = sqliteTable("backups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  type: text("type", {
    enum: ["full", "selective", "scheduled"],
  })
    .notNull()
    .default("full"),
  status: text("status", {
    enum: ["in_progress", "completed", "failed"],
  })
    .notNull()
    .default("in_progress"),
  createdBy: text("created_by").references(() => users.id),
  startedAt: text("started_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  completedAt: text("completed_at"),
  metadata: text("metadata"),
})

// ─── Server Events (Admin) ────────────────────────────────────────────

export const serverEvents = sqliteTable("server_events", {
  id: text("id").primaryKey(),
  type: text("type", {
    enum: [
      "server_start", "server_stop", "backup_completed", "backup_failed",
      "user_login", "user_logout", "user_created", "permission_changed",
      "error", "warning", "info",
    ],
  }).notNull(),
  title: text("title").notNull(),
  message: text("message"),
  userId: text("user_id").references(() => users.id),
  metadata: text("metadata"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── Templates ────────────────────────────────────────────────────────

export const templates = sqliteTable("templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type", {
    enum: ["project", "task", "checklist", "page", "canvas", "process", "dashboard", "form"],
  }).notNull(),
  icon: text("icon"),
  color: text("color"),
  content: text("content"), // JSON blob of the template data
  isFavorite: integer("is_favorite", { mode: "boolean" }).notNull().default(false),
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(true),
  usageCount: integer("usage_count").notNull().default(0),
  createdBy: text("created_by").references(() => users.id),
  lastUsedAt: text("last_used_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const templateItems = sqliteTable("template_items", {
  id: text("id").primaryKey(),
  templateId: text("template_id")
    .notNull()
    .references(() => templates.id, { onDelete: "cascade" }),
  itemType: text("item_type", {
    enum: ["task", "subtask", "checklist", "checklist_item", "label", "status", "step", "field"],
  }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  config: text("config"), // JSON for extra settings (priority, dueDateOffset, etc.)
  sortOrder: real("sort_order").notNull().default(0),
  parentItemId: text("parent_item_id"),
})

// ─── Custom Fields ────────────────────────────────────────────────────

export const customFieldDefinitions = sqliteTable("custom_field_definitions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  fieldType: text("field_type", {
    enum: [
      "text", "long_text", "number", "currency", "date", "date_range",
      "checkbox", "select", "multi_select", "user", "team", "url",
      "email", "phone", "rating", "formula", "relation",
    ],
  }).notNull(),
  icon: text("icon"),
  color: text("color"),
  config: text("config"), // JSON: { min, max, currency, formula, relationType, etc. }
  isRequired: integer("is_required", { mode: "boolean" }).notNull().default(false),
  sortOrder: real("sort_order").notNull().default(0),
  groupName: text("group_name"), // e.g. "Planning", "Delivery", "Finance"
  createdBy: text("created_by").references(() => users.id),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const customFieldOptions = sqliteTable("custom_field_options", {
  id: text("id").primaryKey(),
  fieldId: text("field_id")
    .notNull()
    .references(() => customFieldDefinitions.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  color: text("color"),
  sortOrder: real("sort_order").notNull().default(0),
})

export const customFieldValues = sqliteTable("custom_field_values", {
  id: text("id").primaryKey(),
  fieldId: text("field_id")
    .notNull()
    .references(() => customFieldDefinitions.id, { onDelete: "cascade" }),
  entityType: text("entity_type", {
    enum: ["element", "task"],
  }).notNull(),
  entityId: text("entity_id").notNull(),
  value: text("value"), // stored as text, parsed by field type
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const customFieldScopes = sqliteTable("custom_field_scopes", {
  id: text("id").primaryKey(),
  fieldId: text("field_id")
    .notNull()
    .references(() => customFieldDefinitions.id, { onDelete: "cascade" }),
  scopeType: text("scope_type", {
    enum: ["global", "project", "element_type", "template"],
  }).notNull(),
  scopeValue: text("scope_value"), // projectId, element type name, or templateId
})

// ─── Forms / Intake ───────────────────────────────────────────────────

export const forms = sqliteTable("forms", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  icon: text("icon"),
  color: text("color"),
  type: text("type", {
    enum: ["task_intake", "project_request", "issue_report", "approval_request", "checklist_submission"],
  }).notNull(),
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(false),
  isAnonymous: integer("is_anonymous", { mode: "boolean" }).notNull().default(false),
  confirmationMessage: text("confirmation_message"),
  submissionCount: integer("submission_count").notNull().default(0),
  createdBy: text("created_by").references(() => users.id),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const formFields = sqliteTable("form_fields", {
  id: text("id").primaryKey(),
  formId: text("form_id")
    .notNull()
    .references(() => forms.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  fieldType: text("field_type", {
    enum: [
      "text", "long_text", "number", "date", "select", "multi_select",
      "checkbox", "email", "url", "phone", "file", "user", "rating",
    ],
  }).notNull(),
  placeholder: text("placeholder"),
  helpText: text("help_text"),
  isRequired: integer("is_required", { mode: "boolean" }).notNull().default(false),
  options: text("options"), // JSON array for select/multi-select
  config: text("config"), // JSON for validation rules, min/max, etc.
  sortOrder: real("sort_order").notNull().default(0),
})

export const formSubmissions = sqliteTable("form_submissions", {
  id: text("id").primaryKey(),
  formId: text("form_id")
    .notNull()
    .references(() => forms.id, { onDelete: "cascade" }),
  data: text("data").notNull(), // JSON of field values
  submittedBy: text("submitted_by").references(() => users.id),
  status: text("status", {
    enum: ["pending", "processed", "rejected"],
  }).notNull().default("pending"),
  resultElementId: text("result_element_id").references(() => elements.id),
  resultTaskId: text("result_task_id").references(() => tasks.id),
  processedAt: text("processed_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const formMappings = sqliteTable("form_mappings", {
  id: text("id").primaryKey(),
  formId: text("form_id")
    .notNull()
    .references(() => forms.id, { onDelete: "cascade" }),
  action: text("action", {
    enum: ["create_task", "create_page", "create_reminder", "create_process"],
  }).notNull(),
  targetProjectId: text("target_project_id").references(() => elements.id),
  defaultStatusId: text("default_status_id"),
  defaultAssigneeId: text("default_assignee_id").references(() => users.id),
  fieldMapping: text("field_mapping"), // JSON: { formFieldId -> taskField }
  config: text("config"), // JSON for extra settings
})

// ─── Automation Engine ────────────────────────────────────────────────

export const automations = sqliteTable("automations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  trigger: text("trigger_type", {
    enum: [
      "task_created", "task_updated", "status_changed", "due_date_reached",
      "reminder_triggered", "comment_added", "dependency_resolved",
      "form_submitted", "element_linked", "page_created", "attachment_uploaded",
    ],
  }).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  projectId: text("project_id").references(() => elements.id),
  runCount: integer("run_count").notNull().default(0),
  lastRunAt: text("last_run_at"),
  lastRunStatus: text("last_run_status", {
    enum: ["success", "failure", "skipped"],
  }),
  createdBy: text("created_by").references(() => users.id),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const automationConditions = sqliteTable("automation_conditions", {
  id: text("id").primaryKey(),
  automationId: text("automation_id")
    .notNull()
    .references(() => automations.id, { onDelete: "cascade" }),
  field: text("field").notNull(), // e.g. "status", "priority", "project", "label", "assignee"
  operator: text("operator", {
    enum: ["equals", "not_equals", "contains", "not_contains", "greater_than", "less_than", "is_empty", "is_not_empty"],
  }).notNull(),
  value: text("value").notNull(),
  logicGate: text("logic_gate", { enum: ["and", "or"] }).notNull().default("and"),
  sortOrder: real("sort_order").notNull().default(0),
})

export const automationActions = sqliteTable("automation_actions", {
  id: text("id").primaryKey(),
  automationId: text("automation_id")
    .notNull()
    .references(() => automations.id, { onDelete: "cascade" }),
  actionType: text("action_type", {
    enum: [
      "create_task", "update_status", "assign_user", "add_label",
      "post_notification", "create_reminder", "update_priority",
      "add_comment", "duplicate_template",
    ],
  }).notNull(),
  config: text("config").notNull(), // JSON with action-specific parameters
  sortOrder: real("sort_order").notNull().default(0),
})

export const automationRuns = sqliteTable("automation_runs", {
  id: text("id").primaryKey(),
  automationId: text("automation_id")
    .notNull()
    .references(() => automations.id, { onDelete: "cascade" }),
  status: text("status", {
    enum: ["success", "failure", "skipped"],
  }).notNull(),
  triggerData: text("trigger_data"), // JSON snapshot of what triggered this
  actionsExecuted: integer("actions_executed").notNull().default(0),
  error: text("error"),
  duration: integer("duration"), // ms
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const automationLogs = sqliteTable("automation_logs", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => automationRuns.id, { onDelete: "cascade" }),
  actionType: text("action_type").notNull(),
  status: text("status", { enum: ["success", "failure"] }).notNull(),
  input: text("input"), // JSON
  output: text("output"), // JSON
  error: text("error"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── Feed System ──────────────────────────────────────────────────────

export const feedEvents = sqliteTable("feed_events", {
  id: text("id").primaryKey(),
  type: text("type", {
    enum: [
      "task_created", "task_updated", "task_completed", "task_overdue",
      "task_assigned", "comment_added", "comment_mention", "page_updated",
      "canvas_updated", "process_step_completed", "reminder_triggered",
      "dependency_cleared", "attachment_uploaded", "approval_requested",
      "approval_completed", "template_used", "form_submitted",
      "automation_fired", "project_milestone", "backup_completed",
      "backup_failed", "user_joined", "permission_changed",
    ],
  }).notNull(),
  actorUserId: text("actor_user_id").references(() => users.id),
  subjectElementId: text("subject_element_id").references(() => elements.id, { onDelete: "cascade" }),
  subjectTaskId: text("subject_task_id").references(() => tasks.id, { onDelete: "cascade" }),
  parentElementId: text("parent_element_id").references(() => elements.id),
  teamId: text("team_id").references(() => teams.id),
  projectId: text("project_id").references(() => elements.id),
  title: text("title").notNull(),
  summary: text("summary"),
  payload: text("payload"), // JSON
  priority: text("priority", { enum: ["low", "normal", "high"] }).notNull().default("normal"),
  visibility: text("visibility", { enum: ["private", "team", "workspace"] }).notNull().default("workspace"),
  sourceType: text("source_type", { enum: ["manual", "system", "automation", "form", "api"] }).notNull().default("system"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const feedSubscriptions = sqliteTable("feed_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  targetType: text("target_type", {
    enum: ["project", "element", "team", "user", "label", "automation"],
  }).notNull(),
  targetId: text("target_id").notNull(),
  isMuted: integer("is_muted", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const feedViews = sqliteTable("feed_views", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  filterJson: text("filter_json"), // JSON: { types, projects, teams, priority, sourceType }
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const feedFilters = sqliteTable("feed_filters", {
  id: text("id").primaryKey(),
  viewId: text("view_id")
    .notNull()
    .references(() => feedViews.id, { onDelete: "cascade" }),
  field: text("field").notNull(),
  operator: text("operator").notNull(),
  value: text("value").notNull(),
})

export const feedReadState = sqliteTable("feed_read_state", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  eventId: text("event_id")
    .notNull()
    .references(() => feedEvents.id, { onDelete: "cascade" }),
  readAt: text("read_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const feedPins = sqliteTable("feed_pins", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  eventId: text("event_id")
    .notNull()
    .references(() => feedEvents.id, { onDelete: "cascade" }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
})

// ─── Type exports ───────────────────────────────────────────────────────

export type Element = typeof elements.$inferSelect
export type NewElement = typeof elements.$inferInsert
export type ElementType = Element["type"]
export type Task = typeof tasks.$inferSelect
export type Notification = typeof notifications.$inferSelect
export type ViewPreference = typeof viewPreferences.$inferSelect
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Team = typeof teams.$inferSelect
export type Session = typeof sessions.$inferSelect
export type TaskAssignment = typeof taskAssignments.$inferSelect
export type Watcher = typeof watchers.$inferSelect
export type Mention = typeof mentions.$inferSelect
export type EditSession = typeof editSessions.$inferSelect
export type Approval = typeof approvals.$inferSelect
export type Backup = typeof backups.$inferSelect
export type ServerEvent = typeof serverEvents.$inferSelect
export type ElementPermission = typeof elementPermissions.$inferSelect
export type UserRole = User["role"]
export type Template = typeof templates.$inferSelect
export type TemplateItem = typeof templateItems.$inferSelect
export type CustomFieldDefinition = typeof customFieldDefinitions.$inferSelect
export type CustomFieldOption = typeof customFieldOptions.$inferSelect
export type CustomFieldValue = typeof customFieldValues.$inferSelect
export type Form = typeof forms.$inferSelect
export type FormField = typeof formFields.$inferSelect
export type FormSubmission = typeof formSubmissions.$inferSelect
export type Automation = typeof automations.$inferSelect
export type AutomationCondition = typeof automationConditions.$inferSelect
export type AutomationAction = typeof automationActions.$inferSelect
export type AutomationRun = typeof automationRuns.$inferSelect
export type FeedEvent = typeof feedEvents.$inferSelect
export type FeedSubscription = typeof feedSubscriptions.$inferSelect
