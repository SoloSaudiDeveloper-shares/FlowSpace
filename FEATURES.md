# FlowSpace - Complete Feature & Function Reference

> Every feature, function, component, route, and system implemented in the project.
> Use this as your revision checklist to add, remove, or modify anything.

---

## 1. Database Schema (`src/lib/db/schema.ts`)

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `elements` | Universal element (every item is an element first) | id, type (project/page/canvas/todo_list/reminder/process), title, description, icon, color, isFavorite, isArchived, isDeleted, parentId, sortOrder, createdAt, updatedAt |
| `elementLinks` | Cross-element relationships | id, sourceId, targetId, linkType (reference/dependency/contains/blocks/relates_to), metadata, createdAt |
| `tags` | Universal tag system | id, name (unique), color |
| `elementTags` | Many-to-many element-tag join | elementId, tagId |

### Projects & Tasks

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `projects` | Project metadata (extends element) | id (FK to elements), status (active/paused/completed/archived), startDate, dueDate, progress |
| `taskStatuses` | Custom status columns per project | id, projectId, name, color, sortOrder, isDoneState |
| `tasks` | Individual tasks | id, projectId, statusId, title, description, priority (urgent/high/medium/low/none), startDate, dueDate, sortOrder, parentTaskId, timeEstimate, timeTracked, isCompleted, completedAt, createdAt, updatedAt |
| `taskLabels` | Reusable label definitions | id, name, color |
| `taskToLabels` | Many-to-many task-label join | taskId, labelId |
| `taskChecklists` | Checklists on tasks | id, taskId, title, sortOrder, createdAt |
| `taskChecklistItems` | Checklist items | id, checklistId, title, isCompleted, sortOrder, completedAt |
| `taskDependencies` | Task dependency links | id, taskId, dependsOnTaskId, type (blocks/blocked_by/relates_to), createdAt |
| `taskAttachments` | File attachments on tasks | id, taskId, fileName, filePath, fileSize, mimeType, createdAt |
| `taskComments` | Comments on tasks | id, taskId, content, createdAt, updatedAt |

### Pages & Canvas

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `pages` | Rich text page content | id (FK to elements), content (BlockNote JSON), coverImage, isTemplate |
| `canvases` | Canvas viewport state | id (FK to elements), viewportX, viewportY, viewportZoom |
| `canvasNodes` | Nodes on a canvas | id, canvasId, type (card/sticky_note/element_embed/text/image/group/shape), positionX, positionY, width, height, data (JSON), elementRefId, style, createdAt |
| `canvasEdges` | Connections between nodes | id, canvasId, sourceNodeId, targetNodeId, sourceHandle, targetHandle, type, label, style, animated |

### Todo Lists & Reminders

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `todoLists` | Todo list container | id (FK to elements) |
| `todoItems` | Individual todo items | id, listId, title, isCompleted, sortOrder, dueDate, notes, completedAt, createdAt |
| `reminders` | Time-based reminders | id (FK to elements), remindAt, repeatRule, isDismissed, snoozedUntil |

### Processes

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `processes` | Process/workflow container | id (FK to elements) |
| `processSteps` | Sequential steps | id, processId, title, description, sortOrder, isCompleted, completedAt, createdAt |

### Dashboard, Notifications, Activity

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `dashboardWidgets` | Dashboard grid widgets | id, widgetType (recent_elements/favorites/project_summary/task_board_mini/calendar/quick_capture/element_embed), title, config (JSON), positionX, positionY, width, height, elementRefId |
| `notifications` | System notifications | id, type (reminder_due/task_overdue/task_due_soon/project_milestone/system), title, message, elementId, isRead, createdAt |
| `activityLog` | Action audit trail | id, elementId, action (15+ types), details, createdAt |
| `viewPreferences` | Per-element view settings | id, elementId, viewType (board/list/table), hiddenFields, sortField, sortDirection, groupBy, filterJson, updatedAt |

### Full-Text Search (raw SQL in `src/lib/db/index.ts`)

| Virtual Table | Indexed From | Columns |
|---------------|-------------|---------|
| `elements_fts` | `elements` | title, description, type |
| `tasks_fts` | `tasks` | title, description, project_id |

- Auto-sync INSERT/UPDATE/DELETE triggers keep FTS indices up to date.

---

## 2. Server Actions (`src/lib/actions/`)

### element-actions.ts

| Function | Parameters | Description |
|----------|-----------|-------------|
| `createElement` | type, title?, parentId? | Create new element with type-specific initialization (creates project/page/canvas/todoList/process row too) |
| `getElements` | - | Get all non-deleted, non-archived elements |
| `getElementsByType` | type | Filter elements by type |
| `getElement` | id | Get single element by ID |
| `updateElement` | id, data | Update title, description, icon, color, isFavorite |
| `deleteElement` | id | Soft delete (isDeleted = true) |
| `archiveElement` | id | Archive element (isArchived = true) |
| `restoreElement` | id | Restore from deletion or archive |
| `permanentlyDeleteElement` | id | Hard delete from database |
| `getDeletedElements` | - | Get all soft-deleted items |
| `getArchivedElements` | - | Get all archived items |
| `toggleFavorite` | id | Toggle isFavorite flag |
| `getRecentElements` | limit? | Get most recently updated elements |
| `getFavoriteElements` | - | Get all favorited elements |

### task-actions.ts

**Task Status Management:**

| Function | Parameters | Description |
|----------|-----------|-------------|
| `getTaskStatuses` | projectId | Get all statuses for a project |
| `createTaskStatus` | projectId, data | Create new status column |
| `updateTaskStatus` | id, projectId, data | Update status properties |
| `deleteTaskStatus` | id, projectId | Delete status and clear associated tasks |

**Task Operations:**

| Function | Parameters | Description |
|----------|-----------|-------------|
| `getTasksByProject` | projectId | Get all tasks in a project |
| `createTask` | projectId, statusId, title | Create new task |
| `updateTask` | id, projectId, data | Update any task field (title, description, priority, status, dates, completion, etc.) |
| `deleteTask` | id, projectId | Delete task |
| `moveTask` | taskId, projectId, newStatusId, newSortOrder | Move task between columns, update project progress |
| `getProjectData` | projectId | Get project metadata (status, dates, progress) |
| `duplicateTask` | taskId, projectId | Clone task with all labels and checklists |

**Subtasks:**

| Function | Parameters | Description |
|----------|-----------|-------------|
| `getSubtasks` | parentTaskId | Get child tasks of a parent |
| `createSubtask` | projectId, statusId, parentTaskId, title | Create subtask linked to parent |

**Labels:**

| Function | Parameters | Description |
|----------|-----------|-------------|
| `getAllLabels` | - | Get all task labels |
| `createLabel` | name, color | Create new label |
| `getTaskLabels` | taskId | Get labels assigned to a task |
| `addLabelToTask` | taskId, labelId, projectId | Assign label to task |
| `removeLabelFromTask` | taskId, labelId, projectId | Remove label from task |

**Checklists:**

| Function | Parameters | Description |
|----------|-----------|-------------|
| `getTaskChecklists` | taskId | Get checklists with all items |
| `createChecklist` | taskId, title, projectId | Create new checklist on task |
| `deleteChecklist` | id, projectId | Delete checklist |
| `addChecklistItem` | checklistId, title, projectId | Add item to checklist |
| `toggleChecklistItem` | id, isCompleted, projectId | Mark checklist item done/undone |
| `deleteChecklistItem` | id, projectId | Delete checklist item |

**Dependencies:**

| Function | Parameters | Description |
|----------|-----------|-------------|
| `getTaskDependencies` | taskId | Get all dependencies for a task |
| `addTaskDependency` | taskId, dependsOnTaskId, type, projectId | Create dependency relationship |
| `removeTaskDependency` | id, projectId | Delete dependency |

**Metadata:**

| Function | Parameters | Description |
|----------|-----------|-------------|
| `getTaskCardMetadata` | projectId | Batch fetch subtask counts, labels, checklist progress for all tasks |
| `getTaskAttachments` | taskId | Get file attachments for a task |

### page-actions.ts

| Function | Parameters | Description |
|----------|-----------|-------------|
| `getPageContent` | id | Get page with BlockNote JSON content |
| `savePageContent` | id, content | Save page content (JSON string) |
| `savePageCover` | id, coverImage | Set or clear page cover image |

### canvas-actions.ts

| Function | Parameters | Description |
|----------|-----------|-------------|
| `getCanvasData` | canvasId | Get canvas with all nodes and edges |
| `saveCanvasNodes` | canvasId, nodes[] | Save/replace all nodes |
| `saveCanvasEdges` | canvasId, edges[] | Save/replace all edges |
| `saveCanvasViewport` | canvasId, viewport | Save viewport state (x, y, zoom) |
| `addCanvasNode` | canvasId, type, positionX, positionY, data? | Create single node |

### todo-actions.ts

| Function | Parameters | Description |
|----------|-----------|-------------|
| `getTodoItems` | listId | Get all items in a todo list |
| `createTodoItem` | listId, title | Add item to list |
| `updateTodoItem` | id, listId, data | Update item (title, completion, dueDate, notes, sortOrder) |
| `deleteTodoItem` | id, listId | Remove item |

### reminder-actions.ts

| Function | Parameters | Description |
|----------|-----------|-------------|
| `getReminder` | id | Get single reminder |
| `getAllReminders` | - | Get all reminders joined with element data |
| `updateReminder` | id, data | Update remindAt, repeatRule, isDismissed, snoozedUntil |
| `getDueReminders` | - | Get reminders that have triggered |

### process-actions.ts

| Function | Parameters | Description |
|----------|-----------|-------------|
| `getProcessSteps` | processId | Get all steps in a process |
| `createProcessStep` | processId, title | Create new step |
| `updateProcessStep` | id, processId, data | Update title, description, isCompleted, sortOrder |
| `deleteProcessStep` | id, processId | Delete step |

### search-actions.ts

| Function | Parameters | Description |
|----------|-----------|-------------|
| `fullTextSearch` | query, limit? | Search elements and tasks using FTS5 with prefix matching, rank sorting, LIKE fallback |

### notification-actions.ts

| Function | Parameters | Description |
|----------|-----------|-------------|
| `getNotifications` | limit? | Get notifications with linked element data |
| `getUnreadCount` | - | Count unread notifications |
| `markAsRead` | id | Mark single notification as read |
| `markAllAsRead` | - | Mark all notifications as read |
| `deleteNotification` | id | Delete single notification |
| `clearAllNotifications` | - | Delete all read notifications |
| `createNotification` | data | Create notification manually |
| `generateNotifications` | - | Auto-generate from due reminders and overdue tasks (idempotent) |

### link-actions.ts

| Function | Parameters | Description |
|----------|-----------|-------------|
| `createLink` | sourceId, targetId, linkType | Create element-to-element link |
| `deleteLink` | id | Delete link |
| `getLinksForElement` | elementId | Get all links (inbound + outbound) with direction |
| `searchElements` | query, excludeId? | Search elements for linking UI |

### view-preference-actions.ts

| Function | Parameters | Description |
|----------|-----------|-------------|
| `getViewPreference` | elementId, viewType | Get preference for specific view |
| `getViewPreferences` | elementId | Get all preferences for element |
| `saveViewPreference` | data | Create or update preference |
| `deleteViewPreference` | id | Delete preference |

### dashboard-actions.ts

| Function | Parameters | Description |
|----------|-----------|-------------|
| `getDashboardWidgets` | - | Get all widgets ordered by position |
| `createDashboardWidget` | data, shouldRevalidate? | Create widget |
| `updateDashboardWidget` | id, data | Update position, size, title, config |
| `deleteDashboardWidget` | id | Delete widget |
| `initializeDefaultDashboard` | - | Create default widgets on first load |

### export-actions.ts

| Function | Parameters | Description |
|----------|-----------|-------------|
| `exportElements` | format (json/csv) | Export all elements |
| `exportTasks` | projectId, format | Export project tasks |
| `exportAllData` | - | Full database dump as JSON |

### comment-actions.ts

| Function | Parameters | Description |
|----------|-----------|-------------|
| `getTaskComments` | taskId | Get all comments on a task |
| `addTaskComment` | taskId, content, projectId | Add comment and log activity |
| `updateComment` | id, content, projectId | Edit comment |
| `deleteComment` | id, projectId | Delete comment |
| `getActivityLog` | elementId, limit? | Get activity history |
| `logActivity` | elementId, action, details? | Record action in activity log |

---

## 3. API Routes (`src/app/api/`)

### `/api/attachments` (POST, DELETE)

| Method | Description | Details |
|--------|-------------|---------|
| POST | Upload file attachment | Accepts multipart FormData (file, taskId, projectId). Validates 10MB max. Stores to `data/uploads/`. Returns id and fileName. |
| DELETE | Delete attachment | Accepts JSON body with id and projectId. Removes file from disk and database. |

### `/api/attachments/[id]` (GET)

| Method | Description | Details |
|--------|-------------|---------|
| GET | Download/serve attachment | Streams file by attachment ID with correct Content-Type and Content-Disposition headers. |

### `/api/export` (GET)

| Method | Description | Details |
|--------|-------------|---------|
| GET | Export data | Query params: type (elements/tasks/all), format (json/csv), projectId. Returns file download. |

---

## 4. Pages & Routes (`src/app/`)

| Route | Page | Description |
|-------|------|-------------|
| `/` | Home/Dashboard | Dashboard grid with widgets (recent, favorites, quick capture, project summary). Initializes default dashboard on first visit. |
| `/projects/[id]` | Project Detail | Project header with title, element links, sub-project bar, and ProjectViews (6 view modes). |
| `/pages/[id]` | Page Editor | BlockNote rich text editor with autosave, cover image support. |
| `/canvas/[id]` | Canvas Editor | React Flow visual canvas with custom node types and edge connections. |
| `/todos/[id]` | Todo List | Drag-and-drop reorderable todo items with due dates and notes. |
| `/process/[id]` | Process/Workflow | Toggle between steps view (sequential checklist) and flowchart view (visual diagram). |
| `/reminders` | All Reminders | List of all reminders with edit, snooze, dismiss, delete. |
| `/notifications` | Notifications | Notification feed with auto-generation, mark read, delete. |
| `/settings` | Settings | Data export, appearance (font/color/radius), Gantt tooltip config, keyboard shortcuts, about. |
| `/trash` | Trash/Archive | Tabs for deleted vs archived items. Restore or permanently delete. |

Each dynamic route has `loading.tsx` (skeleton) and `error.tsx` (error boundary) files.

---

## 5. Components (`src/components/`)

### Layout Components

| Component | File | Description |
|-----------|------|-------------|
| `AppSidebar` | `layout/app-sidebar.tsx` | Collapsible sidebar with: quick create buttons, favorites section, elements grouped by type, sub-project tree with expand/collapse, context menu per element, theme toggle, footer links (Notifications, Trash, Settings). |
| `CommandPalette` | `layout/command-palette.tsx` | Cmd+K global search using FTS5. Shows elements and tasks. Quick create, navigation to Trash/Settings/Notifications. |
| `KeyboardShortcuts` | `layout/keyboard-shortcuts.tsx` | Global keyboard shortcut overlay with key bindings. |

### Project Components

| Component | File | Description |
|-----------|------|-------------|
| `ProjectViews` | `project/project-views.tsx` | View switcher (overview/list/board/calendar/gantt/table) with: collapsible search bar, ClickUp-style filter bar (Priority/Status/Due Date pills), sort dropdown, field visibility toggle, filter count badge, clear-all button, result count. |
| `OverviewView` | `project/views/overview-view.tsx` | Project summary: progress bar, status counts, workload chart, task list, tasks-over-time chart, burndown chart, battery chart, cumulative flow. |
| `ListView` | `project/views/list-view.tsx` | Hierarchical task list grouped by status. Tree hierarchy with expand/collapse, indent guides, completion checkboxes, priority flags, due dates. Inline add task per status group. |
| `TaskBoard` | `project/task-board.tsx` | Kanban board with drag-and-drop (dnd-kit). Draggable status columns, task cards between columns, inline task creation, context menus. |
| `CalendarView` | `project/views/calendar-view.tsx` | Month calendar with tasks placed on due dates. Navigation, today highlight. |
| `GanttView` | `project/views/gantt-view.tsx` | Timeline with: task duration bars (draggable, resizable), tree hierarchy with expand/collapse, indent guides, day/week/month zoom, today line, context menu, click-to-schedule, hover tooltip (configurable fields: status/priority/dates/completion). |
| `TableView` | `project/views/table-view.tsx` | Spreadsheet-style table with tree hierarchy, expand/collapse, indent guides, status badges, due dates, priority flags. Inline add task. |
| `TaskCard` | `project/task-card.tsx` | Compact card with title, priority badge, due date, subtask count/progress, checklist progress, label badges. |
| `TaskDetailSheet` | `project/task-detail-sheet.tsx` | Full task editing modal: title, description, priority, status, start/due dates, labels (create/add/remove), subtasks (create/delete), checklists with items, dependencies (add/remove), time tracking, comments (add/edit/delete), file attachments (upload/download/delete), duplicate, delete. |
| `SubProjectBar` | `project/sub-project-bar.tsx` | Horizontal bar showing sub-projects with navigation and create button. |

### Editor Components

| Component | File | Description |
|-----------|------|-------------|
| `PageEditor` | `editor/page-editor.tsx` | BlockNote rich text editor. Autosave every 500ms. Dark/light theme support. Content saved as JSON. |

### Canvas Components

| Component | File | Description |
|-----------|------|-------------|
| `CanvasEditor` | `canvas/canvas-editor.tsx` | React Flow canvas with: custom node types, edge creation, zoom controls (in/out/fit), MiniMap, background grid, add nodes via context menu, saves state to DB. |
| `CardNode` | `canvas/node-types/card-node.tsx` | Card with title and description, resizable, connectable handles. |
| `StickyNoteNode` | `canvas/node-types/sticky-note-node.tsx` | Yellow sticky note style node. |
| `TextNode` | `canvas/node-types/text-node.tsx` | Simple editable text node. |
| `ShapeNode` | `canvas/node-types/shape-node.tsx` | Geometric shape node. |

### Dashboard Components

| Component | File | Description |
|-----------|------|-------------|
| `DashboardGrid` | `dashboard/dashboard-grid.tsx` | Widget grid with: RecentWidget, FavoritesWidget, QuickCaptureWidget, ProjectSummaryWidget. Add/remove widgets. |

### Todo Components

| Component | File | Description |
|-----------|------|-------------|
| `TodoListEditor` | `todos/todo-list-editor.tsx` | Drag-and-drop reorderable items. Add, toggle completion, set due dates, add notes, delete. Shows completion count. |

### Process Components

| Component | File | Description |
|-----------|------|-------------|
| `ProcessContent` | `process/process-content.tsx` | Toggle between steps and flowchart views. |
| `StepsView` | `process/steps-view.tsx` | Ordered step list. Add/edit/delete/complete steps. Drag to reorder. |
| `FlowchartView` | `process/flowchart-view.tsx` | Visual flowchart of process using React Flow canvas. |

### Reminders Components

| Component | File | Description |
|-----------|------|-------------|
| `RemindersList` | `reminders/reminders-list.tsx` | All reminders list. Edit time, snooze, dismiss, delete. Due/overdue status indicators. |

### Notifications Components

| Component | File | Description |
|-----------|------|-------------|
| `NotificationList` | `notifications/notification-list.tsx` | Notification feed with all/unread filter. Mark read, delete, navigate to element. Type badges and timestamps. |

### Settings Components

| Component | File | Description |
|-----------|------|-------------|
| `SettingsContent` | `settings/settings-content.tsx` | Data export (full backup, elements JSON/CSV). Appearance: font family (4 options with previews), font size (3 levels), accent color (7 colors), border radius (5 levels), reset all. Gantt Chart: tooltip field toggles (status/priority/dates/completion). Keyboard shortcuts info. About section. |

### Trash Components

| Component | File | Description |
|-----------|------|-------------|
| `TrashList` | `trash/trash-list.tsx` | Tabs for deleted vs archived items. Restore or permanently delete. Type icons, last modified dates. |

### Shared Components

| Component | File | Description |
|-----------|------|-------------|
| `ElementLinker` | `shared/element-linker.tsx` | Dialog for creating element links. Search elements, select link type (reference/dependency/contains/blocks/relates_to), view/delete existing links. |
| `InlineTitle` | `shared/inline-title.tsx` | Click-to-edit element title, blur to save. |
| `ContextMenu` | `shared/context-menu.tsx` | Custom right-click context menu system. Reusable across all views. |

### Theme Components

| Component | File | Description |
|-----------|------|-------------|
| `ThemeProvider` | `theme-provider.tsx` | Next.js dark/light theme wrapper. |
| `ThemeToggle` | `theme-toggle.tsx` | Moon/sun icon toggle button. |

---

## 6. Hooks (`src/lib/hooks/`)

| Hook | File | Description |
|------|------|-------------|
| `usePreferences` | `use-preferences.tsx` | Context hook for user preferences. Returns: preferences state, updatePreference(key, value), resetPreferences(). Manages font family, font size, accent color, border radius, gantt tooltip fields. Persists to localStorage. Applies to DOM via CSS variables. |
| `useMobile` | `use-mobile.ts` | Responsive design hook (max-width detection). |

---

## 7. Preferences System

| Preference | Options | Stored In |
|------------|---------|-----------|
| Font Family | geist, inter, jakarta, dm-sans | localStorage |
| Font Size | small (14px), default (16px), large (18px) | localStorage |
| Accent Color | neutral, blue, violet, rose, green, orange, teal | localStorage |
| Border Radius | none (0), small (0.25rem), default (0.625rem), large (1rem), full (1.5rem) | localStorage |
| Gantt Tooltip Fields | status, priority, dates, completion (each toggleable) | localStorage |

Accent colors override CSS custom properties (`--primary`, `--ring`, `--sidebar-primary`) via `html[data-accent="..."]` selectors in `globals.css`.

---

## 8. CSS & Animations (`src/app/globals.css`)

| Animation | Class | Description |
|-----------|-------|-------------|
| `page-enter` | `.animate-page-enter` | Fade-in + slide-up on page load |
| `fade-in-scale` | `.animate-fade-in-scale` | Fade-in with slight scale |
| `slide-in-from-right` | `.animate-slide-in-right` | Slide-in from right |
| `stagger-item` | `.stagger-item` | Staggered list item animation (30ms delay between items, up to 10) |
| (inline) | `.transition-smooth` | All properties 200ms cubic-bezier |

Accent color overrides: 7 color schemes x 2 modes (light + dark) = 14 CSS rule blocks.

---

## 9. Utility Functions

| Function | File | Description |
|----------|------|-------------|
| `createId()` | `lib/utils/ids.ts` | Generate nanoid for database primary keys |
| `cn()` | `lib/utils.ts` | Merge Tailwind CSS classes (clsx + tailwind-merge) |

---

## 10. Fonts Loaded (`src/app/layout.tsx`)

| Font | CSS Variable | Used By |
|------|-------------|---------|
| Geist | `--font-geist-sans` | Default font family |
| Geist Mono | `--font-geist-mono` | Monospace/code |
| Inter | `--font-inter` | Selectable in settings |
| Plus Jakarta Sans | `--font-jakarta` | Selectable in settings |
| DM Sans | `--font-dm-sans` | Selectable in settings |

---

## 11. Provider Hierarchy (`src/app/layout.tsx`)

```
<html> (fonts + suppressHydrationWarning)
  <body>
    <ThemeProvider> (dark/light mode)
      <PreferencesProvider> (font, color, radius, tooltip prefs)
        <TooltipProvider>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>{children}</SidebarInset>
            <CommandPalette />
            <KeyboardShortcuts />
          </SidebarProvider>
          <Toaster /> (sonner toast notifications)
        </TooltipProvider>
      </PreferencesProvider>
    </ThemeProvider>
  </body>
</html>
```

---

## 12. Key Feature Summary (20 Features)

1. **Universal Element System** - 6 types unified in one table with cross-linking
2. **Full-Text Search (FTS5)** - Prefix matching on elements and tasks with auto-sync triggers
3. **Rich Task Management** - Statuses, labels, subtasks, checklists, dependencies, time tracking, comments, attachments
4. **6 Project Views** - Overview, List (hierarchical), Board (Kanban DnD), Calendar, Gantt (draggable bars + tooltip), Table
5. **ClickUp-Style Filter Bar** - Priority/Status/Due Date filter pills with counts and clear-all
6. **Canvas Editor** - React Flow with 4 node types, edges, zoom, minimap
7. **Rich Text Pages** - BlockNote editor with autosave
8. **Process Workflows** - Steps view + flowchart view
9. **Todo Lists** - Drag-and-drop, due dates, notes
10. **Reminders** - Time-based with snooze and repeat rules
11. **Element Linking** - 5 relationship types between any elements
12. **Dashboard Widgets** - Configurable grid (recent, favorites, project summary, quick capture)
13. **Notifications** - Auto-generated from reminders/overdue tasks
14. **Appearance Preferences** - 4 fonts, 3 sizes, 7 accent colors, 5 border radii
15. **Gantt Hover Tooltip** - Configurable fields (status/priority/dates/completion)
16. **Activity Logging** - 15+ action types tracked per element
17. **Data Export** - JSON/CSV for elements, tasks, or full backup
18. **File Attachments** - Upload/download on tasks (10MB limit)
19. **Command Palette** - Cmd+K global search and navigation
20. **Dark/Light Theme** - Full theme toggle with accent color support
