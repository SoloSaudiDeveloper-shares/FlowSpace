/**
 * Lightweight i18n.
 *
 * A full next-intl integration would touch every component in the app.
 * To ship Arabic in one commit we do the minimal useful thing:
 *  - Translate the highest-visibility chrome strings (sidebar section
 *    names, top-level nav, common buttons, login form, settings tabs).
 *  - Provide a `t(key)` helper that falls back to English when a key is
 *    missing (no crashes on incomplete translations).
 *  - Wire a `<html lang dir>` attribute switch via the I18nProvider so
 *    Arabic flips the page to RTL automatically.
 *
 * Components opt in by importing `useT()` and calling `t("login.title")`.
 * The bulk of the app stays in English until someone translates it; the
 * fallback keeps everything working in the meantime.
 */

export type Locale = "en" | "ar"

export const LOCALES: { code: Locale; label: string; dir: "ltr" | "rtl" }[] = [
  { code: "en", label: "English",  dir: "ltr" },
  { code: "ar", label: "العربية",  dir: "rtl" },
]

/** A single nested-object dictionary per locale. Keys are dotted paths
 *  (e.g. "login.title"); values are the user-visible string. */
type Dict = Record<string, string>

const EN: Dict = {
  // Auth
  "login.title": "Sign in to your workspace",
  "login.username": "Username",
  "login.password": "Password",
  "login.submit": "Sign In",
  "login.creating": "Signing in...",
  "login.forgot": "Forgot password?",
  "login.register.title": "Create your workspace",
  "login.register.displayName": "Display Name",
  "login.register.confirm": "Confirm Password",
  "login.register.submit": "Create Account",
  "login.twofactor.label": "Authenticator code",
  "login.twofactor.help": "Open your authenticator app for a code, or use a recovery code if you lost your phone.",
  "login.username.ph": "Enter your username",
  "login.password.ph": "Enter your password",
  "login.password.ph.register": "Choose a password",
  "login.name.ph": "Your name",
  "login.confirm.ph": "Confirm your password",
  "login.twofactor.ph": "6-digit code or recovery code",
  "login.creating.register": "Creating account...",
  "login.footer.setup": "This will be the owner account for your workspace.",
  "login.footer.closed": "New signups are currently closed. Ask the owner for an invite.",
  "login.footer.default": "Your personal productivity workspace.",

  // Sidebar groups
  "sidebar.favorites":      "Favorites",
  "sidebar.projects":       "Projects",
  "sidebar.pages":          "Pages",
  "sidebar.canvases":       "Canvases",
  "sidebar.todoLists":      "Todo Lists",
  "sidebar.reminders":      "Reminders",
  "sidebar.processes":      "Processes",
  "sidebar.platform":       "Platform",
  "sidebar.feed":           "Feed",
  "sidebar.templates":      "Templates",
  "sidebar.forms":          "Forms",
  "sidebar.automations":    "Automations",
  "sidebar.approvals":      "Approvals",
  "sidebar.notifications":  "Notifications",
  "sidebar.people":         "People",
  "sidebar.admin":          "Admin",
  "sidebar.trash":          "Trash",
  "sidebar.settings":       "Settings",
  "sidebar.search":         "Search…",
  "sidebar.newElement":     "New element",

  // Settings tabs
  "settings.tab.account":      "Account",
  "settings.tab.data":         "Data",
  "settings.tab.look":         "Look & feel",
  "settings.tab.integrations": "Integrations",
  "settings.tab.help":         "Help",

  // Page header titles
  "page.home":          "Home",
  "page.settings":      "Settings",
  "page.people":        "People & Teams",
  "page.feed":          "Feed",
  "page.myFeed":        "My Feed",
  "page.adminFeed":     "Admin Feed",
  "page.reminders":     "Reminders",
  "page.notifications": "Notifications",
  "page.templates":     "Templates",
  "page.forms":         "Forms",
  "page.automations":   "Automations",
  "page.approvals":     "Approvals",
  "page.admin":         "Administration",
  "page.trash":         "Trash & Archive",

  // Common buttons
  "common.cancel":   "Cancel",
  "common.save":     "Save",
  "common.delete":   "Delete",
  "common.confirm":  "Confirm",
  "common.close":    "Close",
  "common.edit":     "Edit",
  "common.rename":   "Rename",
  "common.copy":     "Copy",
  "common.send":     "Send",
}

// Arabic translations of the strings above. Anything not present here
// falls back to English so partial coverage never crashes a page.
const AR: Dict = {
  // Auth
  "login.title": "تسجيل الدخول إلى مساحة العمل",
  "login.username": "اسم المستخدم",
  "login.password": "كلمة المرور",
  "login.submit": "تسجيل الدخول",
  "login.creating": "جارٍ تسجيل الدخول...",
  "login.forgot": "نسيت كلمة المرور؟",
  "login.register.title": "أنشئ مساحة عملك",
  "login.register.displayName": "الاسم الظاهر",
  "login.register.confirm": "تأكيد كلمة المرور",
  "login.register.submit": "إنشاء حساب",
  "login.twofactor.label": "رمز التحقق",
  "login.twofactor.help": "افتح تطبيق المصادقة للحصول على الرمز، أو استخدم رمز الاسترداد إذا فقدت هاتفك.",
  "login.username.ph": "أدخل اسم المستخدم",
  "login.password.ph": "أدخل كلمة المرور",
  "login.password.ph.register": "اختر كلمة مرور",
  "login.name.ph": "اسمك",
  "login.confirm.ph": "أكِّد كلمة المرور",
  "login.twofactor.ph": "رمز من 6 أرقام أو رمز استرداد",
  "login.creating.register": "جارٍ إنشاء الحساب...",
  "login.footer.setup": "سيكون هذا حساب المالك لمساحة عملك.",
  "login.footer.closed": "التسجيل مغلق حاليًا. اطلب دعوة من المالك.",
  "login.footer.default": "مساحة عملك الشخصية للإنتاجية.",

  // Sidebar groups
  "sidebar.favorites":      "المفضلة",
  "sidebar.projects":       "المشاريع",
  "sidebar.pages":          "الصفحات",
  "sidebar.canvases":       "اللوحات",
  "sidebar.todoLists":      "قوائم المهام",
  "sidebar.reminders":      "التذكيرات",
  "sidebar.processes":      "العمليات",
  "sidebar.platform":       "المنصة",
  "sidebar.feed":           "المستجدات",
  "sidebar.templates":      "القوالب",
  "sidebar.forms":          "النماذج",
  "sidebar.automations":    "الأتمتة",
  "sidebar.approvals":      "الموافقات",
  "sidebar.notifications":  "الإشعارات",
  "sidebar.people":         "الأشخاص",
  "sidebar.admin":          "الإدارة",
  "sidebar.trash":          "المهملات",
  "sidebar.settings":       "الإعدادات",
  "sidebar.search":         "بحث…",
  "sidebar.newElement":     "عنصر جديد",

  // Settings tabs
  "settings.tab.account":      "الحساب",
  "settings.tab.data":         "البيانات",
  "settings.tab.look":         "المظهر",
  "settings.tab.integrations": "التكاملات",
  "settings.tab.help":         "المساعدة",

  // Page header titles
  "page.home":          "الرئيسية",
  "page.settings":      "الإعدادات",
  "page.people":        "الأشخاص والفِرق",
  "page.feed":          "المستجدات",
  "page.myFeed":        "مستجداتي",
  "page.adminFeed":     "مستجدات الإدارة",
  "page.reminders":     "التذكيرات",
  "page.notifications": "الإشعارات",
  "page.templates":     "القوالب",
  "page.forms":         "النماذج",
  "page.automations":   "الأتمتة",
  "page.approvals":     "الموافقات",
  "page.admin":         "الإدارة",
  "page.trash":         "المهملات والأرشيف",

  // Common buttons
  "common.cancel":   "إلغاء",
  "common.save":     "حفظ",
  "common.delete":   "حذف",
  "common.confirm":  "تأكيد",
  "common.close":    "إغلاق",
  "common.edit":     "تعديل",
  "common.rename":   "إعادة تسمية",
  "common.copy":     "نسخ",
  "common.send":     "إرسال",
}

const DICTS: Record<Locale, Dict> = { en: EN, ar: AR }

/** Translate a key. Falls back to English, then to the key itself. */
export function translate(locale: Locale, key: string): string {
  return DICTS[locale]?.[key] ?? EN[key] ?? key
}

/** Direction for a given locale. */
export function localeDirection(locale: Locale): "ltr" | "rtl" {
  return LOCALES.find((l) => l.code === locale)?.dir ?? "ltr"
}
