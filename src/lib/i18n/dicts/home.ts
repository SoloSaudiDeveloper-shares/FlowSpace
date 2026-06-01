/**
 * Home dashboard + home content strings.
 * Keys are prefixed "home." so they never collide with other areas.
 */

export const en: Record<string, string> = {
  // Greetings (HeroBlock)
  "home.greeting.late":      "Working late",
  "home.greeting.morning":   "Good morning",
  "home.greeting.afternoon": "Good afternoon",
  "home.greeting.evening":   "Good evening",

  // Hero actions
  "home.hero.importFromAi": "Import from AI",
  "home.hero.customize":    "Customize",

  // KPI / type labels
  "home.type.projects":  "Projects",
  "home.type.pages":     "Pages",
  "home.type.canvases":  "Canvases",
  "home.type.todoLists": "Todo lists",
  "home.type.reminders": "Reminders",
  "home.type.processes": "Processes",

  // Project pulse
  "home.pulse.title":          "Project pulse",
  "home.pulse.projectCount":   "{n} project",
  "home.pulse.projectCountP":  "{n} projects",
  "home.pulse.status.active":    "Active",
  "home.pulse.status.planning":  "Planning",
  "home.pulse.status.paused":    "Paused",
  "home.pulse.status.completed": "Completed",
  "home.pulse.overall":  "Overall",
  "home.pulse.complete": "complete",
  "home.pulse.stat.openTasks": "Open tasks",
  "home.pulse.stat.done":      "Done",
  "home.pulse.stat.overdue":   "Overdue",

  // Today & upcoming
  "home.today.title":        "Today & upcoming",
  "home.today.overdue":      "{n} overdue",
  "home.today.empty":        "Nothing on the radar for the next 7 days. Quiet seas ahead.",
  "home.today.inProject":    "in {project}",

  // Activity heatmap
  "home.activity.title":       "Activity — last 30 days",
  "home.activity.summary":     "{events} event · {active}/{total} days active",
  "home.activity.summaryP":    "{events} events · {active}/{total} days active",
  "home.activity.dayTooltip":  "{date} — {n} event",
  "home.activity.dayTooltipP": "{date} — {n} events",
  "home.activity.today":       "Today",

  // Quick capture (compact)
  "home.capture.title":       "Capture",
  "home.capture.placeholder": "What's on your mind?",
  "home.capture.speakTip":    "Speak (high-accuracy Whisper)",

  // Recent / favorites row
  "home.recent.tab.recent":      "Recent",
  "home.recent.tab.favorites":   "Favorites",
  "home.recent.empty.recent":    "Nothing recent yet.",
  "home.recent.empty.favorites": "Star items from the sidebar to pin them here.",

  // Customize dialog
  "home.customize.title":       "Customize home",
  "home.customize.description": "Toggle the panels you want on your home page. Hidden panels can be re-added any time.",
  "home.customize.visible":     "Visible on home",
  "home.customize.hidden":      "Hidden",

  // Pending imports banner
  "home.pending.title":   "{n} import waiting for your review",
  "home.pending.titleP":  "{n} imports waiting for your review",
  "home.pending.desc":    "Payloads from your Telegram bot — preview & approve before they land in the workspace.",
  "home.pending.review":  "Review →",

  // Home content (welcome / quick create)
  "home.welcome.title":       "Welcome to FlowSpace",
  "home.welcome.subtitle":    "Your personal workspace for organizing everything.",
  "home.quickCreate.title":   "Quick Create",

  // Element type labels (singular)
  "home.elementType.project":   "Project",
  "home.elementType.page":      "Page",
  "home.elementType.canvas":    "Canvas",
  "home.elementType.todoList":  "Todo List",
  "home.elementType.reminder":  "Reminder",
  "home.elementType.process":   "Process",

  // Quick-create option descriptions
  "home.createOpt.project.desc":  "Kanban board with tasks",
  "home.createOpt.page.desc":     "Rich text document",
  "home.createOpt.canvas.desc":   "Infinite visual canvas",
  "home.createOpt.todoList.desc": "Simple checklist",
  "home.createOpt.reminder.desc": "Time-based reminder",
  "home.createOpt.process.desc":  "Flowchart & steps",

  // Favorites / recent sections (home content)
  "home.section.favorites": "Favorites",
  "home.section.recent":    "Recent",
  "home.empty.title":       "No elements yet",
  "home.empty.desc":        "Create your first project, page, or canvas to get started.",

  // Relative time (formatDate)
  "home.time.justNow":     "Just now",
  "home.time.minutesAgo":  "{n}m ago",
  "home.time.hoursAgo":    "{n}h ago",
  "home.time.daysAgo":     "{n}d ago",

  // Element card actions / context menu
  "home.card.open":              "Open",
  "home.card.addFavorite":       "Add to Favorites",
  "home.card.removeFavorite":    "Remove from Favorites",
  "home.card.archive":           "Archive",
  "home.card.delete":            "Delete",
  "home.card.addFavoriteLower":    "Add to favorites",
  "home.card.removeFavoriteLower": "Remove from favorites",
  "home.card.readAloud":         "Read aloud",
}

export const ar: Record<string, string> = {
  // Greetings (HeroBlock)
  "home.greeting.late":      "تعمل حتى وقت متأخر",
  "home.greeting.morning":   "صباح الخير",
  "home.greeting.afternoon": "مساء الخير",
  "home.greeting.evening":   "مساء الخير",

  // Hero actions
  "home.hero.importFromAi": "استيراد من الذكاء الاصطناعي",
  "home.hero.customize":    "تخصيص",

  // KPI / type labels
  "home.type.projects":  "المشاريع",
  "home.type.pages":     "الصفحات",
  "home.type.canvases":  "اللوحات",
  "home.type.todoLists": "قوائم المهام",
  "home.type.reminders": "التذكيرات",
  "home.type.processes": "العمليات",

  // Project pulse
  "home.pulse.title":          "نبض المشاريع",
  "home.pulse.projectCount":   "مشروع {n}",
  "home.pulse.projectCountP":  "{n} مشاريع",
  "home.pulse.status.active":    "نشط",
  "home.pulse.status.planning":  "قيد التخطيط",
  "home.pulse.status.paused":    "متوقف مؤقتًا",
  "home.pulse.status.completed": "مكتمل",
  "home.pulse.overall":  "الإجمالي",
  "home.pulse.complete": "مكتمل",
  "home.pulse.stat.openTasks": "مهام مفتوحة",
  "home.pulse.stat.done":      "منجزة",
  "home.pulse.stat.overdue":   "متأخرة",

  // Today & upcoming
  "home.today.title":        "اليوم والقادم",
  "home.today.overdue":      "{n} متأخرة",
  "home.today.empty":        "لا شيء على الأفق خلال الأيام السبعة القادمة. أجواء هادئة في الأمام.",
  "home.today.inProject":    "في {project}",

  // Activity heatmap
  "home.activity.title":       "النشاط — آخر 30 يومًا",
  "home.activity.summary":     "{events} حدث · {active}/{total} يوم نشط",
  "home.activity.summaryP":    "{events} حدث · {active}/{total} يوم نشط",
  "home.activity.dayTooltip":  "{date} — {n} حدث",
  "home.activity.dayTooltipP": "{date} — {n} حدث",
  "home.activity.today":       "اليوم",

  // Quick capture (compact)
  "home.capture.title":       "التقاط",
  "home.capture.placeholder": "ما الذي يدور في ذهنك؟",
  "home.capture.speakTip":    "تحدّث (Whisper عالي الدقة)",

  // Recent / favorites row
  "home.recent.tab.recent":      "الأخيرة",
  "home.recent.tab.favorites":   "المفضلة",
  "home.recent.empty.recent":    "لا شيء حديث بعد.",
  "home.recent.empty.favorites": "ضع نجمة على العناصر من الشريط الجانبي لتثبيتها هنا.",

  // Customize dialog
  "home.customize.title":       "تخصيص الرئيسية",
  "home.customize.description": "بدّل اللوحات التي تريدها في صفحتك الرئيسية. يمكن إعادة إضافة اللوحات المخفية في أي وقت.",
  "home.customize.visible":     "ظاهرة في الرئيسية",
  "home.customize.hidden":      "مخفية",

  // Pending imports banner
  "home.pending.title":   "{n} عملية استيراد بانتظار مراجعتك",
  "home.pending.titleP":  "{n} عمليات استيراد بانتظار مراجعتك",
  "home.pending.desc":    "بيانات من بوت تيليجرام الخاص بك — عاينها ووافق عليها قبل أن تصل إلى مساحة العمل.",
  "home.pending.review":  "مراجعة ←",

  // Home content (welcome / quick create)
  "home.welcome.title":       "مرحبًا بك في FlowSpace",
  "home.welcome.subtitle":    "مساحة عملك الشخصية لتنظيم كل شيء.",
  "home.quickCreate.title":   "إنشاء سريع",

  // Element type labels (singular)
  "home.elementType.project":   "مشروع",
  "home.elementType.page":      "صفحة",
  "home.elementType.canvas":    "لوحة",
  "home.elementType.todoList":  "قائمة مهام",
  "home.elementType.reminder":  "تذكير",
  "home.elementType.process":   "عملية",

  // Quick-create option descriptions
  "home.createOpt.project.desc":  "لوحة كانبان مع المهام",
  "home.createOpt.page.desc":     "مستند نصي منسّق",
  "home.createOpt.canvas.desc":   "لوحة بصرية لا نهائية",
  "home.createOpt.todoList.desc": "قائمة تحقق بسيطة",
  "home.createOpt.reminder.desc": "تذكير محدد بوقت",
  "home.createOpt.process.desc":  "مخطط انسيابي وخطوات",

  // Favorites / recent sections (home content)
  "home.section.favorites": "المفضلة",
  "home.section.recent":    "الأخيرة",
  "home.empty.title":       "لا توجد عناصر بعد",
  "home.empty.desc":        "أنشئ أول مشروع أو صفحة أو لوحة لتبدأ.",

  // Relative time (formatDate)
  "home.time.justNow":     "الآن",
  "home.time.minutesAgo":  "منذ {n} د",
  "home.time.hoursAgo":    "منذ {n} س",
  "home.time.daysAgo":     "منذ {n} ي",

  // Element card actions / context menu
  "home.card.open":              "فتح",
  "home.card.addFavorite":       "إضافة إلى المفضلة",
  "home.card.removeFavorite":    "إزالة من المفضلة",
  "home.card.archive":           "أرشفة",
  "home.card.delete":            "حذف",
  "home.card.addFavoriteLower":    "إضافة إلى المفضلة",
  "home.card.removeFavoriteLower": "إزالة من المفضلة",
  "home.card.readAloud":         "قراءة بصوت عالٍ",
}
