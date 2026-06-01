/**
 * Layout "chrome" strings — onboarding tour, floating widgets (pomodoro,
 * task timer, clock) and the platform chat drawer.
 * Keys are prefixed "layout." so they never collide with other areas.
 */

export const en: Record<string, string> = {
  // ── Onboarding tour ──────────────────────────────────────────────
  "layout.tour.step": "Step {n} of {total}",
  "layout.tour.skip": "Skip tour",
  "layout.tour.back": "Back",
  "layout.tour.next": "Next",
  "layout.tour.done": "Done",

  "layout.tour.intro.title": "Welcome to FlowSpace 👋",
  "layout.tour.intro.body":
    "Let's spend 60 seconds on the seven things that make this feel like home. You can skip any time.",
  "layout.tour.sidebar.title": "Your sidebar",
  "layout.tour.sidebar.body":
    "Every element type — projects, pages, canvases, todo lists, reminders, processes — lives in its own collapsible group. Right-click a group header to tint it, right-click an item for the full menu.",
  "layout.tour.palette.title": "Command palette",
  "layout.tour.palette.body":
    "Press ⌘K (Ctrl+K on Windows) anywhere to jump to anything: an element, an action, a settings page. The fastest path to almost everything.",
  "layout.tour.clock.title": "The floating clock",
  "layout.tour.clock.body":
    "Drag it anywhere. Right-click for colour, format, analog/digital, second timezone. Hide it from Settings if you don't need it.",
  "layout.tour.bell.title": "Your bell",
  "layout.tour.bell.body":
    "A single rose number summarising what needs your attention: unread notifications, pending imports from Telegram or Email, overdue tasks, overdue reminders. Click for the full list.",
  "layout.tour.rightClick.title": "Right-click is your friend",
  "layout.tour.rightClick.body":
    "Right-click on the page background, on sidebar items, on feed entries, on tasks. We added a lot of context menus — the platform feels much smaller once you know they're there.",
  "layout.tour.outro.title": "You're set 🎉",
  "layout.tour.outro.body":
    "Settings → Help has a Replay tour button if you ever want to see this again. Now go build something.",

  // ── Pomodoro widget ──────────────────────────────────────────────
  "layout.pomodoro.phase.focus": "Focus",
  "layout.pomodoro.phase.shortBreak": "Short break",
  "layout.pomodoro.phase.longBreak": "Long break",
  "layout.pomodoro.start": "Start",
  "layout.pomodoro.pause": "Pause",
  "layout.pomodoro.skip": "Skip phase",
  "layout.pomodoro.settings": "Settings",
  "layout.pomodoro.hide": "Hide widget",
  "layout.pomodoro.help":
    "25 / 5 / 15 minutes. After 4 focus blocks you earn a long break. Re-enable from Settings → Look & feel if you hide it.",

  // ── Task timer widget ────────────────────────────────────────────
  "layout.timer.resume": "Resume",
  "layout.timer.pause": "Pause",
  "layout.timer.add5": "Add 5 minutes",
  "layout.timer.edit": "Edit / Restart…",
  "layout.timer.setup": "Set up timer…",
  "layout.timer.color": "Color: {label}",
  "layout.timer.resetPosition": "Reset position",
  "layout.timer.stop": "Stop timer",
  "layout.timer.stopShort": "Stop",
  "layout.timer.dragMove": "Drag to move (right-click for options)",
  "layout.timer.dragTimer": "Drag timer",
  "layout.timer.startTimer": "Start timer",
  "layout.timer.startFocus": "Start a focus timer",
  "layout.timer.focus": "Focus",
  "layout.timer.paused": "Paused",
  "layout.timer.done": "Timer done",
  "layout.timer.doneLabeled": "Timer done — {label}",
  "layout.timer.takeBreak": "Take a break.",

  // Color option labels
  "layout.timer.color.neutral": "Neutral",
  "layout.timer.color.blue": "Blue",
  "layout.timer.color.violet": "Violet",
  "layout.timer.color.rose": "Rose",
  "layout.timer.color.green": "Green",
  "layout.timer.color.orange": "Orange",
  "layout.timer.color.teal": "Teal",

  // Timer picker dialog
  "layout.timer.picker.title": "Start a focus timer",
  "layout.timer.picker.desc":
    "Pick a duration. The countdown follows you everywhere — drag it to move; right-click for more options.",
  "layout.timer.picker.labelLabel": "What are you focusing on? (optional)",
  "layout.timer.picker.labelPh": "e.g. Finish CCB submission package",
  "layout.timer.picker.durationLabel": "Duration",
  "layout.timer.picker.minutes": "{n} min",
  "layout.timer.picker.customLabel": "Custom (minutes)",
  "layout.timer.picker.customPh": "e.g. 30",
  "layout.timer.picker.start": "Start",
  "layout.timer.picker.defaultLabel": "{n}-minute focus",

  // ── Topbar clock ─────────────────────────────────────────────────
  "layout.clock.color.default": "Default",
  "layout.clock.color.blue": "Blue",
  "layout.clock.color.violet": "Violet",
  "layout.clock.color.rose": "Rose",
  "layout.clock.color.green": "Green",
  "layout.clock.color.orange": "Orange",
  "layout.clock.color.teal": "Teal",
  "layout.clock.dateFormat.short": "Short — Wed 27 May",
  "layout.clock.dateFormat.long": "Long — Wednesday, May 27 2026",
  "layout.clock.dateFormat.iso": "ISO — 2026-05-27",
  "layout.clock.dateFormat.weekday": "Weekday only — Wednesday",
  "layout.clock.header": "Clock",
  "layout.clock.to12": "Switch to 12-hour",
  "layout.clock.to24": "Switch to 24-hour",
  "layout.clock.hideSeconds": "Hide seconds",
  "layout.clock.showSeconds": "Show seconds",
  "layout.clock.hideDate": "Hide date",
  "layout.clock.showDate": "Show date",
  "layout.clock.toDigital": "Switch to digital",
  "layout.clock.toAnalog": "Switch to analog face",
  "layout.clock.resetPosition": "Reset position",
  "layout.clock.hide": "Hide clock",
  "layout.clock.ariaAnalog": "Current time (drag to reposition, long-press for options)",
  "layout.clock.ariaDigital": "Current time (drag to reposition, right-click for options)",
  "layout.clock.dragGrip": "Drag to move, right-click for options",

  // ── Platform chat drawer ─────────────────────────────────────────
  "layout.chat.suggestion.focus": "What should I focus on today?",
  "layout.chat.suggestion.summarise": "Summarise my AGE project",
  "layout.chat.suggestion.overdue": "What's overdue and why?",
  "layout.chat.suggestion.stalled": "Which projects haven't moved this week?",
  "layout.chat.suggestion.status": "Draft a weekly status update I can email out",
  "layout.chat.unexpectedError": "Unexpected error",
  "layout.chat.open": "Open assistant",
  "layout.chat.close": "Close assistant",
  "layout.chat.title": "Assistant",
  "layout.chat.subtitle": "Asks your AI provider about your workspace",
  "layout.chat.clear": "Clear",
  "layout.chat.emptyIntro":
    "Ask me anything about your workspace. I see your elements, your open tasks, and what's overdue.",
  "layout.chat.try": "Try",
  "layout.chat.thinking": "Thinking…",
  "layout.chat.inputPh": "Ask anything…",
  "layout.chat.speakTooltip": "Speak your question",
  "layout.chat.send": "Send",
  "layout.chat.footer":
    "Uses your AI provider (Settings → AI features). Workspace context refreshed every turn.",
}

export const ar: Record<string, string> = {
  // ── Onboarding tour ──────────────────────────────────────────────
  "layout.tour.step": "الخطوة {n} من {total}",
  "layout.tour.skip": "تخطّي الجولة",
  "layout.tour.back": "رجوع",
  "layout.tour.next": "التالي",
  "layout.tour.done": "تم",

  "layout.tour.intro.title": "مرحبًا بك في FlowSpace 👋",
  "layout.tour.intro.body":
    "لنقضِ 60 ثانية على الأشياء السبعة التي تجعل هذه المساحة تشعر وكأنها بيتك. يمكنك التخطّي في أي وقت.",
  "layout.tour.sidebar.title": "شريطك الجانبي",
  "layout.tour.sidebar.body":
    "كل نوع من العناصر — المشاريع والصفحات واللوحات وقوائم المهام والتذكيرات والعمليات — يوجد في مجموعته القابلة للطي. انقر بزر الفأرة الأيمن على رأس المجموعة لتلوينها، وعلى أي عنصر للحصول على القائمة الكاملة.",
  "layout.tour.palette.title": "لوحة الأوامر",
  "layout.tour.palette.body":
    "اضغط ⌘K (Ctrl+K على ويندوز) في أي مكان للانتقال إلى أي شيء: عنصر أو إجراء أو صفحة إعدادات. أسرع طريق إلى كل شيء تقريبًا.",
  "layout.tour.clock.title": "الساعة العائمة",
  "layout.tour.clock.body":
    "اسحبها إلى أي مكان. انقر بزر الفأرة الأيمن للون والتنسيق وعقارب/رقمي ومنطقة زمنية ثانية. أخفِها من الإعدادات إن لم تكن بحاجة إليها.",
  "layout.tour.bell.title": "جرسك",
  "layout.tour.bell.body":
    "رقم وردي واحد يلخّص ما يحتاج إلى انتباهك: الإشعارات غير المقروءة، والاستيرادات المعلّقة من تيليجرام أو البريد، والمهام المتأخرة، والتذكيرات المتأخرة. انقر لعرض القائمة الكاملة.",
  "layout.tour.rightClick.title": "النقر بالزر الأيمن صديقك",
  "layout.tour.rightClick.body":
    "انقر بزر الفأرة الأيمن على خلفية الصفحة، وعلى عناصر الشريط الجانبي، وعلى مدخلات المستجدات، وعلى المهام. أضفنا الكثير من قوائم السياق — تصبح المنصة أصغر بكثير بمجرد أن تعرف أنها موجودة.",
  "layout.tour.outro.title": "أصبحت جاهزًا 🎉",
  "layout.tour.outro.body":
    "في الإعدادات ← المساعدة زر لإعادة تشغيل الجولة إن أردت رؤيتها مجددًا. والآن انطلق وابنِ شيئًا.",

  // ── Pomodoro widget ──────────────────────────────────────────────
  "layout.pomodoro.phase.focus": "تركيز",
  "layout.pomodoro.phase.shortBreak": "استراحة قصيرة",
  "layout.pomodoro.phase.longBreak": "استراحة طويلة",
  "layout.pomodoro.start": "بدء",
  "layout.pomodoro.pause": "إيقاف مؤقت",
  "layout.pomodoro.skip": "تخطّي المرحلة",
  "layout.pomodoro.settings": "الإعدادات",
  "layout.pomodoro.hide": "إخفاء الأداة",
  "layout.pomodoro.help":
    "25 / 5 / 15 دقيقة. بعد 4 فترات تركيز تحصل على استراحة طويلة. أعِد تفعيلها من الإعدادات ← المظهر إذا أخفيتها.",

  // ── Task timer widget ────────────────────────────────────────────
  "layout.timer.resume": "استئناف",
  "layout.timer.pause": "إيقاف مؤقت",
  "layout.timer.add5": "إضافة 5 دقائق",
  "layout.timer.edit": "تعديل / إعادة تشغيل…",
  "layout.timer.setup": "إعداد المؤقت…",
  "layout.timer.color": "اللون: {label}",
  "layout.timer.resetPosition": "إعادة تعيين الموضع",
  "layout.timer.stop": "إيقاف المؤقت",
  "layout.timer.stopShort": "إيقاف",
  "layout.timer.dragMove": "اسحب للنقل (انقر بالزر الأيمن للخيارات)",
  "layout.timer.dragTimer": "اسحب المؤقت",
  "layout.timer.startTimer": "بدء المؤقت",
  "layout.timer.startFocus": "بدء مؤقت تركيز",
  "layout.timer.focus": "تركيز",
  "layout.timer.paused": "متوقف مؤقتًا",
  "layout.timer.done": "انتهى المؤقت",
  "layout.timer.doneLabeled": "انتهى المؤقت — {label}",
  "layout.timer.takeBreak": "خذ استراحة.",

  // Color option labels
  "layout.timer.color.neutral": "محايد",
  "layout.timer.color.blue": "أزرق",
  "layout.timer.color.violet": "بنفسجي",
  "layout.timer.color.rose": "وردي",
  "layout.timer.color.green": "أخضر",
  "layout.timer.color.orange": "برتقالي",
  "layout.timer.color.teal": "أزرق مخضرّ",

  // Timer picker dialog
  "layout.timer.picker.title": "بدء مؤقت تركيز",
  "layout.timer.picker.desc":
    "اختر مدة. يتبعك العدّ التنازلي في كل مكان — اسحبه للنقل؛ وانقر بالزر الأيمن لمزيد من الخيارات.",
  "layout.timer.picker.labelLabel": "على ماذا تركّز؟ (اختياري)",
  "layout.timer.picker.labelPh": "مثال: إنهاء حزمة تقديم CCB",
  "layout.timer.picker.durationLabel": "المدة",
  "layout.timer.picker.minutes": "{n} دقيقة",
  "layout.timer.picker.customLabel": "مخصص (بالدقائق)",
  "layout.timer.picker.customPh": "مثال: 30",
  "layout.timer.picker.start": "بدء",
  "layout.timer.picker.defaultLabel": "تركيز لمدة {n} دقيقة",

  // ── Topbar clock ─────────────────────────────────────────────────
  "layout.clock.color.default": "افتراضي",
  "layout.clock.color.blue": "أزرق",
  "layout.clock.color.violet": "بنفسجي",
  "layout.clock.color.rose": "وردي",
  "layout.clock.color.green": "أخضر",
  "layout.clock.color.orange": "برتقالي",
  "layout.clock.color.teal": "أزرق مخضرّ",
  "layout.clock.dateFormat.short": "قصير — الأربعاء 27 مايو",
  "layout.clock.dateFormat.long": "طويل — الأربعاء، 27 مايو 2026",
  "layout.clock.dateFormat.iso": "أيزو — 2026-05-27",
  "layout.clock.dateFormat.weekday": "اليوم فقط — الأربعاء",
  "layout.clock.header": "الساعة",
  "layout.clock.to12": "التبديل إلى نظام 12 ساعة",
  "layout.clock.to24": "التبديل إلى نظام 24 ساعة",
  "layout.clock.hideSeconds": "إخفاء الثواني",
  "layout.clock.showSeconds": "إظهار الثواني",
  "layout.clock.hideDate": "إخفاء التاريخ",
  "layout.clock.showDate": "إظهار التاريخ",
  "layout.clock.toDigital": "التبديل إلى الرقمي",
  "layout.clock.toAnalog": "التبديل إلى الوجه العقربي",
  "layout.clock.resetPosition": "إعادة تعيين الموضع",
  "layout.clock.hide": "إخفاء الساعة",
  "layout.clock.ariaAnalog": "الوقت الحالي (اسحب لإعادة التموضع، اضغط مطوّلًا للخيارات)",
  "layout.clock.ariaDigital": "الوقت الحالي (اسحب لإعادة التموضع، انقر بالزر الأيمن للخيارات)",
  "layout.clock.dragGrip": "اسحب للنقل، انقر بالزر الأيمن للخيارات",

  // ── Platform chat drawer ─────────────────────────────────────────
  "layout.chat.suggestion.focus": "على ماذا ينبغي أن أركّز اليوم؟",
  "layout.chat.suggestion.summarise": "لخّص مشروع AGE الخاص بي",
  "layout.chat.suggestion.overdue": "ما المتأخر ولماذا؟",
  "layout.chat.suggestion.stalled": "أي المشاريع لم تتقدّم هذا الأسبوع؟",
  "layout.chat.suggestion.status": "صُغ تحديث حالة أسبوعيًا يمكنني إرساله بالبريد",
  "layout.chat.unexpectedError": "خطأ غير متوقع",
  "layout.chat.open": "فتح المساعد",
  "layout.chat.close": "إغلاق المساعد",
  "layout.chat.title": "المساعد",
  "layout.chat.subtitle": "يسأل مزوّد الذكاء الاصطناعي عن مساحة عملك",
  "layout.chat.clear": "مسح",
  "layout.chat.emptyIntro":
    "اسألني أي شيء عن مساحة عملك. أرى عناصرك ومهامك المفتوحة وما هو متأخر.",
  "layout.chat.try": "جرّب",
  "layout.chat.thinking": "جارٍ التفكير…",
  "layout.chat.inputPh": "اسأل أي شيء…",
  "layout.chat.speakTooltip": "انطق سؤالك",
  "layout.chat.send": "إرسال",
  "layout.chat.footer":
    "يستخدم مزوّد الذكاء الاصطناعي الخاص بك (الإعدادات ← ميزات الذكاء الاصطناعي). يُحدَّث سياق مساحة العمل في كل دور.",
}
