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

// ─── One-time ownership backfill ───────────────────────────────────────
// When the per-user workspace model rolled out, existing rows had
// created_by = NULL. If exactly one human user exists (the admin),
// claim everything for them. Idempotent: subsequent boots find 0 NULLs
// and skip.
try {
  const orphanCount = (sqlite
    .prepare(`SELECT COUNT(*) AS n FROM elements WHERE created_by IS NULL`)
    .get() as { n: number }).n
  if (orphanCount > 0) {
    const users = sqlite
      .prepare(`SELECT id FROM users WHERE is_active = 1 ORDER BY created_at ASC LIMIT 2`)
      .all() as { id: string }[]
    if (users.length === 1) {
      sqlite
        .prepare(`UPDATE elements SET created_by = ? WHERE created_by IS NULL`)
        .run(users[0].id)
      console.log(`[migration] Assigned ${orphanCount} orphaned elements to ${users[0].id}`)
    } else if (users.length > 1) {
      console.warn(
        `[migration] Found ${orphanCount} orphaned elements but multiple users exist; ` +
        `manual assignment required. Backfill skipped to avoid wrong attribution.`
      )
    }
  }
} catch (err) {
  // Don't fail startup over migration — log and continue.
  console.error("[migration] backfill failed:", err)
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
