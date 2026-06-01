/**
 * Task detail strings — the task detail sheet, bulk-action bar, the small
 * meta popover on task cards, and the "send task as email" dialog. One module
 * per area keeps the dictionary maintainable. Each module exports `{ en, ar }`;
 * `strings.ts` merges them all.
 */

export const en: Record<string, string> = {
  // ── Task detail sheet: dialog chrome ──
  "task.sheet.editTask": "Edit Task",
  "task.sheet.editTaskDesc": "Edit task details",
  "task.sheet.taskAria": "Task: {title}",
  "task.sheet.titlePlaceholder": "Task title",
  "task.sheet.titleAria": "Task title",
  "task.sheet.untitled": "Untitled",

  // ── Subtasks (left sidebar) ──
  "task.subtasks.aria": "Subtasks",
  "task.subtasks.empty": "No subtasks",
  "task.subtasks.markIncomplete": "Mark incomplete",
  "task.subtasks.markComplete": "Mark complete",
  "task.subtasks.delete": "Delete subtask",
  "task.subtasks.namePlaceholder": "Subtask name...",
  "task.subtasks.dictate": "Dictate subtask",
  "task.subtasks.add": "Add Subtask",

  // ── Task actions menu ──
  "task.actions.aria": "Task actions",
  "task.actions.duplicate": "Duplicate task",
  "task.actions.copyId": "Copy task ID",
  "task.actions.copied": "Copied!",
  "task.actions.sendAsEmail": "Send as email…",
  "task.actions.delete": "Delete task",

  // ── Properties section ──
  "task.props.title": "Properties",
  "task.props.status": "Status",
  "task.props.priority": "Priority",
  "task.props.priorityNone": "None",
  "task.props.dates": "Dates",
  "task.props.startDate": "Start date",
  "task.props.dueDate": "Due date",
  "task.props.repeat": "Repeat",
  "task.props.repeatNeedsDue": "Set a due date so it can repeat",
  "task.props.tags": "Tags",
  "task.props.removeTag": "Remove tag {name}",
  "task.props.addTag": "Add tag",
  "task.props.createNewTag": "Create new tag",
  "task.props.tagNamePlaceholder": "Tag name",
  "task.props.create": "Create",

  // ── Time tracking section ──
  "task.time.title": "Time Tracking",
  "task.time.stopTimer": "Stop timer",
  "task.time.startTimer": "Start timer",
  "task.time.tracked": "{duration} tracked",
  "task.time.estimate": "Estimate:",
  "task.time.estimatePlaceholder": "min",
  "task.time.estimateAria": "Time estimate in minutes",
  "task.time.progress": "Progress",

  // ── Description section ──
  "task.desc.title": "Description",
  "task.desc.placeholder": "Add a detailed description...",
  "task.desc.aria": "Task description",
  "task.desc.readAloud": "Read description",
  "task.desc.dictate": "Dictate description",

  // ── Checklists section ──
  "task.checklists.title": "Checklists",
  "task.checklists.addItem": "Add item",
  "task.checklists.deleteChecklist": "Delete checklist",
  "task.checklists.markIncomplete": "Mark incomplete",
  "task.checklists.markComplete": "Mark complete",
  "task.checklists.deleteItem": "Delete item",
  "task.checklists.itemPlaceholder": "Item name...",
  "task.checklists.dictateItem": "Dictate item",
  "task.checklists.add": "Add",
  "task.checklists.namePlaceholder": "Checklist name...",
  "task.checklists.dictateName": "Dictate name",
  "task.checklists.cancel": "Cancel",
  "task.checklists.addChecklist": "Add checklist",

  // ── Attachments section ──
  "task.attachments.title": "Attachments",
  "task.attachments.download": "Download",
  "task.attachments.remove": "Remove attachment",
  "task.attachments.uploading": "Uploading...",
  "task.attachments.attachFile": "Attach file",

  // ── Right sidebar tabs ──
  "task.tabs.details": "Details",
  "task.tabs.comments": "Comments",

  // ── Dependencies (right sidebar) ──
  "task.deps.title": "Dependencies",
  "task.deps.unknown": "Unknown",
  "task.deps.remove": "Remove dependency",
  "task.deps.noTasks": "No tasks available",
  "task.deps.cancel": "Cancel",
  "task.deps.add": "Add dependency",

  // Dependency types
  "task.depType.blocks": "Blocks",
  "task.depType.blocked_by": "Blocked by",
  "task.depType.relates_to": "Relates to",

  // ── Info metadata ──
  "task.info.title": "Info",
  "task.info.created": "Created",
  "task.info.updated": "Updated",
  "task.info.completed": "Completed",
  "task.info.taskId": "Task ID",

  // ── Comments (right sidebar) ──
  "task.comments.empty": "No comments yet",
  "task.comments.delete": "Delete comment",
  "task.comments.placeholder": "Add a comment...",
  "task.comments.dictate": "Dictate comment",

  // ── Toasts ──
  "task.toast.fileAttached": "File attached",
  "task.toast.uploadFailed": "Upload failed",
  "task.toast.attachmentRemoved": "Attachment removed",
  "task.toast.attachmentRemoveFailed": "Failed to remove attachment",
  "task.toast.duplicated": "Task duplicated",
  "task.toast.idCopied": "Task ID copied",
  "task.toast.deleted": "Task deleted",

  // ── Bulk action bar ──
  "task.bulk.commentPlaceholder": "Comment on {n} task{s}…",
  "task.bulk.cancel": "Cancel",
  "task.bulk.emailToPlaceholder": "Email {n} task{s} to…",
  "task.bulk.notePlaceholder": "Note (optional)",
  "task.bulk.selected": "{n} selected",
  "task.bulk.comment": "Comment",
  "task.bulk.start": "Start",
  "task.bulk.stop": "Stop",
  "task.bulk.priority": "Priority",
  "task.bulk.move": "Move",
  "task.bulk.due": "Due",
  "task.bulk.dueToday": "Today",
  "task.bulk.dueTomorrow": "Tomorrow",
  "task.bulk.dueNextWeek": "Next week",
  "task.bulk.dueClear": "Clear",
  "task.bulk.label": "Label",
  "task.bulk.feed": "Feed",
  "task.bulk.email": "Email",
  "task.bulk.done": "Done",
  "task.bulk.exitSelect": "Exit select mode",
  // Bulk toasts
  "task.bulk.emailed": "Emailed {n} task{s} to {to}",
  "task.bulk.emailFailed": "Couldn't send the email",
  "task.bulk.actionFailed": "Bulk action failed",
  "task.bulk.commentAdded": "Comment added to {n} task{s}",
  "task.bulk.timerStarted": "Timer started on {n}",
  "task.bulk.timerStopped": "Timer stopped on {n}",
  "task.bulk.prioritySet": "Priority set on {n}",
  "task.bulk.movedTo": "Moved {n} to {status}",
  "task.bulk.dueSet": "Due date set on {n}",
  "task.bulk.dueCleared": "Due date cleared on {n}",
  "task.bulk.labelAdded": "Label added to {n}",
  "task.bulk.postedToFeed": "Posted {n} to feed",
  "task.bulk.completed": "Completed {n}",
  "task.bulk.deleted": "Deleted {n} task{s}",
  "task.bulk.undo": "Undo",
  "task.bulk.deleteFailed": "Bulk delete failed",

  // ── Task meta popover ──
  "task.meta.attachments": "Attachments",
  "task.meta.dependencies": "Dependencies",
  "task.meta.comments": "Comments",
  "task.meta.close": "Close",
  "task.meta.loading": "Loading…",
  "task.meta.empty": "Nothing here yet.",
  "task.meta.unknownTask": "Unknown task",

  // ── Send task email dialog ──
  "task.email.includeDescription": "Description",
  "task.email.includeDueDate": "Due date",
  "task.email.includeStatus": "Status",
  "task.email.includePriority": "Priority",
  "task.email.includeAppLink": "Link back to FlowSpace",
  "task.email.title": "Send task as email",
  "task.email.descPrefix": "Email someone a clean summary of",
  "task.email.descSuffix": "They'll see the details you choose below.",
  "task.email.notConfigured": "The server isn't set up to send email yet. Ask an admin to configure",
  "task.email.notConfiguredOr": "or Gmail SMTP credentials.",
  "task.email.recipient": "Recipient email",
  "task.email.recipientPlaceholder": "name@example.com",
  "task.email.note": "Add a note",
  "task.email.noteOptional": "(optional)",
  "task.email.notePlaceholder": "e.g. \"Quick reminder — can you take a look at this before Friday?\"",
  "task.email.whatToInclude": "What to include",
  "task.email.cancel": "Cancel",
  "task.email.sending": "Sending…",
  "task.email.send": "Send email",
  "task.email.sentTo": "Email sent to {to}",
  "task.email.sendFailed": "Couldn't send email",
}

export const ar: Record<string, string> = {
  // ── Task detail sheet: dialog chrome ──
  "task.sheet.editTask": "تعديل المهمة",
  "task.sheet.editTaskDesc": "تعديل تفاصيل المهمة",
  "task.sheet.taskAria": "المهمة: {title}",
  "task.sheet.titlePlaceholder": "عنوان المهمة",
  "task.sheet.titleAria": "عنوان المهمة",
  "task.sheet.untitled": "بلا عنوان",

  // ── Subtasks (left sidebar) ──
  "task.subtasks.aria": "المهام الفرعية",
  "task.subtasks.empty": "لا توجد مهام فرعية",
  "task.subtasks.markIncomplete": "وضع علامة كغير مكتملة",
  "task.subtasks.markComplete": "وضع علامة كمكتملة",
  "task.subtasks.delete": "حذف المهمة الفرعية",
  "task.subtasks.namePlaceholder": "اسم المهمة الفرعية...",
  "task.subtasks.dictate": "إملاء المهمة الفرعية",
  "task.subtasks.add": "إضافة مهمة فرعية",

  // ── Task actions menu ──
  "task.actions.aria": "إجراءات المهمة",
  "task.actions.duplicate": "تكرار المهمة",
  "task.actions.copyId": "نسخ معرّف المهمة",
  "task.actions.copied": "تم النسخ!",
  "task.actions.sendAsEmail": "إرسال كبريد إلكتروني…",
  "task.actions.delete": "حذف المهمة",

  // ── Properties section ──
  "task.props.title": "الخصائص",
  "task.props.status": "الحالة",
  "task.props.priority": "الأولوية",
  "task.props.priorityNone": "بلا",
  "task.props.dates": "التواريخ",
  "task.props.startDate": "تاريخ البدء",
  "task.props.dueDate": "تاريخ الاستحقاق",
  "task.props.repeat": "التكرار",
  "task.props.repeatNeedsDue": "حدّد تاريخ استحقاق حتى يتكرر",
  "task.props.tags": "الوسوم",
  "task.props.removeTag": "إزالة الوسم {name}",
  "task.props.addTag": "إضافة وسم",
  "task.props.createNewTag": "إنشاء وسم جديد",
  "task.props.tagNamePlaceholder": "اسم الوسم",
  "task.props.create": "إنشاء",

  // ── Time tracking section ──
  "task.time.title": "تتبّع الوقت",
  "task.time.stopTimer": "إيقاف المؤقّت",
  "task.time.startTimer": "بدء المؤقّت",
  "task.time.tracked": "تم تتبّع {duration}",
  "task.time.estimate": "التقدير:",
  "task.time.estimatePlaceholder": "دقيقة",
  "task.time.estimateAria": "تقدير الوقت بالدقائق",
  "task.time.progress": "التقدّم",

  // ── Description section ──
  "task.desc.title": "الوصف",
  "task.desc.placeholder": "أضف وصفًا مفصّلًا...",
  "task.desc.aria": "وصف المهمة",
  "task.desc.readAloud": "قراءة الوصف",
  "task.desc.dictate": "إملاء الوصف",

  // ── Checklists section ──
  "task.checklists.title": "قوائم التحقّق",
  "task.checklists.addItem": "إضافة عنصر",
  "task.checklists.deleteChecklist": "حذف قائمة التحقّق",
  "task.checklists.markIncomplete": "وضع علامة كغير مكتمل",
  "task.checklists.markComplete": "وضع علامة كمكتمل",
  "task.checklists.deleteItem": "حذف العنصر",
  "task.checklists.itemPlaceholder": "اسم العنصر...",
  "task.checklists.dictateItem": "إملاء العنصر",
  "task.checklists.add": "إضافة",
  "task.checklists.namePlaceholder": "اسم قائمة التحقّق...",
  "task.checklists.dictateName": "إملاء الاسم",
  "task.checklists.cancel": "إلغاء",
  "task.checklists.addChecklist": "إضافة قائمة تحقّق",

  // ── Attachments section ──
  "task.attachments.title": "المرفقات",
  "task.attachments.download": "تنزيل",
  "task.attachments.remove": "إزالة المرفق",
  "task.attachments.uploading": "جارٍ الرفع...",
  "task.attachments.attachFile": "إرفاق ملف",

  // ── Right sidebar tabs ──
  "task.tabs.details": "التفاصيل",
  "task.tabs.comments": "التعليقات",

  // ── Dependencies (right sidebar) ──
  "task.deps.title": "التبعيات",
  "task.deps.unknown": "غير معروف",
  "task.deps.remove": "إزالة التبعية",
  "task.deps.noTasks": "لا توجد مهام متاحة",
  "task.deps.cancel": "إلغاء",
  "task.deps.add": "إضافة تبعية",

  // Dependency types
  "task.depType.blocks": "يحجب",
  "task.depType.blocked_by": "محجوب بواسطة",
  "task.depType.relates_to": "مرتبط بـ",

  // ── Info metadata ──
  "task.info.title": "معلومات",
  "task.info.created": "تاريخ الإنشاء",
  "task.info.updated": "آخر تحديث",
  "task.info.completed": "تاريخ الإكمال",
  "task.info.taskId": "معرّف المهمة",

  // ── Comments (right sidebar) ──
  "task.comments.empty": "لا توجد تعليقات بعد",
  "task.comments.delete": "حذف التعليق",
  "task.comments.placeholder": "أضف تعليقًا...",
  "task.comments.dictate": "إملاء التعليق",

  // ── Toasts ──
  "task.toast.fileAttached": "تم إرفاق الملف",
  "task.toast.uploadFailed": "فشل الرفع",
  "task.toast.attachmentRemoved": "تمت إزالة المرفق",
  "task.toast.attachmentRemoveFailed": "تعذّرت إزالة المرفق",
  "task.toast.duplicated": "تم تكرار المهمة",
  "task.toast.idCopied": "تم نسخ معرّف المهمة",
  "task.toast.deleted": "تم حذف المهمة",

  // ── Bulk action bar ──
  "task.bulk.commentPlaceholder": "تعليق على {n} مهمة…",
  "task.bulk.cancel": "إلغاء",
  "task.bulk.emailToPlaceholder": "إرسال {n} مهمة عبر البريد إلى…",
  "task.bulk.notePlaceholder": "ملاحظة (اختياري)",
  "task.bulk.selected": "{n} محددة",
  "task.bulk.comment": "تعليق",
  "task.bulk.start": "بدء",
  "task.bulk.stop": "إيقاف",
  "task.bulk.priority": "الأولوية",
  "task.bulk.move": "نقل",
  "task.bulk.due": "الاستحقاق",
  "task.bulk.dueToday": "اليوم",
  "task.bulk.dueTomorrow": "غدًا",
  "task.bulk.dueNextWeek": "الأسبوع القادم",
  "task.bulk.dueClear": "مسح",
  "task.bulk.label": "وسم",
  "task.bulk.feed": "المستجدات",
  "task.bulk.email": "بريد إلكتروني",
  "task.bulk.done": "تم",
  "task.bulk.exitSelect": "الخروج من وضع التحديد",
  // Bulk toasts
  "task.bulk.emailed": "تم إرسال {n} مهمة إلى {to}",
  "task.bulk.emailFailed": "تعذّر إرسال البريد الإلكتروني",
  "task.bulk.actionFailed": "فشل الإجراء الجماعي",
  "task.bulk.commentAdded": "تمت إضافة تعليق إلى {n} مهمة",
  "task.bulk.timerStarted": "تم بدء المؤقّت على {n}",
  "task.bulk.timerStopped": "تم إيقاف المؤقّت على {n}",
  "task.bulk.prioritySet": "تم تعيين الأولوية على {n}",
  "task.bulk.movedTo": "تم نقل {n} إلى {status}",
  "task.bulk.dueSet": "تم تعيين تاريخ الاستحقاق على {n}",
  "task.bulk.dueCleared": "تم مسح تاريخ الاستحقاق على {n}",
  "task.bulk.labelAdded": "تمت إضافة وسم إلى {n}",
  "task.bulk.postedToFeed": "تم نشر {n} في المستجدات",
  "task.bulk.completed": "تم إكمال {n}",
  "task.bulk.deleted": "تم حذف {n} مهمة",
  "task.bulk.undo": "تراجع",
  "task.bulk.deleteFailed": "فشل الحذف الجماعي",

  // ── Task meta popover ──
  "task.meta.attachments": "المرفقات",
  "task.meta.dependencies": "التبعيات",
  "task.meta.comments": "التعليقات",
  "task.meta.close": "إغلاق",
  "task.meta.loading": "جارٍ التحميل…",
  "task.meta.empty": "لا شيء هنا بعد.",
  "task.meta.unknownTask": "مهمة غير معروفة",

  // ── Send task email dialog ──
  "task.email.includeDescription": "الوصف",
  "task.email.includeDueDate": "تاريخ الاستحقاق",
  "task.email.includeStatus": "الحالة",
  "task.email.includePriority": "الأولوية",
  "task.email.includeAppLink": "رابط للعودة إلى FlowSpace",
  "task.email.title": "إرسال المهمة كبريد إلكتروني",
  "task.email.descPrefix": "أرسِل لشخص ما ملخّصًا واضحًا لـ",
  "task.email.descSuffix": "سيرى التفاصيل التي تختارها أدناه.",
  "task.email.notConfigured": "الخادم غير مُهيّأ لإرسال البريد الإلكتروني بعد. اطلب من المسؤول ضبط",
  "task.email.notConfiguredOr": "أو بيانات اعتماد Gmail SMTP.",
  "task.email.recipient": "بريد المستلم",
  "task.email.recipientPlaceholder": "name@example.com",
  "task.email.note": "أضف ملاحظة",
  "task.email.noteOptional": "(اختياري)",
  "task.email.notePlaceholder": "مثال: \"تذكير سريع — هل يمكنك إلقاء نظرة على هذا قبل الجمعة؟\"",
  "task.email.whatToInclude": "ما الذي تريد تضمينه",
  "task.email.cancel": "إلغاء",
  "task.email.sending": "جارٍ الإرسال…",
  "task.email.send": "إرسال البريد",
  "task.email.sentTo": "تم إرسال البريد إلى {to}",
  "task.email.sendFailed": "تعذّر إرسال البريد",
}
