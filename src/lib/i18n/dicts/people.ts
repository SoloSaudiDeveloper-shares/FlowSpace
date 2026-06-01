/**
 * People & Teams page + Administration page strings.
 * Two prefixes share this module:
 *   - "people."  → src/components/people/people-content.tsx
 *   - "admin."   → src/components/admin/admin-content.tsx
 */

export const en: Record<string, string> = {
  // ─── People & Teams ──────────────────────────────────────────────
  // Tabs
  "people.tab.people": "People",
  "people.tab.teams": "Teams",

  // Header actions
  "people.inviteUser": "Invite User",
  "people.createTeam": "Create Team",

  // Empty states
  "people.empty.users": "No users yet. Invite someone to get started.",
  "people.empty.teams": "No teams yet. Create one to organize your workspace.",

  // User status
  "people.status.active": "Active",
  "people.status.inactive": "Inactive",

  // Role names
  "people.role.owner": "Owner",
  "people.role.admin": "Admin",
  "people.role.editor": "Editor",
  "people.role.commenter": "Commenter",
  "people.role.viewer": "Viewer",

  // Invite User modal
  "people.invite.title": "Invite User",
  "people.invite.username": "Username *",
  "people.invite.username.ph": "johndoe",
  "people.invite.displayName": "Display Name *",
  "people.invite.displayName.ph": "John Doe",
  "people.invite.email": "Email",
  "people.invite.email.ph": "john@example.com",
  "people.invite.password": "Password *",
  "people.invite.password.ph": "Enter a password",
  "people.invite.role": "Role",
  "people.invite.cancel": "Cancel",
  "people.invite.submit": "Create User",
  "people.invite.submitting": "Creating...",

  // Create Team modal
  "people.team.title": "Create Team",
  "people.team.name": "Team Name *",
  "people.team.name.ph": "Engineering",
  "people.team.description": "Description",
  "people.team.description.ph": "What does this team do?",
  "people.team.color": "Color",
  "people.team.cancel": "Cancel",
  "people.team.submit": "Create Team",
  "people.team.submitting": "Creating...",

  // Team card
  "people.team.memberCount": "{count} member",
  "people.team.memberCountPlural": "{count} members",
  "people.team.noMembers": "No members yet",
  "people.team.hide": "Hide",
  "people.team.manage": "Manage",
  "people.team.selectUser": "Select a user to add...",
  "people.team.add": "Add",
  "people.team.loadingMembers": "Loading members...",
  "people.team.emptyMembers": "No members in this team yet",

  // Toasts
  "people.toast.fieldsRequired": "Username, display name, and password are required",
  "people.toast.userCreated": "User created successfully",
  "people.toast.userCreateFailed": "Failed to create user",
  "people.toast.teamNameRequired": "Team name is required",
  "people.toast.teamCreated": "Team created successfully",
  "people.toast.teamCreateFailed": "Failed to create team",
  "people.toast.membersLoadFailed": "Failed to load team members",
  "people.toast.memberAdded": "Member added",
  "people.toast.memberAddFailed": "Failed to add member",
  "people.toast.memberRemoved": "Member removed",
  "people.toast.memberRemoveFailed": "Failed to remove member",

  // ─── Administration ──────────────────────────────────────────────
  // Tabs
  "admin.tab.overview": "Overview",
  "admin.tab.users": "Users",
  "admin.tab.backups": "Backups",
  "admin.tab.events": "Events",
  "admin.tab.database": "Database",
  "admin.tab.integrations": "Integrations",

  // Search
  "admin.search.ph": "Search this tab…",
  "admin.updating": "Updating…",

  // Relative time
  "admin.time.justNow": "just now",
  "admin.time.minutesAgo": "{count} minute ago",
  "admin.time.minutesAgoPlural": "{count} minutes ago",
  "admin.time.hoursAgo": "{count} hour ago",
  "admin.time.hoursAgoPlural": "{count} hours ago",
  "admin.time.daysAgo": "{count} day ago",
  "admin.time.daysAgoPlural": "{count} days ago",
  "admin.time.monthsAgo": "{count} month ago",
  "admin.time.monthsAgoPlural": "{count} months ago",

  // Integrations tab
  "admin.integrations.telegram.title": "Telegram bots",
  "admin.integrations.telegram.on": "on",
  "admin.integrations.telegram.desc":
    "When on, each user can connect their own Telegram bot from Settings → Telegram. Per-user — no sharing between accounts. Inbound webhook traffic is routed via a per-user secret in the URL.",
  "admin.toast.telegramEnabled": "Telegram enabled workspace-wide",
  "admin.toast.telegramDisabled": "Telegram disabled",
  "admin.toast.settingFailed": "Couldn't update setting",

  // Overview — stat cards
  "admin.overview.serverStatus": "Server Status",
  "admin.overview.healthy": "Healthy",
  "admin.overview.activeSessions": "Active Sessions",
  "admin.overview.databaseSize": "Database Size",
  "admin.overview.storageUsed": "Storage Used",

  // Overview — server health
  "admin.overview.serverHealth": "Server Health",
  "admin.overview.uptime": "Uptime",
  "admin.overview.platform": "Platform",
  "admin.overview.nodeVersion": "Node Version",
  "admin.overview.heapUsed": "Heap Used",
  "admin.overview.heapTotal": "Heap Total",
  "admin.overview.memoryUsage": "Memory Usage",

  // Overview — storage breakdown
  "admin.overview.storageBreakdown": "Storage Breakdown",
  "admin.overview.database": "Database",
  "admin.overview.uploads": "Uploads",
  "admin.overview.backups": "Backups",
  "admin.overview.filesCount": "({count} files)",
  "admin.overview.total": "Total",

  // Users tab — table headers
  "admin.users.col.user": "User",
  "admin.users.col.username": "Username",
  "admin.users.col.email": "Email",
  "admin.users.col.role": "Role",
  "admin.users.col.status": "Status",
  "admin.users.col.lastActive": "Last Active",
  "admin.users.col.actions": "Actions",
  "admin.users.empty": "No users found.",
  "admin.users.status.active": "Active",
  "admin.users.status.inactive": "Inactive",
  "admin.users.never": "Never",
  "admin.users.deactivate": "Deactivate",
  "admin.users.reactivate": "Reactivate",

  // Backups tab
  "admin.backups.title": "Backups",
  "admin.backups.stored": "{count} backup stored",
  "admin.backups.storedPlural": "{count} backups stored",
  "admin.backups.create": "Create Backup",
  "admin.backups.empty": "No backups yet. Create your first backup to protect your data.",
  "admin.backups.inProgress": "In Progress",
  "admin.backups.restore": "Restore",
  "admin.backups.delete": "Delete",

  // Backups — confirm dialogs
  "admin.backups.confirmDelete": 'Delete backup "{name}"? This cannot be undone.',
  "admin.backups.confirmRestore":
    'Restore backup "{name}"? This will replace all current data. A safety backup will be created first.',

  // Backups — toasts
  "admin.toast.backupCreated": "Backup created successfully",
  "admin.toast.backupDeleted": "Backup deleted",
  "admin.toast.backupRestored": "Backup restored successfully",
  "admin.toast.restoreFailed": "Restore failed",

  // User actions — toasts
  "admin.toast.userDeactivated": "User deactivated",
  "admin.toast.userReactivated": "User reactivated",

  // Events tab
  "admin.events.title": "Recent Events",
  "admin.events.subtitle": "Last {count} server events",
  "admin.events.help": "What are these?",
  "admin.events.empty": "No events recorded yet.",

  // Database tab
  "admin.database.title": "Database Tables",
  "admin.database.subtitle": "{tables} tables, {rows} total rows",
  "admin.database.col.tableName": "Table Name",
  "admin.database.col.rowCount": "Row Count",
  "admin.database.col.percent": "% of Total",
}

export const ar: Record<string, string> = {
  // ─── الأشخاص والفِرق ─────────────────────────────────────────────
  // Tabs
  "people.tab.people": "الأشخاص",
  "people.tab.teams": "الفِرق",

  // Header actions
  "people.inviteUser": "دعوة مستخدم",
  "people.createTeam": "إنشاء فريق",

  // Empty states
  "people.empty.users": "لا يوجد مستخدمون بعد. ادعُ شخصًا للبدء.",
  "people.empty.teams": "لا توجد فِرق بعد. أنشئ فريقًا لتنظيم مساحة عملك.",

  // User status
  "people.status.active": "نشط",
  "people.status.inactive": "غير نشط",

  // Role names
  "people.role.owner": "المالك",
  "people.role.admin": "مسؤول",
  "people.role.editor": "محرِّر",
  "people.role.commenter": "معلِّق",
  "people.role.viewer": "مشاهد",

  // Invite User modal
  "people.invite.title": "دعوة مستخدم",
  "people.invite.username": "اسم المستخدم *",
  "people.invite.username.ph": "johndoe",
  "people.invite.displayName": "الاسم الظاهر *",
  "people.invite.displayName.ph": "John Doe",
  "people.invite.email": "البريد الإلكتروني",
  "people.invite.email.ph": "john@example.com",
  "people.invite.password": "كلمة المرور *",
  "people.invite.password.ph": "أدخل كلمة مرور",
  "people.invite.role": "الدور",
  "people.invite.cancel": "إلغاء",
  "people.invite.submit": "إنشاء مستخدم",
  "people.invite.submitting": "جارٍ الإنشاء...",

  // Create Team modal
  "people.team.title": "إنشاء فريق",
  "people.team.name": "اسم الفريق *",
  "people.team.name.ph": "الهندسة",
  "people.team.description": "الوصف",
  "people.team.description.ph": "ما الذي يقوم به هذا الفريق؟",
  "people.team.color": "اللون",
  "people.team.cancel": "إلغاء",
  "people.team.submit": "إنشاء فريق",
  "people.team.submitting": "جارٍ الإنشاء...",

  // Team card
  "people.team.memberCount": "عضو واحد",
  "people.team.memberCountPlural": "{count} أعضاء",
  "people.team.noMembers": "لا أعضاء بعد",
  "people.team.hide": "إخفاء",
  "people.team.manage": "إدارة",
  "people.team.selectUser": "اختر مستخدمًا للإضافة...",
  "people.team.add": "إضافة",
  "people.team.loadingMembers": "جارٍ تحميل الأعضاء...",
  "people.team.emptyMembers": "لا أعضاء في هذا الفريق بعد",

  // Toasts
  "people.toast.fieldsRequired": "اسم المستخدم والاسم الظاهر وكلمة المرور مطلوبة",
  "people.toast.userCreated": "تم إنشاء المستخدم بنجاح",
  "people.toast.userCreateFailed": "تعذّر إنشاء المستخدم",
  "people.toast.teamNameRequired": "اسم الفريق مطلوب",
  "people.toast.teamCreated": "تم إنشاء الفريق بنجاح",
  "people.toast.teamCreateFailed": "تعذّر إنشاء الفريق",
  "people.toast.membersLoadFailed": "تعذّر تحميل أعضاء الفريق",
  "people.toast.memberAdded": "تمت إضافة العضو",
  "people.toast.memberAddFailed": "تعذّرت إضافة العضو",
  "people.toast.memberRemoved": "تمت إزالة العضو",
  "people.toast.memberRemoveFailed": "تعذّرت إزالة العضو",

  // ─── الإدارة ─────────────────────────────────────────────────────
  // Tabs
  "admin.tab.overview": "نظرة عامة",
  "admin.tab.users": "المستخدمون",
  "admin.tab.backups": "النسخ الاحتياطية",
  "admin.tab.events": "الأحداث",
  "admin.tab.database": "قاعدة البيانات",
  "admin.tab.integrations": "التكاملات",

  // Search
  "admin.search.ph": "ابحث في هذا التبويب…",
  "admin.updating": "جارٍ التحديث…",

  // Relative time
  "admin.time.justNow": "الآن",
  "admin.time.minutesAgo": "قبل دقيقة",
  "admin.time.minutesAgoPlural": "قبل {count} دقيقة",
  "admin.time.hoursAgo": "قبل ساعة",
  "admin.time.hoursAgoPlural": "قبل {count} ساعة",
  "admin.time.daysAgo": "قبل يوم",
  "admin.time.daysAgoPlural": "قبل {count} يوم",
  "admin.time.monthsAgo": "قبل شهر",
  "admin.time.monthsAgoPlural": "قبل {count} شهر",

  // Integrations tab
  "admin.integrations.telegram.title": "روبوتات تيليجرام",
  "admin.integrations.telegram.on": "مُفعّل",
  "admin.integrations.telegram.desc":
    "عند التفعيل، يمكن لكل مستخدم ربط روبوت تيليجرام الخاص به من الإعدادات ← تيليجرام. لكل مستخدم على حدة — لا مشاركة بين الحسابات. تُوجَّه حركة الويب هوك الواردة عبر مفتاح سري خاص بكل مستخدم في الرابط.",
  "admin.toast.telegramEnabled": "تم تفعيل تيليجرام على مستوى مساحة العمل",
  "admin.toast.telegramDisabled": "تم تعطيل تيليجرام",
  "admin.toast.settingFailed": "تعذّر تحديث الإعداد",

  // Overview — stat cards
  "admin.overview.serverStatus": "حالة الخادم",
  "admin.overview.healthy": "سليم",
  "admin.overview.activeSessions": "الجلسات النشطة",
  "admin.overview.databaseSize": "حجم قاعدة البيانات",
  "admin.overview.storageUsed": "المساحة المستخدمة",

  // Overview — server health
  "admin.overview.serverHealth": "صحة الخادم",
  "admin.overview.uptime": "مدة التشغيل",
  "admin.overview.platform": "المنصة",
  "admin.overview.nodeVersion": "إصدار Node",
  "admin.overview.heapUsed": "الذاكرة المستخدمة",
  "admin.overview.heapTotal": "إجمالي الذاكرة",
  "admin.overview.memoryUsage": "استخدام الذاكرة",

  // Overview — storage breakdown
  "admin.overview.storageBreakdown": "تفصيل المساحة",
  "admin.overview.database": "قاعدة البيانات",
  "admin.overview.uploads": "الملفات المرفوعة",
  "admin.overview.backups": "النسخ الاحتياطية",
  "admin.overview.filesCount": "({count} ملف)",
  "admin.overview.total": "الإجمالي",

  // Users tab — table headers
  "admin.users.col.user": "المستخدم",
  "admin.users.col.username": "اسم المستخدم",
  "admin.users.col.email": "البريد الإلكتروني",
  "admin.users.col.role": "الدور",
  "admin.users.col.status": "الحالة",
  "admin.users.col.lastActive": "آخر نشاط",
  "admin.users.col.actions": "الإجراءات",
  "admin.users.empty": "لم يُعثر على مستخدمين.",
  "admin.users.status.active": "نشط",
  "admin.users.status.inactive": "غير نشط",
  "admin.users.never": "أبدًا",
  "admin.users.deactivate": "إلغاء التنشيط",
  "admin.users.reactivate": "إعادة التنشيط",

  // Backups tab
  "admin.backups.title": "النسخ الاحتياطية",
  "admin.backups.stored": "نسخة احتياطية واحدة مخزّنة",
  "admin.backups.storedPlural": "{count} نسخ احتياطية مخزّنة",
  "admin.backups.create": "إنشاء نسخة احتياطية",
  "admin.backups.empty": "لا توجد نسخ احتياطية بعد. أنشئ أول نسخة احتياطية لحماية بياناتك.",
  "admin.backups.inProgress": "قيد التنفيذ",
  "admin.backups.restore": "استعادة",
  "admin.backups.delete": "حذف",

  // Backups — confirm dialogs
  "admin.backups.confirmDelete": 'حذف النسخة الاحتياطية "{name}"؟ لا يمكن التراجع عن هذا.',
  "admin.backups.confirmRestore":
    'استعادة النسخة الاحتياطية "{name}"؟ سيؤدي هذا إلى استبدال جميع البيانات الحالية. سيتم إنشاء نسخة احتياطية وقائية أولًا.',

  // Backups — toasts
  "admin.toast.backupCreated": "تم إنشاء النسخة الاحتياطية بنجاح",
  "admin.toast.backupDeleted": "تم حذف النسخة الاحتياطية",
  "admin.toast.backupRestored": "تمت استعادة النسخة الاحتياطية بنجاح",
  "admin.toast.restoreFailed": "فشلت الاستعادة",

  // User actions — toasts
  "admin.toast.userDeactivated": "تم إلغاء تنشيط المستخدم",
  "admin.toast.userReactivated": "تمت إعادة تنشيط المستخدم",

  // Events tab
  "admin.events.title": "الأحداث الأخيرة",
  "admin.events.subtitle": "آخر {count} حدثًا للخادم",
  "admin.events.help": "ما هذه؟",
  "admin.events.empty": "لم تُسجَّل أحداث بعد.",

  // Database tab
  "admin.database.title": "جداول قاعدة البيانات",
  "admin.database.subtitle": "{tables} جدولًا، {rows} صفًا إجماليًا",
  "admin.database.col.tableName": "اسم الجدول",
  "admin.database.col.rowCount": "عدد الصفوف",
  "admin.database.col.percent": "٪ من الإجمالي",
}
