/**
 * Feed module — the /feed page (filters, pinned section, empty state, the
 * docs/quick-post side panel) and the scrolling feed ticker bar.
 * Keys are prefixed "feed.". Mirrors the wording in core.ts (e.g. the feed
 * itself is "المستجدات").
 */

export const en: Record<string, string> = {
  // Ticker label
  "feed.label": "Feed",

  // Type filter chips
  "feed.filter.tasks": "Tasks",
  "feed.filter.comments": "Comments",
  "feed.filter.pages": "Pages",
  "feed.filter.canvas": "Canvas",
  "feed.filter.approvals": "Approvals",
  "feed.filter.automation": "Automation",
  "feed.filter.system": "System",

  // Priority + source filter rows
  "feed.priority.label": "Priority:",
  "feed.source.label": "Source:",
  "feed.filter.all": "all",
  "feed.priority.high": "high",
  "feed.priority.normal": "normal",
  "feed.priority.low": "low",
  "feed.source.manual": "manual",
  "feed.source.system": "system",
  "feed.source.automation": "automation",

  // Source chip labels (display)
  "feed.sourceChip.manual": "manual",
  "feed.sourceChip.automation": "automation",
  "feed.sourceChip.form": "form",
  "feed.sourceChip.api": "api",

  // Pinned section
  "feed.pinned": "Pinned",

  // Empty state
  "feed.empty.title": "No feed events yet",
  "feed.empty.desc": "Activity will appear here as it happens.",

  // Day labels
  "feed.day.today": "Today",
  "feed.day.yesterday": "Yesterday",

  // Relative time
  "feed.time.justNow": "just now",
  "feed.time.minutesAgo": "{n}m ago",
  "feed.time.hoursAgo": "{n}h ago",
  "feed.time.daysAgo": "{n}d ago",
  "feed.time.yesterdayAt": "Yesterday at {time}",

  // Card meta + actor fallback
  "feed.actor.system": "System",
  "feed.meta.project": "Project",
  "feed.meta.element": "Element",
  "feed.card.tooltip": "Right-click for priority & actions",

  // Context menu / quick actions
  "feed.action.pin": "Pin",
  "feed.action.unpin": "Unpin",
  "feed.action.markRead": "Mark as read",
  "feed.action.openRelated": "Open related",
  "feed.action.openRelatedItem": "Open related item",
  "feed.action.highPriority": "High priority",
  "feed.action.normalPriority": "Normal priority",
  "feed.action.lowPriority": "Low priority",

  // Ticker context menu
  "feed.action.openSubject": "Open subject",
  "feed.action.openFeedPage": "Open Feed page",
  "feed.action.hideSession": "Hide ticker for this session",
  "feed.action.hidePermanent": "Hide ticker permanently",

  // Ticker controls (titles / aria-labels)
  "feed.ticker.dragMove": "Drag to move · Double-click to re-pin",
  "feed.ticker.resize": "Drag to resize",
  "feed.ticker.makeFloating": "Unpin (make floating)",
  "feed.ticker.pinBack": "Pin back to top/bottom",
  "feed.ticker.unpinAria": "Unpin ticker",
  "feed.ticker.pinAria": "Pin ticker",
  "feed.ticker.hideSession": "Hide for this session",
  "feed.ticker.hideAria": "Hide feed ticker",
  "feed.ticker.entryTooltip": "Click to open · Right-click for options",
  "feed.ticker.floatingAria": "Floating activity feed ticker",

  // Toasts
  "feed.toast.markedRead": "Marked as read",
  "feed.toast.markReadFail": "Failed to mark as read",
  "feed.toast.unpinned": "Unpinned",
  "feed.toast.pinned": "Pinned",
  "feed.toast.pinFail": "Failed to update pin",
  "feed.toast.prioritySet": "Priority set to {priority}",
  "feed.toast.priorityFail": "Couldn't change priority — you don't own this event",
  "feed.toast.posted": "Posted to feed",
  "feed.toast.postFail": "Couldn't post — please try again",

  // Side panel: aria + quick post
  "feed.panel.aria": "Feed documentation and quick post",
  "feed.panel.postHeading": "Post to feed",
  "feed.panel.titlePlaceholder": "What's the headline?",
  "feed.panel.detailPlaceholder": "Optional detail…",
  "feed.panel.posting": "Posting…",
  "feed.panel.postButton": "Post to feed",

  // Side panel: about
  "feed.panel.aboutHeading": "About the feed",
  "feed.panel.aboutBody":
    "The feed is your workspace's activity stream. Anything interesting that happens — tasks completing, comments landing, approvals firing, automations running — turns into a feed event. They show up here, in the scrolling ticker, and the home dashboard's heatmap.",

  // Side panel: sources
  "feed.panel.sourcesHeading": "Where items come from",
  "feed.panel.source.systemTitle": "System events",
  "feed.panel.source.systemDesc":
    "Tasks, comments, page edits — generated automatically as you work in projects.",
  "feed.panel.source.automationsTitle": "Automations",
  "feed.panel.source.automationsDesc":
    "Triggers you set up under Platform → Automations publish here when they fire.",
  "feed.panel.source.formsTitle": "Form submissions",
  "feed.panel.source.formsDesc":
    "External forms (Platform → Forms) push a feed event with each submission.",
  "feed.panel.source.manualTitle": "Manual posts",
  "feed.panel.source.manualDesc":
    "Use the composer above to drop a note for the team. Right-click on any item in your projects to also push it to the feed.",
  "feed.panel.source.apiTitle": "API",
  "feed.panel.source.apiDesc":
    "Programmatic events from integrations land here too.",

  // Side panel: tips
  "feed.panel.tipsHeading": "Tips",
  "feed.panel.tip.rightClickLabel": "Right-click",
  "feed.panel.tip.rightClickBody":
    "any item (here, in the ticker, on the home dashboard) to change its priority. High items get a rose dot and float up.",
  "feed.panel.tip.pinLabel": "Pin",
  "feed.panel.tip.pinBody":
    "items you want to keep visible — they get their own section at the top.",
  "feed.panel.tip.dragLabel": "Drag the ticker.",
  "feed.panel.tip.dragBody":
    "Unpin it from the ticker's pin icon (top-right) to float it anywhere on screen, then drag the left edge to move and the bottom-right corner to resize.",
}

export const ar: Record<string, string> = {
  // Ticker label
  "feed.label": "المستجدات",

  // Type filter chips
  "feed.filter.tasks": "المهام",
  "feed.filter.comments": "التعليقات",
  "feed.filter.pages": "الصفحات",
  "feed.filter.canvas": "اللوحات",
  "feed.filter.approvals": "الموافقات",
  "feed.filter.automation": "الأتمتة",
  "feed.filter.system": "النظام",

  // Priority + source filter rows
  "feed.priority.label": "الأولوية:",
  "feed.source.label": "المصدر:",
  "feed.filter.all": "الكل",
  "feed.priority.high": "عالية",
  "feed.priority.normal": "عادية",
  "feed.priority.low": "منخفضة",
  "feed.source.manual": "يدوي",
  "feed.source.system": "النظام",
  "feed.source.automation": "أتمتة",

  // Source chip labels (display)
  "feed.sourceChip.manual": "يدوي",
  "feed.sourceChip.automation": "أتمتة",
  "feed.sourceChip.form": "نموذج",
  "feed.sourceChip.api": "واجهة برمجية",

  // Pinned section
  "feed.pinned": "المثبتة",

  // Empty state
  "feed.empty.title": "لا توجد مستجدات بعد",
  "feed.empty.desc": "ستظهر الأنشطة هنا فور حدوثها.",

  // Day labels
  "feed.day.today": "اليوم",
  "feed.day.yesterday": "أمس",

  // Relative time
  "feed.time.justNow": "الآن",
  "feed.time.minutesAgo": "قبل {n} د",
  "feed.time.hoursAgo": "قبل {n} س",
  "feed.time.daysAgo": "قبل {n} ي",
  "feed.time.yesterdayAt": "أمس الساعة {time}",

  // Card meta + actor fallback
  "feed.actor.system": "النظام",
  "feed.meta.project": "مشروع",
  "feed.meta.element": "عنصر",
  "feed.card.tooltip": "انقر بالزر الأيمن للأولوية والإجراءات",

  // Context menu / quick actions
  "feed.action.pin": "تثبيت",
  "feed.action.unpin": "إلغاء التثبيت",
  "feed.action.markRead": "تحديد كمقروء",
  "feed.action.openRelated": "فتح العنصر المرتبط",
  "feed.action.openRelatedItem": "فتح العنصر المرتبط",
  "feed.action.highPriority": "أولوية عالية",
  "feed.action.normalPriority": "أولوية عادية",
  "feed.action.lowPriority": "أولوية منخفضة",

  // Ticker context menu
  "feed.action.openSubject": "فتح الموضوع",
  "feed.action.openFeedPage": "فتح صفحة المستجدات",
  "feed.action.hideSession": "إخفاء الشريط لهذه الجلسة",
  "feed.action.hidePermanent": "إخفاء الشريط نهائيًا",

  // Ticker controls (titles / aria-labels)
  "feed.ticker.dragMove": "اسحب للتحريك · انقر مرتين لإعادة التثبيت",
  "feed.ticker.resize": "اسحب لتغيير الحجم",
  "feed.ticker.makeFloating": "إلغاء التثبيت (جعله عائمًا)",
  "feed.ticker.pinBack": "تثبيت في الأعلى/الأسفل",
  "feed.ticker.unpinAria": "إلغاء تثبيت الشريط",
  "feed.ticker.pinAria": "تثبيت الشريط",
  "feed.ticker.hideSession": "إخفاء لهذه الجلسة",
  "feed.ticker.hideAria": "إخفاء شريط المستجدات",
  "feed.ticker.entryTooltip": "انقر للفتح · انقر بالزر الأيمن للخيارات",
  "feed.ticker.floatingAria": "شريط المستجدات العائم",

  // Toasts
  "feed.toast.markedRead": "تم التحديد كمقروء",
  "feed.toast.markReadFail": "تعذّر التحديد كمقروء",
  "feed.toast.unpinned": "تم إلغاء التثبيت",
  "feed.toast.pinned": "تم التثبيت",
  "feed.toast.pinFail": "تعذّر تحديث التثبيت",
  "feed.toast.prioritySet": "تم ضبط الأولوية إلى {priority}",
  "feed.toast.priorityFail": "تعذّر تغيير الأولوية — هذا الحدث ليس ملكك",
  "feed.toast.posted": "تم النشر في المستجدات",
  "feed.toast.postFail": "تعذّر النشر — يرجى المحاولة مرة أخرى",

  // Side panel: aria + quick post
  "feed.panel.aria": "توثيق المستجدات والنشر السريع",
  "feed.panel.postHeading": "النشر في المستجدات",
  "feed.panel.titlePlaceholder": "ما العنوان الرئيسي؟",
  "feed.panel.detailPlaceholder": "تفاصيل اختيارية…",
  "feed.panel.posting": "جارٍ النشر…",
  "feed.panel.postButton": "النشر في المستجدات",

  // Side panel: about
  "feed.panel.aboutHeading": "حول المستجدات",
  "feed.panel.aboutBody":
    "المستجدات هي سجل نشاط مساحة عملك. كل ما يحدث من أمور مهمة — اكتمال المهام، ورود التعليقات، إطلاق الموافقات، تشغيل الأتمتة — يتحوّل إلى حدث في المستجدات. تظهر هنا، وفي الشريط المتحرك، وفي خريطة النشاط بلوحة الصفحة الرئيسية.",

  // Side panel: sources
  "feed.panel.sourcesHeading": "من أين تأتي العناصر",
  "feed.panel.source.systemTitle": "أحداث النظام",
  "feed.panel.source.systemDesc":
    "المهام والتعليقات وتعديلات الصفحات — تُنشأ تلقائيًا أثناء عملك في المشاريع.",
  "feed.panel.source.automationsTitle": "الأتمتة",
  "feed.panel.source.automationsDesc":
    "المشغّلات التي تعدّها ضمن المنصة ← الأتمتة تُنشر هنا عند إطلاقها.",
  "feed.panel.source.formsTitle": "إرسالات النماذج",
  "feed.panel.source.formsDesc":
    "النماذج الخارجية (المنصة ← النماذج) تدفع حدثًا في المستجدات مع كل إرسال.",
  "feed.panel.source.manualTitle": "المنشورات اليدوية",
  "feed.panel.source.manualDesc":
    "استخدم محرّر النشر أعلاه لترك ملاحظة للفريق. انقر بالزر الأيمن على أي عنصر في مشاريعك لدفعه أيضًا إلى المستجدات.",
  "feed.panel.source.apiTitle": "الواجهة البرمجية",
  "feed.panel.source.apiDesc":
    "الأحداث البرمجية القادمة من التكاملات تظهر هنا أيضًا.",

  // Side panel: tips
  "feed.panel.tipsHeading": "نصائح",
  "feed.panel.tip.rightClickLabel": "انقر بالزر الأيمن",
  "feed.panel.tip.rightClickBody":
    "على أي عنصر (هنا، في الشريط، أو في لوحة الصفحة الرئيسية) لتغيير أولويته. العناصر العالية تحصل على نقطة وردية وتطفو إلى الأعلى.",
  "feed.panel.tip.pinLabel": "ثبِّت",
  "feed.panel.tip.pinBody":
    "العناصر التي تريد إبقاءها ظاهرة — تحصل على قسم خاص بها في الأعلى.",
  "feed.panel.tip.dragLabel": "اسحب الشريط.",
  "feed.panel.tip.dragBody":
    "ألغِ تثبيته من أيقونة التثبيت في الشريط (أعلى اليمين) لتعويمه في أي مكان على الشاشة، ثم اسحب الحافة اليسرى للتحريك والزاوية السفلية اليمنى لتغيير الحجم.",
}
