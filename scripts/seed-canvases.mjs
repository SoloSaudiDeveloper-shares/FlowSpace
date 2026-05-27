// Add 4 canvases to the already-seeded FlowSpace DB.
//
// 1. NorthStar Architecture — card nodes for toolkit modules, edges for deps
// 2. Networking Map        — sticky notes per person, edges to a "Lead" hub
// 3. 2026 Workspace Map    — element_embed nodes for all 9 projects (grid layout)
// 4. CCB Process Flowchart — text nodes for each CCB step, connected
//
// Run: node scripts/seed-canvases.mjs
// Idempotent against running multiple times: skips creation if a canvas with
// the same title already exists.

import Database from "better-sqlite3"
import { nanoid } from "nanoid"
import path from "node:path"
import process from "node:process"

const DB_PATH =
  process.env.DB_PATH ||
  path.join(process.cwd(), ".next", "standalone", "data", "app.db")

const NOW_ISO = "2026-05-27T11:00:00.000Z"
const SEED_MARKER = JSON.stringify({ seed: "v1" })
const id = () => nanoid()

const db = new Database(DB_PATH)
db.pragma("foreign_keys = ON")

const admin = db.prepare("SELECT id FROM users WHERE role='owner' LIMIT 1").get()
if (!admin) {
  console.error("No owner user found in", DB_PATH); process.exit(1)
}
const ADMIN = admin.id
console.log("Adding canvases to", DB_PATH)

// ─── statements ──────────────────────────────────────────────────────
const stmt = {
  element: db.prepare(`
    INSERT INTO elements (id, type, title, description, icon, color, is_favorite,
      is_archived, is_deleted, parent_id, sort_order, created_at, updated_at,
      created_by, last_edited_by, version, visibility)
    VALUES (@id, @type, @title, @description, NULL, NULL, 0,
      0, 0, NULL, @sort_order, @created_at, @updated_at,
      @created_by, @created_by, 1, 'workspace')
  `),
  canvas: db.prepare(`
    INSERT INTO canvases (id, viewport_x, viewport_y, viewport_zoom)
    VALUES (@id, @viewport_x, @viewport_y, @viewport_zoom)
  `),
  node: db.prepare(`
    INSERT INTO canvas_nodes (id, canvas_id, type, position_x, position_y, width,
      height, data, element_ref_id, style, created_at)
    VALUES (@id, @canvas_id, @type, @position_x, @position_y, @width,
      @height, @data, @element_ref_id, @style, @created_at)
  `),
  edge: db.prepare(`
    INSERT INTO canvas_edges (id, canvas_id, source_node_id, target_node_id,
      source_handle, target_handle, type, label, style, animated)
    VALUES (@id, @canvas_id, @source_node_id, @target_node_id,
      @source_handle, @target_handle, @type, @label, @style, @animated)
  `),
  link: db.prepare(`
    INSERT INTO element_links (id, source_id, target_id, link_type, metadata, created_at)
    VALUES (@id, @source_id, @target_id, @link_type, NULL, @created_at)
  `),
  activity: db.prepare(`
    INSERT INTO activity_log (id, element_id, action, details, created_at, user_id)
    VALUES (@id, @element_id, @action, @details, @created_at, @user_id)
  `),
}

function existingCanvas(title) {
  return db.prepare("SELECT id FROM elements WHERE type='canvas' AND title=? AND is_deleted=0")
    .get(title)
}

function findElement(title) {
  return db.prepare("SELECT id FROM elements WHERE title=? AND is_deleted=0 LIMIT 1").get(title)
}

function createCanvas({ title, description, sortOrder, viewport = { x: 0, y: 0, zoom: 1 } }) {
  if (existingCanvas(title)) {
    console.log("  skip (exists):", title)
    return null
  }
  const eid = id()
  stmt.element.run({
    id: eid, type: "canvas", title, description,
    sort_order: sortOrder, created_at: NOW_ISO, updated_at: NOW_ISO,
    created_by: ADMIN,
  })
  stmt.canvas.run({
    id: eid, viewport_x: viewport.x, viewport_y: viewport.y, viewport_zoom: viewport.zoom,
  })
  stmt.activity.run({
    id: id(), element_id: eid, action: "created",
    details: SEED_MARKER, created_at: NOW_ISO, user_id: ADMIN,
  })
  return eid
}

function addNode({ canvasId, type, x, y, w = 200, h = 80, data, elementRefId = null, style = null }) {
  const nid = id()
  stmt.node.run({
    id: nid, canvas_id: canvasId, type, position_x: x, position_y: y,
    width: w, height: h,
    data: data ? JSON.stringify(data) : null,
    element_ref_id: elementRefId,
    style: style ? JSON.stringify(style) : null,
    created_at: NOW_ISO,
  })
  return nid
}

function addEdge({ canvasId, source, target, label = null, animated = false, type = "default" }) {
  stmt.edge.run({
    id: id(), canvas_id: canvasId, source_node_id: source, target_node_id: target,
    source_handle: null, target_handle: null, type, label, style: null,
    animated: animated ? 1 : 0,
  })
}

function linkProjectToCanvas(projectTitle, canvasId, linkType = "contains") {
  const proj = findElement(projectTitle)
  if (!proj || !canvasId) return
  stmt.link.run({
    id: id(), source_id: proj.id, target_id: canvasId,
    link_type: linkType, created_at: NOW_ISO,
  })
}

const tx = db.transaction(() => {

  // ───────── 1. NorthStar Architecture ─────────
  const c1 = createCanvas({
    title: "NorthStar Architecture",
    description: "Toolkit modules and dependency map.",
    sortOrder: 0,
  })
  if (c1) {
    const core = addNode({ canvasId: c1, type: "card", x: 280, y: 60, w: 220, h: 110,
      data: { label: "Core", description: "Shared types, utilities, math, IO" } })
    const ui = addNode({ canvasId: c1, type: "card", x: 60, y: 240, w: 220, h: 110,
      data: { label: "UI Helpers", description: "Reusable Unity UI components" } })
    const build = addNode({ canvasId: c1, type: "card", x: 280, y: 240, w: 220, h: 110,
      data: { label: "Build Utils", description: "CI scripts + packaging" } })
    const editor = addNode({ canvasId: c1, type: "card", x: 500, y: 240, w: 220, h: 110,
      data: { label: "Editor Extensions", description: "Inspector + custom windows" } })
    const hub = addNode({ canvasId: c1, type: "card", x: 280, y: 420, w: 220, h: 110,
      data: { label: "Hub (Unity)", description: "Consumer of all toolkits" } })
    addEdge({ canvasId: c1, source: core, target: ui, label: "uses" })
    addEdge({ canvasId: c1, source: core, target: build, label: "uses" })
    addEdge({ canvasId: c1, source: core, target: editor, label: "uses" })
    addEdge({ canvasId: c1, source: ui, target: hub, animated: true })
    addEdge({ canvasId: c1, source: build, target: hub, animated: true })
    addEdge({ canvasId: c1, source: editor, target: hub })
    linkProjectToCanvas("NorthStar", c1, "contains")
  }

  // ───────── 2. Networking Map ─────────
  const c2 = createCanvas({
    title: "Networking — People Map",
    description: "Per-person status for the Book 15 skills matrix.",
    sortOrder: 1,
  })
  if (c2) {
    const lead = addNode({ canvasId: c2, type: "card", x: 320, y: 60, w: 200, h: 90,
      data: { label: "Lead", description: "Recipient of the compiled matrix" } })
    const people = [
      { name: "Joe",      done: true,  x: 80,  y: 260 },
      { name: "David",    done: true,  x: 260, y: 260 },
      { name: "Muhammad", done: false, x: 440, y: 260 },
      { name: "Waleed",   done: false, x: 620, y: 260 },
    ]
    for (const p of people) {
      const nid = addNode({ canvasId: c2, type: "sticky_note", x: p.x, y: p.y, w: 160, h: 140,
        data: { label: `${p.name}\n${p.done ? "✓ done" : "⌛ follow-up"}`,
                color: p.done ? "#bbf7d0" : "#fed7aa" } })
      addEdge({ canvasId: c2, source: nid, target: lead, label: p.done ? "submitted" : "pending", animated: !p.done })
    }
    linkProjectToCanvas("Matrix of skills", c2, "contains")
    linkProjectToCanvas("Networking", c2, "relates_to")
  }

  // ───────── 3. 2026 Workspace Map (standalone) ─────────
  const c3 = createCanvas({
    title: "2026 Workspace Map",
    description: "All current projects laid out by deadline.",
    sortOrder: 2,
  })
  if (c3) {
    // Section header text nodes
    addNode({ canvasId: c3, type: "text", x: 60, y: 20, w: 180, h: 40,
      data: { label: "📅 May–June" } })
    addNode({ canvasId: c3, type: "text", x: 60, y: 240, w: 180, h: 40,
      data: { label: "📅 July" } })
    addNode({ canvasId: c3, type: "text", x: 60, y: 460, w: 180, h: 40,
      data: { label: "📅 Aug+" } })

    // Layout: 3 rows × 3 columns, grouped by due date band
    const layout = [
      // Row 1: May–June
      { title: "Homework",            x: 280, y: 60 },
      { title: "Matrix of skills",    x: 520, y: 60 },
      { title: "UI things from Meta", x: 760, y: 60 },
      // Row 2: July
      { title: "AGE",                 x: 280, y: 280 },
      { title: "NorthStar",           x: 520, y: 280 },
      { title: "Malik project",       x: 760, y: 280 },
      // Row 3: Aug+
      { title: "Vault system",        x: 280, y: 500 },
      { title: "Speaking app",        x: 520, y: 500 },
      { title: "Networking",          x: 760, y: 500 },
    ]
    const embeds = {}
    for (const it of layout) {
      const proj = findElement(it.title)
      if (!proj) { console.warn("  missing project:", it.title); continue }
      embeds[it.title] = addNode({
        canvasId: c3, type: "element_embed",
        x: it.x, y: it.y, w: 220, h: 120,
        data: { label: it.title },
        elementRefId: proj.id,
      })
    }
    // Cross-project relationships (mirror the elementLinks)
    if (embeds["NorthStar"] && embeds["UI things from Meta"])
      addEdge({ canvasId: c3, source: embeds["NorthStar"], target: embeds["UI things from Meta"], label: "Hub" })
    if (embeds["Networking"] && embeds["Matrix of skills"])
      addEdge({ canvasId: c3, source: embeds["Networking"], target: embeds["Matrix of skills"], label: "Book 15" })
    if (embeds["AGE"] && embeds["Networking"])
      addEdge({ canvasId: c3, source: embeds["AGE"], target: embeds["Networking"], label: "CCB" })
  }

  // ───────── 4. CCB Process Flowchart ─────────
  const c4 = createCanvas({
    title: "CCB Submission — Flowchart",
    description: "Visual version of the CCB submission process.",
    sortOrder: 3,
  })
  if (c4) {
    const steps = [
      "Prepare materials", "Internal review", "Submit to CCB",
      "CCB meeting", "Address feedback", "Final approval",
    ]
    let prev = null
    steps.forEach((s, i) => {
      const x = 80 + (i % 3) * 260
      const y = 60 + Math.floor(i / 3) * 200
      const nid = addNode({ canvasId: c4, type: "card", x, y, w: 220, h: 100,
        data: { label: s, description: i < 2 ? "✓ done" : "" } })
      if (prev) addEdge({ canvasId: c4, source: prev, target: nid, animated: i === 2 })
      prev = nid
    })
    linkProjectToCanvas("AGE", c4, "contains")
    linkProjectToCanvas("Networking", c4, "relates_to")
  }

  console.log("Canvases added.")
})

tx()

// summary
const stats = db.prepare(`
  SELECT e.title, COUNT(DISTINCT cn.id) as nodes, COUNT(DISTINCT ce.id) as edges
  FROM elements e
  LEFT JOIN canvas_nodes cn ON cn.canvas_id = e.id
  LEFT JOIN canvas_edges ce ON ce.canvas_id = e.id
  WHERE e.type='canvas' AND e.is_deleted=0
  GROUP BY e.id ORDER BY e.sort_order
`).all()
console.log("\nFinal canvases:")
for (const s of stats) console.log(`  ${s.title.padEnd(35)} ${s.nodes} nodes, ${s.edges} edges`)

db.close()
