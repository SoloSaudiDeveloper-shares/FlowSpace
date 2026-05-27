// Seed FlowSpace with 9 realistic sample projects.
//
// Reads admin user id from the target DB, then inserts:
//   - 12 tags (4 dimensions)
//   - 7 task labels
//   - 9 projects, each with: tasks, default + custom statuses, checklists,
//     dependencies, labels, process, page, reminder, project-level tags
//   - cross-project element links
//   - 1 standalone "Personal weekly" todo list
//   - activity_log entries (with seed marker for cleanup)
//
// Run from project root:   node scripts/seed-projects.mjs
// Set DB_PATH env var to override target (default: .next/standalone/data/app.db).

import Database from "better-sqlite3"
import { nanoid } from "nanoid"
import path from "node:path"
import process from "node:process"

const DB_PATH =
  process.env.DB_PATH ||
  path.join(process.cwd(), ".next", "standalone", "data", "app.db")

const NOW_ISO = "2026-05-27T10:00:00.000Z" // matches CLAUDE.md current date
const SEED_MARKER = JSON.stringify({ seed: "v1" })

// ─── utils ────────────────────────────────────────────────────────────
const id = () => nanoid()
const iso = (d) =>
  (d instanceof Date ? d : new Date(d)).toISOString()
const dateOnly = (yyyy, mm, dd, hour = 10) =>
  iso(new Date(Date.UTC(yyyy, mm - 1, dd, hour)))

// ─── connect ──────────────────────────────────────────────────────────
const db = new Database(DB_PATH)
db.pragma("foreign_keys = ON")

const admin = db.prepare("SELECT id FROM users WHERE role='owner' LIMIT 1").get()
if (!admin) {
  console.error("No owner user found in", DB_PATH)
  process.exit(1)
}
const ADMIN = admin.id
console.log("Seeding into", DB_PATH, "as user", ADMIN)

// ─── prepared statements ──────────────────────────────────────────────
const ins = {
  element: db.prepare(`
    INSERT INTO elements (id, type, title, description, icon, color, is_favorite,
      is_archived, is_deleted, parent_id, sort_order, created_at, updated_at,
      created_by, last_edited_by, version, visibility)
    VALUES (@id, @type, @title, @description, @icon, @color, @is_favorite,
      0, 0, @parent_id, @sort_order, @created_at, @updated_at,
      @created_by, @last_edited_by, 1, 'workspace')
  `),
  project: db.prepare(`
    INSERT INTO projects (id, status, start_date, due_date, progress)
    VALUES (@id, @status, @start_date, @due_date, @progress)
  `),
  taskStatus: db.prepare(`
    INSERT INTO task_statuses (id, project_id, name, color, sort_order, is_done_state)
    VALUES (@id, @project_id, @name, @color, @sort_order, @is_done_state)
  `),
  task: db.prepare(`
    INSERT INTO tasks (id, project_id, status_id, title, description, priority,
      start_date, due_date, sort_order, parent_task_id, time_estimate, time_tracked,
      is_completed, completed_at, created_at, updated_at, created_by,
      assignee_id, last_edited_by, version)
    VALUES (@id, @project_id, @status_id, @title, @description, @priority,
      @start_date, @due_date, @sort_order, NULL, NULL, 0,
      @is_completed, @completed_at, @created_at, @updated_at, @created_by,
      NULL, @created_by, 1)
  `),
  checklist: db.prepare(`
    INSERT INTO task_checklists (id, task_id, title, sort_order, created_at)
    VALUES (@id, @task_id, @title, @sort_order, @created_at)
  `),
  checklistItem: db.prepare(`
    INSERT INTO task_checklist_items (id, checklist_id, title, is_completed,
      sort_order, completed_at)
    VALUES (@id, @checklist_id, @title, @is_completed, @sort_order, @completed_at)
  `),
  dep: db.prepare(`
    INSERT INTO task_dependencies (id, task_id, depends_on_task_id, type, created_at)
    VALUES (@id, @task_id, @depends_on_task_id, @type, @created_at)
  `),
  taskLabel: db.prepare(`
    INSERT INTO task_labels (id, name, color)
    VALUES (@id, @name, @color)
  `),
  taskToLabel: db.prepare(`
    INSERT INTO task_to_labels (task_id, label_id)
    VALUES (@task_id, @label_id)
  `),
  process: db.prepare(`INSERT INTO processes (id) VALUES (@id)`),
  step: db.prepare(`
    INSERT INTO process_steps (id, process_id, title, description, sort_order,
      is_completed, completed_at, created_at)
    VALUES (@id, @process_id, @title, @description, @sort_order, @is_completed,
      @completed_at, @created_at)
  `),
  page: db.prepare(`
    INSERT INTO pages (id, content, cover_image, is_template)
    VALUES (@id, @content, NULL, 0)
  `),
  reminder: db.prepare(`
    INSERT INTO reminders (id, remind_at, repeat_rule, is_dismissed, snoozed_until)
    VALUES (@id, @remind_at, NULL, 0, NULL)
  `),
  todoList: db.prepare(`INSERT INTO todo_lists (id) VALUES (@id)`),
  todoItem: db.prepare(`
    INSERT INTO todo_items (id, list_id, title, is_completed, sort_order,
      due_date, notes, completed_at, created_at)
    VALUES (@id, @list_id, @title, @is_completed, @sort_order,
      @due_date, @notes, @completed_at, @created_at)
  `),
  tag: db.prepare(`INSERT INTO tags (id, name, color) VALUES (@id, @name, @color)`),
  elementTag: db.prepare(`
    INSERT INTO element_tags (element_id, tag_id) VALUES (@element_id, @tag_id)
  `),
  elementLink: db.prepare(`
    INSERT INTO element_links (id, source_id, target_id, link_type, metadata, created_at)
    VALUES (@id, @source_id, @target_id, @link_type, NULL, @created_at)
  `),
  activity: db.prepare(`
    INSERT INTO activity_log (id, element_id, action, details, created_at, user_id)
    VALUES (@id, @element_id, @action, @details, @created_at, @user_id)
  `),
}

// ─── helpers ──────────────────────────────────────────────────────────
function createElement({ type, title, description = null, icon = null, color = null,
                         isFavorite = 0, parentId = null, sortOrder = 0,
                         createdAt = NOW_ISO, updatedAt = NOW_ISO }) {
  const eid = id()
  ins.element.run({
    id: eid, type, title, description, icon, color,
    is_favorite: isFavorite, parent_id: parentId, sort_order: sortOrder,
    created_at: createdAt, updated_at: updatedAt,
    created_by: ADMIN, last_edited_by: ADMIN,
  })
  ins.activity.run({
    id: id(), element_id: eid, action: "created",
    details: SEED_MARKER, created_at: createdAt, user_id: ADMIN,
  })
  return eid
}

function defaultStatuses(projectId) {
  const todo = id(), inprog = id(), done = id()
  ins.taskStatus.run({ id: todo, project_id: projectId, name: "To Do",
    color: "#94a3b8", sort_order: 0, is_done_state: 0 })
  ins.taskStatus.run({ id: inprog, project_id: projectId, name: "In Progress",
    color: "#3b82f6", sort_order: 1, is_done_state: 0 })
  ins.taskStatus.run({ id: done, project_id: projectId, name: "Done",
    color: "#22c55e", sort_order: 2, is_done_state: 1 })
  return { todo, inprog, done }
}

// BlockNote document — minimal valid JSON for a heading + paragraph
function blocknoteDoc(headline, paragraphs) {
  const block = (type, text) => ({
    id: id(), type, props: {
      textColor: "default", backgroundColor: "default", textAlignment: "left",
      ...(type === "heading" ? { level: 1 } : {}),
    },
    content: [{ type: "text", text, styles: {} }],
    children: [],
  })
  return JSON.stringify([
    block("heading", headline),
    ...paragraphs.map((p) => block("paragraph", p)),
  ])
}

// ─── transaction ──────────────────────────────────────────────────────
const seed = db.transaction(() => {

  // ── Tags ──────────────────────────────────────────────────────────
  const TAGS = {}
  const tagRows = [
    // Domain
    ["work", "#3b82f6"], ["study", "#a855f7"], ["side-project", "#06b6d4"],
    // Stakeholder
    ["book-15", "#f59e0b"], ["innovation-center", "#ec4899"], ["cipd", "#10b981"],
    ["malik", "#ef4444"], ["meta", "#1f2937"], ["unity-hub", "#6366f1"],
    // Urgency
    ["this-week", "#dc2626"], ["this-month", "#f97316"], ["this-quarter", "#84cc16"],
    // Type
    ["build", "#0ea5e9"], ["research", "#8b5cf6"], ["homework", "#14b8a6"],
    ["design", "#f472b6"], ["networking", "#facc15"],
  ]
  for (const [name, color] of tagRows) {
    const tid = id()
    ins.tag.run({ id: tid, name, color })
    TAGS[name] = tid
  }
  const tagProject = (elementId, names) => {
    for (const n of names) ins.elementTag.run({ element_id: elementId, tag_id: TAGS[n] })
  }

  // ── Task labels ───────────────────────────────────────────────────
  const LABELS = {}
  for (const [name, color] of [
    ["Bug", "#ef4444"], ["Doc", "#3b82f6"], ["Research", "#a855f7"],
    ["Design", "#f472b6"], ["Code", "#10b981"], ["Review", "#f59e0b"],
    ["Blocked", "#dc2626"],
  ]) {
    const lid = id()
    ins.taskLabel.run({ id: lid, name, color })
    LABELS[name] = lid
  }
  const labelTask = (taskId, names) => {
    for (const n of names) ins.taskToLabel.run({ task_id: taskId, label_id: LABELS[n] })
  }

  // ── Shared CCB process (linked to AGE and Networking) ────────────
  const ccbProcessId = createElement({
    type: "process", title: "CCB Submission Process",
    description: "Standard workflow for change-control review and approval.",
    sortOrder: 100,
  })
  ins.process.run({ id: ccbProcessId })
  const ccbSteps = [
    ["Prepare submission materials", "Slide deck, scope doc, risk log", 1],
    ["Internal review", "Walk-through with the team", 1],
    ["Submit to CCB", "File with the board secretary", 0],
    ["CCB meeting", "Present and field questions", 0],
    ["Address feedback", "Iterate on whatever they raise", 0],
    ["Final approval & sign-off", "Get it in writing", 0],
  ]
  ccbSteps.forEach(([t, d, done], i) => {
    ins.step.run({
      id: id(), process_id: ccbProcessId, title: t, description: d,
      sort_order: i, is_completed: done,
      completed_at: done ? NOW_ISO : null, created_at: NOW_ISO,
    })
  })

  // ── Per-project blueprint helper ─────────────────────────────────
  // Each project entry produces: element + projects row + statuses + tasks +
  // optional checklists/deps + process (unless ccb=true) + page + reminder + tags.
  function buildProject(p, sortOrder) {
    const projId = createElement({
      type: "project", title: p.title, description: p.description,
      sortOrder, createdAt: p.createdAt ?? NOW_ISO, updatedAt: NOW_ISO,
    })
    ins.project.run({
      id: projId, status: p.status, start_date: p.startDate ?? null,
      due_date: p.dueDate, progress: 0, // recomputed below
    })
    const s = defaultStatuses(projId)
    // optional extra columns
    const extras = {}
    if (p.extraStatuses) {
      p.extraStatuses.forEach((es, i) => {
        const eid = id()
        ins.taskStatus.run({
          id: eid, project_id: projId, name: es.name, color: es.color,
          sort_order: 3 + i, is_done_state: es.isDone ? 1 : 0,
        })
        extras[es.name] = eid
      })
    }
    const statusOf = (name) =>
      name === "To Do" ? s.todo : name === "In Progress" ? s.inprog :
      name === "Done" ? s.done : extras[name]

    // tasks
    const taskIds = {}
    p.tasks.forEach((t, i) => {
      const tid = id()
      const isCompleted = t.status === "Done" ? 1 : 0
      const completedAt = isCompleted ? (t.completedAt ?? NOW_ISO) : null
      ins.task.run({
        id: tid, project_id: projId, status_id: statusOf(t.status),
        title: t.title, description: t.description ?? null,
        priority: t.priority ?? "medium",
        start_date: t.startDate ?? null, due_date: t.dueDate ?? null,
        sort_order: i, is_completed: isCompleted, completed_at: completedAt,
        created_at: NOW_ISO, updated_at: NOW_ISO, created_by: ADMIN,
      })
      taskIds[t.title] = tid
      if (t.labels) labelTask(tid, t.labels)
      if (t.checklist) {
        const cid = id()
        ins.checklist.run({
          id: cid, task_id: tid, title: t.checklist.title ?? "Checklist",
          sort_order: 0, created_at: NOW_ISO,
        })
        t.checklist.items.forEach((it, j) => {
          ins.checklistItem.run({
            id: id(), checklist_id: cid, title: it.title,
            is_completed: it.done ? 1 : 0, sort_order: j,
            completed_at: it.done ? NOW_ISO : null,
          })
        })
      }
      if (isCompleted) {
        ins.activity.run({
          id: id(), element_id: projId, action: "completed",
          details: JSON.stringify({ taskId: tid, taskTitle: t.title }),
          created_at: completedAt, user_id: ADMIN,
        })
      }
    })
    // dependencies
    if (p.deps) {
      for (const [a, type, b] of p.deps) {
        ins.dep.run({
          id: id(), task_id: taskIds[a], depends_on_task_id: taskIds[b],
          type, created_at: NOW_ISO,
        })
      }
    }
    // process (if any)
    let processId = null
    if (p.process) {
      processId = createElement({
        type: "process", title: p.process.title,
        description: p.process.description, sortOrder: 100 + sortOrder,
      })
      ins.process.run({ id: processId })
      p.process.steps.forEach((st, i) => {
        ins.step.run({
          id: id(), process_id: processId, title: st.title,
          description: st.description ?? null, sort_order: i,
          is_completed: st.done ? 1 : 0,
          completed_at: st.done ? NOW_ISO : null, created_at: NOW_ISO,
        })
      })
    }
    // page (brief)
    if (p.page) {
      const pgId = createElement({
        type: "page", title: p.page.title, sortOrder: 200 + sortOrder,
      })
      ins.page.run({
        id: pgId,
        content: blocknoteDoc(p.page.title, p.page.paragraphs ?? []),
      })
      // link the page to the project
      ins.elementLink.run({
        id: id(), source_id: projId, target_id: pgId,
        link_type: "contains", created_at: NOW_ISO,
      })
    }
    // reminder
    if (p.reminder) {
      const remId = createElement({
        type: "reminder", title: p.reminder.title, sortOrder: 300 + sortOrder,
      })
      ins.reminder.run({ id: remId, remind_at: p.reminder.at })
      ins.elementLink.run({
        id: id(), source_id: projId, target_id: remId,
        link_type: "relates_to", created_at: NOW_ISO,
      })
    }
    // tags on project
    tagProject(projId, p.tags)
    // ccb shared process link
    if (p.linkCcb) {
      ins.elementLink.run({
        id: id(), source_id: projId, target_id: ccbProcessId,
        link_type: "contains", created_at: NOW_ISO,
      })
    }
    // recompute progress
    const totalTasks = p.tasks.length
    const completedTasks = p.tasks.filter((t) => t.status === "Done").length
    let progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
    db.prepare("UPDATE projects SET progress=? WHERE id=?").run(progress, projId)

    return { projId, taskIds, processId }
  }

  // ───────── 1. NorthStar ─────────
  const NS = buildProject({
    title: "NorthStar",
    description: "Convert NorthStar to a reusable toolkit and extract the toolkits into the Hub in Unity.",
    status: "active",
    dueDate: dateOnly(2026, 7, 15),
    tags: ["work", "build", "unity-hub", "this-month"],
    tasks: [
      { title: "Identify toolkit boundaries", status: "Done", priority: "high",
        labels: ["Doc", "Research"], completedAt: dateOnly(2026, 5, 10) },
      { title: "Audit existing exports", status: "Done", priority: "medium",
        labels: ["Research"], completedAt: dateOnly(2026, 5, 18) },
      { title: "Extract toolkit components from NorthStar repo", status: "In Progress",
        priority: "high", labels: ["Code"], dueDate: dateOnly(2026, 6, 10) },
      { title: "Stage toolkits in Hub branch", status: "In Progress",
        priority: "medium", labels: ["Code"], dueDate: dateOnly(2026, 6, 20) },
      { title: "Verify Unity integration", status: "To Do",
        priority: "high", labels: ["Code", "Review"], dueDate: dateOnly(2026, 7, 5) },
      { title: "Document toolkit public API", status: "To Do",
        priority: "medium", labels: ["Doc"], dueDate: dateOnly(2026, 7, 10) },
      { title: "Tag a release", status: "To Do",
        priority: "low", labels: ["Code"], dueDate: dateOnly(2026, 7, 15) },
    ],
    deps: [["Tag a release", "blocked_by", "Document toolkit public API"]],
    process: {
      title: "Toolkit extraction workflow",
      description: "Repeatable steps for moving toolkits from NorthStar into the Hub.",
      steps: [
        { title: "Identify", done: true },
        { title: "Extract", done: true },
        { title: "Stage in Hub branch", done: false },
        { title: "Verify in Unity", done: false },
        { title: "Document", done: false },
        { title: "Release", done: false },
      ],
    },
    page: {
      title: "NorthStar Toolkit Brief",
      paragraphs: [
        "Goal: lift the toolkit out of NorthStar and ship it as a Hub package consumable by any Unity project.",
        "Scope: data, UI helpers, build utilities. Stretch: editor extensions.",
        "Open questions: namespacing, versioning, sample scenes.",
      ],
    },
    reminder: { title: "Tag NorthStar toolkit release",
      at: dateOnly(2026, 7, 14, 9) },
  }, 0)

  // ───────── 2. Vault system ─────────
  const VS = buildProject({
    title: "Vault system",
    description: "Internal vault for secure data (placeholder — confirm scope).",
    status: "paused",
    dueDate: dateOnly(2026, 8, 30),
    tags: ["work", "build", "this-quarter"],
    tasks: [
      { title: "Define scope", status: "To Do", priority: "high",
        labels: ["Doc"], dueDate: dateOnly(2026, 6, 15) },
      { title: "Decide encryption approach", status: "To Do",
        priority: "high", labels: ["Research"], dueDate: dateOnly(2026, 6, 30) },
      { title: "Pick storage backend", status: "To Do",
        priority: "medium", labels: ["Research"], dueDate: dateOnly(2026, 7, 10) },
      { title: "Spike auth flow", status: "To Do",
        priority: "medium", labels: ["Code"], dueDate: dateOnly(2026, 7, 25) },
      { title: "Threat-model review", status: "To Do",
        priority: "high", labels: ["Review"], dueDate: dateOnly(2026, 8, 15) },
    ],
    process: {
      title: "Security review workflow",
      description: "Standard security path for new internal data systems.",
      steps: [
        { title: "Threat model", done: false },
        { title: "Design review", done: false },
        { title: "Build", done: false },
        { title: "Pen test", done: false },
        { title: "Sign-off", done: false },
      ],
    },
    page: {
      title: "Vault System — Design Notes",
      paragraphs: [
        "TODO: scope confirmation with stakeholder.",
        "TODO: encryption choice (AES-GCM vs libsodium).",
        "TODO: storage backend.",
      ],
    },
    reminder: { title: "Design review for Vault",
      at: dateOnly(2026, 8, 29, 9) },
  }, 1)

  // ───────── 3. UI things from Meta ─────────
  const UM = buildProject({
    title: "UI things from Meta",
    description: "Extract UI samples from Meta sample projects and install them in the Hub.",
    status: "active",
    dueDate: dateOnly(2026, 6, 20),
    tags: ["study", "design", "meta", "unity-hub", "this-month"],
    tasks: [
      { title: "Pull latest Meta samples", status: "Done",
        priority: "medium", labels: ["Code"], completedAt: dateOnly(2026, 5, 15) },
      { title: "Extract UI layouts from samples", status: "In Progress",
        priority: "high", labels: ["Design", "Code"], dueDate: dateOnly(2026, 6, 1),
        checklist: {
          title: "Layouts to extract",
          items: [
            { title: "Main menu", done: true },
            { title: "Settings panel", done: true },
            { title: "HUD overlay", done: false },
            { title: "Inventory grid", done: false },
            { title: "Confirmation dialog", done: false },
          ],
        }},
      { title: "Adapt naming to Hub conventions", status: "In Progress",
        priority: "medium", labels: ["Code", "Doc"], dueDate: dateOnly(2026, 6, 5) },
      { title: "Install in Hub component library", status: "To Do",
        priority: "high", labels: ["Code"], dueDate: dateOnly(2026, 6, 10) },
      { title: "Build a demo scene in Unity", status: "To Do",
        priority: "medium", labels: ["Design"], dueDate: dateOnly(2026, 6, 15) },
      { title: "Get a designer review", status: "To Do",
        priority: "low", labels: ["Review"], dueDate: dateOnly(2026, 6, 18) },
    ],
    process: {
      title: "Hub component import",
      description: "Standard flow for bringing external UI samples into the Hub library.",
      steps: [
        { title: "Pull", done: true },
        { title: "Extract", done: false },
        { title: "Adapt", done: false },
        { title: "Install", done: false },
        { title: "Demo", done: false },
        { title: "Review", done: false },
      ],
    },
    page: {
      title: "Meta UI Samples — Catalog",
      paragraphs: [
        "Source: Meta sample project (latest pull 2026-05-15).",
        "Targeted layouts: Main menu, Settings, HUD, Inventory, Confirmation.",
        "License + attribution notes pending.",
      ],
    },
    reminder: { title: "Demo Meta UI layouts in Hub",
      at: dateOnly(2026, 6, 15, 9) },
  }, 2)

  // ───────── 4. Homework (completed) ─────────
  const HW = buildProject({
    title: "Homework",
    description: "Coursework deliverable — delivered 2026-05-24, deadline was 2026-05-25.",
    status: "completed",
    dueDate: dateOnly(2026, 5, 25),
    tags: ["study", "homework", "cipd"],
    tasks: [
      { title: "Draft answers", status: "Done", priority: "high",
        labels: ["Doc"], completedAt: dateOnly(2026, 5, 20) },
      { title: "Cite sources", status: "Done", priority: "medium",
        labels: ["Doc", "Research"], completedAt: dateOnly(2026, 5, 22) },
      { title: "Proofread", status: "Done", priority: "medium",
        labels: ["Review"], completedAt: dateOnly(2026, 5, 23) },
      { title: "Submit before 25/5", status: "Done", priority: "urgent",
        labels: ["Doc"], completedAt: dateOnly(2026, 5, 24) },
    ],
    page: {
      title: "Homework — Final Submission",
      paragraphs: [
        "Final version submitted on 2026-05-24, one day before the 25/5 deadline.",
        "Sources cited; reviewed; archived locally.",
      ],
    },
  }, 3)

  // ───────── 5. AGE ─────────
  const AG = buildProject({
    title: "AGE",
    description: "Finish the UIs and submit through a CCB meeting.",
    status: "active",
    dueDate: dateOnly(2026, 7, 1),
    tags: ["work", "cipd", "build", "this-month"],
    extraStatuses: [
      { name: "Blocked", color: "#dc2626", isDone: false },
      { name: "Review", color: "#f59e0b", isDone: false },
    ],
    tasks: [
      { title: "Lock scope with stakeholders", status: "Done", priority: "high",
        labels: ["Doc"], completedAt: dateOnly(2026, 5, 5) },
      { title: "First-pass UI mockups", status: "Done", priority: "high",
        labels: ["Design"], completedAt: dateOnly(2026, 5, 18) },
      { title: "Finish remaining UI screens", status: "In Progress",
        priority: "high", labels: ["Design", "Code"], dueDate: dateOnly(2026, 6, 10) },
      { title: "Internal review", status: "Review", priority: "medium",
        labels: ["Review"], dueDate: dateOnly(2026, 6, 18) },
      { title: "Prepare CCB submission package", status: "To Do",
        priority: "high", labels: ["Doc"], dueDate: dateOnly(2026, 6, 22) },
      { title: "Submit to CCB", status: "To Do", priority: "urgent",
        labels: ["Doc"], dueDate: dateOnly(2026, 6, 25) },
      { title: "Address CCB feedback", status: "To Do", priority: "high",
        labels: ["Code", "Doc"], dueDate: dateOnly(2026, 7, 1) },
    ],
    deps: [["Submit to CCB", "blocked_by", "Prepare CCB submission package"]],
    page: {
      title: "AGE — CCB Brief",
      paragraphs: [
        "Stakeholders: scope locked 2026-05-05.",
        "Open risks: UI screens 4-6 still in progress.",
        "Mitigation: pull-forward review on the finished ones.",
      ],
    },
    reminder: { title: "CCB meeting prep for AGE",
      at: dateOnly(2026, 6, 30, 9) },
    linkCcb: true,
  }, 4)

  // ───────── 6. Networking ─────────
  const NW = buildProject({
    title: "Networking",
    description: "Finish Book 15, test team functionality and the networking project, then submit through CCB.",
    status: "active",
    dueDate: dateOnly(2026, 12, 31),
    tags: ["work", "book-15", "networking", "this-quarter"],
    extraStatuses: [
      { name: "Blocked", color: "#dc2626", isDone: false },
    ],
    tasks: [
      { title: "Outline Book 15 chapters", status: "Done", priority: "high",
        labels: ["Doc"], completedAt: dateOnly(2026, 4, 20) },
      { title: "Finish Book 15 chapters", status: "In Progress", priority: "high",
        labels: ["Doc"], dueDate: dateOnly(2026, 6, 15) },
      { title: "Test team functionality", status: "In Progress", priority: "high",
        labels: ["Code", "Review"], dueDate: dateOnly(2026, 7, 1) },
      { title: "Test networking project", status: "To Do", priority: "high",
        labels: ["Code"], dueDate: dateOnly(2026, 8, 15) },
      { title: "Prepare CCB submission", status: "To Do", priority: "medium",
        labels: ["Doc"], dueDate: dateOnly(2026, 10, 15) },
      { title: "Submit to CCB", status: "To Do", priority: "urgent",
        labels: ["Doc"], dueDate: dateOnly(2026, 11, 15) },
    ],
    deps: [["Submit to CCB", "blocked_by", "Test networking project"]],
    page: {
      title: "Networking + Book 15 — Status",
      paragraphs: [
        "Book 15 chapters partially complete; ETA mid-June.",
        "Team functionality testing in progress; networking project testing queued.",
        "CCB submission planned for Q4.",
      ],
    },
    reminder: { title: "Book 15 finalisation",
      at: dateOnly(2026, 6, 15, 9) },
    linkCcb: true,
  }, 5)

  // ───────── 7. Matrix of skills ─────────
  const MX = buildProject({
    title: "Matrix of skills",
    description: "Compile per-person skills inventory and send to the lead.",
    status: "active",
    dueDate: dateOnly(2026, 6, 5),
    tags: ["work", "book-15", "research", "this-week"],
    tasks: [
      { title: "Joe — skills entry", status: "Done", priority: "medium",
        labels: ["Research"], completedAt: dateOnly(2026, 5, 18) },
      { title: "David — skills entry", status: "Done", priority: "medium",
        labels: ["Research"], completedAt: dateOnly(2026, 5, 20) },
      { title: "Muhammad — skills entry", status: "In Progress",
        priority: "high", labels: ["Research"], dueDate: dateOnly(2026, 5, 30) },
      { title: "Waleed — follow-up", status: "In Progress",
        priority: "urgent", labels: ["Research"], dueDate: dateOnly(2026, 5, 29) },
      { title: "Compile skills matrix", status: "To Do",
        priority: "high", labels: ["Doc"], dueDate: dateOnly(2026, 6, 3),
        checklist: {
          title: "People",
          items: [
            { title: "Joe", done: true },
            { title: "David", done: true },
            { title: "Muhammad", done: false },
            { title: "Waleed", done: false },
          ],
        }},
      { title: "Send to lead", status: "To Do",
        priority: "urgent", labels: ["Doc"], dueDate: dateOnly(2026, 6, 5) },
    ],
    deps: [["Send to lead", "blocked_by", "Compile skills matrix"]],
    page: {
      title: "Skills Matrix — Status",
      paragraphs: [
        "Joe: complete. David: complete.",
        "Muhammad: pending — chasing.",
        "Waleed: follow-up scheduled for this week.",
      ],
    },
    reminder: { title: "Send skills matrix to lead",
      at: dateOnly(2026, 6, 4, 9) },
  }, 6)

  // ───────── 8. Speaking app ─────────
  const SP = buildProject({
    title: "Speaking app",
    description: "Speaking-practice app for the Innovation Center — test on standalone + dev machines, wire API keys.",
    status: "active",
    dueDate: dateOnly(2026, 9, 30),
    tags: ["side-project", "innovation-center", "build", "this-quarter"],
    tasks: [
      { title: "Build standalone bundle", status: "Done", priority: "high",
        labels: ["Code"], completedAt: dateOnly(2026, 5, 12) },
      { title: "Test on standalone computer", status: "In Progress",
        priority: "high", labels: ["Code", "Review"], dueDate: dateOnly(2026, 7, 15) },
      { title: "Test on dev computer", status: "In Progress",
        priority: "medium", labels: ["Code", "Review"], dueDate: dateOnly(2026, 7, 20) },
      { title: "Add API key configuration", status: "To Do",
        priority: "high", labels: ["Code"], dueDate: dateOnly(2026, 8, 10) },
      { title: "Test API key flow end-to-end", status: "To Do",
        priority: "high", labels: ["Code", "Review"], dueDate: dateOnly(2026, 9, 1) },
      { title: "Document setup", status: "To Do",
        priority: "medium", labels: ["Doc"], dueDate: dateOnly(2026, 9, 20) },
    ],
    process: {
      title: "Cross-machine validation",
      description: "Validate a build on both reference machines before sign-off.",
      steps: [
        { title: "Build", done: true },
        { title: "Deploy to standalone", done: false },
        { title: "Test on standalone", done: false },
        { title: "Deploy to dev", done: false },
        { title: "Test on dev", done: false },
        { title: "Sign-off", done: false },
      ],
    },
    page: {
      title: "Speaking App — Test Plan",
      paragraphs: [
        "Environments: standalone computer (locked-down) and personal dev machine.",
        "Test cases: cold start, mic permission, API key prompt, offline fallback.",
        "API keys: stored per-user, not bundled.",
      ],
    },
    reminder: { title: "Speaking app sign-off",
      at: dateOnly(2026, 9, 29, 9) },
  }, 7)

  // ───────── 9. Malik project ─────────
  const MK = buildProject({
    title: "Malik project",
    description: "Download project from the TTS network, test AI comparison, add API calls.",
    status: "active",
    dueDate: dateOnly(2026, 7, 31),
    tags: ["work", "malik", "build", "research", "this-month"],
    tasks: [
      { title: "Download project from TTS network", status: "To Do",
        priority: "urgent", labels: ["Code"], dueDate: dateOnly(2026, 6, 5) },
      { title: "Run baseline locally", status: "To Do",
        priority: "high", labels: ["Code", "Research"], dueDate: dateOnly(2026, 6, 12) },
      { title: "Test AI comparison feature", status: "To Do",
        priority: "high", labels: ["Research"], dueDate: dateOnly(2026, 6, 25) },
      { title: "Add API call integrations", status: "To Do",
        priority: "high", labels: ["Code"], dueDate: dateOnly(2026, 7, 15) },
      { title: "Validate end-to-end", status: "To Do",
        priority: "medium", labels: ["Review"], dueDate: dateOnly(2026, 7, 28) },
    ],
    deps: [
      ["Run baseline locally", "blocked_by", "Download project from TTS network"],
      ["Test AI comparison feature", "blocked_by", "Run baseline locally"],
    ],
    process: {
      title: "AI feature integration",
      description: "Acquire third-party project, baseline it, integrate APIs, validate.",
      steps: [
        { title: "Acquire", done: false },
        { title: "Run baseline", done: false },
        { title: "Test feature", done: false },
        { title: "Integrate APIs", done: false },
        { title: "Validate", done: false },
      ],
    },
    page: {
      title: "Malik Project — Notes",
      paragraphs: [
        "Source: TTS network share.",
        "Goal: evaluate AI comparison module and add the missing API call layer.",
        "Open questions: rate limits, key rotation.",
      ],
    },
    reminder: { title: "Malik project AI integration check",
      at: dateOnly(2026, 7, 30, 9) },
  }, 8)

  // ── Cross-project links ─────────────────────────────────────────
  const link = (source, target, type) =>
    ins.elementLink.run({
      id: id(), source_id: source, target_id: target,
      link_type: type, created_at: NOW_ISO,
    })
  link(NS.projId, UM.projId, "relates_to")  // both target the Hub
  link(NW.projId, MX.projId, "relates_to")  // both for Book 15
  // AGE and Networking both link to ccbProcessId (already linked in buildProject via linkCcb)

  // ── Personal weekly todo list ───────────────────────────────────
  const todoListId = createElement({
    type: "todo_list", title: "Personal weekly", sortOrder: 1000,
    description: "Recurring weekly checklist.",
  })
  ins.todoList.run({ id: todoListId })
  const todoItems = [
    { title: "Inbox zero", done: true },
    { title: "Review PRs", done: true },
    { title: "Plan next sprint", done: false },
    { title: "Gym Tue / Thu", done: true },
    { title: "Call family", done: false },
    { title: "Update calendar", done: false },
    { title: "Submit timesheet", done: false },
    { title: "Backup laptop", done: false },
  ]
  todoItems.forEach((t, i) => {
    ins.todoItem.run({
      id: id(), list_id: todoListId, title: t.title,
      is_completed: t.done ? 1 : 0, sort_order: i,
      due_date: null, notes: null,
      completed_at: t.done ? NOW_ISO : null, created_at: NOW_ISO,
    })
  })

  console.log("Seeded successfully.")
})

seed()

// ─── summary ──────────────────────────────────────────────────────────
const stats = {
  projects: db.prepare("SELECT COUNT(*) n FROM elements WHERE type='project'").get().n,
  tasks: db.prepare("SELECT COUNT(*) n FROM tasks").get().n,
  pages: db.prepare("SELECT COUNT(*) n FROM elements WHERE type='page'").get().n,
  processes: db.prepare("SELECT COUNT(*) n FROM elements WHERE type='process'").get().n,
  reminders: db.prepare("SELECT COUNT(*) n FROM elements WHERE type='reminder'").get().n,
  todo_lists: db.prepare("SELECT COUNT(*) n FROM elements WHERE type='todo_list'").get().n,
  tags: db.prepare("SELECT COUNT(*) n FROM tags").get().n,
  task_labels: db.prepare("SELECT COUNT(*) n FROM task_labels").get().n,
  element_links: db.prepare("SELECT COUNT(*) n FROM element_links").get().n,
  checklist_items: db.prepare("SELECT COUNT(*) n FROM task_checklist_items").get().n,
  dependencies: db.prepare("SELECT COUNT(*) n FROM task_dependencies").get().n,
  activity_log: db.prepare("SELECT COUNT(*) n FROM activity_log").get().n,
}
console.log("\nFinal counts:")
for (const [k, v] of Object.entries(stats)) console.log(`  ${k}:`, v)

db.close()
