/**
 * Feature "how do I use this?" guide content (the GUIDES registry in
 * `@/lib/guides`). Every key is prefixed "guides." — note this is distinct
 * from "guide." which the GuideDialog chrome (step/back/next/done/copy) uses.
 *
 * Prose is split around literal syntax tokens (code samples, env-var names,
 * `flws_…`, `#high`, `~6h`, `@2026-07-01`, `- [ ]`, keyboard keys, URLs, the
 * markdown import example) so those stay untranslated in the JSX while the
 * surrounding sentences localize. Fragment keys ending in `a`/`b`/`c` are the
 * sentence pieces that wrap an inline <code>/<strong> in the original prose;
 * leading/trailing spaces are intentional to preserve natural spacing.
 */

export const en: Record<string, string> = {
  // ── API tokens ──────────────────────────────────────────────────────
  "guides.apiTokens.label": "API tokens",
  "guides.apiTokens.blurb": "Let scripts and integrations act as you.",
  "guides.apiTokens.step1.title": "What is an API token?",
  "guides.apiTokens.step1.p1":
    "A token is a long-lived key that lets a script, cron job, or tool act as you — without your password. Anyone who has it can do anything you can, so treat it like a password and never paste it into a public place.",
  "guides.apiTokens.step2.title": "Issue one",
  "guides.apiTokens.step2.p1a":
    "In the API-tokens section, give the token a name that says what it's for (e.g.",
  "guides.apiTokens.step2.p1b":
    "), pick an expiry, and hit Issue. You'll see the full",
  "guides.apiTokens.step2.p1c":
    "value once — copy it into your password manager or your script's secrets right away.",
  "guides.apiTokens.step3.title": "Use it in a request",
  "guides.apiTokens.step3.p1a": "Send the token as an",
  "guides.apiTokens.step3.p1b":
    "header on any API route that supports it. Here's the web-clipper endpoint, which drops a pending item into your bell:",
  "guides.apiTokens.step4.title": "Keep it safe — revoke anytime",
  "guides.apiTokens.step4.p1":
    "If a token leaks, or you're done with a script, click the trash icon next to it. It stops working immediately — no other tokens are affected. Set a short expiry on tokens you only need briefly.",

  // ── Markdown format ─────────────────────────────────────────────────
  "guides.markdownFormat.label": "Markdown format",
  "guides.markdownFormat.blurb": "Turn plain text into projects, pages, and tasks.",
  "guides.markdownFormat.step1.title": "Write once, import anywhere",
  "guides.markdownFormat.step1.p1":
    "Write text in this format and FlowSpace turns it into a structured element. It works in Import from AI and when you email it in — and a plain email still becomes a simple to-do. The next steps show a full example, what each token means, and a ready-made AI prompt.",
  "guides.markdownFormat.step2.title": "Full example",
  "guides.markdownFormat.step2.p1":
    "This uses every field. Copy it, tweak the values, and import — or just use it as a reference.",
  "guides.markdownFormat.step3.title": "Token legend",
  "guides.markdownFormat.step3.typeTitle":
    "Required first line. Type = Project, Page, Todo, Canvas, Reminder, Process.",
  "guides.markdownFormat.step3.status": "planning · active · paused · completed (projects).",
  "guides.markdownFormat.step3.due": "Optional due date (ISO).",
  "guides.markdownFormat.step3.tags": "Optional, comma-separated.",
  "guides.markdownFormat.step3.tasks": "Starts the task list (## Steps in a Process).",
  "guides.markdownFormat.step3.checkbox": "An open / completed task.",
  "guides.markdownFormat.step3.indent": "Indent 2 spaces → a subtask of the task above.",
  "guides.markdownFormat.step3.checklist":
    "Indented → a checklist; indented - [ ] lines below are its items.",
  "guides.markdownFormat.step3.estimate": "Optional time estimate on a task (~1h30m too).",
  "guides.markdownFormat.step3.priority": "Priority: urgent · high · medium · low.",
  "guides.markdownFormat.step3.taskDue": "Due date on a single task.",
  "guides.markdownFormat.step3.notes": "Free text → the element's description.",
  "guides.markdownFormat.step4.title": "Let AI write it for you",
  "guides.markdownFormat.step4.p1":
    "Paste this prompt into ChatGPT / Claude after a brain-dump and it will output markdown in exactly this format — ready to paste into the importer or email in.",
  "guides.markdownFormat.step5.title": "Tips & limits",
  "guides.markdownFormat.step5.row1.title": "One element per import",
  "guides.markdownFormat.step5.row1.a": "each import builds a single element — exactly one",
  "guides.markdownFormat.step5.row1.b":
    "header line. If your notes cover several projects, do them one at a time, or paste each block separately.",
  "guides.markdownFormat.step5.row2.title": "Want a plain page, not a task list?",
  "guides.markdownFormat.step5.row2.a": "start with",
  "guides.markdownFormat.step5.row2.b": "instead of",
  "guides.markdownFormat.step5.row2.c":
    "— everything below the header becomes the page body (skip",
  "guides.markdownFormat.step5.row2.d": ").",
  "guides.markdownFormat.step5.row3.title": "Forgot the boxes? It still works",
  "guides.markdownFormat.step5.row3.a": "if a model drops the",
  "guides.markdownFormat.step5.row3.b": "boxes, plain bullets under",
  "guides.markdownFormat.step5.row3.c": "are still imported as open tasks — but the",
  "guides.markdownFormat.step5.row3.d": "form is the reliable one.",

  // ── Telegram bot ────────────────────────────────────────────────────
  "guides.telegramBot.label": "Telegram bot",
  "guides.telegramBot.blurb": "Capture and query your work from chat.",
  "guides.telegramBot.step1.title": "Smart capture — inline syntax",
  "guides.telegramBot.step1.p1":
    "Text the bot anything and it becomes a todo. Sprinkle these tokens anywhere in the message — the bot pulls them out and tells you what it captured.",
  "guides.telegramBot.step1.priority": "Set priority (urgent/high/medium/low)",
  "guides.telegramBot.step1.due": "Set ISO due date",
  "guides.telegramBot.step1.relative": "Or @today / @tomorrow / @next-week",
  "guides.telegramBot.step1.tag": "Add a tag (alphanumeric + dashes)",
  "guides.telegramBot.step1.exampleLabel": "Example:",
  "guides.telegramBot.step1.exampleResultA": "→ title",
  "guides.telegramBot.step1.exampleResultB": ", due 2026-06-15, priority high, tag",
  "guides.telegramBot.step2.title": "Commands",
  "guides.telegramBot.step2.text": "Capture as todo (smart syntax)",
  "guides.telegramBot.step2.tasks": "Open tasks across projects",
  "guides.telegramBot.step2.deadlines": "Due in the next N days",
  "guides.telegramBot.step2.projects": "Projects + completion %",
  "guides.telegramBot.step2.lists": "Your todo lists",
  "guides.telegramBot.step2.add": "Quick add to default",
  "guides.telegramBot.step2.todo": "Add to a specific list",
  "guides.telegramBot.step2.task": "New task in a project",
  "guides.telegramBot.step2.done": "Mark a task/todo done",
  "guides.telegramBot.step2.help": "Full command list",
  "guides.telegramBot.step3.title": "Paste-from-AI inbox",
  "guides.telegramBot.step3.p1":
    "Brainstorm with Claude or ChatGPT, ask them to output in FlowSpace format, then paste the markdown to your bot. FlowSpace recognises the structure and queues it for your approval instead of acting immediately — review it on the home page and click Approve. Grab the ready-made prompt from the home page → “Import from AI” → “Copy AI prompt”.",
  "guides.telegramBot.step4.title": "What you can do",
  "guides.telegramBot.step4.row1.title": "Capture ideas on the go",
  "guides.telegramBot.step4.row1.body":
    "text the bot anything — it becomes a todo in your chosen list.",
  "guides.telegramBot.step4.row2.title": "Query your work from anywhere",
  "guides.telegramBot.step4.row2.body": "— live read-only summaries.",
  "guides.telegramBot.step4.row3.title": "Mark things done",
  "guides.telegramBot.step4.row3.body":
    "— first 4 chars of the ID shown after each task are enough.",
  "guides.telegramBot.step4.row4.title": "Push a whole project structure",
  "guides.telegramBot.step4.row4.body": "paste FlowSpace markdown; it queues for your approval.",
  "guides.telegramBot.step4.row5.title": "Choose where captures land",
  "guides.telegramBot.step4.row5.body": "set the target list in the Telegram section.",

  // ── Custom fields ───────────────────────────────────────────────────
  "guides.customFields.label": "Custom fields",
  "guides.customFields.blurb": "Add your own metadata to elements and tasks.",
  "guides.customFields.step1.title": "What are custom fields?",
  "guides.customFields.step1.p1":
    "Extra columns you bolt onto your elements or tasks — anything that isn't already built in. Estimated hours, client name, repo URL, confidence rating, a checkbox for “ready for review”. Once you define a field it shows up on the task detail sheet (or element panel) for whichever element types you scoped it to.",
  "guides.customFields.step2.title": "The field types",
  "guides.customFields.step2.row1.title": "Text / Long text",
  "guides.customFields.step2.row1.body": "free-form strings.",
  "guides.customFields.step2.row2.title": "Number",
  "guides.customFields.step2.row2.body": "integers or decimals, e.g. an estimate.",
  "guides.customFields.step2.row3.title": "Date",
  "guides.customFields.step2.row3.body": "review date, kickoff, etc.",
  "guides.customFields.step2.row4.title": "Checkbox",
  "guides.customFields.step2.row4.body": "a yes/no flag.",
  "guides.customFields.step2.row5.title": "Select / Multi-select",
  "guides.customFields.step2.row5.body": "fixed options (add them after creating).",
  "guides.customFields.step2.row6.title": "URL / Email",
  "guides.customFields.step2.row6.body": "typed input with validation.",
  "guides.customFields.step2.row7.title": "Rating",
  "guides.customFields.step2.row7.body": "1–5 stars.",
  "guides.customFields.step3.title": "Scope — where a field shows up",
  "guides.customFields.step3.p1a": "When you create a field you choose its scope:",
  "guides.customFields.step3.scopeAll": "All elements",
  "guides.customFields.step3.p1b": ",",
  "guides.customFields.step3.scopeType": "a specific element type",
  "guides.customFields.step3.p1c": "(only Projects, only Tasks…), or",
  "guides.customFields.step3.scopeProject": "a single project",
  "guides.customFields.step3.p1d":
    ". The field then appears on the detail panel of everything that matches.",

  // ── Calendar sync ───────────────────────────────────────────────────
  "guides.calendarSync.label": "Calendar sync",
  "guides.calendarSync.blurb": "Push due dates to Google Calendar.",
  "guides.calendarSync.step1.title": "What gets synced",
  "guides.calendarSync.step1.p1a": "Once connected, FlowSpace pushes anything with a",
  "guides.calendarSync.step1.dateWord": "date",
  "guides.calendarSync.step1.p1b": "to your Google Calendar as an",
  "guides.calendarSync.step1.allDayWord": "all-day event",
  "guides.calendarSync.step1.p1c": ":",
  "guides.calendarSync.step2.title": "The four sources",
  "guides.calendarSync.step2.row1.title": "Tasks",
  "guides.calendarSync.step2.row1.body": "any task with a due date.",
  "guides.calendarSync.step2.row2.title": "To-dos",
  "guides.calendarSync.step2.row2.body": "to-do items with a due date.",
  "guides.calendarSync.step2.row3.title": "Reminders",
  "guides.calendarSync.step2.row3.body": "the reminder's date/time.",
  "guides.calendarSync.step2.row4.title": "Project deadlines",
  "guides.calendarSync.step2.row4.body": "a project's own due date.",
  "guides.calendarSync.step3.title": "How to make one show up",
  "guides.calendarSync.step3.p1a": "Create a task and give it a",
  "guides.calendarSync.step3.dueDateWord": "due date",
  "guides.calendarSync.step3.p1b":
    "(or add a reminder, or set a project's due date). Within ~5 minutes it appears in Google Calendar — or hit",
  "guides.calendarSync.step3.syncNowWord": "Sync now",
  "guides.calendarSync.step3.p1c":
    "in the Calendar sync section to push immediately and see the count.",
  "guides.calendarSync.step4.title": "One-way + cleanup",
  "guides.calendarSync.step4.p1":
    "Sync is one-way (FlowSpace → Google). Editing the event in Google won't change FlowSpace. Remove the due date or delete the item and the matching event disappears on the next sync. Open Google Calendar on your phone or the web to see them.",

  // ── AI response length ──────────────────────────────────────────────
  "guides.aiResponseLength.label": "AI response length",
  "guides.aiResponseLength.blurb": "Control how long AI answers can get (max tokens).",
  "guides.aiResponseLength.step1.title": "What is “max tokens”?",
  "guides.aiResponseLength.step1.p1a": "A token is a chunk of text — roughly",
  "guides.aiResponseLength.step1.threeQuarters": "¾ of a word",
  "guides.aiResponseLength.step1.p1b": "(so ~1,000 tokens ≈ 750 words). The number is the",
  "guides.aiResponseLength.step1.maxLength": "maximum length",
  "guides.aiResponseLength.step1.p1c":
    "an AI answer is allowed to reach. Raise it for longer answers, lower it to keep things short and fast.",
  "guides.aiResponseLength.step2.title": "Why the defaults are generous",
  "guides.aiResponseLength.step2.p1a": "Some models (e.g.",
  "guides.aiResponseLength.step2.p1b":
    ") spend hidden “thinking” tokens that count against this same cap. If the budget is too small, thinking eats it and the visible answer gets cut off mid-sentence. The defaults leave plenty of room. A simpler local model just stops at the natural end, so a high ceiling does no harm.",
  "guides.aiResponseLength.step3.title": "The four fields",
  "guides.aiResponseLength.step3.row1.title": "Summarize · One line",
  "guides.aiResponseLength.step3.row1.body": "a single-sentence summary (default 1024).",
  "guides.aiResponseLength.step3.row2.title": "Summarize · Short",
  "guides.aiResponseLength.step3.row2.body": "3–5 bullet points (default 2048).",
  "guides.aiResponseLength.step3.row3.title": "Summarize · Detailed",
  "guides.aiResponseLength.step3.row3.body": "one or two full paragraphs (default 4096).",
  "guides.aiResponseLength.step3.row4.title": "Other actions",
  "guides.aiResponseLength.step3.row4.body":
    "expand, improve, continue, generate to-dos (default 2048).",
  "guides.aiResponseLength.step4.title": "Tuning tips",
  "guides.aiResponseLength.step4.p1a": "If a summary still comes out truncated,",
  "guides.aiResponseLength.step4.raiseWord": "raise",
  "guides.aiResponseLength.step4.p1b":
    "that field. If answers are longer or slower than you want,",
  "guides.aiResponseLength.step4.lowerWord": "lower",
  "guides.aiResponseLength.step4.p1c":
    "it. Changes apply to the next AI action — no reload needed.",

  // ── Server events ───────────────────────────────────────────────────
  "guides.serverEvents.label": "Server events",
  "guides.serverEvents.blurb": "The admin audit log explained.",
  "guides.serverEvents.step1.title": "What are server events?",
  "guides.serverEvents.step1.p1a":
    "The audit log of everything important the server did. Each entry records",
  "guides.serverEvents.step1.whenWord": "when",
  "guides.serverEvents.step1.p1b": "something happened,",
  "guides.serverEvents.step1.whatWord": "what",
  "guides.serverEvents.step1.p1c": "happened, and",
  "guides.serverEvents.step1.whoWord": "who",
  "guides.serverEvents.step1.p1d":
    "triggered it. Use it to debug issues, spot suspicious activity, or confirm a deploy succeeded.",
  "guides.serverEvents.step2.title": "Event types you'll see",
  "guides.serverEvents.step2.row1.body":
    "container booted or shut down. After a deploy you should see a fresh start.",
  "guides.serverEvents.step2.row2.body": "scheduled backups. Red = investigate.",
  "guides.serverEvents.step2.row3.body": "session activity, for security review.",
  "guides.serverEvents.step2.row4.body": "new signup. Cross-check the Users tab.",
  "guides.serverEvents.step2.row5.body": "admin or role flips. High-impact.",
  "guides.serverEvents.step2.row6.body": "server-side problems logged for investigation.",

  // ── Quick add & shortcuts ───────────────────────────────────────────
  "guides.quickAdd.label": "Quick add & shortcuts",
  "guides.quickAdd.blurb":
    "Type tasks in plain language; drive the board with the keyboard.",
  "guides.quickAdd.step1.title": "Quick add with natural language",
  "guides.quickAdd.step1.p1a": "Press",
  "guides.quickAdd.step1.p1b":
    "anywhere in a project to open the quick-add bar, then type the task the way you'd say it. FlowSpace pulls out the due date and priority and files the rest as the title. It also works in the inline",
  "guides.quickAdd.step1.addTaskWord": "Add task",
  "guides.quickAdd.step1.p1c": "boxes on the List and Board.",
  "guides.quickAdd.step2.title": "What it understands",
  "guides.quickAdd.step2.row1.title": "Priority",
  "guides.quickAdd.step2.row2.title": "When",
  "guides.quickAdd.step2.row2.a": "a weekday like",
  "guides.quickAdd.step2.row2.b": ", or an exact date",
  "guides.quickAdd.step2.row3.title": "Example",
  "guides.quickAdd.step2.row3.body":
    "→ a high-priority task “Submit report” due this Friday",
  "guides.quickAdd.step3.title": "Keyboard shortcuts",
  "guides.quickAdd.step3.views":
    "switch view (Overview, List, Board, Calendar, Gantt, Table)",
  "guides.quickAdd.step3.quickAdd": "open quick-add",
  "guides.quickAdd.step3.search": "search",
  "guides.quickAdd.step3.filter": "toggle the filter bar",
  "guides.quickAdd.step3.move": "move the cursor down / up the List (↓ / ↑ also work)",
  "guides.quickAdd.step3.openTask": "open the task under the cursor",
  "guides.quickAdd.step3.toggleComplete":
    "mark the task under the cursor complete / incomplete",
  "guides.quickAdd.step3.note":
    "Shortcuts pause whenever you're typing in a field, so they never get in the way.",
}

export const ar: Record<string, string> = {
  // ── رموز الواجهة البرمجية (API) ──────────────────────────────────────
  "guides.apiTokens.label": "رموز الواجهة البرمجية",
  "guides.apiTokens.blurb": "اسمح للنصوص البرمجية والتكاملات بالعمل نيابةً عنك.",
  "guides.apiTokens.step1.title": "ما هو رمز الواجهة البرمجية؟",
  "guides.apiTokens.step1.p1":
    "الرمز هو مفتاح طويل الأمد يتيح لنص برمجي أو مهمة مجدولة أو أداة العمل نيابةً عنك — دون كلمة مرورك. أي شخص يمتلكه يستطيع فعل كل ما تستطيعه، لذا تعامل معه كأنه كلمة مرور ولا تلصقه أبدًا في مكان عام.",
  "guides.apiTokens.step2.title": "أصدِر رمزًا",
  "guides.apiTokens.step2.p1a":
    "في قسم رموز الواجهة البرمجية، امنح الرمز اسمًا يوضح الغرض منه (مثل",
  "guides.apiTokens.step2.p1b":
    ")، واختر مدة الصلاحية، ثم اضغط على إصدار. سترى القيمة الكاملة",
  "guides.apiTokens.step2.p1c":
    "مرة واحدة فقط — انسخها فورًا إلى مدير كلمات المرور أو إلى أسرار النص البرمجي لديك.",
  "guides.apiTokens.step3.title": "استخدمه في طلب",
  "guides.apiTokens.step3.p1a": "أرسل الرمز كترويسة",
  "guides.apiTokens.step3.p1b":
    "في أي مسار من مسارات الواجهة البرمجية يدعم ذلك. إليك نقطة نهاية قاصّ الويب، التي تُسقِط عنصرًا معلّقًا في جرسك:",
  "guides.apiTokens.step4.title": "حافظ على أمانه — يمكنك الإلغاء في أي وقت",
  "guides.apiTokens.step4.p1":
    "إذا تسرّب رمز، أو انتهيت من نص برمجي، فاضغط على أيقونة سلة المهملات بجانبه. سيتوقف عن العمل فورًا — دون التأثير على أي رموز أخرى. اضبط مدة صلاحية قصيرة للرموز التي تحتاجها لفترة وجيزة فقط.",

  // ── تنسيق ماركداون ───────────────────────────────────────────────────
  "guides.markdownFormat.label": "تنسيق ماركداون",
  "guides.markdownFormat.blurb": "حوّل النص العادي إلى مشاريع وصفحات ومهام.",
  "guides.markdownFormat.step1.title": "اكتب مرة واحدة، واستورد في أي مكان",
  "guides.markdownFormat.step1.p1":
    "اكتب النص بهذا التنسيق وستحوّله FlowSpace إلى عنصر منظَّم. يعمل في الاستيراد من الذكاء الاصطناعي وعند إرساله بالبريد الإلكتروني — وحتى البريد العادي يتحوّل إلى مهمة بسيطة. توضّح الخطوات التالية مثالًا كاملًا، ومعنى كل رمز، ونصًّا جاهزًا للذكاء الاصطناعي.",
  "guides.markdownFormat.step2.title": "مثال كامل",
  "guides.markdownFormat.step2.p1":
    "هذا يستخدم كل حقل. انسخه، وعدّل القيم، ثم استورد — أو استخدمه كمرجع فقط.",
  "guides.markdownFormat.step3.title": "دليل الرموز",
  "guides.markdownFormat.step3.typeTitle":
    "السطر الأول إلزامي. النوع = Project أو Page أو Todo أو Canvas أو Reminder أو Process.",
  "guides.markdownFormat.step3.status": "planning · active · paused · completed (للمشاريع).",
  "guides.markdownFormat.step3.due": "تاريخ استحقاق اختياري (بصيغة ISO).",
  "guides.markdownFormat.step3.tags": "اختياري، مفصول بفواصل.",
  "guides.markdownFormat.step3.tasks": "يبدأ قائمة المهام (## Steps في العملية Process).",
  "guides.markdownFormat.step3.checkbox": "مهمة مفتوحة / مكتملة.",
  "guides.markdownFormat.step3.indent": "أزِح مسافتين ← مهمة فرعية للمهمة التي فوقها.",
  "guides.markdownFormat.step3.checklist":
    "مع إزاحة ← قائمة تحقق؛ وأسطر - [ ] المُزاحة تحتها هي عناصرها.",
  "guides.markdownFormat.step3.estimate": "تقدير زمني اختياري للمهمة (و~1h30m أيضًا).",
  "guides.markdownFormat.step3.priority": "الأولوية: urgent · high · medium · low.",
  "guides.markdownFormat.step3.taskDue": "تاريخ استحقاق لمهمة واحدة.",
  "guides.markdownFormat.step3.notes": "نص حر ← وصف العنصر.",
  "guides.markdownFormat.step4.title": "دع الذكاء الاصطناعي يكتبه لك",
  "guides.markdownFormat.step4.p1":
    "الصق هذا النص في ChatGPT / Claude بعد تفريغ أفكارك وسيُخرج ماركداون بهذا التنسيق تمامًا — جاهزًا للصقه في أداة الاستيراد أو لإرساله بالبريد.",
  "guides.markdownFormat.step5.title": "نصائح وحدود",
  "guides.markdownFormat.step5.row1.title": "عنصر واحد لكل عملية استيراد",
  "guides.markdownFormat.step5.row1.a": "كل عملية استيراد تُنشئ عنصرًا واحدًا — سطر ترويسة",
  "guides.markdownFormat.step5.row1.b":
    "واحد بالضبط. إذا كانت ملاحظاتك تغطي عدة مشاريع، فأنجزها واحدًا تلو الآخر، أو الصق كل كتلة على حدة.",
  "guides.markdownFormat.step5.row2.title": "تريد صفحة عادية بدلًا من قائمة مهام؟",
  "guides.markdownFormat.step5.row2.a": "ابدأ بـ",
  "guides.markdownFormat.step5.row2.b": "بدلًا من",
  "guides.markdownFormat.step5.row2.c":
    "— يصبح كل ما تحت الترويسة هو متن الصفحة (تجاوز",
  "guides.markdownFormat.step5.row2.d": ").",
  "guides.markdownFormat.step5.row3.title": "نسيت المربعات؟ لا يزال يعمل",
  "guides.markdownFormat.step5.row3.a": "إذا أسقط النموذج مربعات",
  "guides.markdownFormat.step5.row3.b": "، فإن النقاط العادية تحت",
  "guides.markdownFormat.step5.row3.c": "تُستورَد أيضًا كمهام مفتوحة — لكن صيغة",
  "guides.markdownFormat.step5.row3.d": "هي الأكثر موثوقية.",

  // ── بوت تيليجرام ─────────────────────────────────────────────────────
  "guides.telegramBot.label": "بوت تيليجرام",
  "guides.telegramBot.blurb": "التقط أعمالك واستعلم عنها من المحادثة.",
  "guides.telegramBot.step1.title": "التقاط ذكي — صياغة ضمنية",
  "guides.telegramBot.step1.p1":
    "أرسل للبوت أي شيء نصًّا فيتحوّل إلى مهمة. انثر هذه الرموز في أي موضع من الرسالة — يستخرجها البوت ويخبرك بما التقطه.",
  "guides.telegramBot.step1.priority": "تعيين الأولوية (urgent/high/medium/low)",
  "guides.telegramBot.step1.due": "تعيين تاريخ استحقاق بصيغة ISO",
  "guides.telegramBot.step1.relative": "أو @today / @tomorrow / @next-week",
  "guides.telegramBot.step1.tag": "إضافة وسم (أحرف وأرقام وشرطات)",
  "guides.telegramBot.step1.exampleLabel": "مثال:",
  "guides.telegramBot.step1.exampleResultA": "← العنوان",
  "guides.telegramBot.step1.exampleResultB": "، الاستحقاق 2026-06-15، الأولوية عالية، الوسم",
  "guides.telegramBot.step2.title": "الأوامر",
  "guides.telegramBot.step2.text": "التقاط كمهمة (صياغة ذكية)",
  "guides.telegramBot.step2.tasks": "المهام المفتوحة عبر المشاريع",
  "guides.telegramBot.step2.deadlines": "المستحقة خلال الأيام N القادمة",
  "guides.telegramBot.step2.projects": "المشاريع + نسبة الإنجاز %",
  "guides.telegramBot.step2.lists": "قوائم المهام لديك",
  "guides.telegramBot.step2.add": "إضافة سريعة إلى الافتراضية",
  "guides.telegramBot.step2.todo": "إضافة إلى قائمة محددة",
  "guides.telegramBot.step2.task": "مهمة جديدة في مشروع",
  "guides.telegramBot.step2.done": "وضع علامة منجَز على مهمة",
  "guides.telegramBot.step2.help": "قائمة الأوامر الكاملة",
  "guides.telegramBot.step3.title": "صندوق اللصق من الذكاء الاصطناعي",
  "guides.telegramBot.step3.p1":
    "تبادل الأفكار مع Claude أو ChatGPT، واطلب منهما الإخراج بتنسيق FlowSpace، ثم الصق الماركداون إلى بوتك. يتعرّف FlowSpace على البنية ويضعها في طابور موافقتك بدلًا من التصرّف فورًا — راجعها في الصفحة الرئيسية واضغط على موافقة. احصل على النص الجاهز من الصفحة الرئيسية ← «الاستيراد من الذكاء الاصطناعي» ← «نسخ نص الذكاء الاصطناعي».",
  "guides.telegramBot.step4.title": "ما الذي يمكنك فعله",
  "guides.telegramBot.step4.row1.title": "التقط الأفكار وأنت في الطريق",
  "guides.telegramBot.step4.row1.body":
    "أرسل للبوت أي شيء — فيتحوّل إلى مهمة في القائمة التي اخترتها.",
  "guides.telegramBot.step4.row2.title": "استعلم عن أعمالك من أي مكان",
  "guides.telegramBot.step4.row2.body": "— ملخّصات حيّة للقراءة فقط.",
  "guides.telegramBot.step4.row3.title": "ضع علامة منجَز على الأشياء",
  "guides.telegramBot.step4.row3.body":
    "— تكفي أول 4 أحرف من المعرّف المعروض بعد كل مهمة.",
  "guides.telegramBot.step4.row4.title": "ادفع بنية مشروع كاملة",
  "guides.telegramBot.step4.row4.body": "الصق ماركداون FlowSpace؛ فيُوضع في طابور موافقتك.",
  "guides.telegramBot.step4.row5.title": "اختر وجهة الالتقاطات",
  "guides.telegramBot.step4.row5.body": "اضبط القائمة المستهدفة في قسم تيليجرام.",

  // ── الحقول المخصّصة ──────────────────────────────────────────────────
  "guides.customFields.label": "الحقول المخصّصة",
  "guides.customFields.blurb": "أضِف بياناتك الوصفية الخاصة إلى العناصر والمهام.",
  "guides.customFields.step1.title": "ما هي الحقول المخصّصة؟",
  "guides.customFields.step1.p1":
    "أعمدة إضافية تُلحِقها بعناصرك أو مهامك — أي شيء غير مُضمَّن أصلًا. الساعات المقدَّرة، اسم العميل، رابط المستودع، تقييم الثقة، مربع اختيار لـ «جاهز للمراجعة». بمجرد تعريف حقل يظهر في ورقة تفاصيل المهمة (أو لوحة العنصر) لأنواع العناصر التي حدّدت نطاقها له.",
  "guides.customFields.step2.title": "أنواع الحقول",
  "guides.customFields.step2.row1.title": "نص / نص طويل",
  "guides.customFields.step2.row1.body": "سلاسل نصية حرّة.",
  "guides.customFields.step2.row2.title": "رقم",
  "guides.customFields.step2.row2.body": "أعداد صحيحة أو عشرية، مثل تقدير.",
  "guides.customFields.step2.row3.title": "تاريخ",
  "guides.customFields.step2.row3.body": "تاريخ المراجعة، الانطلاق، إلخ.",
  "guides.customFields.step2.row4.title": "مربع اختيار",
  "guides.customFields.step2.row4.body": "علامة نعم/لا.",
  "guides.customFields.step2.row5.title": "اختيار / اختيار متعدد",
  "guides.customFields.step2.row5.body": "خيارات ثابتة (أضِفها بعد الإنشاء).",
  "guides.customFields.step2.row6.title": "رابط / بريد إلكتروني",
  "guides.customFields.step2.row6.body": "إدخال مُصنَّف مع تحقق.",
  "guides.customFields.step2.row7.title": "تقييم",
  "guides.customFields.step2.row7.body": "من 1 إلى 5 نجوم.",
  "guides.customFields.step3.title": "النطاق — أين يظهر الحقل",
  "guides.customFields.step3.p1a": "عند إنشاء حقل تختار نطاقه:",
  "guides.customFields.step3.scopeAll": "كل العناصر",
  "guides.customFields.step3.p1b": "،",
  "guides.customFields.step3.scopeType": "نوع عنصر محدد",
  "guides.customFields.step3.p1c": "(المشاريع فقط، المهام فقط…)، أو",
  "guides.customFields.step3.scopeProject": "مشروع واحد",
  "guides.customFields.step3.p1d":
    ". عندها يظهر الحقل في لوحة تفاصيل كل ما يطابقه.",

  // ── مزامنة التقويم ───────────────────────────────────────────────────
  "guides.calendarSync.label": "مزامنة التقويم",
  "guides.calendarSync.blurb": "ادفع تواريخ الاستحقاق إلى تقويم Google.",
  "guides.calendarSync.step1.title": "ما الذي تتم مزامنته",
  "guides.calendarSync.step1.p1a": "بمجرد الاتصال، تدفع FlowSpace أي شيء له",
  "guides.calendarSync.step1.dateWord": "تاريخ",
  "guides.calendarSync.step1.p1b": "إلى تقويم Google كـ",
  "guides.calendarSync.step1.allDayWord": "حدث طوال اليوم",
  "guides.calendarSync.step1.p1c": ":",
  "guides.calendarSync.step2.title": "المصادر الأربعة",
  "guides.calendarSync.step2.row1.title": "المهام",
  "guides.calendarSync.step2.row1.body": "أي مهمة لها تاريخ استحقاق.",
  "guides.calendarSync.step2.row2.title": "عناصر المهام",
  "guides.calendarSync.step2.row2.body": "عناصر المهام التي لها تاريخ استحقاق.",
  "guides.calendarSync.step2.row3.title": "التذكيرات",
  "guides.calendarSync.step2.row3.body": "تاريخ/وقت التذكير.",
  "guides.calendarSync.step2.row4.title": "مواعيد المشاريع النهائية",
  "guides.calendarSync.step2.row4.body": "تاريخ استحقاق المشروع نفسه.",
  "guides.calendarSync.step3.title": "كيف تجعل واحدًا يظهر",
  "guides.calendarSync.step3.p1a": "أنشئ مهمة وامنحها",
  "guides.calendarSync.step3.dueDateWord": "تاريخ استحقاق",
  "guides.calendarSync.step3.p1b":
    "(أو أضِف تذكيرًا، أو اضبط تاريخ استحقاق مشروع). خلال ~5 دقائق يظهر في تقويم Google — أو اضغط على",
  "guides.calendarSync.step3.syncNowWord": "مزامنة الآن",
  "guides.calendarSync.step3.p1c":
    "في قسم مزامنة التقويم للدفع فورًا ورؤية العدد.",
  "guides.calendarSync.step4.title": "اتجاه واحد + تنظيف",
  "guides.calendarSync.step4.p1":
    "المزامنة باتجاه واحد (من FlowSpace إلى Google). تعديل الحدث في Google لن يغيّر FlowSpace. أزِل تاريخ الاستحقاق أو احذف العنصر فيختفي الحدث المطابق في المزامنة التالية. افتح تقويم Google على هاتفك أو الويب لرؤيتها.",

  // ── طول رد الذكاء الاصطناعي ──────────────────────────────────────────
  "guides.aiResponseLength.label": "طول رد الذكاء الاصطناعي",
  "guides.aiResponseLength.blurb": "تحكّم في الحد الأقصى لطول إجابات الذكاء الاصطناعي (max tokens).",
  "guides.aiResponseLength.step1.title": "ما هو «الحد الأقصى للرموز (max tokens)»؟",
  "guides.aiResponseLength.step1.p1a": "الرمز (token) هو جزء من النص — يساوي تقريبًا",
  "guides.aiResponseLength.step1.threeQuarters": "¾ كلمة",
  "guides.aiResponseLength.step1.p1b": "(أي ~1000 رمز ≈ 750 كلمة). والرقم هو",
  "guides.aiResponseLength.step1.maxLength": "أقصى طول",
  "guides.aiResponseLength.step1.p1c":
    "مسموح به لإجابة الذكاء الاصطناعي. ارفعه للإجابات الأطول، واخفِضه لإبقاء الأمور قصيرة وسريعة.",
  "guides.aiResponseLength.step2.title": "لماذا الإعدادات الافتراضية سخيّة",
  "guides.aiResponseLength.step2.p1a": "بعض النماذج (مثل",
  "guides.aiResponseLength.step2.p1b":
    ") تُنفِق رموز «تفكير» خفيّة تُحتسَب من الحد نفسه. إذا كانت الميزانية صغيرة جدًا، يلتهمها التفكير وتُقطَع الإجابة الظاهرة في منتصف الجملة. تترك الإعدادات الافتراضية مساحة وافرة. أما النموذج المحلي الأبسط فيتوقف عند نهايته الطبيعية، لذا فإن السقف العالي لا يضرّ.",
  "guides.aiResponseLength.step3.title": "الحقول الأربعة",
  "guides.aiResponseLength.step3.row1.title": "تلخيص · سطر واحد",
  "guides.aiResponseLength.step3.row1.body": "ملخّص بجملة واحدة (الافتراضي 1024).",
  "guides.aiResponseLength.step3.row2.title": "تلخيص · قصير",
  "guides.aiResponseLength.step3.row2.body": "من 3 إلى 5 نقاط (الافتراضي 2048).",
  "guides.aiResponseLength.step3.row3.title": "تلخيص · مفصّل",
  "guides.aiResponseLength.step3.row3.body": "فقرة أو فقرتان كاملتان (الافتراضي 4096).",
  "guides.aiResponseLength.step3.row4.title": "إجراءات أخرى",
  "guides.aiResponseLength.step3.row4.body":
    "التوسيع، التحسين، المتابعة، توليد المهام (الافتراضي 2048).",
  "guides.aiResponseLength.step4.title": "نصائح للضبط",
  "guides.aiResponseLength.step4.p1a": "إذا خرج الملخّص مقطوعًا، فـ",
  "guides.aiResponseLength.step4.raiseWord": "ارفع",
  "guides.aiResponseLength.step4.p1b":
    "ذلك الحقل. وإذا كانت الإجابات أطول أو أبطأ مما تريد، فـ",
  "guides.aiResponseLength.step4.lowerWord": "اخفِض",
  "guides.aiResponseLength.step4.p1c":
    "ه. تسري التغييرات على إجراء الذكاء الاصطناعي التالي — دون الحاجة لإعادة تحميل.",

  // ── أحداث الخادم ─────────────────────────────────────────────────────
  "guides.serverEvents.label": "أحداث الخادم",
  "guides.serverEvents.blurb": "شرح سجل تدقيق الإدارة.",
  "guides.serverEvents.step1.title": "ما هي أحداث الخادم؟",
  "guides.serverEvents.step1.p1a":
    "سجل التدقيق لكل أمر مهم قام به الخادم. يسجّل كل إدخال",
  "guides.serverEvents.step1.whenWord": "متى",
  "guides.serverEvents.step1.p1b": "حدث شيء ما، و",
  "guides.serverEvents.step1.whatWord": "ماذا",
  "guides.serverEvents.step1.p1c": "حدث، و",
  "guides.serverEvents.step1.whoWord": "مَن",
  "guides.serverEvents.step1.p1d":
    "أطلقه. استخدمه لتصحيح المشكلات، أو رصد النشاط المريب، أو تأكيد نجاح عملية نشر.",
  "guides.serverEvents.step2.title": "أنواع الأحداث التي ستراها",
  "guides.serverEvents.step2.row1.body":
    "إقلاع الحاوية أو إيقافها. بعد النشر يُفترض أن ترى إقلاعًا جديدًا.",
  "guides.serverEvents.step2.row2.body": "النسخ الاحتياطية المجدولة. الأحمر = تحقّق.",
  "guides.serverEvents.step2.row3.body": "نشاط الجلسات، لمراجعة الأمان.",
  "guides.serverEvents.step2.row4.body": "تسجيل جديد. تحقّق منه في تبويب المستخدمين.",
  "guides.serverEvents.step2.row5.body": "تغيير صلاحية إدارة أو دور. عالي التأثير.",
  "guides.serverEvents.step2.row6.body": "مشكلات من جانب الخادم مسجَّلة للتحقيق.",

  // ── الإضافة السريعة والاختصارات ──────────────────────────────────────
  "guides.quickAdd.label": "الإضافة السريعة والاختصارات",
  "guides.quickAdd.blurb": "اكتب المهام بلغة طبيعية؛ وتحكّم باللوحة من لوحة المفاتيح.",
  "guides.quickAdd.step1.title": "إضافة سريعة بلغة طبيعية",
  "guides.quickAdd.step1.p1a": "اضغط",
  "guides.quickAdd.step1.p1b":
    "في أي مكان داخل مشروع لفتح شريط الإضافة السريعة، ثم اكتب المهمة كما تنطقها. تستخرج FlowSpace تاريخ الاستحقاق والأولوية وتُسجّل الباقي كعنوان. كما يعمل أيضًا في مربعات",
  "guides.quickAdd.step1.addTaskWord": "إضافة مهمة",
  "guides.quickAdd.step1.p1c": "الضمنية في القائمة واللوحة.",
  "guides.quickAdd.step2.title": "ما الذي يفهمه",
  "guides.quickAdd.step2.row1.title": "الأولوية",
  "guides.quickAdd.step2.row2.title": "الوقت",
  "guides.quickAdd.step2.row2.a": "يومًا من الأسبوع مثل",
  "guides.quickAdd.step2.row2.b": "، أو تاريخًا محددًا",
  "guides.quickAdd.step2.row3.title": "مثال",
  "guides.quickAdd.step2.row3.body":
    "← مهمة عالية الأولوية «Submit report» مستحقة هذا الجمعة",
  "guides.quickAdd.step3.title": "اختصارات لوحة المفاتيح",
  "guides.quickAdd.step3.views":
    "تبديل العرض (نظرة عامة، قائمة، لوحة، تقويم، غانت، جدول)",
  "guides.quickAdd.step3.quickAdd": "فتح الإضافة السريعة",
  "guides.quickAdd.step3.search": "بحث",
  "guides.quickAdd.step3.filter": "إظهار/إخفاء شريط التصفية",
  "guides.quickAdd.step3.move": "تحريك المؤشر لأسفل / لأعلى في القائمة (↓ / ↑ تعملان أيضًا)",
  "guides.quickAdd.step3.openTask": "فتح المهمة تحت المؤشر",
  "guides.quickAdd.step3.toggleComplete":
    "وضع علامة منجَز / غير منجَز على المهمة تحت المؤشر",
  "guides.quickAdd.step3.note":
    "تتوقف الاختصارات مؤقتًا كلما كنت تكتب في حقل، فلا تعترض طريقك أبدًا.",
}
