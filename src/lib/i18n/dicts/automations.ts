/**
 * Strings for the Automations and Approvals views. All keys are prefixed
 * "auto.". Trigger / operator / action / status ENUM values stay in the logic;
 * only their human-readable display names live here.
 */

export const en: Record<string, string> = {
  // ─── Tabs / header ───────────────────────────────────────────────────
  "auto.tab.automations": "Automations",
  "auto.tab.history": "Run History",
  "auto.create": "Create Automation",

  // ─── Automations empty state ────────────────────────────────────────
  "auto.empty.title": "No automations yet",
  "auto.empty.desc": "Create one to automate repetitive workflows",

  // ─── Automation card ────────────────────────────────────────────────
  "auto.card.when": "When: {trigger}",
  "auto.card.conditions": "{count} conditions",
  "auto.card.actions": "{count} actions",
  "auto.card.runs": "{count} runs",
  "auto.card.edit": "Edit",
  "auto.card.activate": "Activate",
  "auto.card.deactivate": "Deactivate",
  "auto.card.delete": "Delete",

  // ─── Run history ────────────────────────────────────────────────────
  "auto.history.loading": "Loading run history...",
  "auto.history.empty": "No runs recorded yet",
  "auto.history.col.automation": "Automation",
  "auto.history.col.status": "Status",
  "auto.history.col.actions": "Actions",
  "auto.history.col.duration": "Duration",
  "auto.history.col.error": "Error",
  "auto.history.col.time": "Time",
  "auto.history.executed": "{count} executed",
  "auto.history.details": "Run details",
  "auto.history.status": "Status: ",
  "auto.history.actionsExecuted": "Actions executed: ",
  "auto.history.duration": "Duration: ",
  "auto.history.error": "Error: ",
  "auto.history.triggerData": "Trigger data: ",

  // ─── Relative time / never ──────────────────────────────────────────
  "auto.time.never": "Never",
  "auto.time.justNow": "Just now",
  "auto.time.minAgo": "{n}m ago",
  "auto.time.hrAgo": "{n}h ago",
  "auto.time.dayAgo": "{n}d ago",

  // ─── Trigger display names ──────────────────────────────────────────
  "auto.trigger.task_created": "Task Created",
  "auto.trigger.task_updated": "Task Updated",
  "auto.trigger.status_changed": "Status Changed",
  "auto.trigger.due_date_reached": "Due Date Reached",
  "auto.trigger.reminder_triggered": "Reminder Triggered",
  "auto.trigger.comment_added": "Comment Added",
  "auto.trigger.dependency_resolved": "Dependency Resolved",
  "auto.trigger.form_submitted": "Form Submitted",
  "auto.trigger.element_linked": "Element Linked",
  "auto.trigger.page_created": "Page Created",
  "auto.trigger.attachment_uploaded": "Attachment Uploaded",

  // ─── Action display names ───────────────────────────────────────────
  "auto.action.create_task": "Create Task",
  "auto.action.update_status": "Update Status",
  "auto.action.assign_user": "Assign User",
  "auto.action.add_label": "Add Label",
  "auto.action.post_notification": "Post Notification",
  "auto.action.create_reminder": "Create Reminder",
  "auto.action.update_priority": "Update Priority",
  "auto.action.add_comment": "Add Comment",
  "auto.action.duplicate_template": "Duplicate Template",

  // ─── Operator display names ─────────────────────────────────────────
  "auto.operator.equals": "Equals",
  "auto.operator.not_equals": "Not Equals",
  "auto.operator.contains": "Contains",
  "auto.operator.not_contains": "Not Contains",
  "auto.operator.greater_than": "Greater Than",
  "auto.operator.less_than": "Less Than",
  "auto.operator.is_empty": "Is Empty",
  "auto.operator.is_not_empty": "Is Not Empty",

  // ─── Condition field display names ───────────────────────────────────
  "auto.field.title": "Title",
  "auto.field.description": "Description",
  "auto.field.status": "Status",
  "auto.field.priority": "Priority",
  "auto.field.assignee": "Assignee",
  "auto.field.project": "Project",
  "auto.field.label": "Label",
  "auto.field.dueDate": "Due Date",

  // ─── Run status display names ───────────────────────────────────────
  "auto.status.success": "Success",
  "auto.status.failure": "Failure",
  "auto.status.skipped": "Skipped",

  // ─── Prebuilt templates ─────────────────────────────────────────────
  "auto.tpl.high-priority-alert.name": "Alert on high-priority tasks",
  "auto.tpl.high-priority-alert.desc": "Notify me whenever a new high-priority task is created.",
  "auto.tpl.high-priority-alert.notifTitle": "High-priority task created",
  "auto.tpl.high-priority-alert.notifMsg": "A new high-priority task was just added.",
  "auto.tpl.bug-flag.name": "Flag bugs from the title",
  "auto.tpl.bug-flag.desc": "When a task title mentions \"bug\", raise a notification.",
  "auto.tpl.bug-flag.notifTitle": "Possible bug reported",
  "auto.tpl.bug-flag.notifMsg": "A task mentioning 'bug' was created — triage it.",
  "auto.tpl.celebrate-done.name": "Celebrate completed work",
  "auto.tpl.celebrate-done.desc": "Post a notification when a task is moved to Done.",
  "auto.tpl.celebrate-done.notifTitle": "Task completed 🎉",
  "auto.tpl.celebrate-done.notifMsg": "A task just moved to Done. Nice work!",
  "auto.tpl.due-date-nudge.name": "Due-date reminder",
  "auto.tpl.due-date-nudge.desc": "Get a heads-up the moment a task hits its due date.",
  "auto.tpl.due-date-nudge.notifTitle": "Task is due",
  "auto.tpl.due-date-nudge.notifMsg": "A task has reached its due date.",
  "auto.tpl.form-to-task.name": "Form submission → follow-up task",
  "auto.tpl.form-to-task.desc": "Create a follow-up task whenever a form is submitted.",
  "auto.tpl.form-to-task.taskTitle": "Follow up on new form submission",
  "auto.tpl.dependency-unblocked.name": "Notify when unblocked",
  "auto.tpl.dependency-unblocked.desc": "Tell me when a blocking dependency is resolved.",
  "auto.tpl.dependency-unblocked.notifTitle": "Task unblocked",
  "auto.tpl.dependency-unblocked.notifMsg": "A blocking dependency was just resolved.",

  // ─── Toasts ─────────────────────────────────────────────────────────
  "auto.toast.nameRequired": "Name is required",
  "auto.toast.updated": "Automation updated",
  "auto.toast.created": "Automation created",
  "auto.toast.saveFailed": "Failed to save automation",
  "auto.toast.deleted": "Automation deleted",
  "auto.toast.deleteFailed": "Failed to delete automation",
  "auto.toast.toggleFailed": "Failed to toggle automation",
  "auto.toast.runsFailed": "Failed to load run history",

  // ─── Action config placeholders ─────────────────────────────────────
  "auto.ph.taskTitle": "Task title",
  "auto.ph.statusId": "Status ID",
  "auto.ph.assigneeId": "Assignee ID",
  "auto.ph.notifTitle": "Notification title",
  "auto.ph.notifMessage": "Notification message",

  // ─── Builder dialog ─────────────────────────────────────────────────
  "auto.builder.editTitle": "Edit Automation",
  "auto.builder.createTitle": "Create Automation",
  "auto.builder.editDesc": "Update the automation settings below.",
  "auto.builder.createDesc": "Set up a trigger, conditions, and actions for your automation.",
  "auto.builder.templateLabel": "Start from a template",
  "auto.builder.templateHint": "Picking a template fills in the form below — tweak anything before you create it.",
  "auto.builder.name": "Name",
  "auto.builder.namePh": "My automation",
  "auto.builder.description": "Description",
  "auto.builder.descriptionPh": "Optional description...",
  "auto.builder.trigger": "Trigger",
  "auto.builder.projectScope": "Project scope (optional)",
  "auto.builder.projectScopePh": "Project ID or leave blank for all projects",
  "auto.builder.conditions": "Conditions",
  "auto.builder.gate.and": "AND",
  "auto.builder.gate.or": "OR",
  "auto.builder.conditionValuePh": "Value",
  "auto.builder.addCondition": "Add condition",
  "auto.builder.actions": "Actions",
  "auto.builder.addAction": "Add action",
  "auto.builder.cancel": "Cancel",
  "auto.builder.saving": "Saving...",
  "auto.builder.update": "Update",
  "auto.builder.create": "Create",

  // ─── Approvals: status labels ───────────────────────────────────────
  "auto.approval.status.pending": "Pending",
  "auto.approval.status.approved": "Approved",
  "auto.approval.status.rejected": "Rejected",
  "auto.approval.status.changes_requested": "Changes Requested",

  // ─── Approvals: tabs ────────────────────────────────────────────────
  "auto.approval.tab.all": "All",
  "auto.approval.tab.pending": "Pending",
  "auto.approval.tab.approved": "Approved",
  "auto.approval.tab.rejected": "Rejected",

  // ─── Approvals: header / banner ─────────────────────────────────────
  "auto.approval.request": "Request Approval",
  "auto.approval.banner.one": "You have {count} pending approval to review.",
  "auto.approval.banner.many": "You have {count} pending approvals to review.",

  // ─── Approvals: empty state ─────────────────────────────────────────
  "auto.approval.empty.title": "No approvals found",
  "auto.approval.empty.desc": "Create an approval request to get started",

  // ─── Approvals: list item ───────────────────────────────────────────
  "auto.approval.from": "Approval from {name}",
  "auto.approval.resolved": " • Resolved {date}",
  "auto.approval.review": "Review",

  // ─── Approvals: resolve dialog ──────────────────────────────────────
  "auto.approval.reviewTitle": "Review Approval",
  "auto.approval.requestedBy": "Requested by {name}",
  "auto.approval.commentOptional": "Comment (optional)",
  "auto.approval.commentPh": "Add a comment...",
  "auto.approval.requestChanges": "Request Changes",
  "auto.approval.reject": "Reject",
  "auto.approval.approve": "Approve",

  // ─── Approvals: create dialog ───────────────────────────────────────
  "auto.approval.assignTo": "Assign to",
  "auto.approval.selectUser": "Select a user...",
  "auto.approval.comment": "Comment",
  "auto.approval.createCommentPh": "Describe what needs approval...",
  "auto.approval.cancel": "Cancel",
  "auto.approval.sendRequest": "Send Request",

  // ─── Approvals: toasts ──────────────────────────────────────────────
  "auto.approval.toast.resolved": "Approval {status}",
  "auto.approval.toast.selectAssignee": "Select an assignee",
  "auto.approval.toast.created": "Approval request created",
  "auto.approval.toast.createFailed": "Failed to create approval",
  "auto.approval.toast.resolveFailed": "Failed to resolve approval",
  "auto.approval.toast.deleted": "Approval deleted",
  "auto.approval.toast.deleteFailed": "Failed to delete",

  // ─── Approvals: resolved-status words (for toast interpolation) ──────
  "auto.approval.resolvedStatus.approved": "approved",
  "auto.approval.resolvedStatus.rejected": "rejected",
  "auto.approval.resolvedStatus.changes_requested": "changes requested",
}

export const ar: Record<string, string> = {
  // ─── Tabs / header ───────────────────────────────────────────────────
  "auto.tab.automations": "الأتمتة",
  "auto.tab.history": "سجل التشغيل",
  "auto.create": "إنشاء أتمتة",

  // ─── Automations empty state ────────────────────────────────────────
  "auto.empty.title": "لا توجد أتمتة بعد",
  "auto.empty.desc": "أنشئ واحدة لأتمتة المهام المتكررة",

  // ─── Automation card ────────────────────────────────────────────────
  "auto.card.when": "عند: {trigger}",
  "auto.card.conditions": "{count} شروط",
  "auto.card.actions": "{count} إجراءات",
  "auto.card.runs": "{count} عملية تشغيل",
  "auto.card.edit": "تعديل",
  "auto.card.activate": "تفعيل",
  "auto.card.deactivate": "إيقاف",
  "auto.card.delete": "حذف",

  // ─── Run history ────────────────────────────────────────────────────
  "auto.history.loading": "جارٍ تحميل سجل التشغيل...",
  "auto.history.empty": "لم تُسجَّل أي عمليات تشغيل بعد",
  "auto.history.col.automation": "الأتمتة",
  "auto.history.col.status": "الحالة",
  "auto.history.col.actions": "الإجراءات",
  "auto.history.col.duration": "المدة",
  "auto.history.col.error": "الخطأ",
  "auto.history.col.time": "الوقت",
  "auto.history.executed": "نُفِّذ {count}",
  "auto.history.details": "تفاصيل التشغيل",
  "auto.history.status": "الحالة: ",
  "auto.history.actionsExecuted": "الإجراءات المنفَّذة: ",
  "auto.history.duration": "المدة: ",
  "auto.history.error": "الخطأ: ",
  "auto.history.triggerData": "بيانات المُشغِّل: ",

  // ─── Relative time / never ──────────────────────────────────────────
  "auto.time.never": "أبدًا",
  "auto.time.justNow": "الآن",
  "auto.time.minAgo": "قبل {n} د",
  "auto.time.hrAgo": "قبل {n} س",
  "auto.time.dayAgo": "قبل {n} ي",

  // ─── Trigger display names ──────────────────────────────────────────
  "auto.trigger.task_created": "إنشاء مهمة",
  "auto.trigger.task_updated": "تحديث مهمة",
  "auto.trigger.status_changed": "تغيُّر الحالة",
  "auto.trigger.due_date_reached": "بلوغ تاريخ الاستحقاق",
  "auto.trigger.reminder_triggered": "تشغيل تذكير",
  "auto.trigger.comment_added": "إضافة تعليق",
  "auto.trigger.dependency_resolved": "حل التبعية",
  "auto.trigger.form_submitted": "إرسال نموذج",
  "auto.trigger.element_linked": "ربط عنصر",
  "auto.trigger.page_created": "إنشاء صفحة",
  "auto.trigger.attachment_uploaded": "رفع مرفق",

  // ─── Action display names ───────────────────────────────────────────
  "auto.action.create_task": "إنشاء مهمة",
  "auto.action.update_status": "تحديث الحالة",
  "auto.action.assign_user": "تعيين مستخدم",
  "auto.action.add_label": "إضافة وسم",
  "auto.action.post_notification": "نشر إشعار",
  "auto.action.create_reminder": "إنشاء تذكير",
  "auto.action.update_priority": "تحديث الأولوية",
  "auto.action.add_comment": "إضافة تعليق",
  "auto.action.duplicate_template": "تكرار قالب",

  // ─── Operator display names ─────────────────────────────────────────
  "auto.operator.equals": "يساوي",
  "auto.operator.not_equals": "لا يساوي",
  "auto.operator.contains": "يحتوي على",
  "auto.operator.not_contains": "لا يحتوي على",
  "auto.operator.greater_than": "أكبر من",
  "auto.operator.less_than": "أصغر من",
  "auto.operator.is_empty": "فارغ",
  "auto.operator.is_not_empty": "غير فارغ",

  // ─── Condition field display names ───────────────────────────────────
  "auto.field.title": "العنوان",
  "auto.field.description": "الوصف",
  "auto.field.status": "الحالة",
  "auto.field.priority": "الأولوية",
  "auto.field.assignee": "المُكلَّف",
  "auto.field.project": "المشروع",
  "auto.field.label": "الوسم",
  "auto.field.dueDate": "تاريخ الاستحقاق",

  // ─── Run status display names ───────────────────────────────────────
  "auto.status.success": "نجاح",
  "auto.status.failure": "فشل",
  "auto.status.skipped": "تم التخطي",

  // ─── Prebuilt templates ─────────────────────────────────────────────
  "auto.tpl.high-priority-alert.name": "تنبيه عند المهام عالية الأولوية",
  "auto.tpl.high-priority-alert.desc": "نبّهني عند إنشاء أي مهمة جديدة عالية الأولوية.",
  "auto.tpl.high-priority-alert.notifTitle": "تم إنشاء مهمة عالية الأولوية",
  "auto.tpl.high-priority-alert.notifMsg": "تمت إضافة مهمة جديدة عالية الأولوية للتو.",
  "auto.tpl.bug-flag.name": "وسم العلل من العنوان",
  "auto.tpl.bug-flag.desc": "عندما يذكر عنوان مهمة كلمة \"bug\"، أصدر إشعارًا.",
  "auto.tpl.bug-flag.notifTitle": "علة محتملة تم الإبلاغ عنها",
  "auto.tpl.bug-flag.notifMsg": "تم إنشاء مهمة تذكر 'bug' — راجِعها.",
  "auto.tpl.celebrate-done.name": "احتفِ بالعمل المنجز",
  "auto.tpl.celebrate-done.desc": "انشر إشعارًا عند نقل مهمة إلى \"منجز\".",
  "auto.tpl.celebrate-done.notifTitle": "اكتملت المهمة 🎉",
  "auto.tpl.celebrate-done.notifMsg": "انتقلت مهمة للتو إلى \"منجز\". عمل رائع!",
  "auto.tpl.due-date-nudge.name": "تذكير بتاريخ الاستحقاق",
  "auto.tpl.due-date-nudge.desc": "احصل على تنبيه فور بلوغ المهمة تاريخ استحقاقها.",
  "auto.tpl.due-date-nudge.notifTitle": "المهمة مستحقة",
  "auto.tpl.due-date-nudge.notifMsg": "بلغت مهمة تاريخ استحقاقها.",
  "auto.tpl.form-to-task.name": "إرسال نموذج ← مهمة متابعة",
  "auto.tpl.form-to-task.desc": "أنشئ مهمة متابعة عند إرسال أي نموذج.",
  "auto.tpl.form-to-task.taskTitle": "متابعة إرسال نموذج جديد",
  "auto.tpl.dependency-unblocked.name": "أبلِغني عند رفع الحظر",
  "auto.tpl.dependency-unblocked.desc": "أخبرني عند حل تبعية مُعيقة.",
  "auto.tpl.dependency-unblocked.notifTitle": "تم رفع الحظر عن المهمة",
  "auto.tpl.dependency-unblocked.notifMsg": "تم حل تبعية مُعيقة للتو.",

  // ─── Toasts ─────────────────────────────────────────────────────────
  "auto.toast.nameRequired": "الاسم مطلوب",
  "auto.toast.updated": "تم تحديث الأتمتة",
  "auto.toast.created": "تم إنشاء الأتمتة",
  "auto.toast.saveFailed": "تعذر حفظ الأتمتة",
  "auto.toast.deleted": "تم حذف الأتمتة",
  "auto.toast.deleteFailed": "تعذر حذف الأتمتة",
  "auto.toast.toggleFailed": "تعذر تبديل حالة الأتمتة",
  "auto.toast.runsFailed": "تعذر تحميل سجل التشغيل",

  // ─── Action config placeholders ─────────────────────────────────────
  "auto.ph.taskTitle": "عنوان المهمة",
  "auto.ph.statusId": "معرّف الحالة",
  "auto.ph.assigneeId": "معرّف المُكلَّف",
  "auto.ph.notifTitle": "عنوان الإشعار",
  "auto.ph.notifMessage": "نص الإشعار",

  // ─── Builder dialog ─────────────────────────────────────────────────
  "auto.builder.editTitle": "تعديل الأتمتة",
  "auto.builder.createTitle": "إنشاء أتمتة",
  "auto.builder.editDesc": "حدّث إعدادات الأتمتة أدناه.",
  "auto.builder.createDesc": "اضبط مُشغِّلًا وشروطًا وإجراءات لأتمتتك.",
  "auto.builder.templateLabel": "ابدأ من قالب",
  "auto.builder.templateHint": "اختيار قالب يملأ النموذج أدناه — عدّل ما تشاء قبل إنشائه.",
  "auto.builder.name": "الاسم",
  "auto.builder.namePh": "أتمتتي",
  "auto.builder.description": "الوصف",
  "auto.builder.descriptionPh": "وصف اختياري...",
  "auto.builder.trigger": "المُشغِّل",
  "auto.builder.projectScope": "نطاق المشروع (اختياري)",
  "auto.builder.projectScopePh": "معرّف المشروع أو اتركه فارغًا لكل المشاريع",
  "auto.builder.conditions": "الشروط",
  "auto.builder.gate.and": "و",
  "auto.builder.gate.or": "أو",
  "auto.builder.conditionValuePh": "القيمة",
  "auto.builder.addCondition": "إضافة شرط",
  "auto.builder.actions": "الإجراءات",
  "auto.builder.addAction": "إضافة إجراء",
  "auto.builder.cancel": "إلغاء",
  "auto.builder.saving": "جارٍ الحفظ...",
  "auto.builder.update": "تحديث",
  "auto.builder.create": "إنشاء",

  // ─── Approvals: status labels ───────────────────────────────────────
  "auto.approval.status.pending": "قيد الانتظار",
  "auto.approval.status.approved": "تمت الموافقة",
  "auto.approval.status.rejected": "مرفوض",
  "auto.approval.status.changes_requested": "مطلوب تعديلات",

  // ─── Approvals: tabs ────────────────────────────────────────────────
  "auto.approval.tab.all": "الكل",
  "auto.approval.tab.pending": "قيد الانتظار",
  "auto.approval.tab.approved": "تمت الموافقة",
  "auto.approval.tab.rejected": "مرفوض",

  // ─── Approvals: header / banner ─────────────────────────────────────
  "auto.approval.request": "طلب موافقة",
  "auto.approval.banner.one": "لديك {count} موافقة قيد الانتظار للمراجعة.",
  "auto.approval.banner.many": "لديك {count} موافقات قيد الانتظار للمراجعة.",

  // ─── Approvals: empty state ─────────────────────────────────────────
  "auto.approval.empty.title": "لا توجد موافقات",
  "auto.approval.empty.desc": "أنشئ طلب موافقة للبدء",

  // ─── Approvals: list item ───────────────────────────────────────────
  "auto.approval.from": "موافقة من {name}",
  "auto.approval.resolved": " • تم الحل {date}",
  "auto.approval.review": "مراجعة",

  // ─── Approvals: resolve dialog ──────────────────────────────────────
  "auto.approval.reviewTitle": "مراجعة الموافقة",
  "auto.approval.requestedBy": "طلبها {name}",
  "auto.approval.commentOptional": "تعليق (اختياري)",
  "auto.approval.commentPh": "أضف تعليقًا...",
  "auto.approval.requestChanges": "طلب تعديلات",
  "auto.approval.reject": "رفض",
  "auto.approval.approve": "موافقة",

  // ─── Approvals: create dialog ───────────────────────────────────────
  "auto.approval.assignTo": "تعيين إلى",
  "auto.approval.selectUser": "اختر مستخدمًا...",
  "auto.approval.comment": "تعليق",
  "auto.approval.createCommentPh": "صِف ما يحتاج إلى موافقة...",
  "auto.approval.cancel": "إلغاء",
  "auto.approval.sendRequest": "إرسال الطلب",

  // ─── Approvals: toasts ──────────────────────────────────────────────
  "auto.approval.toast.resolved": "الموافقة {status}",
  "auto.approval.toast.selectAssignee": "اختر مُكلَّفًا",
  "auto.approval.toast.created": "تم إنشاء طلب الموافقة",
  "auto.approval.toast.createFailed": "تعذر إنشاء الموافقة",
  "auto.approval.toast.resolveFailed": "تعذر حل الموافقة",
  "auto.approval.toast.deleted": "تم حذف الموافقة",
  "auto.approval.toast.deleteFailed": "تعذر الحذف",

  // ─── Approvals: resolved-status words (for toast interpolation) ──────
  "auto.approval.resolvedStatus.approved": "تمت الموافقة عليها",
  "auto.approval.resolvedStatus.rejected": "رُفضت",
  "auto.approval.resolvedStatus.changes_requested": "طُلبت تعديلات",
}
