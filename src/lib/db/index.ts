import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import * as schema from "./schema"
import path from "path"
import fs from "fs"
import { BOOTSTRAP_SCHEMA_SQL } from "./bootstrap-schema"
import { getDataDir } from "@/lib/utils/data-dir"

const dbDir = getDataDir()
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

const dbPath = path.join(dbDir, "app.db")
const sqlite = new Database(dbPath)

sqlite.pragma("journal_mode = WAL")
sqlite.pragma("foreign_keys = ON")

// Bootstrap the drizzle-defined tables (elements, tasks, projects, ...) so a
// fresh install can boot without `drizzle-kit push`. All statements use
// CREATE TABLE IF NOT EXISTS, so this is a no-op when the schema is already in
// place. Must run BEFORE any FTS trigger creation below — those triggers
// reference these tables.
sqlite.exec(BOOTSTRAP_SCHEMA_SQL)

// ─── Server settings (key-value config store) ──────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS server_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

// ─── Google OAuth + email-verified columns on users ────────────────────
// SQLite doesn't have ALTER TABLE ... ADD COLUMN IF NOT EXISTS. Check first.
try {
  const cols = sqlite.prepare(`PRAGMA table_info(users)`).all() as { name: string }[]
  const colNames = new Set(cols.map((c) => c.name))
  if (!colNames.has("google_id")) {
    sqlite.exec(`ALTER TABLE users ADD COLUMN google_id TEXT`)
    sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL`)
    console.log("[migration] users.google_id column added")
  }
  if (!colNames.has("email_verified")) {
    sqlite.exec(`ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0`)
    // Existing users (predate verification) are grandfathered in as verified.
    sqlite.exec(`UPDATE users SET email_verified = 1 WHERE email_verified = 0`)
    console.log("[migration] users.email_verified column added (existing users grandfathered)")
  }
} catch (err) {
  console.error("[migration] users column adds failed:", err)
}

// ─── Password reset tokens ─────────────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at    TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_pwd_reset_token ON password_reset_tokens(token);`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_pwd_reset_user ON password_reset_tokens(user_id);`)

// ─── Per-user preferences (the giant JSON blob from the settings page) ──
// One row per user. Source of truth so a user signing in on a new device
// gets their theme/sidebar/clock/AI/etc. choices immediately.
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS user_preferences (
    user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    prefs_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

// ─── Telegram bots (one per user) ──────────────────────────────────────
// Each user wires up their OWN bot via BotFather — no sharing. We store
// the token + a webhook_secret embedded in the per-user webhook URL so
// inbound Telegram updates route to the right user.
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS telegram_bots (
    user_id        TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    bot_token      TEXT NOT NULL,
    bot_username   TEXT,
    bot_id         INTEGER,
    chat_id        TEXT,
    webhook_secret TEXT NOT NULL UNIQUE,
    target_list_id TEXT REFERENCES elements(id) ON DELETE SET NULL,
    is_active      INTEGER NOT NULL DEFAULT 1,
    last_seen_at   TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_tg_bots_secret ON telegram_bots(webhook_secret);`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_tg_bots_active ON telegram_bots(is_active) WHERE is_active = 1;`)

// ─── Telegram message history ──────────────────────────────────────────
// Each inbound message + each outbound reply gets logged so the user can
// scroll through what the bot has been doing on their behalf. Pruned to
// the last 500 entries per user on insert to keep this from growing
// unbounded.
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS telegram_messages (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    direction  TEXT NOT NULL,   -- "in" | "out"
    text       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_tg_msgs_user_time ON telegram_messages(user_id, created_at DESC);`)

// ─── Pending imports (Telegram → app approval flow) ────────────────────
// When the bot recognises FlowSpace AI-import markdown in a message
// (starts with "# Project:" / "# Page:" etc), we DON'T create the element
// immediately. Instead we stash it here and surface a notification in
// the app so the user can preview & approve before anything materializes.
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS pending_imports (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source     TEXT NOT NULL,   -- "telegram" today; "email" / "api" later
    payload    TEXT NOT NULL,   -- raw markdown to be parsed
    parsed_summary TEXT,        -- human-friendly one-liner shown in the bell
    status     TEXT NOT NULL DEFAULT 'pending', -- pending | approved | dismissed
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT
  );
`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_pending_user_status ON pending_imports(user_id, status);`)

// ─── Telegram conversation state ────────────────────────────────────────
// Holds the "I'm waiting for the user's next text" cursor between
// messages. One row per user — flat schema, last write wins. We always
// stamp an expires_at (10 min default) so an abandoned flow doesn't
// leave the user stuck in a hidden state.
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS telegram_conversations (
    user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    step       TEXT NOT NULL,
    context    TEXT,
    expires_at TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

// ─── Pending voice messages ────────────────────────────────────────────
// Holds a voice note received from Telegram between the user tapping
// the language button and the destination button. Short-lived — a cron
// job purges anything older than 1 hour so stale rows don't pile up.
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS pending_voices (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_id     TEXT NOT NULL,
    chat_id     TEXT NOT NULL,
    message_id  INTEGER NOT NULL,
    transcript  TEXT,
    language    TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_pending_voices_user ON pending_voices(user_id, created_at);`)

// ─── Reminder bot-fired tracking ────────────────────────────────────────
// `bot_fired_at` so the cron doesn't re-DM the same reminder forever.
// SQLite has no ADD COLUMN IF NOT EXISTS — check pragma first.
try {
  const cols = sqlite.prepare(`PRAGMA table_info(reminders)`).all() as { name: string }[]
  if (!cols.some((c) => c.name === "bot_fired_at")) {
    sqlite.exec(`ALTER TABLE reminders ADD COLUMN bot_fired_at TEXT`)
  }
} catch (err) {
  console.error("[migration] reminders.bot_fired_at:", err)
}

// ─── Canvas configuration (per-canvas) ────────────────────────────────
// Per-canvas display settings: background pattern, grid snap, minimap
// visibility, dot/line gap. Stored on the existing `canvases` table so
// they're loaded alongside viewport state in one query.
try {
  const cols = sqlite.prepare(`PRAGMA table_info(canvases)`).all() as { name: string }[]
  const has = (n: string) => cols.some((c) => c.name === n)
  // 'dots' | 'lines' | 'cross' | 'none'
  if (!has("background_variant")) sqlite.exec(`ALTER TABLE canvases ADD COLUMN background_variant TEXT NOT NULL DEFAULT 'dots'`)
  if (!has("background_gap"))     sqlite.exec(`ALTER TABLE canvases ADD COLUMN background_gap INTEGER NOT NULL DEFAULT 20`)
  if (!has("snap_to_grid"))       sqlite.exec(`ALTER TABLE canvases ADD COLUMN snap_to_grid INTEGER NOT NULL DEFAULT 0`)
  if (!has("show_minimap"))       sqlite.exec(`ALTER TABLE canvases ADD COLUMN show_minimap INTEGER NOT NULL DEFAULT 1`)
} catch (err) {
  console.error("[migration] canvases config:", err)
}

// ─── Telegram voice usage stats (per-user, per-day) ───────────────────
// Groq doesn't expose a balance endpoint, so the next-best signal is
// "what we've spent ourselves today". One row per (user, day); the
// count + duration columns get incremented whenever a transcription
// completes successfully.
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS voice_usage_daily (
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date        TEXT NOT NULL,  -- yyyy-mm-dd in UTC
    count       INTEGER NOT NULL DEFAULT 0,
    seconds     INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, date)
  );
`)

// ─── Todo items: priority (per-item) ───────────────────────────────────
// Mirrors the tasks table — urgent / high / medium / low / null. Lets
// the user mark a quick todo as urgent without promoting it to a full
// project task.
try {
  const cols = sqlite.prepare(`PRAGMA table_info(todo_items)`).all() as { name: string }[]
  if (!cols.some((c) => c.name === "priority")) {
    sqlite.exec(`ALTER TABLE todo_items ADD COLUMN priority TEXT`)
  }
} catch (err) {
  console.error("[migration] todo_items.priority:", err)
}

// ─── Two-factor authentication (per-user) ──────────────────────────────
// `totp_secret`: base32 secret stored once enrolled; null = 2FA off
// `totp_enabled`: 1 once the user has verified at least one code (so
//                 we don't lock people out of accounts they haven't
//                 finished enrolling yet)
// `totp_recovery_hashes`: JSON array of SHA-256 hashes; each one-time
//                         use. Re-issued whenever the user resets 2FA.
try {
  const cols = sqlite.prepare(`PRAGMA table_info(users)`).all() as { name: string }[]
  const has = (n: string) => cols.some((c) => c.name === n)
  if (!has("totp_secret"))           sqlite.exec(`ALTER TABLE users ADD COLUMN totp_secret TEXT`)
  if (!has("totp_enabled"))          sqlite.exec(`ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0`)
  if (!has("totp_recovery_hashes"))  sqlite.exec(`ALTER TABLE users ADD COLUMN totp_recovery_hashes TEXT`)
} catch (err) {
  console.error("[migration] users.totp_*:", err)
}

// ─── Personal API tokens (per-user) ────────────────────────────────────
// Long-lived bearer tokens for scripts / integrations that don't want to
// log in interactively. Each token: SHA-256 hashed, scope label, last
// used timestamp. Users can revoke any token from Settings → Account.
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS api_tokens (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    token_hash  TEXT NOT NULL UNIQUE,
    last_used_at TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at  TEXT
  );
`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_id);`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_api_tokens_hash ON api_tokens(token_hash);`)

// ─── Inbound emails (for Email IN) ─────────────────────────────────────
// One row per received email. Default state is `pending` — the user
// approves them via the bell badge, just like Telegram-import flow.
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS inbound_emails (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_addr   TEXT NOT NULL,
    from_name   TEXT,
    subject     TEXT NOT NULL DEFAULT '',
    body_text   TEXT NOT NULL DEFAULT '',
    body_html   TEXT,
    status      TEXT NOT NULL DEFAULT 'pending',  -- pending | imported | dismissed
    target_list_id TEXT,                          -- where it went after approval
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    handled_at  TEXT
  );
`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_inbound_emails_user ON inbound_emails(user_id, status);`)

// ─── Habits (per-user) ─────────────────────────────────────────────────
// A habit is "do X every day/week"; entries record check-ins. Streaks
// are computed from entries.
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS habits (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    icon        TEXT,
    color       TEXT,
    cadence     TEXT NOT NULL DEFAULT 'daily',  -- daily | weekly | custom
    is_archived INTEGER NOT NULL DEFAULT 0,
    sort_order  REAL NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS habit_entries (
    id          TEXT PRIMARY KEY,
    habit_id    TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    date        TEXT NOT NULL,  -- ISO yyyy-mm-dd
    note        TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (habit_id, date)
  );
`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_habits_user ON habits(user_id, is_archived);`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_habit_entries_date ON habit_entries(habit_id, date);`)

// ─── Pomodoro sessions (per-user) ──────────────────────────────────────
// Logging for the focus timer. Used for the home dashboard's "today's
// focus" tile and for weekly stats.
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS pomodoro_sessions (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id     TEXT,
    started_at  TEXT NOT NULL,
    ended_at    TEXT,
    duration_sec INTEGER NOT NULL DEFAULT 0,
    kind        TEXT NOT NULL DEFAULT 'focus',  -- focus | short_break | long_break
    completed   INTEGER NOT NULL DEFAULT 0
  );
`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_pomodoro_user ON pomodoro_sessions(user_id, started_at);`)

// ─── Google Calendar sync state (per-user) ─────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS google_calendar_sync (
    user_id          TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    refresh_token    TEXT NOT NULL,
    access_token     TEXT,
    access_expires_at TEXT,
    calendar_id      TEXT NOT NULL DEFAULT 'primary',
    last_sync_at     TEXT,
    enabled          INTEGER NOT NULL DEFAULT 1
  );
`)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS google_calendar_events (
    task_id     TEXT PRIMARY KEY,
    event_id    TEXT NOT NULL,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)
// Migration: add user_id so sync can own events across ALL sources (tasks,
// to-dos, reminders, project deadlines) and clean up orphans per-user. The
// task_id column doubles as a generic "source id". Idempotent.
{
  const gcalCols = sqlite
    .prepare(`PRAGMA table_info(google_calendar_events)`)
    .all() as { name: string }[]
  if (!gcalCols.some((c) => c.name === "user_id")) {
    sqlite.exec(`ALTER TABLE google_calendar_events ADD COLUMN user_id TEXT`)
    // Backfill existing task-based rows from task → project → owner.
    sqlite.exec(`
      UPDATE google_calendar_events
         SET user_id = (
           SELECT e.created_by FROM tasks t
             JOIN elements e ON e.id = t.project_id
            WHERE t.id = google_calendar_events.task_id
         )
       WHERE user_id IS NULL
    `)
  }
}

// Migration: persistent (server-side) task timer — when set, the task's timer
// is running and accrues until stopped/completed. Idempotent.
// Also: task recurrence rule — completing a recurring task spawns the next one.
{
  const taskCols = sqlite.prepare(`PRAGMA table_info(tasks)`).all() as { name: string }[]
  if (taskCols.length && !taskCols.some((c) => c.name === "time_tracking_started_at")) {
    sqlite.exec(`ALTER TABLE tasks ADD COLUMN time_tracking_started_at TEXT`)
  }
  if (taskCols.length && !taskCols.some((c) => c.name === "repeat_rule")) {
    sqlite.exec(`ALTER TABLE tasks ADD COLUMN repeat_rule TEXT`)
  }
}

// ─── Full-text search (FTS5) ───────────────────────────────────────────
//
// Single virtual table indexed across elements + tasks + todo_items.
// Each row carries:
//   - entity_kind  ('element' | 'task' | 'todo')
//   - entity_id    the actual row id in the source table
//   - type_label   user-friendly type (project/page/canvas/todo_list/
//                  reminder/process/task/todo) — used to filter results
//   - title        searchable
//   - body         searchable (description / notes / page content text)
//   - owner_user_id  for scoping; UNINDEXED so we don't search it
//
// Triggers keep the index in sync on every write. For pages we strip
// the BlockNote JSON down to plain text so search hits real prose,
// not JSON keys. Safe to rebuild on startup if FTS5 ever drifts:
//   DELETE FROM search_index; INSERT INTO search_index SELECT … (below)
sqlite.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
    entity_kind UNINDEXED,
    entity_id   UNINDEXED,
    type_label  UNINDEXED,
    owner_user_id UNINDEXED,
    title,
    body,
    tokenize = 'porter unicode61 remove_diacritics 2'
  );
`)

// Populate from scratch the first time the table is empty. Strip
// BlockNote JSON to plain text via a regex pass (good enough for
// search — extracts "text" string values).
try {
  const countRow = sqlite
    .prepare(`SELECT COUNT(*) AS n FROM search_index`)
    .get() as { n: number }
  if (countRow.n === 0) {
    const ins = sqlite.prepare(
      `INSERT INTO search_index
         (entity_kind, entity_id, type_label, owner_user_id, title, body)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    // Elements (project, page, canvas, todo_list, reminder, process)
    const elements = sqlite
      .prepare(
        `SELECT id, type, title, description, created_by FROM elements
          WHERE is_deleted = 0`,
      )
      .all() as { id: string; type: string; title: string; description: string | null; created_by: string | null }[]
    for (const e of elements) {
      if (!e.created_by) continue
      let body = e.description ?? ""
      if (e.type === "page") {
        const pageRow = sqlite
          .prepare(`SELECT content FROM pages WHERE id = ?`)
          .get(e.id) as { content: string | null } | undefined
        if (pageRow?.content) body += " " + extractTextFromBlocknoteJson(pageRow.content)
      }
      ins.run("element", e.id, e.type, e.created_by, e.title, body)
    }
    // Tasks
    const tasks = sqlite
      .prepare(
        `SELECT t.id, t.title, t.description, e.created_by
           FROM tasks t
           INNER JOIN elements e ON e.id = t.project_id
          WHERE e.is_deleted = 0`,
      )
      .all() as { id: string; title: string; description: string | null; created_by: string | null }[]
    for (const t of tasks) {
      if (!t.created_by) continue
      ins.run("task", t.id, "task", t.created_by, t.title, t.description ?? "")
    }
    // Todo items
    const todos = sqlite
      .prepare(
        `SELECT ti.id, ti.title, ti.notes, e.created_by
           FROM todo_items ti
           INNER JOIN elements e ON e.id = ti.list_id
          WHERE e.is_deleted = 0`,
      )
      .all() as { id: string; title: string; notes: string | null; created_by: string | null }[]
    for (const t of todos) {
      if (!t.created_by) continue
      ins.run("todo", t.id, "todo", t.created_by, t.title, t.notes ?? "")
    }
    console.log(`[search] indexed ${elements.length + tasks.length + todos.length} rows`)
  }
} catch (err) {
  console.error("[search] initial population:", err)
}

// Triggers — keep search_index in sync on every write.
sqlite.exec(`
  CREATE TRIGGER IF NOT EXISTS search_index_elements_ai
    AFTER INSERT ON elements WHEN NEW.is_deleted = 0
  BEGIN
    INSERT INTO search_index (entity_kind, entity_id, type_label, owner_user_id, title, body)
    VALUES ('element', NEW.id, NEW.type, NEW.created_by, NEW.title, COALESCE(NEW.description, ''));
  END;
`)
sqlite.exec(`
  CREATE TRIGGER IF NOT EXISTS search_index_elements_au
    AFTER UPDATE ON elements
  BEGIN
    DELETE FROM search_index WHERE entity_kind = 'element' AND entity_id = OLD.id;
    INSERT INTO search_index (entity_kind, entity_id, type_label, owner_user_id, title, body)
    SELECT 'element', NEW.id, NEW.type, NEW.created_by, NEW.title, COALESCE(NEW.description, '')
    WHERE NEW.is_deleted = 0;
  END;
`)
sqlite.exec(`
  CREATE TRIGGER IF NOT EXISTS search_index_elements_ad
    AFTER DELETE ON elements
  BEGIN
    DELETE FROM search_index WHERE entity_kind = 'element' AND entity_id = OLD.id;
  END;
`)

sqlite.exec(`
  CREATE TRIGGER IF NOT EXISTS search_index_tasks_ai
    AFTER INSERT ON tasks
  BEGIN
    INSERT INTO search_index (entity_kind, entity_id, type_label, owner_user_id, title, body)
    SELECT 'task', NEW.id, 'task', e.created_by, NEW.title, COALESCE(NEW.description, '')
      FROM elements e WHERE e.id = NEW.project_id;
  END;
`)
sqlite.exec(`
  CREATE TRIGGER IF NOT EXISTS search_index_tasks_au
    AFTER UPDATE ON tasks
  BEGIN
    DELETE FROM search_index WHERE entity_kind = 'task' AND entity_id = OLD.id;
    INSERT INTO search_index (entity_kind, entity_id, type_label, owner_user_id, title, body)
    SELECT 'task', NEW.id, 'task', e.created_by, NEW.title, COALESCE(NEW.description, '')
      FROM elements e WHERE e.id = NEW.project_id;
  END;
`)
sqlite.exec(`
  CREATE TRIGGER IF NOT EXISTS search_index_tasks_ad
    AFTER DELETE ON tasks
  BEGIN
    DELETE FROM search_index WHERE entity_kind = 'task' AND entity_id = OLD.id;
  END;
`)

sqlite.exec(`
  CREATE TRIGGER IF NOT EXISTS search_index_todos_ai
    AFTER INSERT ON todo_items
  BEGIN
    INSERT INTO search_index (entity_kind, entity_id, type_label, owner_user_id, title, body)
    SELECT 'todo', NEW.id, 'todo', e.created_by, NEW.title, COALESCE(NEW.notes, '')
      FROM elements e WHERE e.id = NEW.list_id;
  END;
`)
sqlite.exec(`
  CREATE TRIGGER IF NOT EXISTS search_index_todos_au
    AFTER UPDATE ON todo_items
  BEGIN
    DELETE FROM search_index WHERE entity_kind = 'todo' AND entity_id = OLD.id;
    INSERT INTO search_index (entity_kind, entity_id, type_label, owner_user_id, title, body)
    SELECT 'todo', NEW.id, 'todo', e.created_by, NEW.title, COALESCE(NEW.notes, '')
      FROM elements e WHERE e.id = NEW.list_id;
  END;
`)
sqlite.exec(`
  CREATE TRIGGER IF NOT EXISTS search_index_todos_ad
    AFTER DELETE ON todo_items
  BEGIN
    DELETE FROM search_index WHERE entity_kind = 'todo' AND entity_id = OLD.id;
  END;
`)

/**
 * Walks a BlockNote JSON document and pulls out every `text` string
 * value into a single space-joined plain-text bag. Cheap regex pass;
 * not perfect (it'd find a stray `"text":"…"` inside a styles object)
 * but FTS5 doesn't care about the noise and the result is searchable.
 */
function extractTextFromBlocknoteJson(json: string): string {
  if (!json) return ""
  // Walk JSON.parse'd doc tree if possible (cleaner); fall back to a
  // regex on parse failure (corrupted or partial content).
  try {
    const root = JSON.parse(json) as unknown
    const out: string[] = []
    const stack: unknown[] = [root]
    while (stack.length) {
      const node = stack.pop()
      if (!node) continue
      if (typeof node === "string") continue
      if (Array.isArray(node)) {
        for (const c of node) stack.push(c)
      } else if (typeof node === "object") {
        const obj = node as Record<string, unknown>
        if (typeof obj.text === "string") out.push(obj.text)
        for (const v of Object.values(obj)) {
          if (v && typeof v === "object") stack.push(v)
        }
      }
    }
    return out.join(" ").slice(0, 200_000)
  } catch {
    const matches = json.match(/"text"\s*:\s*"([^"\\]|\\.)*"/g)
    if (!matches) return ""
    return matches
      .map((m) => m.replace(/^"text"\s*:\s*"/, "").replace(/"$/, ""))
      .join(" ")
      .slice(0, 200_000)
  }
}

// ─── Telegram digest preferences (per-bot) ─────────────────────────────
try {
  const cols = sqlite.prepare(`PRAGMA table_info(telegram_bots)`).all() as { name: string }[]
  const has = (n: string) => cols.some((c) => c.name === n)
  if (!has("digest_enabled"))     sqlite.exec(`ALTER TABLE telegram_bots ADD COLUMN digest_enabled INTEGER NOT NULL DEFAULT 0`)
  if (!has("digest_time"))        sqlite.exec(`ALTER TABLE telegram_bots ADD COLUMN digest_time TEXT NOT NULL DEFAULT '08:00'`)
  if (!has("digest_last_sent"))   sqlite.exec(`ALTER TABLE telegram_bots ADD COLUMN digest_last_sent TEXT`)
  // Voice transcription language hint passed to Groq Whisper. `auto` lets
  // Whisper guess (which can mis-detect short utterances). Default `en` so
  // English speakers don't get surprise Arabic/Spanish/etc back. Switch via
  // /voice <lang> at any time.
  if (!has("voice_language"))     sqlite.exec(`ALTER TABLE telegram_bots ADD COLUMN voice_language TEXT NOT NULL DEFAULT 'en'`)
  // When true, voice messages bypass the language + destination pickers
  // and route straight to the user's defaults (voice_language + target_list_id).
  // Users can toggle this with `/voice skip on|off` or in Settings → Telegram.
  if (!has("voice_auto_skip"))    sqlite.exec(`ALTER TABLE telegram_bots ADD COLUMN voice_auto_skip INTEGER NOT NULL DEFAULT 0`)
  // Voice transcription key source: 0 = use this user's own Groq key
  // (from their browser pref → user_preferences.speechGroqApiKey), 1 =
  // use the server-wide shared TELEGRAM_VOICE_GROQ_KEY env var. Default 0
  // so the workspace quota doesn't get drained by a single power user.
  if (!has("voice_key_use_shared")) sqlite.exec(`ALTER TABLE telegram_bots ADD COLUMN voice_key_use_shared INTEGER NOT NULL DEFAULT 0`)
  // End-of-day digest — mirror of morning digest. Two separate
  // settings: enabled flag, time-of-day (HH:MM), last_sent tracking.
  // Default off — opt-in via /digest evening on or Settings UI.
  if (!has("digest_evening_enabled"))   sqlite.exec(`ALTER TABLE telegram_bots ADD COLUMN digest_evening_enabled INTEGER NOT NULL DEFAULT 0`)
  if (!has("digest_evening_time"))      sqlite.exec(`ALTER TABLE telegram_bots ADD COLUMN digest_evening_time TEXT NOT NULL DEFAULT '19:00'`)
  if (!has("digest_evening_last_sent")) sqlite.exec(`ALTER TABLE telegram_bots ADD COLUMN digest_evening_last_sent TEXT`)
  // Natural-language commands: when true, freeform text that doesn't
  // match a slash command, smart-capture, or AI-import format gets
  // routed through the user's AI provider for intent parsing.
  if (!has("nl_commands_enabled")) sqlite.exec(`ALTER TABLE telegram_bots ADD COLUMN nl_commands_enabled INTEGER NOT NULL DEFAULT 0`)
  // Voice OUT — when true the bot also sends a voice-note version of
  // its text reply (synthesised through the user's AI provider's
  // /audio/speech endpoint, e.g. OpenAI tts-1). Off by default.
  if (!has("voice_out_enabled")) sqlite.exec(`ALTER TABLE telegram_bots ADD COLUMN voice_out_enabled INTEGER NOT NULL DEFAULT 0`)
} catch (err) {
  console.error("[migration] telegram_bots digest columns:", err)
}

// ─── Start the background cron ─────────────────────────────────────────
// Imported lazily so bootstrap-only scripts (e.g., bootstrap-admin.mjs)
// don't accidentally start a cron timer. Anything that uses the DB at
// runtime hits this file, kicking off the singleton.
import("@/lib/cron/index").then((mod) => {
  import("@/lib/cron/jobs").then(() => mod.startCron())
}).catch((err) => console.error("[cron] startup failed:", err))

// ─── Email verification tokens ─────────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email      TEXT NOT NULL,
    token      TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at    TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_email_verify_token ON email_verification_tokens(token);`)

// ─── One-time ownership backfill ───────────────────────────────────────
// Pre-isolation rows have NULL owner columns. They were created before
// the per-user model existed, which means they all belong to whoever
// the sole user was at the time — i.e. the oldest user (the original
// owner). Assigning orphans to the OLDEST active user is safe: new
// users (signed up after the isolation roll-out) have later created_at
// and cannot have produced these rows. Idempotent.
try {
  const oldest = sqlite
    .prepare(`SELECT id FROM users WHERE is_active = 1 ORDER BY created_at ASC LIMIT 1`)
    .get() as { id: string } | undefined

  if (oldest) {
    const backfills: { table: string; column: string }[] = [
      { table: "elements",       column: "created_by" },
      { table: "notifications",  column: "user_id"   },
      { table: "forms",          column: "created_by" },
      { table: "templates",      column: "created_by" },
      { table: "feed_events",    column: "actor_user_id" },
    ]

    for (const { table, column } of backfills) {
      const orphanCount = (sqlite
        .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column} IS NULL`)
        .get() as { n: number }).n
      if (orphanCount === 0) continue
      sqlite
        .prepare(`UPDATE ${table} SET ${column} = ? WHERE ${column} IS NULL`)
        .run(oldest.id)
      console.log(`[migration] ${table}.${column}: assigned ${orphanCount} orphans to ${oldest.id} (oldest user)`)
    }
  }
} catch (err) {
  console.error("[migration] backfill failed:", err)
}

// ─── Showcase templates seed ───────────────────────────────────────────
// Idempotent per user — every active user gets their own copies of the
// showcase templates. Runs on every startup but only inserts genuinely
// missing rows. Backfills any user that signed up before this seed
// existed (e.g. early Google sign-ups), then runs harmlessly thereafter.
try {
  const allUsers = sqlite
    .prepare(`SELECT id FROM users WHERE is_active = 1`)
    .all() as { id: string }[]
  if (allUsers.length > 0) {
    const { seedShowcaseTemplates } = await import("./seed-showcase-templates")
    for (const u of allUsers) {
      const count = seedShowcaseTemplates(sqlite, u.id)
      if (count > 0) console.log(`[seed] showcase templates: ${count} inserted for ${u.id}`)
    }
  }
} catch (err) {
  console.error("[seed] showcase templates failed:", err)
}

// ─── FTS5 Full-Text Search ─────────────────────────────────────────────
// Create virtual table for full-text search on elements
sqlite.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS elements_fts USING fts5(
    id UNINDEXED,
    title,
    description,
    type UNINDEXED,
    content='elements',
    content_rowid='rowid'
  );
`)

// Triggers to keep FTS index in sync with elements table
sqlite.exec(`
  CREATE TRIGGER IF NOT EXISTS elements_fts_insert AFTER INSERT ON elements BEGIN
    INSERT INTO elements_fts(rowid, id, title, description, type)
    VALUES (NEW.rowid, NEW.id, NEW.title, NEW.description, NEW.type);
  END;
`)
sqlite.exec(`
  CREATE TRIGGER IF NOT EXISTS elements_fts_update AFTER UPDATE ON elements BEGIN
    INSERT INTO elements_fts(elements_fts, rowid, id, title, description, type)
    VALUES('delete', OLD.rowid, OLD.id, OLD.title, OLD.description, OLD.type);
    INSERT INTO elements_fts(rowid, id, title, description, type)
    VALUES (NEW.rowid, NEW.id, NEW.title, NEW.description, NEW.type);
  END;
`)
sqlite.exec(`
  CREATE TRIGGER IF NOT EXISTS elements_fts_delete AFTER DELETE ON elements BEGIN
    INSERT INTO elements_fts(elements_fts, rowid, id, title, description, type)
    VALUES('delete', OLD.rowid, OLD.id, OLD.title, OLD.description, OLD.type);
  END;
`)

// FTS5 for tasks
sqlite.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
    id UNINDEXED,
    title,
    description,
    project_id UNINDEXED,
    content='tasks',
    content_rowid='rowid'
  );
`)
sqlite.exec(`
  CREATE TRIGGER IF NOT EXISTS tasks_fts_insert AFTER INSERT ON tasks BEGIN
    INSERT INTO tasks_fts(rowid, id, title, description, project_id)
    VALUES (NEW.rowid, NEW.id, NEW.title, NEW.description, NEW.project_id);
  END;
`)
sqlite.exec(`
  CREATE TRIGGER IF NOT EXISTS tasks_fts_update AFTER UPDATE ON tasks BEGIN
    INSERT INTO tasks_fts(tasks_fts, rowid, id, title, description, project_id)
    VALUES('delete', OLD.rowid, OLD.id, OLD.title, OLD.description, OLD.project_id);
    INSERT INTO tasks_fts(rowid, id, title, description, project_id)
    VALUES (NEW.rowid, NEW.id, NEW.title, NEW.description, NEW.project_id);
  END;
`)
sqlite.exec(`
  CREATE TRIGGER IF NOT EXISTS tasks_fts_delete AFTER DELETE ON tasks BEGIN
    INSERT INTO tasks_fts(tasks_fts, rowid, id, title, description, project_id)
    VALUES('delete', OLD.rowid, OLD.id, OLD.title, OLD.description, OLD.project_id);
  END;
`)

// FTS5 for task comments
sqlite.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS comments_fts USING fts5(
    id UNINDEXED,
    content,
    task_id UNINDEXED,
    content='task_comments',
    content_rowid='rowid'
  );
`)
sqlite.exec(`
  CREATE TRIGGER IF NOT EXISTS comments_fts_insert AFTER INSERT ON task_comments BEGIN
    INSERT INTO comments_fts(rowid, id, content, task_id)
    VALUES (NEW.rowid, NEW.id, NEW.content, NEW.task_id);
  END;
`)
sqlite.exec(`
  CREATE TRIGGER IF NOT EXISTS comments_fts_update AFTER UPDATE ON task_comments BEGIN
    INSERT INTO comments_fts(comments_fts, rowid, id, content, task_id)
    VALUES('delete', OLD.rowid, OLD.id, OLD.content, OLD.task_id);
    INSERT INTO comments_fts(rowid, id, content, task_id)
    VALUES (NEW.rowid, NEW.id, NEW.content, NEW.task_id);
  END;
`)
sqlite.exec(`
  CREATE TRIGGER IF NOT EXISTS comments_fts_delete AFTER DELETE ON task_comments BEGIN
    INSERT INTO comments_fts(comments_fts, rowid, id, content, task_id)
    VALUES('delete', OLD.rowid, OLD.id, OLD.content, OLD.task_id);
  END;
`)

// FTS5 for feed events
sqlite.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS feed_fts USING fts5(
    id UNINDEXED,
    title,
    summary,
    type UNINDEXED,
    content='feed_events',
    content_rowid='rowid'
  );
`)
sqlite.exec(`
  CREATE TRIGGER IF NOT EXISTS feed_fts_insert AFTER INSERT ON feed_events BEGIN
    INSERT INTO feed_fts(rowid, id, title, summary, type)
    VALUES (NEW.rowid, NEW.id, NEW.title, NEW.summary, NEW.type);
  END;
`)
sqlite.exec(`
  CREATE TRIGGER IF NOT EXISTS feed_fts_update AFTER UPDATE ON feed_events BEGIN
    INSERT INTO feed_fts(feed_fts, rowid, id, title, summary, type)
    VALUES('delete', OLD.rowid, OLD.id, OLD.title, OLD.summary, OLD.type);
    INSERT INTO feed_fts(rowid, id, title, summary, type)
    VALUES (NEW.rowid, NEW.id, NEW.title, NEW.summary, NEW.type);
  END;
`)
sqlite.exec(`
  CREATE TRIGGER IF NOT EXISTS feed_fts_delete AFTER DELETE ON feed_events BEGIN
    INSERT INTO feed_fts(feed_fts, rowid, id, title, summary, type)
    VALUES('delete', OLD.rowid, OLD.id, OLD.title, OLD.summary, OLD.type);
  END;
`)

// Rebuild FTS indexes from existing data (idempotent)
try {
  sqlite.exec(`INSERT INTO elements_fts(elements_fts) VALUES('rebuild');`)
  sqlite.exec(`INSERT INTO tasks_fts(tasks_fts) VALUES('rebuild');`)
  sqlite.exec(`INSERT INTO comments_fts(comments_fts) VALUES('rebuild');`)
  sqlite.exec(`INSERT INTO feed_fts(feed_fts) VALUES('rebuild');`)
} catch {
  // Ignore if tables are empty or already synced
}

// ─── Users & Identity ─────────────────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    email TEXT,
    password_hash TEXT NOT NULL,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'editor' CHECK(role IN ('owner','admin','editor','commenter','viewer')),
    is_active INTEGER NOT NULL DEFAULT 1,
    last_active_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    icon TEXT,
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('lead','member')),
    joined_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

// ─── Permissions ──────────────────────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS element_permissions (
    id TEXT PRIMARY KEY,
    element_id TEXT NOT NULL REFERENCES elements(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('editor','commenter','viewer')),
    can_view INTEGER NOT NULL DEFAULT 1,
    can_edit INTEGER NOT NULL DEFAULT 0,
    can_comment INTEGER NOT NULL DEFAULT 0,
    can_delete INTEGER NOT NULL DEFAULT 0,
    can_manage INTEGER NOT NULL DEFAULT 0,
    inherited_from TEXT REFERENCES elements(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

// ─── Assignments & Collaboration ──────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS task_assignments (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'assignee' CHECK(role IN ('assignee','watcher','contributor')),
    assigned_by TEXT REFERENCES users(id),
    assigned_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS watchers (
    id TEXT PRIMARY KEY,
    element_id TEXT NOT NULL REFERENCES elements(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS mentions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mentioned_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    element_id TEXT REFERENCES elements(id) ON DELETE CASCADE,
    task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
    comment_id TEXT REFERENCES task_comments(id) ON DELETE CASCADE,
    context TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

// ─── Edit Sessions & Real-Time ────────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS edit_sessions (
    id TEXT PRIMARY KEY,
    element_id TEXT NOT NULL REFERENCES elements(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_activity TEXT NOT NULL DEFAULT (datetime('now')),
    is_active INTEGER NOT NULL DEFAULT 1
  );
`)

// ─── Approvals ────────────────────────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY,
    element_id TEXT REFERENCES elements(id) ON DELETE CASCADE,
    task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
    requested_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_to TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','changes_requested')),
    comment TEXT,
    resolved_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

// ─── Backups ──────────────────────────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS backups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    type TEXT NOT NULL DEFAULT 'full' CHECK(type IN ('full','selective','scheduled')),
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','completed','failed')),
    created_by TEXT REFERENCES users(id),
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    metadata TEXT
  );
`)

// ─── Server Events ───────────────────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS server_events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('server_start','server_stop','backup_completed','backup_failed','user_login','user_logout','user_created','permission_changed','error','warning','info')),
    title TEXT NOT NULL,
    message TEXT,
    user_id TEXT REFERENCES users(id),
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

// ─── Add new columns to existing tables (safe ALTER IF NOT EXISTS) ──
// Add version, created_by, last_edited_by, visibility to elements
try { sqlite.exec(`ALTER TABLE elements ADD COLUMN created_by TEXT;`) } catch {}
try { sqlite.exec(`ALTER TABLE elements ADD COLUMN last_edited_by TEXT;`) } catch {}
try { sqlite.exec(`ALTER TABLE elements ADD COLUMN version INTEGER NOT NULL DEFAULT 1;`) } catch {}
try { sqlite.exec(`ALTER TABLE elements ADD COLUMN visibility TEXT NOT NULL DEFAULT 'workspace';`) } catch {}

// Add version, created_by, assignee_id, last_edited_by to tasks
try { sqlite.exec(`ALTER TABLE tasks ADD COLUMN created_by TEXT;`) } catch {}
try { sqlite.exec(`ALTER TABLE tasks ADD COLUMN assignee_id TEXT;`) } catch {}
try { sqlite.exec(`ALTER TABLE tasks ADD COLUMN last_edited_by TEXT;`) } catch {}
try { sqlite.exec(`ALTER TABLE tasks ADD COLUMN version INTEGER NOT NULL DEFAULT 1;`) } catch {}

// Add author_id to task_comments
try { sqlite.exec(`ALTER TABLE task_comments ADD COLUMN author_id TEXT;`) } catch {}

// Add user_id, actor_id to notifications
try { sqlite.exec(`ALTER TABLE notifications ADD COLUMN user_id TEXT;`) } catch {}
try { sqlite.exec(`ALTER TABLE notifications ADD COLUMN actor_id TEXT;`) } catch {}

// Add user_id to activity_log
try { sqlite.exec(`ALTER TABLE activity_log ADD COLUMN user_id TEXT;`) } catch {}

// Expand notification type constraint (drop/recreate not needed—SQLite CHECK is per-row, new values work if column accepts TEXT)

// ─── Notifications table ───────────────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('reminder_due','task_overdue','task_due_soon','project_milestone','system','mention','assignment','approval_request','comment_reply','permission_change')),
    title TEXT NOT NULL,
    message TEXT,
    element_id TEXT REFERENCES elements(id) ON DELETE CASCADE,
    user_id TEXT,
    actor_id TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

// ─── View Preferences table ───────────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS view_preferences (
    id TEXT PRIMARY KEY,
    element_id TEXT NOT NULL REFERENCES elements(id) ON DELETE CASCADE,
    view_type TEXT NOT NULL CHECK(view_type IN ('board','list','table')),
    hidden_fields TEXT,
    sort_field TEXT,
    sort_direction TEXT CHECK(sort_direction IN ('asc','desc')),
    group_by TEXT,
    filter_json TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

// ─── Templates ────────────────────────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK(type IN ('project','task','checklist','page','canvas','process','dashboard','form')),
    icon TEXT,
    color TEXT,
    content TEXT,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    is_published INTEGER NOT NULL DEFAULT 1,
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_by TEXT REFERENCES users(id),
    last_used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS template_items (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK(item_type IN ('task','subtask','checklist','checklist_item','label','status','step','field')),
    title TEXT NOT NULL,
    description TEXT,
    config TEXT,
    sort_order REAL NOT NULL DEFAULT 0,
    parent_item_id TEXT
  );
`)

// ─── Custom Fields ────────────────────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS custom_field_definitions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    field_type TEXT NOT NULL CHECK(field_type IN ('text','long_text','number','currency','date','date_range','checkbox','select','multi_select','user','team','url','email','phone','rating','formula','relation')),
    icon TEXT,
    color TEXT,
    config TEXT,
    is_required INTEGER NOT NULL DEFAULT 0,
    sort_order REAL NOT NULL DEFAULT 0,
    group_name TEXT,
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS custom_field_options (
    id TEXT PRIMARY KEY,
    field_id TEXT NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    color TEXT,
    sort_order REAL NOT NULL DEFAULT 0
  );
`)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS custom_field_values (
    id TEXT PRIMARY KEY,
    field_id TEXT NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK(entity_type IN ('element','task')),
    entity_id TEXT NOT NULL,
    value TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS custom_field_scopes (
    id TEXT PRIMARY KEY,
    field_id TEXT NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
    scope_type TEXT NOT NULL CHECK(scope_type IN ('global','project','element_type','template')),
    scope_value TEXT
  );
`)

// ─── Forms / Intake ───────────────────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS forms (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    color TEXT,
    type TEXT NOT NULL CHECK(type IN ('task_intake','project_request','issue_report','approval_request','checklist_submission')),
    is_published INTEGER NOT NULL DEFAULT 0,
    is_anonymous INTEGER NOT NULL DEFAULT 0,
    confirmation_message TEXT,
    submission_count INTEGER NOT NULL DEFAULT 0,
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS form_fields (
    id TEXT PRIMARY KEY,
    form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    field_type TEXT NOT NULL CHECK(field_type IN ('text','long_text','number','date','select','multi_select','checkbox','email','url','phone','file','user','rating')),
    placeholder TEXT,
    help_text TEXT,
    is_required INTEGER NOT NULL DEFAULT 0,
    options TEXT,
    config TEXT,
    sort_order REAL NOT NULL DEFAULT 0
  );
`)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS form_submissions (
    id TEXT PRIMARY KEY,
    form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    submitted_by TEXT REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processed','rejected')),
    result_element_id TEXT REFERENCES elements(id),
    result_task_id TEXT REFERENCES tasks(id),
    processed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS form_mappings (
    id TEXT PRIMARY KEY,
    form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK(action IN ('create_task','create_page','create_reminder','create_process')),
    target_project_id TEXT REFERENCES elements(id),
    default_status_id TEXT,
    default_assignee_id TEXT REFERENCES users(id),
    field_mapping TEXT,
    config TEXT
  );
`)

// ─── Automation Engine ────────────────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS automations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL CHECK(trigger_type IN ('task_created','task_updated','status_changed','due_date_reached','reminder_triggered','comment_added','dependency_resolved','form_submitted','element_linked','page_created','attachment_uploaded')),
    is_active INTEGER NOT NULL DEFAULT 1,
    project_id TEXT REFERENCES elements(id),
    run_count INTEGER NOT NULL DEFAULT 0,
    last_run_at TEXT,
    last_run_status TEXT CHECK(last_run_status IN ('success','failure','skipped')),
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS automation_conditions (
    id TEXT PRIMARY KEY,
    automation_id TEXT NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
    field TEXT NOT NULL,
    operator TEXT NOT NULL CHECK(operator IN ('equals','not_equals','contains','not_contains','greater_than','less_than','is_empty','is_not_empty')),
    value TEXT NOT NULL,
    logic_gate TEXT NOT NULL DEFAULT 'and' CHECK(logic_gate IN ('and','or')),
    sort_order REAL NOT NULL DEFAULT 0
  );
`)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS automation_actions (
    id TEXT PRIMARY KEY,
    automation_id TEXT NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL CHECK(action_type IN ('create_task','update_status','assign_user','add_label','post_notification','create_reminder','update_priority','add_comment','duplicate_template')),
    config TEXT NOT NULL,
    sort_order REAL NOT NULL DEFAULT 0
  );
`)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS automation_runs (
    id TEXT PRIMARY KEY,
    automation_id TEXT NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK(status IN ('success','failure','skipped')),
    trigger_data TEXT,
    actions_executed INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    duration INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS automation_logs (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES automation_runs(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('success','failure')),
    input TEXT,
    output TEXT,
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

// ─── Feed System ──────────────────────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS feed_events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    actor_user_id TEXT REFERENCES users(id),
    subject_element_id TEXT REFERENCES elements(id) ON DELETE CASCADE,
    subject_task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
    parent_element_id TEXT REFERENCES elements(id),
    team_id TEXT REFERENCES teams(id),
    project_id TEXT REFERENCES elements(id),
    title TEXT NOT NULL,
    summary TEXT,
    payload TEXT,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high')),
    visibility TEXT NOT NULL DEFAULT 'workspace' CHECK(visibility IN ('private','team','workspace')),
    source_type TEXT NOT NULL DEFAULT 'system' CHECK(source_type IN ('manual','system','automation','form','api')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS feed_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK(target_type IN ('project','element','team','user','label','automation')),
    target_id TEXT NOT NULL,
    is_muted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS feed_views (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    filter_json TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS feed_filters (
    id TEXT PRIMARY KEY,
    view_id TEXT NOT NULL REFERENCES feed_views(id) ON DELETE CASCADE,
    field TEXT NOT NULL,
    operator TEXT NOT NULL,
    value TEXT NOT NULL
  );
`)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS feed_read_state (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id TEXT NOT NULL REFERENCES feed_events(id) ON DELETE CASCADE,
    read_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS feed_pins (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id TEXT NOT NULL REFERENCES feed_events(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

export const db = drizzle(sqlite, { schema })

// Export raw sqlite for FTS queries
export { sqlite }
