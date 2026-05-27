import "server-only"
import type Database from "better-sqlite3"

/**
 * Idempotent one-time seed of showcase templates. Triggered from
 * db/index.ts at startup. Skipped if server_settings has the
 * `templates_seeded_v1` key. Templates are owned by the oldest active
 * user (the original admin) so they can be cloned or duplicated.
 *
 * Each template entry is a database row in `templates` plus zero or more
 * `template_items`. The existing createFromTemplate server action knows
 * how to materialize them into real elements/tasks/steps/etc.
 */

interface TemplateSeed {
  name: string
  description: string
  type: "project" | "task" | "checklist" | "page" | "canvas" | "process" | "dashboard" | "form"
  icon: string
  color: string
  content?: Record<string, unknown>
  items?: Array<{
    item_type: "task" | "subtask" | "checklist" | "checklist_item" | "label" | "status" | "step" | "field"
    title: string
    description?: string
    config?: Record<string, unknown>
  }>
}

const SHOWCASE_TEMPLATES: TemplateSeed[] = [
  // ── Product management ────────────────────────────────────────────
  {
    name: "Product Roadmap — Quarterly",
    description: "Phase-gated product plan with Discovery → Design → Build → Launch swimlanes and built-in priority labels.",
    type: "project",
    icon: "Compass",
    color: "#6366f1",
    items: [
      { item_type: "status", title: "Discovery",      config: { color: "#94a3b8", sortOrder: 0, isDoneState: false } },
      { item_type: "status", title: "Design",         config: { color: "#3b82f6", sortOrder: 1, isDoneState: false } },
      { item_type: "status", title: "Build",          config: { color: "#8b5cf6", sortOrder: 2, isDoneState: false } },
      { item_type: "status", title: "Launch",         config: { color: "#10b981", sortOrder: 3, isDoneState: true  } },
      { item_type: "label",  title: "p0", config: { color: "#ef4444" } },
      { item_type: "label",  title: "p1", config: { color: "#f97316" } },
      { item_type: "label",  title: "p2", config: { color: "#eab308" } },
      { item_type: "task",   title: "Define quarterly OKRs",         description: "Aligned with company strategy + execs", config: { status: "Discovery", priority: "high" } },
      { item_type: "task",   title: "User interviews (8 customers)", description: "Mix of new + power users",              config: { status: "Discovery", priority: "high" } },
      { item_type: "task",   title: "Competitive teardown",          description: "Track 5 peer products + key gaps",      config: { status: "Discovery", priority: "medium" } },
      { item_type: "task",   title: "Hero feature design spec",      description: "Figma + clickable prototype",           config: { status: "Design",    priority: "high" } },
      { item_type: "task",   title: "Engineering sizing",            description: "Break into ≤3-day chunks",              config: { status: "Build",     priority: "medium" } },
      { item_type: "task",   title: "Internal demo",                 description: "Whole team, capture feedback",          config: { status: "Build",     priority: "medium" } },
      { item_type: "task",   title: "Launch announcement draft",     description: "Email + changelog + social copy",       config: { status: "Launch",    priority: "high" } },
      { item_type: "task",   title: "Post-launch metrics review",    description: "30-day cohort retention, NPS",          config: { status: "Launch",    priority: "high" } },
    ],
  },

  // ── Project management ────────────────────────────────────────────
  {
    name: "Project Kanban — Engineering Sprint",
    description: "Classic kanban for a 2-week sprint with Backlog / In Progress / Review / Done columns and starter tasks.",
    type: "project",
    icon: "KanbanSquare",
    color: "#3b82f6",
    items: [
      { item_type: "status", title: "Backlog",     config: { color: "#94a3b8", sortOrder: 0, isDoneState: false } },
      { item_type: "status", title: "In Progress", config: { color: "#3b82f6", sortOrder: 1, isDoneState: false } },
      { item_type: "status", title: "In Review",   config: { color: "#8b5cf6", sortOrder: 2, isDoneState: false } },
      { item_type: "status", title: "Done",        config: { color: "#22c55e", sortOrder: 3, isDoneState: true  } },
      { item_type: "task",   title: "Set up sprint goal in standup",     config: { status: "Backlog",     priority: "high" } },
      { item_type: "task",   title: "Triage incoming bugs",              config: { status: "Backlog",     priority: "medium" } },
      { item_type: "task",   title: "Add tracing to checkout endpoint",  config: { status: "In Progress", priority: "medium" } },
      { item_type: "task",   title: "Fix race in webhook queue",         config: { status: "In Progress", priority: "high" } },
      { item_type: "task",   title: "Migrate auth module to v4",         config: { status: "In Review",   priority: "medium" } },
      { item_type: "task",   title: "Sprint retro doc",                  config: { status: "Done",        priority: "low" } },
    ],
  },

  // ── Brainstorming ─────────────────────────────────────────────────
  {
    name: "Brainstorm — How Might We…",
    description: "Open canvas with 4 prompt sticky notes for fast divergent thinking. Drag, group, and color-code your ideas.",
    type: "canvas",
    icon: "Lightbulb",
    color: "#eab308",
    content: {
      nodes: [
        { id: "n1", type: "sticky", x:  -240, y: -160, w: 200, h: 120, color: "#fde68a", text: "How might we delight power users without overwhelming new ones?" },
        { id: "n2", type: "sticky", x:    40, y: -160, w: 200, h: 120, color: "#bbf7d0", text: "What if onboarding took 30 seconds, not 5 minutes?" },
        { id: "n3", type: "sticky", x:  -240, y:   40, w: 200, h: 120, color: "#bfdbfe", text: "Wild idea: zero clicks to value. What does that look like?" },
        { id: "n4", type: "sticky", x:    40, y:   40, w: 200, h: 120, color: "#fecaca", text: "Constraint: pick ONE feature to remove that nobody would miss." },
      ],
    },
  },

  // ── Control / process management ──────────────────────────────────
  {
    name: "Process — Code Review Checklist",
    description: "Standard pre-merge gate: self-check, push, request reviewers, address feedback, merge, deploy. Adapt to your team.",
    type: "process",
    icon: "GitPullRequestCheck",
    color: "#8b5cf6",
    items: [
      { item_type: "step", title: "Self-review the diff",            description: "Re-read your own change, look for off-by-ones, missing edge cases, console.logs left behind." },
      { item_type: "step", title: "Run tests + linter locally",      description: "All green before pushing." },
      { item_type: "step", title: "Push PR with clear description",  description: "What changed and why, plus a screenshot/recording for UI changes." },
      { item_type: "step", title: "Tag 2 reviewers",                 description: "One domain owner, one fresh perspective." },
      { item_type: "step", title: "Address feedback in new commits", description: "Don't force-push during active review." },
      { item_type: "step", title: "Merge on green CI",               description: "Squash + descriptive merge message." },
      { item_type: "step", title: "Watch deploy metrics",            description: "First 30 min after deploy — error rate, p95 latency, business KPIs." },
    ],
  },

  // ── Budget / finance ──────────────────────────────────────────────
  {
    name: "Monthly Budget Tracker",
    description: "A page template for monthly budgeting. Fill in projected vs actual per category.",
    type: "page",
    icon: "Wallet",
    color: "#22c55e",
    content: {
      // Block-based content the page editor understands.
      blocks: [
        { type: "heading-1", text: "Monthly Budget — [Month Year]" },
        { type: "paragraph", text: "Numbers in your currency of choice. Update the Actual column at the end of each week." },
        { type: "heading-2", text: "Income" },
        { type: "table", columns: ["Source", "Projected", "Actual", "Notes"], rows: [
          ["Salary",      "", "", ""],
          ["Freelance",   "", "", ""],
          ["Investments", "", "", ""],
        ]},
        { type: "heading-2", text: "Fixed expenses" },
        { type: "table", columns: ["Category", "Projected", "Actual", "Notes"], rows: [
          ["Rent / mortgage", "", "", ""],
          ["Utilities",       "", "", ""],
          ["Internet / phone","", "", ""],
          ["Insurance",       "", "", ""],
          ["Subscriptions",   "", "", ""],
        ]},
        { type: "heading-2", text: "Variable expenses" },
        { type: "table", columns: ["Category", "Projected", "Actual", "Notes"], rows: [
          ["Groceries",     "", "", ""],
          ["Dining out",    "", "", ""],
          ["Transport",     "", "", ""],
          ["Entertainment", "", "", ""],
          ["Personal care", "", "", ""],
        ]},
        { type: "heading-2", text: "Savings & investments" },
        { type: "table", columns: ["Target", "Projected", "Actual", "Notes"], rows: [
          ["Emergency fund",   "", "", ""],
          ["Retirement",       "", "", ""],
          ["Stocks / crypto",  "", "", ""],
          ["Big-purchase pot", "", "", ""],
        ]},
        { type: "heading-2", text: "End-of-month review" },
        { type: "paragraph", text: "What worked? What didn't? What's the one change for next month?" },
      ],
    },
  },

  // ── Expense log ───────────────────────────────────────────────────
  {
    name: "Expense Log — Weekly",
    description: "Lightweight checklist-as-ledger: one item per expense. Quick capture, weekly review.",
    type: "checklist",
    icon: "Receipt",
    color: "#f97316",
    items: [
      { item_type: "checklist_item", title: "[Mon] $—.—— · Groceries — supermarket" },
      { item_type: "checklist_item", title: "[Tue] $—.—— · Coffee + lunch" },
      { item_type: "checklist_item", title: "[Wed] $—.—— · Fuel" },
      { item_type: "checklist_item", title: "[Thu] $—.—— · Subscription renewal" },
      { item_type: "checklist_item", title: "[Fri] $—.—— · Dinner with friends" },
      { item_type: "checklist_item", title: "Weekly total: $—.——" },
      { item_type: "checklist_item", title: "Notable spike / category to watch next week:" },
    ],
  },
]

export function seedShowcaseTemplates(db: Database.Database, ownerId: string): number {
  // Idempotency flag
  const flag = db
    .prepare(`SELECT value FROM server_settings WHERE key = 'templates_seeded_v1'`)
    .get() as { value: string } | undefined
  if (flag) return 0

  const insertTemplate = db.prepare(`
    INSERT INTO templates (id, name, description, type, icon, color, content, is_favorite, is_published, usage_count, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, 0, ?, datetime('now'), datetime('now'))
  `)
  const insertItem = db.prepare(`
    INSERT INTO template_items (id, template_id, item_type, title, description, config, sort_order, parent_item_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
  `)
  const markSeeded = db.prepare(`
    INSERT INTO server_settings (key, value, updated_at) VALUES ('templates_seeded_v1', 'true', datetime('now'))
  `)

  const randomId = () => "tpl" + Math.random().toString(36).slice(2, 14)

  const tx = db.transaction(() => {
    for (const t of SHOWCASE_TEMPLATES) {
      const tid = randomId()
      insertTemplate.run(
        tid,
        t.name,
        t.description,
        t.type,
        t.icon,
        t.color,
        t.content ? JSON.stringify(t.content) : null,
        ownerId,
      )
      if (t.items) {
        let i = 0
        for (const item of t.items) {
          insertItem.run(
            randomId(),
            tid,
            item.item_type,
            item.title,
            item.description ?? null,
            item.config ? JSON.stringify(item.config) : null,
            i++,
          )
        }
      }
    }
    markSeeded.run()
  })
  tx()
  return SHOWCASE_TEMPLATES.length
}
