// Seed ~20 sample feed_events for the FeedTicker. Idempotent: skips if
// any feed_events with our seed marker already exist.
//
// Run: node scripts/seed-feed.mjs

import Database from "better-sqlite3"
import { nanoid } from "nanoid"
import path from "node:path"
import process from "node:process"

const DB_PATH =
  process.env.DB_PATH ||
  path.join(process.cwd(), ".next", "standalone", "data", "app.db")

const db = new Database(DB_PATH)
db.pragma("foreign_keys = ON")

const admin = db.prepare("SELECT id FROM users WHERE role='owner' LIMIT 1").get()
if (!admin) {
  console.error("No owner user found in", DB_PATH); process.exit(1)
}
const ADMIN = admin.id

// Idempotency check
const existing = db
  .prepare("SELECT COUNT(*) n FROM feed_events WHERE payload LIKE '%\"seed\":\"v1\"%'")
  .get()
if (existing.n > 0) {
  console.log("Feed already seeded (", existing.n, "events). Nothing to do.")
  db.close()
  process.exit(0)
}

// Pull a few project ids to attach events to
const projects = db
  .prepare("SELECT id, title FROM elements WHERE type='project' AND is_deleted=0 ORDER BY sort_order LIMIT 9")
  .all()

if (projects.length === 0) {
  console.log("No projects to attach events to. Run seed-projects.mjs first.")
  db.close()
  process.exit(0)
}

const ins = db.prepare(`
  INSERT INTO feed_events (id, type, actor_user_id, subject_element_id, subject_task_id,
    parent_element_id, team_id, project_id, title, summary, payload, priority,
    visibility, source_type, created_at)
  VALUES (@id, @type, @actor_user_id, @subject_element_id, NULL, NULL, NULL, @project_id,
    @title, @summary, @payload, @priority, 'workspace', @source_type, @created_at)
`)

// Generate timestamps spread over the last 24h
function isoOffset(hoursAgo) {
  return new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString()
}

const events = []
const projById = Object.fromEntries(projects.map((p) => [p.title, p.id]))

function add(type, projectTitle, title, summary, hoursAgo, priority = "normal", source = "system") {
  const pid = projById[projectTitle]
  if (!pid) return
  events.push({
    id: nanoid(),
    type,
    actor_user_id: ADMIN,
    subject_element_id: pid,
    project_id: pid,
    title,
    summary,
    payload: JSON.stringify({ seed: "v1" }),
    priority,
    source_type: source,
    created_at: isoOffset(hoursAgo),
  })
}

add("task_completed", "NorthStar",          "Audit existing exports — done",    "All 14 export points catalogued.",       0.5,  "normal")
add("task_created",  "NorthStar",           "New task: Stage toolkits in Hub",  "Branch `toolkit-hub-stage` created.",     1.2,  "normal")
add("task_completed","UI things from Meta", "Pull latest Meta samples — done",  "12 layouts pulled, 5 prioritised.",       2.0,  "normal")
add("comment_added", "Matrix of skills",    "Comment on Compile skills matrix", "Waleed: I'll have mine by Friday.",       2.5,  "normal")
add("task_overdue",  "Homework",            "Homework overdue?",                "Resolved — submitted 2026-05-24.",        3.0,  "low")
add("approval_requested","AGE",             "CCB submission ready for review",  "Package v0.3 awaiting internal sign-off.", 4.0, "high",   "manual")
add("task_assigned", "Networking",          "Test team functionality assigned", "Owner assigned.",                         4.5,  "normal")
add("process_step_completed","AGE",         "CCB process: Internal review done","Moving to submission stage.",             5.2,  "normal")
add("reminder_triggered","Matrix of skills","Reminder: send matrix to lead",    "Due tomorrow at 09:00.",                  6.0,  "high")
add("page_updated",  "NorthStar",           "Page: NorthStar Toolkit Brief",    "Open questions section expanded.",        7.5,  "normal")
add("canvas_updated","Networking",          "Canvas: Networking — People Map",  "Waleed sticky updated to pending.",       8.0,  "normal")
add("task_completed","Networking",          "Outline Book 15 chapters — done",  "12 chapter outlines in the doc.",         9.0,  "normal")
add("dependency_cleared","AGE",             "Submit to CCB no longer blocked",  "Prepare CCB submission package finished.",10.5, "normal")
add("attachment_uploaded","Speaking app",   "Test plan attached",               "Test plan v2.1 uploaded.",                11.5, "normal")
add("task_created",  "Malik project",       "New task: Download from TTS net",  "Awaiting network access ticket.",         13.0, "normal")
add("comment_mention","NorthStar",          "Mentioned in NorthStar",           "Mention — ready for your review.",        14.2, "normal")
add("task_completed","Speaking app",        "Build standalone bundle — done",   "v0.4 ready for staging machine.",         16.0, "normal")
add("automation_fired","Networking",        "Automation: weekly Book 15 nudge", "Notified watchers.",                      17.5, "low",    "automation")
add("project_milestone","AGE",              "Milestone: UI mockups locked",     "First-pass complete.",                    20.0, "high")
add("form_submitted","Networking",          "New form submission",              "Skills matrix entry from David.",         22.5, "normal", "form")

const tx = db.transaction(() => { for (const e of events) ins.run(e) })
tx()

console.log("Seeded", events.length, "feed events")
db.close()
