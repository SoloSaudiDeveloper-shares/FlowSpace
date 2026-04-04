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
  dueDate: text("due_date"),
  sortOrder: real("sort_order").notNull().default(0),
  parentTaskId: text("parent_task_id"),
  isCompleted: integer("is_completed", { mode: "boolean" }).notNull().default(false),
  completedAt: text("completed_at"),
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
    enum: ["card", "sticky_note", "element_embed", "text", "image", "group"],
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

// ─── Type exports ───────────────────────────────────────────────────────

export type Element = typeof elements.$inferSelect
export type NewElement = typeof elements.$inferInsert
export type ElementType = Element["type"]
