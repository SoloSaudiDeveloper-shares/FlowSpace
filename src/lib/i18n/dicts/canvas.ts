/**
 * Canvas area strings — shape picker, node-type editors (card, embed,
 * group, image, shape, sticky note, text). Shape names are keyed by the
 * shape `id` (logic enum) so the picker can look them up by id without
 * mutating the SHAPES data table. All keys are prefixed "canvas.".
 */

export const en: Record<string, string> = {
  // Shape picker
  "canvas.shapes": "Shapes",
  "canvas.shapes.basic": "Basic Shapes",
  "canvas.shapes.flowchart": "Flowchart",

  // Shape names (keyed by shape id)
  "canvas.shape.rectangle": "Rectangle",
  "canvas.shape.rounded-rect": "Rounded Rect",
  "canvas.shape.circle": "Circle",
  "canvas.shape.triangle": "Triangle",
  "canvas.shape.diamond": "Diamond",
  "canvas.shape.parallelogram": "Parallelogram",
  "canvas.shape.hexagon": "Hexagon",
  "canvas.shape.pentagon": "Pentagon",
  "canvas.shape.octagon": "Octagon",
  "canvas.shape.star": "Star",
  "canvas.shape.arrow-right": "Arrow Right",
  "canvas.shape.arrow-left": "Arrow Left",
  "canvas.shape.arrow-double": "Double Arrow",
  "canvas.shape.cross": "Cross",
  "canvas.shape.speech-bubble": "Speech Bubble",
  "canvas.shape.process": "Process",
  "canvas.shape.decision": "Decision",
  "canvas.shape.terminal": "Terminal",
  "canvas.shape.data": "Data / I/O",
  "canvas.shape.document": "Document",
  "canvas.shape.predefined-process": "Predefined Process",
  "canvas.shape.database": "Database",
  "canvas.shape.manual-input": "Manual Input",
  "canvas.shape.delay": "Delay",
  "canvas.shape.preparation": "Preparation",
  "canvas.shape.loop-limit": "Loop Limit",
  "canvas.shape.display": "Display",

  // Card node
  "canvas.card.title.ph": "Card title",
  "canvas.card.description.ph": "Description...",
  "canvas.card.dictateTitle": "Dictate title",
  "canvas.card.dictateDescription": "Dictate description",

  // Embed node
  "canvas.embed.noElement": "No element linked",
  "canvas.embed.note.ph": "Add note...",

  // Group node
  "canvas.group.label.ph": "Group label...",
  "canvas.group.dictateLabel": "Dictate label",
  "canvas.color.indigo": "Indigo",
  "canvas.color.green": "Green",
  "canvas.color.amber": "Amber",
  "canvas.color.red": "Red",
  "canvas.color.cyan": "Cyan",
  "canvas.color.purple": "Purple",

  // Image node
  "canvas.image.caption.ph": "Caption...",
  "canvas.image.upload": "Upload",
  "canvas.image.url": "URL",
  "canvas.image.urlPrompt": "Enter image URL:",

  // Shape node
  "canvas.shapeNode.label.ph": "Label...",
  "canvas.shapeNode.setColor": "Set color",

  // Sticky note node
  "canvas.sticky.ph": "Write something...",

  // Text node
  "canvas.text.ph": "Type text...",

  // Shared node toolbar
  "canvas.dictate": "Dictate",
  "canvas.readAloud": "Read aloud",
}

export const ar: Record<string, string> = {
  // Shape picker
  "canvas.shapes": "الأشكال",
  "canvas.shapes.basic": "الأشكال الأساسية",
  "canvas.shapes.flowchart": "مخطط انسيابي",

  // Shape names (keyed by shape id)
  "canvas.shape.rectangle": "مستطيل",
  "canvas.shape.rounded-rect": "مستطيل مستدير",
  "canvas.shape.circle": "دائرة",
  "canvas.shape.triangle": "مثلث",
  "canvas.shape.diamond": "معيّن",
  "canvas.shape.parallelogram": "متوازي أضلاع",
  "canvas.shape.hexagon": "سداسي",
  "canvas.shape.pentagon": "خماسي",
  "canvas.shape.octagon": "ثماني",
  "canvas.shape.star": "نجمة",
  "canvas.shape.arrow-right": "سهم يمين",
  "canvas.shape.arrow-left": "سهم يسار",
  "canvas.shape.arrow-double": "سهم مزدوج",
  "canvas.shape.cross": "صليب",
  "canvas.shape.speech-bubble": "فقاعة كلام",
  "canvas.shape.process": "عملية",
  "canvas.shape.decision": "قرار",
  "canvas.shape.terminal": "طرفية",
  "canvas.shape.data": "بيانات / إدخال وإخراج",
  "canvas.shape.document": "مستند",
  "canvas.shape.predefined-process": "عملية معرّفة مسبقًا",
  "canvas.shape.database": "قاعدة بيانات",
  "canvas.shape.manual-input": "إدخال يدوي",
  "canvas.shape.delay": "تأخير",
  "canvas.shape.preparation": "تحضير",
  "canvas.shape.loop-limit": "حد التكرار",
  "canvas.shape.display": "عرض",

  // Card node
  "canvas.card.title.ph": "عنوان البطاقة",
  "canvas.card.description.ph": "الوصف...",
  "canvas.card.dictateTitle": "إملاء العنوان",
  "canvas.card.dictateDescription": "إملاء الوصف",

  // Embed node
  "canvas.embed.noElement": "لا يوجد عنصر مرتبط",
  "canvas.embed.note.ph": "أضف ملاحظة...",

  // Group node
  "canvas.group.label.ph": "تسمية المجموعة...",
  "canvas.group.dictateLabel": "إملاء التسمية",
  "canvas.color.indigo": "نيلي",
  "canvas.color.green": "أخضر",
  "canvas.color.amber": "كهرماني",
  "canvas.color.red": "أحمر",
  "canvas.color.cyan": "سماوي",
  "canvas.color.purple": "بنفسجي",

  // Image node
  "canvas.image.caption.ph": "تعليق...",
  "canvas.image.upload": "رفع",
  "canvas.image.url": "رابط",
  "canvas.image.urlPrompt": "أدخل رابط الصورة:",

  // Shape node
  "canvas.shapeNode.label.ph": "تسمية...",
  "canvas.shapeNode.setColor": "تعيين اللون",

  // Sticky note node
  "canvas.sticky.ph": "اكتب شيئًا...",

  // Text node
  "canvas.text.ph": "اكتب نصًا...",

  // Shared node toolbar
  "canvas.dictate": "إملاء",
  "canvas.readAloud": "القراءة بصوت عالٍ",
}
