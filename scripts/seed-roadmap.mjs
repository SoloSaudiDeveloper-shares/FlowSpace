// Seed a "FlowSpace Roadmap" project that mirrors flowspace-status.xlsx
// inside the platform itself. Better than a spreadsheet on the desktop —
// you can drag tasks across columns, comment on them, set due dates, get
// Telegram digests, the works.
//
// Idempotent: if a roadmap with the same seed marker exists, the script
// deletes it first so you get a clean re-seed.
//
// Run from project root:   node scripts/seed-roadmap.mjs
// Override target DB:      DB_PATH=path/to/app.db node scripts/seed-roadmap.mjs

import Database from "better-sqlite3"
import { nanoid } from "nanoid"
import path from "node:path"
import process from "node:process"

const DB_PATH =
  process.env.DB_PATH ||
  path.join(process.cwd(), ".next", "standalone", "data", "app.db")

const NOW_ISO = new Date().toISOString()
const SEED_MARKER = "roadmap-v1"

const id = () => nanoid()

const db = new Database(DB_PATH)
db.pragma("foreign_keys = ON")

const admin = db.prepare("SELECT id FROM users WHERE role='owner' LIMIT 1").get()
if (!admin) {
  console.error("No owner user found in", DB_PATH)
  process.exit(1)
}
const ADMIN = admin.id
console.log("Seeding roadmap into", DB_PATH, "as user", ADMIN)

// ─── Idempotency: delete any prior roadmap with this marker ───────────
//
// We tag the project's description with a marker line so we can find +
// purge it on re-runs. CASCADE on elements -> projects/tasks/statuses
// cleans up children.
const existing = db
  .prepare(
    `SELECT id FROM elements
      WHERE created_by = ? AND type = 'project'
        AND description LIKE '%[seed:roadmap-v1]%'`,
  )
  .all(ADMIN)
if (existing.length > 0) {
  console.log(`  removing ${existing.length} prior roadmap project(s)…`)
  const del = db.prepare(`DELETE FROM elements WHERE id = ?`)
  for (const e of existing) del.run(e.id)
}

// ─── prepared statements ──────────────────────────────────────────────
const ins = {
  element: db.prepare(`
    INSERT INTO elements (id, type, title, description, icon, color, is_favorite,
      is_archived, is_deleted, parent_id, sort_order, created_at, updated_at,
      created_by, last_edited_by, version, visibility)
    VALUES (@id, 'project', @title, @description, @icon, @color, 1,
      0, 0, NULL, @sort_order, @created_at, @updated_at,
      @created_by, @created_by, 1, 'workspace')
  `),
  project: db.prepare(`
    INSERT INTO projects (id, status, progress)
    VALUES (?, 'active', ?)
  `),
  status: db.prepare(`
    INSERT INTO task_statuses (id, project_id, name, color, sort_order, is_done_state)
    VALUES (@id, @project_id, @name, @color, @sort_order, @is_done_state)
  `),
  task: db.prepare(`
    INSERT INTO tasks (id, project_id, status_id, title, description, priority,
      start_date, due_date, sort_order, parent_task_id, time_estimate, time_tracked,
      is_completed, completed_at, created_at, updated_at, created_by,
      assignee_id, last_edited_by, version)
    VALUES (@id, @project_id, @status_id, @title, @description, @priority,
      NULL, NULL, @sort_order, NULL, NULL, 0,
      @is_completed, @completed_at, @created_at, @updated_at, @created_by,
      NULL, @created_by, 1)
  `),
}

// ─── Project ──────────────────────────────────────────────────────────
const projectId = id()
ins.element.run({
  id: projectId,
  title: "FlowSpace — Roadmap",
  description: [
    "Live project mirror of the status spreadsheet. Drag cards between",
    "columns to update what's done / waiting / blocked. Priority on each",
    "card carries the rough effort signal:",
    "",
    "  urgent  → bug to fix now",
    "  high    → quick win (≤ 1 day)",
    "  medium  → 1–3 days",
    "  low     → heavy / external / multi-week",
    "",
    "[seed:roadmap-v1]  (this marker is how the seeder finds + cleans up its own data)",
  ].join("\n"),
  icon: "Rocket",
  color: "#a78bfa",
  sort_order: 0,
  created_at: NOW_ISO,
  updated_at: NOW_ISO,
  created_by: ADMIN,
})

// ─── Status columns (kanban) ──────────────────────────────────────────
const STATUSES = [
  { name: "Delivered",     color: "#22c55e", sort_order: 0, is_done_state: 1 },
  { name: "Verify",        color: "#f59e0b", sort_order: 1, is_done_state: 0 },
  { name: "Bug",           color: "#ef4444", sort_order: 2, is_done_state: 0 },
  { name: "Quick win",     color: "#3b82f6", sort_order: 3, is_done_state: 0 },
  { name: "Medium",        color: "#8b5cf6", sort_order: 4, is_done_state: 0 },
  { name: "Heavy/external",color: "#f97316", sort_order: 5, is_done_state: 0 },
]
const statusIds = {}
for (const s of STATUSES) {
  const sid = id()
  ins.status.run({ id: sid, project_id: projectId, ...s })
  statusIds[s.name] = sid
}

// ─── Task helper ──────────────────────────────────────────────────────
let taskCounter = 0
function task(column, title, priority, description) {
  taskCounter++
  const statusId = statusIds[column]
  const isDone = STATUSES.find((s) => s.name === column).is_done_state === 1
  ins.task.run({
    id: id(),
    project_id: projectId,
    status_id: statusId,
    title,
    description: description ?? null,
    priority, // urgent | high | medium | low
    sort_order: taskCounter,
    is_completed: isDone ? 1 : 0,
    completed_at: isDone ? NOW_ISO : null,
    created_at: NOW_ISO,
    updated_at: NOW_ISO,
    created_by: ADMIN,
  })
}

// ─── DELIVERED (compact — these are already done; one card per area) ──
//
// We won't fan out into 55 cards. The point of the Delivered column is
// to show "look how far we've come", not to be a TODO list of past work.
const DELIVERED = [
  ["Auth & security",   "2FA (TOTP) + API tokens + Google OAuth + bcrypt + rate-limit + session config"],
  ["Workspace + multi-user", "Per-user element isolation; admin event log; configurable open/closed signups"],
  ["Sidebar + nav polish",   "Per-section colours; drag-reorder; right-click everywhere; tooltips"],
  ["Top widgets",            "Draggable clock (digital/analog), floating task timer, scrolling feed ticker"],
  ["Element pages",          "Inline title editor, watch/unwatch, send-as-email button, save-as-template"],
  ["Custom fields",          "Text/number/date/select/etc. with one-click example seeder"],
  ["Telegram bot",           "Multi-user, smart capture, /tasks /deadlines /projects /lists /stats /search /digest, inline keyboards, pagination"],
  ["Telegram voice IN",      "Groq Whisper, per-message language, auto-skip"],
  ["Telegram voice OUT",     "TTS replies via user's /audio/speech provider"],
  ["Telegram NL commands",   "Freeform routed through AI provider"],
  ["Bot reply templates",    "Six moments editable from Settings, variable chips"],
  ["Telegram digests",       "Morning + evening cron, per-user time"],
  ["Email — send any element", "Built-in templates per type; variable engine"],
  ["Email IN webhook",       "Resend/Postmark/etc. compatible; per-user routing; approval bell"],
  ["AI provider settings",   "OpenAI / Ollama / Gemini / Anthropic; keys stay in browser"],
  ["AI-import",              "Markdown spec → projects + tasks + lists in one paste"],
  ["PWA",                    "Manifest, icons, service worker, install banner, offline shell"],
  ["i18n scaffolding",       "en/ar + RTL switch; 60 core strings translated (coverage is the bug below)"],
  ["Onboarding tour",        "Seven-step first-run guide; replay from Settings"],
  ["Self-hosted Whisper",    "docker-compose sidecar + docs; voice module routes locally when env set"],
  ["Backups",                "Create / restore / delete from Admin; retention policy"],
  ["Pomodoro widget",        "Focus 25 → break 5 → long break 15 after 4 blocks; logged to DB"],
  ["Habit tracker",          "/habits — daily/weekly, streak counter"],
  ["Web clipper",            "Bookmarklet + Chrome extension stub → POST /api/clip"],
  ["Teams integration study","docs/TEAMS_INTEGRATION.md compares webhook / Power Automate / Bot Framework"],
]
for (const [t, d] of DELIVERED) task("Delivered", t, "low", d)

// ─── BUGS (from your latest message) ──────────────────────────────────
const BUGS = [
  ["Mobile: clock + timer + date eat the screen on phones", "urgent",
   "Topbar widgets designed for desktop. Add `< sm` responsive breakpoints — collapse to icon-only, hide date chip on `< md`. ~2 hours."],
  ["Mobile: Settings checkboxes (clock toggle etc.) don't respond", "urgent",
   "Most clock controls live behind a right-click context menu. Mobile has no right-click. Add long-press handler OR a visible gear button. ~3 hours."],
  ["Home capture mic less accurate than Telegram", "high",
   "Home uses Web Speech API; Telegram uses Groq Whisper. Add engine toggle on home capture matching Settings → Speech. ~1 hour."],
  ["Arabic isn't fully integrated — most UI still English when locale=ar", "high",
   "Scaffold landed (provider + 60 keys + RTL flip). Need t('…') wrapping on every <button>/<label>/<placeholder> in home/todo/project/settings. ~2 days."],
  ["Verify Google Calendar end-to-end (untested)", "high",
   "Check on VM: GOOGLE_CLIENT_ID/SECRET set, calendar.events scope on consent screen, redirect URI matches /api/auth/google-calendar/callback. 30 min if it works first try."],
]
for (const [t, p, d] of BUGS) task("Bug", t, p, d)

// ─── QUICK WINS ───────────────────────────────────────────────────────
const QUICK = [
  ["Telegram /clear — wipe my bot message history", "high",
   "One server action + one bot command. ~1 hour."],
  ["Undo button on Telegram capture success", "high",
   "Inline keyboard '↩️ Undo' → soft-deletes the just-created todo. ~1 hour."],
  ["Mobile-friendly priority + due date controls on todo items", "high",
   "Tap-to-expand row reveals priority + date pickers. Right-click menu already covers desktop. ~3 hours."],
  ["Help → markdown templates viewer with copy button", "high",
   "Render docs/AI_IMPORT_FORMAT.md as code blocks with copy buttons. ~3 hours."],
  ["Add project-markdown templates to Help (sprint / content / OKR)", "high",
   "Bake 3-4 blueprint markdowns into the existing template seeder. ~2 hours."],
  ["Deep-link from Telegram reply → opens FlowSpace page in browser", "high",
   "Compose t.me/<bot> + element URL. Reuse buildHref from send-element-email. ~1 hour."],
  ["Telegram language preference saved once, never asked again", "high",
   "Tighten voice_auto_skip respect for text path. ~1 hour."],
  ["Arabic on login + globe / flag picker (US + KSA)", "high",
   "Reuse LocaleSwitcher; shrink to 2-flag chip. ~1 hour."],
  ["Export todo list → Excel + send by email", "high",
   "openpyxl-style export server action; attach .xlsx to send-element-email-dialog. ~3 hours."],
  ["Search bar in admin settings", "high",
   "Reuse command palette component, scoped to admin sections. ~2 hours."],
  ["Verify reminder → Telegram DM still works for me", "high",
   "Cron telegram:remind already exists; confirm it fires. 15 min."],
  ["Confirm there's no UI cap on todo-list items", "high",
   "No code cap. SQLite handles millions. Look for any rendering choke at 1k+ items. 30 min."],
]
for (const [t, p, d] of QUICK) task("Quick win", t, p, d)

// ─── MEDIUM ───────────────────────────────────────────────────────────
const MEDIUM = [
  ["Image upload + LLM vision analysis", "medium",
   "aiVisionModel setting already exists. Need: upload form → multipart to LLM → store result. ~1 day."],
  ["PDF + CSV upload + parse", "medium",
   "PDF via pdf-parse; CSV via papaparse. Land content as a Page; optional LLM summary. ~1 day."],
  ["Chat with LLM about your platform (voice + text)", "medium",
   "Sidebar drawer chat with read access to elements. Combines speech + AI provider. ~2 days."],
  ["Global search across descriptions, page content, comments, custom fields", "medium",
   "SQLite FTS5 virtual table; index on insert/update; ranked results in command palette. ~2 days."],
  ["Groq voice quota indicator", "medium",
   "Groq has no balance endpoint. Track our own usage (count + seconds today). ~3 hours."],
  ["Canvas configuration menu", "medium",
   "Add grid size, snap, default node type, background colour. ~1 day."],
]
for (const [t, p, d] of MEDIUM) task("Medium", t, p, d)

// ─── HEAVY / EXTERNAL ─────────────────────────────────────────────────
const HEAVY = [
  ["TikTok integration", "low",
   "Public API does login + basic profile only. 'Schedule a post' needs TikTok for Business + Content Posting API approval. Realistic v1: post a TikTok link → FlowSpace pulls metadata. ~1 week."],
  ["Twitter / X integration", "low",
   "Free tier dead. Basic tier ~$100/mo for 50k reads + 3k writes. Code itself is straightforward REST. ~3 days + recurring bill."],
  ["WhatsApp Business integration", "low",
   "Meta verification + dedicated phone number you can't use for personal WA. ~2-week approval + ~1 week code."],
  ["Video → frames → LLM analysis bot", "low",
   "ffmpeg -vf fps=1 → vision LLM per frame → summary. Compute-heavy. Limit to short clips (<1 min). ~2-3 days."],
]
for (const [t, p, d] of HEAVY) task("Heavy/external", t, p, d)

// ─── VERIFY (one-card column for things in flight) ────────────────────
// We already added Calendar to Bugs; nothing else open here yet.

// ─── Recompute project progress ───────────────────────────────────────
const total = db
  .prepare(`SELECT COUNT(*) AS n FROM tasks WHERE project_id = ?`)
  .get(projectId).n
const done = db
  .prepare(
    `SELECT COUNT(*) AS n FROM tasks t INNER JOIN task_statuses s ON s.id = t.status_id
     WHERE t.project_id = ? AND s.is_done_state = 1`,
  )
  .get(projectId).n
const progress = total > 0 ? Math.round((done / total) * 100) : 0

ins.project.run(projectId, progress)

console.log(`\n✓ Seeded "FlowSpace — Roadmap"`)
console.log(`  ${total} cards across ${STATUSES.length} columns`)
console.log(`  ${done} delivered (${progress}% complete)`)
console.log(`  ${BUGS.length} bugs · ${QUICK.length} quick wins · ${MEDIUM.length} medium · ${HEAVY.length} heavy`)
console.log(`\nOpen FlowSpace, find "FlowSpace — Roadmap" in Projects, switch to Board view.`)

db.close()
