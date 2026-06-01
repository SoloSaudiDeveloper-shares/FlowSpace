export const en: Record<string, string> = {
  // View tab labels
  "proj.view.overview": "Overview",
  "proj.view.list": "List",
  "proj.view.board": "Board",
  "proj.view.calendar": "Calendar",
  "proj.view.gantt": "Gantt",
  "proj.view.table": "Table",

  // Toolbar / aria
  "proj.toolbar.projectViews": "Project views",
  "proj.toolbar.selectMultiple": "Select multiple tasks",
  "proj.toolbar.done": "Done",
  "proj.toolbar.select": "Select",
  "proj.toolbar.deselectAll": "Deselect all",
  "proj.toolbar.selectAllVisible": "Select all visible tasks",
  "proj.toolbar.none": "None",
  "proj.toolbar.all": "All",
  "proj.toolbar.filter": "Filter",
  "proj.toolbar.views": "Views",
  "proj.toolbar.sort": "Sort",
  "proj.toolbar.fields": "Fields",

  // Fields menu
  "proj.field.priority": "Priority",
  "proj.field.dueDate": "Due Date",
  "proj.field.startDate": "Start Date",
  "proj.field.labels": "Labels",
  "proj.field.subtasks": "Subtasks",
  "proj.field.checklists": "Checklists",
  "proj.field.timeTracking": "Time Tracking",
  "proj.field.description": "Description",
  "proj.fields.visible": "Visible fields",

  // Saved views
  "proj.views.saved": "Saved views",
  "proj.views.empty": "No saved views yet.",
  "proj.views.delete": "Delete view",
  "proj.views.saveCurrent": "Save current as…",
  "proj.views.namePrompt": "Name this view (e.g. \"My week\", \"Overdue\"):",

  // Sort menu
  "proj.sort.by": "Sort by",
  "proj.sort.manual": "Default order",
  "proj.sort.title": "Title",
  "proj.sort.priority": "Priority",
  "proj.sort.dueDate": "Due Date",
  "proj.sort.createdAt": "Created",
  "proj.sort.updatedAt": "Updated",

  // Search + quick-add
  "proj.search.placeholder": "Search tasks in this project...",
  "proj.quickAdd.placeholder": "Quick add — e.g. \"Submit report fri #high\"",
  "proj.quickAdd.add": "Add",
  "proj.quickAdd.close": "Close (Esc)",

  // Filter bar
  "proj.filter.label": "Filters:",
  "proj.filter.priority": "Priority",
  "proj.filter.priorityWith": "Priority: {v}",
  "proj.filter.status": "Status",
  "proj.filter.statusWith": "Status: {v}",
  "proj.filter.due": "Due Date",
  "proj.filter.dueWith": "Due: {v}",
  "proj.filter.clearAll": "Clear all",
  "proj.filter.taskCount": "{n} task",
  "proj.filter.taskCountPlural": "{n} tasks",

  // Filter values
  "proj.val.all": "All",
  "proj.val.urgent": "Urgent",
  "proj.val.high": "High",
  "proj.val.medium": "Medium",
  "proj.val.low": "Low",
  "proj.val.none": "None",
  "proj.val.active": "Active",
  "proj.val.completed": "Completed",
  "proj.val.overdue": "Overdue",
  "proj.val.today": "Today",
  "proj.val.thisWeek": "This week",
  "proj.val.noDate": "No date",

  // List/Table column headers
  "proj.col.name": "Name",
  "proj.col.time": "Time",
  "proj.col.subs": "Subs",
  "proj.col.checks": "Checks",
  "proj.col.labels": "Labels",
  "proj.col.start": "Start",
  "proj.col.due": "Due",
  "proj.col.prio": "Prio",
  "proj.col.desc": "Desc",
  "proj.col.status": "Status",
  "proj.col.dueDate": "Due Date",
  "proj.col.priority": "Priority",

  // Row aria / affordances
  "proj.row.repeats": "Repeats",
  "proj.row.collapseSubtasks": "Collapse subtasks",
  "proj.row.expandSubtasks": "Expand subtasks",
  "proj.row.collapse": "Collapse",
  "proj.row.expand": "Expand",
  "proj.row.deselect": "Deselect",
  "proj.row.select": "Select",

  // Add task affordances
  "proj.addTask": "Add task",
  "proj.addTask.placeholder": "Task name…  (try \"fri #high\")",
  "proj.addTask.placeholderPlain": "Task name...",
  "proj.addTask.titlePlaceholder": "Task title…  (try \"fri #high\")",
  "proj.addTask.save": "Save",
  "proj.addTask.cancel": "Cancel",
  "proj.dictate": "Dictate task",

  // Context menu (list row)
  "proj.menu.open": "Open",
  "proj.menu.addComment": "Add comment",
  "proj.menu.stopTimer": "Stop timer",
  "proj.menu.startTimer": "Start timer",
  "proj.menu.priority": "Priority",
  "proj.menu.moveTo": "Move to",
  "proj.menu.dueDate": "Due date",
  "proj.menu.today": "Today",
  "proj.menu.tomorrow": "Tomorrow",
  "proj.menu.nextWeek": "Next week",
  "proj.menu.customDate": "Custom date…",
  "proj.menu.clearDueDate": "Clear due date",
  "proj.menu.markIncomplete": "Mark incomplete",
  "proj.menu.markComplete": "Mark complete",
  "proj.menu.deleteTask": "Delete task",

  // Context menu (card)
  "proj.menu.edit": "Edit",
  "proj.menu.markIncompleteCap": "Mark Incomplete",
  "proj.menu.markCompleteCap": "Mark Complete",
  "proj.menu.duplicate": "Duplicate",
  "proj.menu.delete": "Delete",

  // Board column menu
  "proj.board.addTask": "Add Task",
  "proj.board.rename": "Rename",
  "proj.board.renamePrompt": "Rename column to:",
  "proj.board.deleteColumn": "Delete Column",
  "proj.board.addColumn": "Add column",
  "proj.board.columnPlaceholder": "Column name...",
  "proj.board.add": "Add",
  "proj.board.cancel": "Cancel",

  // Toasts
  "proj.toast.taskDeleted": "Task deleted",
  "proj.toast.undo": "Undo",

  // Card badges / aria
  "proj.card.dragToReorder": "Drag to reorder",
  "proj.card.markIncomplete": "Mark incomplete",
  "proj.card.markComplete": "Mark complete",
  "proj.card.task": "Task: {title}",
  "proj.card.taskCompleted": "Task: {title} (completed)",
  "proj.card.priority": "Priority: {label}",
  "proj.card.hasDescription": "Has description",
  "proj.card.repeats": "Repeats",
  "proj.card.attachments": "Attachments",
  "proj.card.dependencies": "Dependencies",
  "proj.card.comments": "Comments",
}

export const ar: Record<string, string> = {
  // View tab labels
  "proj.view.overview": "نظرة عامة",
  "proj.view.list": "قائمة",
  "proj.view.board": "لوحة",
  "proj.view.calendar": "تقويم",
  "proj.view.gantt": "غانت",
  "proj.view.table": "جدول",

  // Toolbar / aria
  "proj.toolbar.projectViews": "عروض المشروع",
  "proj.toolbar.selectMultiple": "تحديد عدة مهام",
  "proj.toolbar.done": "تم",
  "proj.toolbar.select": "تحديد",
  "proj.toolbar.deselectAll": "إلغاء تحديد الكل",
  "proj.toolbar.selectAllVisible": "تحديد كل المهام الظاهرة",
  "proj.toolbar.none": "بلا",
  "proj.toolbar.all": "الكل",
  "proj.toolbar.filter": "تصفية",
  "proj.toolbar.views": "العروض",
  "proj.toolbar.sort": "ترتيب",
  "proj.toolbar.fields": "الحقول",

  // Fields menu
  "proj.field.priority": "الأولوية",
  "proj.field.dueDate": "تاريخ الاستحقاق",
  "proj.field.startDate": "تاريخ البدء",
  "proj.field.labels": "التسميات",
  "proj.field.subtasks": "المهام الفرعية",
  "proj.field.checklists": "قوائم التحقق",
  "proj.field.timeTracking": "تتبّع الوقت",
  "proj.field.description": "الوصف",
  "proj.fields.visible": "الحقول الظاهرة",

  // Saved views
  "proj.views.saved": "العروض المحفوظة",
  "proj.views.empty": "لا توجد عروض محفوظة بعد.",
  "proj.views.delete": "حذف العرض",
  "proj.views.saveCurrent": "حفظ الحالي باسم…",
  "proj.views.namePrompt": "اسم هذا العرض (مثل \"أسبوعي\"، \"المتأخرة\"):",

  // Sort menu
  "proj.sort.by": "الترتيب حسب",
  "proj.sort.manual": "الترتيب الافتراضي",
  "proj.sort.title": "العنوان",
  "proj.sort.priority": "الأولوية",
  "proj.sort.dueDate": "تاريخ الاستحقاق",
  "proj.sort.createdAt": "تاريخ الإنشاء",
  "proj.sort.updatedAt": "تاريخ التحديث",

  // Search + quick-add
  "proj.search.placeholder": "ابحث عن المهام في هذا المشروع...",
  "proj.quickAdd.placeholder": "إضافة سريعة — مثل \"تسليم التقرير الجمعة ‎#high\"",
  "proj.quickAdd.add": "إضافة",
  "proj.quickAdd.close": "إغلاق (Esc)",

  // Filter bar
  "proj.filter.label": "عوامل التصفية:",
  "proj.filter.priority": "الأولوية",
  "proj.filter.priorityWith": "الأولوية: {v}",
  "proj.filter.status": "الحالة",
  "proj.filter.statusWith": "الحالة: {v}",
  "proj.filter.due": "تاريخ الاستحقاق",
  "proj.filter.dueWith": "الاستحقاق: {v}",
  "proj.filter.clearAll": "مسح الكل",
  "proj.filter.taskCount": "{n} مهمة",
  "proj.filter.taskCountPlural": "{n} مهمة",

  // Filter values
  "proj.val.all": "الكل",
  "proj.val.urgent": "عاجلة",
  "proj.val.high": "عالية",
  "proj.val.medium": "متوسطة",
  "proj.val.low": "منخفضة",
  "proj.val.none": "بلا",
  "proj.val.active": "نشطة",
  "proj.val.completed": "مكتملة",
  "proj.val.overdue": "متأخرة",
  "proj.val.today": "اليوم",
  "proj.val.thisWeek": "هذا الأسبوع",
  "proj.val.noDate": "بلا تاريخ",

  // List/Table column headers
  "proj.col.name": "الاسم",
  "proj.col.time": "الوقت",
  "proj.col.subs": "فرعية",
  "proj.col.checks": "تحقق",
  "proj.col.labels": "التسميات",
  "proj.col.start": "البدء",
  "proj.col.due": "الاستحقاق",
  "proj.col.prio": "الأولوية",
  "proj.col.desc": "الوصف",
  "proj.col.status": "الحالة",
  "proj.col.dueDate": "تاريخ الاستحقاق",
  "proj.col.priority": "الأولوية",

  // Row aria / affordances
  "proj.row.repeats": "متكررة",
  "proj.row.collapseSubtasks": "طيّ المهام الفرعية",
  "proj.row.expandSubtasks": "توسيع المهام الفرعية",
  "proj.row.collapse": "طيّ",
  "proj.row.expand": "توسيع",
  "proj.row.deselect": "إلغاء التحديد",
  "proj.row.select": "تحديد",

  // Add task affordances
  "proj.addTask": "إضافة مهمة",
  "proj.addTask.placeholder": "اسم المهمة…  (جرّب \"fri #high\")",
  "proj.addTask.placeholderPlain": "اسم المهمة...",
  "proj.addTask.titlePlaceholder": "عنوان المهمة…  (جرّب \"fri #high\")",
  "proj.addTask.save": "حفظ",
  "proj.addTask.cancel": "إلغاء",
  "proj.dictate": "إملاء المهمة",

  // Context menu (list row)
  "proj.menu.open": "فتح",
  "proj.menu.addComment": "إضافة تعليق",
  "proj.menu.stopTimer": "إيقاف المؤقّت",
  "proj.menu.startTimer": "بدء المؤقّت",
  "proj.menu.priority": "الأولوية",
  "proj.menu.moveTo": "نقل إلى",
  "proj.menu.dueDate": "تاريخ الاستحقاق",
  "proj.menu.today": "اليوم",
  "proj.menu.tomorrow": "غدًا",
  "proj.menu.nextWeek": "الأسبوع القادم",
  "proj.menu.customDate": "تاريخ مخصّص…",
  "proj.menu.clearDueDate": "مسح تاريخ الاستحقاق",
  "proj.menu.markIncomplete": "تحديد كغير مكتملة",
  "proj.menu.markComplete": "تحديد كمكتملة",
  "proj.menu.deleteTask": "حذف المهمة",

  // Context menu (card)
  "proj.menu.edit": "تعديل",
  "proj.menu.markIncompleteCap": "تحديد كغير مكتملة",
  "proj.menu.markCompleteCap": "تحديد كمكتملة",
  "proj.menu.duplicate": "تكرار",
  "proj.menu.delete": "حذف",

  // Board column menu
  "proj.board.addTask": "إضافة مهمة",
  "proj.board.rename": "إعادة تسمية",
  "proj.board.renamePrompt": "إعادة تسمية العمود إلى:",
  "proj.board.deleteColumn": "حذف العمود",
  "proj.board.addColumn": "إضافة عمود",
  "proj.board.columnPlaceholder": "اسم العمود...",
  "proj.board.add": "إضافة",
  "proj.board.cancel": "إلغاء",

  // Toasts
  "proj.toast.taskDeleted": "تم حذف المهمة",
  "proj.toast.undo": "تراجع",

  // Card badges / aria
  "proj.card.dragToReorder": "اسحب لإعادة الترتيب",
  "proj.card.markIncomplete": "تحديد كغير مكتملة",
  "proj.card.markComplete": "تحديد كمكتملة",
  "proj.card.task": "مهمة: {title}",
  "proj.card.taskCompleted": "مهمة: {title} (مكتملة)",
  "proj.card.priority": "الأولوية: {label}",
  "proj.card.hasDescription": "تحتوي على وصف",
  "proj.card.repeats": "متكررة",
  "proj.card.attachments": "المرفقات",
  "proj.card.dependencies": "التبعيات",
  "proj.card.comments": "التعليقات",
}
