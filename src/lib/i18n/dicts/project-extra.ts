/**
 * Project "extra" views — calendar, gantt, and the overview dashboard.
 * User-facing labels, card titles/descriptions, chart legends, empty
 * states, tooltips, and confirm/prompt text live here. All keys are
 * prefixed "projx.". Date/number formatting stays on Intl/toLocale.
 */

export const en: Record<string, string> = {
  // ─── Shared view controls ───────────────────────────────────────────────
  "projx.today": "Today",

  // ─── Calendar view ──────────────────────────────────────────────────────
  "projx.calendar.day.sun": "Sun",
  "projx.calendar.day.mon": "Mon",
  "projx.calendar.day.tue": "Tue",
  "projx.calendar.day.wed": "Wed",
  "projx.calendar.day.thu": "Thu",
  "projx.calendar.day.fri": "Fri",
  "projx.calendar.day.sat": "Sat",
  "projx.calendar.more": "+{n} more",
  "projx.calendar.unscheduled": "Unscheduled",
  "projx.calendar.overdue": "Overdue",

  // ─── Gantt view ─────────────────────────────────────────────────────────
  "projx.gantt.zoom.day": "Day",
  "projx.gantt.zoom.week": "Week",
  "projx.gantt.zoom.month": "Month",
  "projx.gantt.col.name": "Name",
  "projx.gantt.col.dueDate": "Due Date",
  "projx.gantt.addTask": "Add Task",
  "projx.gantt.taskName.ph": "Task name...",
  "projx.gantt.clickToSchedule": "Click to schedule",
  "projx.gantt.collapse": "Collapse",
  "projx.gantt.expand": "Expand",
  // Context menu
  "projx.gantt.menu.open": "Open",
  "projx.gantt.menu.rename": "Rename",
  "projx.gantt.menu.unschedule": "Unschedule",
  "projx.gantt.menu.duplicate": "Duplicate",
  "projx.gantt.menu.delete": "Delete",
  "projx.gantt.renamePrompt": "Rename task:",
  "projx.gantt.copySuffix": "{title} (copy)",
  // Tooltip
  "projx.gantt.tooltip.completed": "Completed",
  "projx.gantt.tooltip.inProgress": "In progress",

  // ─── Overview view ──────────────────────────────────────────────────────
  "projx.overview.addCard": "Card",
  "projx.overview.empty.title": "No cards added yet",
  "projx.overview.empty.hint": "Click the “Card” button to add widgets",

  // Card context menu
  "projx.overview.size.1col": "1 Column",
  "projx.overview.size.2col": "2 Columns",
  "projx.overview.size.3col": "3 Columns",
  "projx.overview.size.full": "Full Width",
  "projx.overview.removeColor": "Remove Color",
  "projx.overview.moveUp": "Move Up",
  "projx.overview.moveDown": "Move Down",
  "projx.overview.resetSize": "Reset Size",
  "projx.overview.removeCard": "Remove Card",

  // Card colors
  "projx.overview.color.red": "Red",
  "projx.overview.color.orange": "Orange",
  "projx.overview.color.yellow": "Yellow",
  "projx.overview.color.green": "Green",
  "projx.overview.color.blue": "Blue",
  "projx.overview.color.purple": "Purple",
  "projx.overview.color.pink": "Pink",
  "projx.overview.color.cyan": "Cyan",

  // Card picker
  "projx.overview.picker.title": "Add Card",
  "projx.overview.picker.search.ph": "Search cards...",
  "projx.overview.picker.added": "Added",
  "projx.overview.picker.empty": "No cards found",

  // Card categories
  "projx.overview.cat.overview": "Overview",
  "projx.overview.cat.statuses": "Statuses",
  "projx.overview.cat.priorities": "Priorities",
  "projx.overview.cat.tasks": "Tasks",
  "projx.overview.cat.tables": "Tables",
  "projx.overview.cat.charts": "Charts",
  "projx.overview.cat.embeds": "Embeds",

  // Card titles
  "projx.card.progress.title": "Progress",
  "projx.card.notes.title": "Notes",
  "projx.card.workload.title": "Workload by Status",
  "projx.card.status_pie.title": "Tasks by Status",
  "projx.card.total_tasks.title": "Total Tasks",
  "projx.card.completed_tasks.title": "Completed Tasks",
  "projx.card.incomplete_tasks.title": "Incomplete Tasks",
  "projx.card.priority_bar.title": "Priority Breakdown",
  "projx.card.priority_pie.title": "Priority Distribution",
  "projx.card.urgent_tasks.title": "Total Urgent Tasks",
  "projx.card.high_tasks.title": "Total High Tasks",
  "projx.card.priority_list.title": "Priority Tasks",
  "projx.card.task_list.title": "Task List",
  "projx.card.recent.title": "Recent Tasks",
  "projx.card.overdue.title": "Overdue Tasks",
  "projx.card.status_table.title": "Tasks by Status",
  "projx.card.priority_table.title": "Tasks by Priority",
  "projx.card.line_chart.title": "Tasks Over Time",
  "projx.card.burndown.title": "Burndown Chart",
  "projx.card.battery.title": "Battery Chart",
  "projx.card.cumulative_flow.title": "Cumulative Flow",
  "projx.card.embed.title": "Custom Embed",

  // Card descriptions
  "projx.card.progress.desc": "Task completion overview with status breakdown",
  "projx.card.notes.desc": "Project notes and description",
  "projx.card.workload.desc": "Task count per status as horizontal bars",
  "projx.card.status_pie.desc": "Pie chart of task distribution by status",
  "projx.card.total_tasks.desc": "Total number of tasks in this project",
  "projx.card.completed_tasks.desc": "Number of completed tasks",
  "projx.card.incomplete_tasks.desc": "Number of tasks not yet completed",
  "projx.card.priority_bar.desc": "Task count per priority as bar chart",
  "projx.card.priority_pie.desc": "Pie chart of tasks by priority",
  "projx.card.urgent_tasks.desc": "Number of urgent priority tasks",
  "projx.card.high_tasks.desc": "Number of high priority tasks",
  "projx.card.priority_list.desc": "List of urgent and high priority tasks",
  "projx.card.task_list.desc": "All tasks at a glance",
  "projx.card.recent.desc": "Recently updated tasks",
  "projx.card.overdue.desc": "Tasks past their due date",
  "projx.card.status_table.desc": "Table of task counts grouped by status",
  "projx.card.priority_table.desc": "Table of task counts grouped by priority",
  "projx.card.line_chart.desc": "Line chart of cumulative tasks created over time",
  "projx.card.burndown.desc": "Track remaining tasks toward completion",
  "projx.card.battery.desc": "Status completion as battery-style fill bars",
  "projx.card.cumulative_flow.desc": "Stacked area showing status distribution over time",
  "projx.card.embed.desc": "Embed any URL or website via iframe",

  // Priority labels (this view reads "none" as "No Priority")
  "projx.priority.urgent": "Urgent",
  "projx.priority.high": "High",
  "projx.priority.medium": "Medium",
  "projx.priority.low": "Low",
  "projx.priority.none": "No Priority",

  // Mini-preview labels
  "projx.preview.totalTasks": "Total Tasks",
  "projx.preview.completed": "Completed",
  "projx.preview.incomplete": "Incomplete",
  "projx.preview.urgentTasks": "Urgent Tasks",
  "projx.preview.highTasks": "High Tasks",
  "projx.preview.pasteUrl": "Paste URL",

  // Big-number labels
  "projx.num.totalTasks": "Total Tasks",
  "projx.num.completedTasks": "Completed Tasks",
  "projx.num.incompleteTasks": "Incomplete Tasks",
  "projx.num.urgentTasks": "Urgent Tasks",
  "projx.num.highTasks": "High Tasks",

  // Empty states
  "projx.empty.noTasksYet": "No tasks yet",
  "projx.empty.noTasks": "No tasks",
  "projx.empty.noData": "No data",
  "projx.empty.noOverdue": "No overdue tasks",
  "projx.empty.noPriority": "No urgent or high priority tasks",

  // Progress card
  "projx.progress.complete": "{completed} / {total} tasks complete",

  // Pie chart center label
  "projx.pie.tasks": "tasks",

  // Table headers
  "projx.table.status": "Status",
  "projx.table.priority": "Priority",
  "projx.table.tasks": "Tasks",
  "projx.table.pct": "%",

  // Recent/overdue table headers
  "projx.tbl.name": "Name",
  "projx.tbl.status": "Status",
  "projx.tbl.updated": "Updated",
  "projx.tbl.due": "Due",

  // Burndown legend
  "projx.burndown.actual": "Actual",
  "projx.burndown.ideal": "Ideal",

  // Battery card
  "projx.battery.overallCompletion": "Overall Completion",

  // Notes card
  "projx.notes.ph": "Add notes about this project...",

  // Embed card
  "projx.embed.prompt": "Paste a URL to embed content (Google Docs, Sheets, Figma, YouTube, etc.)",
  "projx.embed.button": "Embed",
  "projx.embed.note": "Some websites block embedding for security. Google Docs, YouTube, Figma, and CodePen work best.",
  "projx.embed.iframeTitle": "Embedded content",
  "projx.embed.blocked": "This website may have blocked embedding. Many sites (including claude.ai) prevent being shown inside other pages for security.",
  "projx.embed.openNewTab": "Open in New Tab",
  "projx.embed.changeUrl": "Change URL",
  "projx.embed.openNewTab.title": "Open in new tab",
  "projx.embed.change": "Change",

  // Time-ago helper
  "projx.ago.justNow": "just now",
  "projx.ago.minutes": "{n}m ago",
  "projx.ago.hours": "{n}h ago",
  "projx.ago.days": "{n}d ago",
}

export const ar: Record<string, string> = {
  // ─── Shared view controls ───────────────────────────────────────────────
  "projx.today": "اليوم",

  // ─── Calendar view ──────────────────────────────────────────────────────
  "projx.calendar.day.sun": "الأحد",
  "projx.calendar.day.mon": "الإثنين",
  "projx.calendar.day.tue": "الثلاثاء",
  "projx.calendar.day.wed": "الأربعاء",
  "projx.calendar.day.thu": "الخميس",
  "projx.calendar.day.fri": "الجمعة",
  "projx.calendar.day.sat": "السبت",
  "projx.calendar.more": "+{n} أخرى",
  "projx.calendar.unscheduled": "غير مجدول",
  "projx.calendar.overdue": "متأخر",

  // ─── Gantt view ─────────────────────────────────────────────────────────
  "projx.gantt.zoom.day": "يوم",
  "projx.gantt.zoom.week": "أسبوع",
  "projx.gantt.zoom.month": "شهر",
  "projx.gantt.col.name": "الاسم",
  "projx.gantt.col.dueDate": "تاريخ الاستحقاق",
  "projx.gantt.addTask": "إضافة مهمة",
  "projx.gantt.taskName.ph": "اسم المهمة...",
  "projx.gantt.clickToSchedule": "انقر للجدولة",
  "projx.gantt.collapse": "طي",
  "projx.gantt.expand": "توسيع",
  // Context menu
  "projx.gantt.menu.open": "فتح",
  "projx.gantt.menu.rename": "إعادة تسمية",
  "projx.gantt.menu.unschedule": "إلغاء الجدولة",
  "projx.gantt.menu.duplicate": "تكرار",
  "projx.gantt.menu.delete": "حذف",
  "projx.gantt.renamePrompt": "إعادة تسمية المهمة:",
  "projx.gantt.copySuffix": "{title} (نسخة)",
  // Tooltip
  "projx.gantt.tooltip.completed": "مكتملة",
  "projx.gantt.tooltip.inProgress": "قيد التنفيذ",

  // ─── Overview view ──────────────────────────────────────────────────────
  "projx.overview.addCard": "بطاقة",
  "projx.overview.empty.title": "لم تُضَف أي بطاقات بعد",
  "projx.overview.empty.hint": "انقر زر “بطاقة” لإضافة عناصر",

  // Card context menu
  "projx.overview.size.1col": "عمود واحد",
  "projx.overview.size.2col": "عمودان",
  "projx.overview.size.3col": "ثلاثة أعمدة",
  "projx.overview.size.full": "العرض الكامل",
  "projx.overview.removeColor": "إزالة اللون",
  "projx.overview.moveUp": "تحريك لأعلى",
  "projx.overview.moveDown": "تحريك لأسفل",
  "projx.overview.resetSize": "إعادة تعيين الحجم",
  "projx.overview.removeCard": "إزالة البطاقة",

  // Card colors
  "projx.overview.color.red": "أحمر",
  "projx.overview.color.orange": "برتقالي",
  "projx.overview.color.yellow": "أصفر",
  "projx.overview.color.green": "أخضر",
  "projx.overview.color.blue": "أزرق",
  "projx.overview.color.purple": "بنفسجي",
  "projx.overview.color.pink": "وردي",
  "projx.overview.color.cyan": "سماوي",

  // Card picker
  "projx.overview.picker.title": "إضافة بطاقة",
  "projx.overview.picker.search.ph": "ابحث في البطاقات...",
  "projx.overview.picker.added": "مُضافة",
  "projx.overview.picker.empty": "لم يُعثر على بطاقات",

  // Card categories
  "projx.overview.cat.overview": "نظرة عامة",
  "projx.overview.cat.statuses": "الحالات",
  "projx.overview.cat.priorities": "الأولويات",
  "projx.overview.cat.tasks": "المهام",
  "projx.overview.cat.tables": "الجداول",
  "projx.overview.cat.charts": "الرسوم البيانية",
  "projx.overview.cat.embeds": "التضمينات",

  // Card titles
  "projx.card.progress.title": "التقدّم",
  "projx.card.notes.title": "الملاحظات",
  "projx.card.workload.title": "حجم العمل حسب الحالة",
  "projx.card.status_pie.title": "المهام حسب الحالة",
  "projx.card.total_tasks.title": "إجمالي المهام",
  "projx.card.completed_tasks.title": "المهام المكتملة",
  "projx.card.incomplete_tasks.title": "المهام غير المكتملة",
  "projx.card.priority_bar.title": "تفصيل الأولويات",
  "projx.card.priority_pie.title": "توزيع الأولويات",
  "projx.card.urgent_tasks.title": "إجمالي المهام العاجلة",
  "projx.card.high_tasks.title": "إجمالي المهام المرتفعة",
  "projx.card.priority_list.title": "المهام ذات الأولوية",
  "projx.card.task_list.title": "قائمة المهام",
  "projx.card.recent.title": "المهام الأخيرة",
  "projx.card.overdue.title": "المهام المتأخرة",
  "projx.card.status_table.title": "المهام حسب الحالة",
  "projx.card.priority_table.title": "المهام حسب الأولوية",
  "projx.card.line_chart.title": "المهام عبر الزمن",
  "projx.card.burndown.title": "مخطط الإنجاز",
  "projx.card.battery.title": "مخطط البطارية",
  "projx.card.cumulative_flow.title": "التدفّق التراكمي",
  "projx.card.embed.title": "تضمين مخصّص",

  // Card descriptions
  "projx.card.progress.desc": "نظرة عامة على إنجاز المهام مع تفصيل الحالات",
  "projx.card.notes.desc": "ملاحظات المشروع ووصفه",
  "projx.card.workload.desc": "عدد المهام لكل حالة كأشرطة أفقية",
  "projx.card.status_pie.desc": "مخطط دائري لتوزيع المهام حسب الحالة",
  "projx.card.total_tasks.desc": "العدد الإجمالي للمهام في هذا المشروع",
  "projx.card.completed_tasks.desc": "عدد المهام المكتملة",
  "projx.card.incomplete_tasks.desc": "عدد المهام التي لم تكتمل بعد",
  "projx.card.priority_bar.desc": "عدد المهام لكل أولوية كمخطط أعمدة",
  "projx.card.priority_pie.desc": "مخطط دائري للمهام حسب الأولوية",
  "projx.card.urgent_tasks.desc": "عدد المهام ذات الأولوية العاجلة",
  "projx.card.high_tasks.desc": "عدد المهام ذات الأولوية المرتفعة",
  "projx.card.priority_list.desc": "قائمة بالمهام العاجلة والمرتفعة الأولوية",
  "projx.card.task_list.desc": "كل المهام في لمحة",
  "projx.card.recent.desc": "المهام المحدَّثة مؤخرًا",
  "projx.card.overdue.desc": "المهام التي تجاوزت تاريخ استحقاقها",
  "projx.card.status_table.desc": "جدول بأعداد المهام مجمّعة حسب الحالة",
  "projx.card.priority_table.desc": "جدول بأعداد المهام مجمّعة حسب الأولوية",
  "projx.card.line_chart.desc": "مخطط خطّي للمهام التراكمية المنشأة عبر الزمن",
  "projx.card.burndown.desc": "تتبّع المهام المتبقية نحو الإنجاز",
  "projx.card.battery.desc": "إنجاز الحالات كأشرطة تعبئة بنمط البطارية",
  "projx.card.cumulative_flow.desc": "مساحة متراكمة تُظهر توزيع الحالات عبر الزمن",
  "projx.card.embed.desc": "ضمّن أي رابط أو موقع عبر إطار iframe",

  // Priority labels (this view reads "none" as "No Priority")
  "projx.priority.urgent": "عاجلة",
  "projx.priority.high": "مرتفعة",
  "projx.priority.medium": "متوسطة",
  "projx.priority.low": "منخفضة",
  "projx.priority.none": "بلا أولوية",

  // Mini-preview labels
  "projx.preview.totalTasks": "إجمالي المهام",
  "projx.preview.completed": "مكتملة",
  "projx.preview.incomplete": "غير مكتملة",
  "projx.preview.urgentTasks": "مهام عاجلة",
  "projx.preview.highTasks": "مهام مرتفعة",
  "projx.preview.pasteUrl": "ألصق الرابط",

  // Big-number labels
  "projx.num.totalTasks": "إجمالي المهام",
  "projx.num.completedTasks": "المهام المكتملة",
  "projx.num.incompleteTasks": "المهام غير المكتملة",
  "projx.num.urgentTasks": "المهام العاجلة",
  "projx.num.highTasks": "المهام المرتفعة",

  // Empty states
  "projx.empty.noTasksYet": "لا توجد مهام بعد",
  "projx.empty.noTasks": "لا توجد مهام",
  "projx.empty.noData": "لا توجد بيانات",
  "projx.empty.noOverdue": "لا توجد مهام متأخرة",
  "projx.empty.noPriority": "لا توجد مهام عاجلة أو مرتفعة الأولوية",

  // Progress card
  "projx.progress.complete": "اكتملت {completed} من {total} مهمة",

  // Pie chart center label
  "projx.pie.tasks": "مهمة",

  // Table headers
  "projx.table.status": "الحالة",
  "projx.table.priority": "الأولوية",
  "projx.table.tasks": "المهام",
  "projx.table.pct": "٪",

  // Recent/overdue table headers
  "projx.tbl.name": "الاسم",
  "projx.tbl.status": "الحالة",
  "projx.tbl.updated": "آخر تحديث",
  "projx.tbl.due": "الاستحقاق",

  // Burndown legend
  "projx.burndown.actual": "الفعلي",
  "projx.burndown.ideal": "المثالي",

  // Battery card
  "projx.battery.overallCompletion": "نسبة الإنجاز الكلّية",

  // Notes card
  "projx.notes.ph": "أضف ملاحظات حول هذا المشروع...",

  // Embed card
  "projx.embed.prompt": "ألصق رابطًا لتضمين محتوى (مستندات Google، جداول البيانات، Figma، YouTube، إلخ.)",
  "projx.embed.button": "تضمين",
  "projx.embed.note": "تمنع بعض المواقع التضمين لأسباب أمنية. تعمل مستندات Google وYouTube وFigma وCodePen على أفضل وجه.",
  "projx.embed.iframeTitle": "محتوى مُضمَّن",
  "projx.embed.blocked": "قد يكون هذا الموقع قد منع التضمين. تمنع مواقع كثيرة (بما فيها claude.ai) عرضها داخل صفحات أخرى لأسباب أمنية.",
  "projx.embed.openNewTab": "فتح في تبويب جديد",
  "projx.embed.changeUrl": "تغيير الرابط",
  "projx.embed.openNewTab.title": "فتح في تبويب جديد",
  "projx.embed.change": "تغيير",

  // Time-ago helper
  "projx.ago.justNow": "الآن",
  "projx.ago.minutes": "قبل {n} د",
  "projx.ago.hours": "قبل {n} س",
  "projx.ago.days": "قبل {n} ي",
}
