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

  // ── Bug Tracker (Jira-inspired) ───────────────────────────────────
  {
    name: "Bug Tracker — Software",
    description: "Jira-style severity workflow with Open / Triage / In Progress / In Review / Closed. Seeded with realistic example bugs across severity.",
    type: "project",
    icon: "Bug",
    color: "#ef4444",
    items: [
      { item_type: "status", title: "Open",         config: { color: "#94a3b8", sortOrder: 0, isDoneState: false } },
      { item_type: "status", title: "Triage",       config: { color: "#f59e0b", sortOrder: 1, isDoneState: false } },
      { item_type: "status", title: "In Progress",  config: { color: "#3b82f6", sortOrder: 2, isDoneState: false } },
      { item_type: "status", title: "In Review",    config: { color: "#8b5cf6", sortOrder: 3, isDoneState: false } },
      { item_type: "status", title: "Closed",       config: { color: "#22c55e", sortOrder: 4, isDoneState: true } },
      { item_type: "label",  title: "blocker",  config: { color: "#7c2d12" } },
      { item_type: "label",  title: "critical", config: { color: "#dc2626" } },
      { item_type: "label",  title: "major",    config: { color: "#ea580c" } },
      { item_type: "label",  title: "minor",    config: { color: "#ca8a04" } },
      { item_type: "label",  title: "trivial",  config: { color: "#65a30d" } },
      { item_type: "label",  title: "regression",  config: { color: "#9333ea" } },
      { item_type: "task",   title: "[BUG] Login form crashes on submit with empty password",  description: "Repro: Open /login, click Sign In without typing anything. Expected: validation error. Actual: 500.\nSteps:\n1. Visit /login\n2. Click 'Sign In'\nEnvironment: Chrome 130 / macOS 15", config: { status: "Triage",      priority: "urgent" } },
      { item_type: "task",   title: "[BUG] Sidebar drag-and-drop loses order on refresh",      description: "Reorder works visually but state not persisted. Likely a missing PATCH.", config: { status: "In Progress", priority: "high" } },
      { item_type: "task",   title: "[BUG] Date picker shows wrong week on Mondays",          description: "Edge case at the week boundary. Spotted in Calendar view.",                config: { status: "Open",        priority: "medium" } },
      { item_type: "task",   title: "[BUG] CSV export omits the description column",          description: "Export action defined column list missing 'description'.",                config: { status: "In Review",   priority: "low" } },
      { item_type: "task",   title: "[BUG] Inline title editor doesn't save on blur",         description: "User clicks elsewhere, change reverts. Probably onBlur handler missing.",  config: { status: "Open",        priority: "medium" } },
      { item_type: "task",   title: "[BUG] Dark mode flickers on first paint",                description: "FOUC — theme cookie not read on SSR.",                                    config: { status: "Closed",      priority: "low" } },
    ],
  },

  // ── Marketing Campaign ────────────────────────────────────────────
  {
    name: "Marketing Campaign — Product Launch",
    description: "End-to-end 4-phase campaign: Plan, Create, Launch, Measure. Each phase has 4-6 starter tasks with realistic priorities.",
    type: "project",
    icon: "Megaphone",
    color: "#ec4899",
    items: [
      { item_type: "status", title: "Plan",    config: { color: "#94a3b8", sortOrder: 0, isDoneState: false } },
      { item_type: "status", title: "Create",  config: { color: "#3b82f6", sortOrder: 1, isDoneState: false } },
      { item_type: "status", title: "Launch",  config: { color: "#f97316", sortOrder: 2, isDoneState: false } },
      { item_type: "status", title: "Measure", config: { color: "#22c55e", sortOrder: 3, isDoneState: true } },
      { item_type: "label",  title: "must-have", config: { color: "#ef4444" } },
      { item_type: "label",  title: "nice-to-have", config: { color: "#3b82f6" } },
      { item_type: "task",   title: "Campaign brief + KPIs",            description: "One-pager: goal, audience, message, success metric (CTR, signups, MRR…). Sign-off from leadership.",   config: { status: "Plan",    priority: "high" } },
      { item_type: "task",   title: "Audience segmentation",            description: "Define 2-3 ICPs. Pull list from CRM, deduplicate, tag.",                                              config: { status: "Plan",    priority: "high" } },
      { item_type: "task",   title: "Channel mix + budget split",       description: "Paid vs organic, social vs email vs SEO. Get numbers, not opinions.",                               config: { status: "Plan",    priority: "high" } },
      { item_type: "task",   title: "Asset list + dependencies",        description: "Hero video, 12 social posts, landing page, blog post, 3 email sends, demo deck.",                  config: { status: "Plan",    priority: "medium" } },
      { item_type: "task",   title: "Landing page copy + design",       description: "Headline, sub, 3 benefit blocks, social proof, CTA. Variants for A/B.",                            config: { status: "Create",  priority: "high" } },
      { item_type: "task",   title: "Email sequence (3 touches)",       description: "Teaser → Launch → Follow-up. Personalised first line per segment.",                               config: { status: "Create",  priority: "high" } },
      { item_type: "task",   title: "Social copy + 12 visuals",         description: "Hook + CTA per post. Mix carousels, single image, video clips.",                                  config: { status: "Create",  priority: "medium" } },
      { item_type: "task",   title: "PR pitch + 5 outlet outreach",     description: "Personalised pitch. Embargo and exclusive offers if needed.",                                     config: { status: "Create",  priority: "medium" } },
      { item_type: "task",   title: "Demo video script + record",       description: "60-90s demo. Show outcome first, then product.",                                                  config: { status: "Create",  priority: "medium" } },
      { item_type: "task",   title: "Final QA + dry run",               description: "Test all links, tracking, fallback URLs, mobile rendering. Pre-launch checklist.",                config: { status: "Launch",  priority: "high" } },
      { item_type: "task",   title: "Go live: page + email + social",   description: "Coordinated push. Monitor first hour for issues.",                                                config: { status: "Launch",  priority: "high" } },
      { item_type: "task",   title: "Customer & community AMA",         description: "Open thread or live session. Capture FAQs.",                                                       config: { status: "Launch",  priority: "medium" } },
      { item_type: "task",   title: "Daily metrics review (week 1)",    description: "Track signups, conversion, CAC, drop-off. Update stakeholders.",                                  config: { status: "Measure", priority: "high" } },
      { item_type: "task",   title: "Post-mortem + learnings doc",      description: "What worked, what didn't, what to change next campaign. Add to playbook.",                       config: { status: "Measure", priority: "medium" } },
    ],
  },

  // ── OKRs Quarterly ────────────────────────────────────────────────
  {
    name: "OKRs — Quarterly Planning",
    description: "Set 3 Objectives, each with 3 measurable Key Results. Track confidence weekly. Score at end of quarter (0.0-1.0).",
    type: "project",
    icon: "Target",
    color: "#0ea5e9",
    items: [
      { item_type: "status", title: "Drafting",    config: { color: "#94a3b8", sortOrder: 0, isDoneState: false } },
      { item_type: "status", title: "Committed",   config: { color: "#3b82f6", sortOrder: 1, isDoneState: false } },
      { item_type: "status", title: "At Risk",     config: { color: "#f59e0b", sortOrder: 2, isDoneState: false } },
      { item_type: "status", title: "On Track",    config: { color: "#10b981", sortOrder: 3, isDoneState: false } },
      { item_type: "status", title: "Scored",      config: { color: "#8b5cf6", sortOrder: 4, isDoneState: true } },
      { item_type: "label",  title: "objective", config: { color: "#0ea5e9" } },
      { item_type: "label",  title: "key result", config: { color: "#22c55e" } },
      { item_type: "task",   title: "OBJECTIVE: Become the default tool for our top 100 customers",                  description: "Aspirational. Qualitative. Inspires the team.", config: { status: "Drafting", priority: "high" } },
      { item_type: "task",   title: "KR 1.1 — Drive weekly active users from 320 → 700 by EOQ",                       description: "Measurable. Score = (actual - start) / (target - start).", config: { status: "Drafting", priority: "high" } },
      { item_type: "task",   title: "KR 1.2 — Reach 90% feature adoption for 3 hero features",                       description: "Adoption = % of active users who used the feature ≥ once in a week.", config: { status: "Drafting", priority: "high" } },
      { item_type: "task",   title: "KR 1.3 — NPS up from 32 to 55",                                                 description: "Quarterly NPS survey + analysis.", config: { status: "Drafting", priority: "high" } },
      { item_type: "task",   title: "OBJECTIVE: Make onboarding feel effortless",                                    description: "", config: { status: "Drafting", priority: "high" } },
      { item_type: "task",   title: "KR 2.1 — Time-to-first-value down from 14 min to 4 min",                        description: "Measured via session telemetry.", config: { status: "Drafting", priority: "high" } },
      { item_type: "task",   title: "KR 2.2 — D7 activation rate up from 22% to 45%",                                description: "Activation = completed setup + made one real action.", config: { status: "Drafting", priority: "high" } },
      { item_type: "task",   title: "KR 2.3 — Reduce support tickets per new user from 1.8 to 0.6",                  description: "From self-serve helpfulness + clearer empty states.", config: { status: "Drafting", priority: "medium" } },
      { item_type: "task",   title: "OBJECTIVE: Build a healthy, durable engineering team",                          description: "", config: { status: "Drafting", priority: "medium" } },
      { item_type: "task",   title: "KR 3.1 — 90% of sprints close within ±20% of forecasted points",                description: "", config: { status: "Drafting", priority: "medium" } },
      { item_type: "task",   title: "KR 3.2 — p90 PR review turnaround under 8 hours",                               description: "", config: { status: "Drafting", priority: "medium" } },
      { item_type: "task",   title: "KR 3.3 — On-call incident rate under 2 per month, MTTR < 30 min",               description: "", config: { status: "Drafting", priority: "medium" } },
    ],
  },

  // ── Sprint Retrospective canvas ───────────────────────────────────
  {
    name: "Sprint Retrospective — Start/Stop/Continue",
    description: "Classic retro layout with three columns. Run live: each person drops sticky notes in 5 min, then group + vote.",
    type: "canvas",
    icon: "Sparkles",
    color: "#a855f7",
    content: {
      nodes: [
        // Headers
        { id: "h1", type: "header", x: -380, y: -250, w: 220, h: 40, text: "START — what should we add?", color: "#22c55e" },
        { id: "h2", type: "header", x: -120, y: -250, w: 220, h: 40, text: "STOP — what isn't working?",  color: "#ef4444" },
        { id: "h3", type: "header", x:  140, y: -250, w: 220, h: 40, text: "CONTINUE — what's great?",    color: "#3b82f6" },
        // Sample sticky notes
        { id: "s1", type: "sticky", x: -360, y: -180, w: 180, h: 90, color: "#bbf7d0", text: "Async standups (write up the day before)" },
        { id: "s2", type: "sticky", x: -360, y:  -80, w: 180, h: 90, color: "#bbf7d0", text: "Pair-programming Wednesdays" },
        { id: "s3", type: "sticky", x: -100, y: -180, w: 180, h: 90, color: "#fecaca", text: "Sprint goals that change mid-sprint" },
        { id: "s4", type: "sticky", x: -100, y:  -80, w: 180, h: 90, color: "#fecaca", text: "Meetings without an agenda" },
        { id: "s5", type: "sticky", x:  160, y: -180, w: 180, h: 90, color: "#bfdbfe", text: "Friday demos — keep the cadence" },
        { id: "s6", type: "sticky", x:  160, y:  -80, w: 180, h: 90, color: "#bfdbfe", text: "Clear PR descriptions" },
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

/**
 * Seed showcase templates for a specific user. Each user gets their own
 * private copies (per the per-user isolation model).
 *
 * Idempotent per user — skips templates already present in that user's
 * workspace, only inserts genuinely new ones. Safe to call on every
 * new-user signup and on startup for the oldest user.
 */
export function seedShowcaseTemplates(db: Database.Database, ownerId: string): number {
  // Skip individual templates that already exist for this user.
  const existingNames = new Set(
    (db
      .prepare(`SELECT name FROM templates WHERE created_by = ?`)
      .all(ownerId) as { name: string }[]).map((r) => r.name)
  )

  const insertTemplate = db.prepare(`
    INSERT INTO templates (id, name, description, type, icon, color, content, is_favorite, is_published, usage_count, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, 0, ?, datetime('now'), datetime('now'))
  `)
  const insertItem = db.prepare(`
    INSERT INTO template_items (id, template_id, item_type, title, description, config, sort_order, parent_item_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
  `)

  const randomId = () => "tpl" + Math.random().toString(36).slice(2, 14)

  let insertedCount = 0
  const tx = db.transaction(() => {
    for (const t of SHOWCASE_TEMPLATES) {
      if (existingNames.has(t.name)) continue
      insertedCount++
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
  })
  tx()
  return insertedCount
}
