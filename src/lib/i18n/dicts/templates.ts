/**
 * Templates area strings — the /templates page (TemplatesContent): toolbar,
 * type filters, template cards, the "use" and "create" dialogs, section
 * headers, empty state and toasts. All keys are prefixed "tpl.".
 */

export const en: Record<string, string> = {
  // Type / category labels (filter chips, create-dialog options, card badges)
  "tpl.type.all":       "All",
  "tpl.type.project":   "Project",
  "tpl.type.task":      "Task",
  "tpl.type.page":      "Page",
  "tpl.type.canvas":    "Canvas",
  "tpl.type.process":   "Process",
  "tpl.type.checklist": "Checklist",
  "tpl.type.dashboard": "Dashboard",
  "tpl.type.form":      "Form",

  // Toolbar
  "tpl.search.ph":   "Search templates...",
  "tpl.new":         "New Template",

  // Markdown blueprints disclosure
  "tpl.blueprints.title": "Markdown blueprints",
  "tpl.blueprints.help":  "— paste-to-import starters (Sprint, OKR, Content calendar…)",

  // Section headers
  "tpl.section.recent":     "Recently Used",
  "tpl.section.favorites":  "Favorites",
  "tpl.section.all":        "All Templates",
  "tpl.section.typed":      "{type} Templates",

  // Empty state
  "tpl.empty.title": "No templates found",
  "tpl.empty.help":  "Try a different filter or create a new template",

  // Card
  "tpl.card.fav.add":    "Add to favorites",
  "tpl.card.fav.remove": "Remove from favorites",
  "tpl.card.duplicate":  "Duplicate",
  "tpl.card.delete":     "Delete",
  "tpl.card.used.one":   "Used {count} time",
  "tpl.card.used.other": "Used {count} times",
  "tpl.card.use":        "Use Template",

  // Use Template dialog
  "tpl.use.title":     "Use Template",
  "tpl.use.from":      "Create a new {type} from",
  "tpl.use.titleLbl":  "Title",
  "tpl.use.title.ph":  "Enter a title...",
  "tpl.use.cancel":    "Cancel",
  "tpl.use.create":    "Create",

  // Create Template dialog
  "tpl.create.title":      "Create Template",
  "tpl.create.nameLbl":    "Name",
  "tpl.create.name.ph":    "Template name",
  "tpl.create.typeLbl":    "Type",
  "tpl.create.descLbl":    "Description",
  "tpl.create.desc.ph":    "Optional description",
  "tpl.create.iconLbl":    "Icon",
  "tpl.create.icon.ph":    "e.g. FolderKanban",
  "tpl.create.colorLbl":   "Color",
  "tpl.create.color.ph":   "e.g. #6366f1",
  "tpl.create.cancel":     "Cancel",
  "tpl.create.create":     "Create",

  // Toasts
  "tpl.toast.created":         "Created {type} from template",
  "tpl.toast.createFailed":    "Failed to create from template",
  "tpl.toast.nameRequired":    "Template name is required",
  "tpl.toast.tplCreated":      "Template created",
  "tpl.toast.tplCreateFailed": "Failed to create template",
  "tpl.toast.favFailed":       "Failed to update favorite",
  "tpl.toast.duplicated":      "Template duplicated",
  "tpl.toast.dupFailed":       "Failed to duplicate template",
  "tpl.toast.deleted":         "Template deleted",
  "tpl.toast.deleteFailed":    "Failed to delete template",
}

export const ar: Record<string, string> = {
  // Type / category labels (filter chips, create-dialog options, card badges)
  "tpl.type.all":       "الكل",
  "tpl.type.project":   "مشروع",
  "tpl.type.task":      "مهمة",
  "tpl.type.page":      "صفحة",
  "tpl.type.canvas":    "لوحة",
  "tpl.type.process":   "عملية",
  "tpl.type.checklist": "قائمة تحقق",
  "tpl.type.dashboard": "لوحة معلومات",
  "tpl.type.form":      "نموذج",

  // Toolbar
  "tpl.search.ph":   "ابحث في القوالب...",
  "tpl.new":         "قالب جديد",

  // Markdown blueprints disclosure
  "tpl.blueprints.title": "مخططات ماركداون",
  "tpl.blueprints.help":  "— بدايات جاهزة للصق والاستيراد (سبرنت، الأهداف والنتائج، تقويم المحتوى…)",

  // Section headers
  "tpl.section.recent":     "المستخدمة مؤخرًا",
  "tpl.section.favorites":  "المفضلة",
  "tpl.section.all":        "كل القوالب",
  "tpl.section.typed":      "قوالب {type}",

  // Empty state
  "tpl.empty.title": "لا توجد قوالب",
  "tpl.empty.help":  "جرّب عامل تصفية مختلفًا أو أنشئ قالبًا جديدًا",

  // Card
  "tpl.card.fav.add":    "إضافة إلى المفضلة",
  "tpl.card.fav.remove": "إزالة من المفضلة",
  "tpl.card.duplicate":  "تكرار",
  "tpl.card.delete":     "حذف",
  "tpl.card.used.one":   "استُخدم {count} مرة",
  "tpl.card.used.other": "استُخدم {count} مرة",
  "tpl.card.use":        "استخدام القالب",

  // Use Template dialog
  "tpl.use.title":     "استخدام القالب",
  "tpl.use.from":      "أنشئ {type} جديدًا من",
  "tpl.use.titleLbl":  "العنوان",
  "tpl.use.title.ph":  "أدخل عنوانًا...",
  "tpl.use.cancel":    "إلغاء",
  "tpl.use.create":    "إنشاء",

  // Create Template dialog
  "tpl.create.title":      "إنشاء قالب",
  "tpl.create.nameLbl":    "الاسم",
  "tpl.create.name.ph":    "اسم القالب",
  "tpl.create.typeLbl":    "النوع",
  "tpl.create.descLbl":    "الوصف",
  "tpl.create.desc.ph":    "وصف اختياري",
  "tpl.create.iconLbl":    "الأيقونة",
  "tpl.create.icon.ph":    "مثال: FolderKanban",
  "tpl.create.colorLbl":   "اللون",
  "tpl.create.color.ph":   "مثال: ‎#6366f1",
  "tpl.create.cancel":     "إلغاء",
  "tpl.create.create":     "إنشاء",

  // Toasts
  "tpl.toast.created":         "تم إنشاء {type} من القالب",
  "tpl.toast.createFailed":    "تعذّر الإنشاء من القالب",
  "tpl.toast.nameRequired":    "اسم القالب مطلوب",
  "tpl.toast.tplCreated":      "تم إنشاء القالب",
  "tpl.toast.tplCreateFailed": "تعذّر إنشاء القالب",
  "tpl.toast.favFailed":       "تعذّر تحديث المفضلة",
  "tpl.toast.duplicated":      "تم تكرار القالب",
  "tpl.toast.dupFailed":       "تعذّر تكرار القالب",
  "tpl.toast.deleted":         "تم حذف القالب",
  "tpl.toast.deleteFailed":    "تعذّر حذف القالب",
}
