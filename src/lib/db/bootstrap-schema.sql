CREATE TABLE IF NOT EXISTS `activity_log` (
	`id` text PRIMARY KEY NOT NULL,
	`element_id` text NOT NULL,
	`action` text NOT NULL,
	`details` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL, user_id TEXT,
	FOREIGN KEY (`element_id`) REFERENCES `elements`(`id`) ON UPDATE no action ON DELETE cascade
);

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

CREATE TABLE IF NOT EXISTS automation_actions (
    id TEXT PRIMARY KEY,
    automation_id TEXT NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL CHECK(action_type IN ('create_task','update_status','assign_user','add_label','post_notification','create_reminder','update_priority','add_comment','duplicate_template')),
    config TEXT NOT NULL,
    sort_order REAL NOT NULL DEFAULT 0
  );

CREATE TABLE IF NOT EXISTS automation_conditions (
    id TEXT PRIMARY KEY,
    automation_id TEXT NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
    field TEXT NOT NULL,
    operator TEXT NOT NULL CHECK(operator IN ('equals','not_equals','contains','not_contains','greater_than','less_than','is_empty','is_not_empty')),
    value TEXT NOT NULL,
    logic_gate TEXT NOT NULL DEFAULT 'and' CHECK(logic_gate IN ('and','or')),
    sort_order REAL NOT NULL DEFAULT 0
  );

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

CREATE TABLE IF NOT EXISTS `canvas_edges` (
	`id` text PRIMARY KEY NOT NULL,
	`canvas_id` text NOT NULL,
	`source_node_id` text NOT NULL,
	`target_node_id` text NOT NULL,
	`source_handle` text,
	`target_handle` text,
	`type` text DEFAULT 'default',
	`label` text,
	`style` text,
	`animated` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`canvas_id`) REFERENCES `elements`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_node_id`) REFERENCES `canvas_nodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_node_id`) REFERENCES `canvas_nodes`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `canvas_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`canvas_id` text NOT NULL,
	`type` text NOT NULL,
	`position_x` real NOT NULL,
	`position_y` real NOT NULL,
	`width` real,
	`height` real,
	`data` text,
	`element_ref_id` text,
	`style` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`canvas_id`) REFERENCES `elements`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`element_ref_id`) REFERENCES `elements`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS `canvases` (
	`id` text PRIMARY KEY NOT NULL,
	`viewport_x` real DEFAULT 0 NOT NULL,
	`viewport_y` real DEFAULT 0 NOT NULL,
	`viewport_zoom` real DEFAULT 1 NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `elements`(`id`) ON UPDATE no action ON DELETE cascade
);

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

CREATE TABLE IF NOT EXISTS custom_field_options (
    id TEXT PRIMARY KEY,
    field_id TEXT NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    color TEXT,
    sort_order REAL NOT NULL DEFAULT 0
  );

CREATE TABLE IF NOT EXISTS custom_field_scopes (
    id TEXT PRIMARY KEY,
    field_id TEXT NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
    scope_type TEXT NOT NULL CHECK(scope_type IN ('global','project','element_type','template')),
    scope_value TEXT
  );

CREATE TABLE IF NOT EXISTS custom_field_values (
    id TEXT PRIMARY KEY,
    field_id TEXT NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK(entity_type IN ('element','task')),
    entity_id TEXT NOT NULL,
    value TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

CREATE TABLE IF NOT EXISTS `dashboard_widgets` (
	`id` text PRIMARY KEY NOT NULL,
	`widget_type` text NOT NULL,
	`title` text,
	`config` text,
	`position_x` integer NOT NULL,
	`position_y` integer NOT NULL,
	`width` integer DEFAULT 1 NOT NULL,
	`height` integer DEFAULT 1 NOT NULL,
	`element_ref_id` text,
	FOREIGN KEY (`element_ref_id`) REFERENCES `elements`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS edit_sessions (
    id TEXT PRIMARY KEY,
    element_id TEXT NOT NULL REFERENCES elements(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_activity TEXT NOT NULL DEFAULT (datetime('now')),
    is_active INTEGER NOT NULL DEFAULT 1
  );

CREATE TABLE IF NOT EXISTS `element_links` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`target_id` text NOT NULL,
	`link_type` text NOT NULL,
	`metadata` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `elements`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_id`) REFERENCES `elements`(`id`) ON UPDATE no action ON DELETE cascade
);

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

CREATE TABLE IF NOT EXISTS `element_tags` (
	`element_id` text NOT NULL,
	`tag_id` text NOT NULL,
	FOREIGN KEY (`element_id`) REFERENCES `elements`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `elements` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text DEFAULT 'Untitled' NOT NULL,
	`description` text,
	`icon` text,
	`color` text,
	`is_favorite` integer DEFAULT false NOT NULL,
	`is_archived` integer DEFAULT false NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`parent_id` text,
	`sort_order` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL, created_by TEXT, last_edited_by TEXT, version INTEGER NOT NULL DEFAULT 1, visibility TEXT NOT NULL DEFAULT 'workspace',
	FOREIGN KEY (`parent_id`) REFERENCES `elements`(`id`) ON UPDATE no action ON DELETE no action
);

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

CREATE TABLE IF NOT EXISTS feed_filters (
    id TEXT PRIMARY KEY,
    view_id TEXT NOT NULL REFERENCES feed_views(id) ON DELETE CASCADE,
    field TEXT NOT NULL,
    operator TEXT NOT NULL,
    value TEXT NOT NULL
  );

CREATE TABLE IF NOT EXISTS feed_pins (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id TEXT NOT NULL REFERENCES feed_events(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

CREATE TABLE IF NOT EXISTS feed_read_state (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id TEXT NOT NULL REFERENCES feed_events(id) ON DELETE CASCADE,
    read_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

CREATE TABLE IF NOT EXISTS feed_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK(target_type IN ('project','element','team','user','label','automation')),
    target_id TEXT NOT NULL,
    is_muted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

CREATE TABLE IF NOT EXISTS feed_views (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    filter_json TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

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

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('reminder_due','task_overdue','task_due_soon','project_milestone','system')),
    title TEXT NOT NULL,
    message TEXT,
    element_id TEXT REFERENCES elements(id) ON DELETE CASCADE,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  , user_id TEXT, actor_id TEXT);

CREATE TABLE IF NOT EXISTS `pages` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text,
	`cover_image` text,
	`is_template` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `elements`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `process_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`process_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`sort_order` real DEFAULT 0 NOT NULL,
	`is_completed` integer DEFAULT false NOT NULL,
	`completed_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`process_id`) REFERENCES `elements`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `processes` (
	`id` text PRIMARY KEY NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `elements`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`start_date` text,
	`due_date` text,
	`progress` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `elements`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`remind_at` text NOT NULL,
	`repeat_rule` text,
	`is_dismissed` integer DEFAULT false NOT NULL,
	`snoozed_until` text,
	FOREIGN KEY (`id`) REFERENCES `elements`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS server_events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('server_start','server_stop','backup_completed','backup_failed','user_login','user_logout','user_created','permission_changed','error','warning','info')),
    title TEXT NOT NULL,
    message TEXT,
    user_id TEXT REFERENCES users(id),
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

CREATE TABLE IF NOT EXISTS `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text
);

CREATE TABLE IF NOT EXISTS task_assignments (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'assignee' CHECK(role IN ('assignee','watcher','contributor')),
    assigned_by TEXT REFERENCES users(id),
    assigned_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

CREATE TABLE IF NOT EXISTS `task_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`file_name` text NOT NULL,
	`file_path` text NOT NULL,
	`file_size` integer NOT NULL,
	`mime_type` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `task_checklist_items` (
	`id` text PRIMARY KEY NOT NULL,
	`checklist_id` text NOT NULL,
	`title` text NOT NULL,
	`is_completed` integer DEFAULT false NOT NULL,
	`sort_order` real DEFAULT 0 NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`checklist_id`) REFERENCES `task_checklists`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `task_checklists` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`title` text NOT NULL,
	`sort_order` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `task_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL, author_id TEXT,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `task_dependencies` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`depends_on_task_id` text NOT NULL,
	`type` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`depends_on_task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `task_labels` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `task_statuses` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`sort_order` real DEFAULT 0 NOT NULL,
	`is_done_state` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `elements`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `task_to_labels` (
	`task_id` text NOT NULL,
	`label_id` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`label_id`) REFERENCES `task_labels`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`status_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`priority` text DEFAULT 'none' NOT NULL,
	`due_date` text,
	`sort_order` real DEFAULT 0 NOT NULL,
	`parent_task_id` text,
	`is_completed` integer DEFAULT false NOT NULL,
	`completed_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL, `start_date` text, `time_estimate` integer, `time_tracked` integer DEFAULT 0 NOT NULL, created_by TEXT, assignee_id TEXT, last_edited_by TEXT, version INTEGER NOT NULL DEFAULT 1,
	FOREIGN KEY (`project_id`) REFERENCES `elements`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`status_id`) REFERENCES `task_statuses`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('lead','member')),
    joined_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

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

CREATE TABLE IF NOT EXISTS `todo_items` (
	`id` text PRIMARY KEY NOT NULL,
	`list_id` text NOT NULL,
	`title` text NOT NULL,
	`is_completed` integer DEFAULT false NOT NULL,
	`sort_order` real DEFAULT 0 NOT NULL,
	`due_date` text,
	`notes` text,
	`completed_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`list_id`) REFERENCES `elements`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `todo_lists` (
	`id` text PRIMARY KEY NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `elements`(`id`) ON UPDATE no action ON DELETE cascade
);

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

CREATE TABLE IF NOT EXISTS watchers (
    id TEXT PRIMARY KEY,
    element_id TEXT NOT NULL REFERENCES elements(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );