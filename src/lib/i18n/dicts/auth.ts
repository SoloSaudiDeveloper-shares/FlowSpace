/**
 * Auth flows outside login: forgot-password, reset-password, verify-email.
 * Tone matches core.ts "login.*" (كلمة المرور، إعادة التعيين، تأكيد البريد).
 */

export const en: Record<string, string> = {
  // Forgot password
  "auth.forgot.title": "Forgot password",
  "auth.forgot.subtitle": "We'll email you a one-time link to set a new one.",
  "auth.forgot.emailNotConfigured":
    "Email isn't configured on this server. Ask the owner to set the {user} and {pass} environment variables.",
  "auth.forgot.sentTitle": "If an account exists for that username or email, a reset link is on its way.",
  "auth.forgot.sentHelp": "The link expires in 1 hour. Check your spam folder if you don't see it.",
  "auth.forgot.identifierLabel": "Username or email",
  "auth.forgot.identifierPh": "admin or you@example.com",
  "auth.forgot.submit": "Send reset link",
  "auth.forgot.submitting": "Sending...",
  "auth.forgot.backToSignIn": "Back to sign in",

  // Reset password — invalid/expired link
  "auth.reset.invalidTitle": "Link is invalid or expired",
  "auth.reset.invalidSubtitle": "Reset links expire after 1 hour and can only be used once.",
  "auth.reset.requestNew": "Request a new link",

  // Reset password — form
  "auth.reset.title": "Set a new password",
  "auth.reset.subtitle": "Choose something you haven't used before.",
  "auth.reset.doneTitle": "Password updated.",
  "auth.reset.doneHelp": "Redirecting you to sign in…",
  "auth.reset.newPasswordLabel": "New password",
  "auth.reset.newPasswordPh": "At least 8 characters",
  "auth.reset.confirmLabel": "Confirm new password",
  "auth.reset.submit": "Update password",
  "auth.reset.submitting": "Updating...",
  "auth.reset.errTooShort": "Password must be at least 8 characters",
  "auth.reset.errMismatch": "Passwords do not match",
  "auth.reset.errGeneric": "Something went wrong. Try again.",

  // Verify email
  "auth.verify.okTitle": "Email confirmed",
  "auth.verify.okSubtitle": "Your FlowSpace account is fully set up.",
  "auth.verify.failTitle": "Couldn't verify",
  "auth.verify.failGeneric": "Something went wrong.",
  "auth.verify.openApp": "Open FlowSpace",
}

export const ar: Record<string, string> = {
  // Forgot password
  "auth.forgot.title": "نسيت كلمة المرور",
  "auth.forgot.subtitle": "سنرسل إليك رابطًا لمرة واحدة عبر البريد لتعيين كلمة مرور جديدة.",
  "auth.forgot.emailNotConfigured":
    "لم يُهيّأ البريد الإلكتروني على هذا الخادم. اطلب من المالك تعيين متغيري البيئة {user} و {pass}.",
  "auth.forgot.sentTitle": "إذا كان هناك حساب لاسم المستخدم أو البريد الإلكتروني هذا، فإن رابط إعادة التعيين في طريقه إليك.",
  "auth.forgot.sentHelp": "ينتهي صلاحية الرابط خلال ساعة واحدة. تحقّق من مجلد البريد العشوائي إذا لم تجده.",
  "auth.forgot.identifierLabel": "اسم المستخدم أو البريد الإلكتروني",
  "auth.forgot.identifierPh": "admin أو you@example.com",
  "auth.forgot.submit": "إرسال رابط إعادة التعيين",
  "auth.forgot.submitting": "جارٍ الإرسال...",
  "auth.forgot.backToSignIn": "العودة إلى تسجيل الدخول",

  // Reset password — invalid/expired link
  "auth.reset.invalidTitle": "الرابط غير صالح أو منتهي الصلاحية",
  "auth.reset.invalidSubtitle": "تنتهي صلاحية روابط إعادة التعيين بعد ساعة واحدة ويمكن استخدامها مرة واحدة فقط.",
  "auth.reset.requestNew": "طلب رابط جديد",

  // Reset password — form
  "auth.reset.title": "تعيين كلمة مرور جديدة",
  "auth.reset.subtitle": "اختر كلمة مرور لم تستخدمها من قبل.",
  "auth.reset.doneTitle": "تم تحديث كلمة المرور.",
  "auth.reset.doneHelp": "جارٍ تحويلك إلى تسجيل الدخول…",
  "auth.reset.newPasswordLabel": "كلمة المرور الجديدة",
  "auth.reset.newPasswordPh": "8 أحرف على الأقل",
  "auth.reset.confirmLabel": "تأكيد كلمة المرور الجديدة",
  "auth.reset.submit": "تحديث كلمة المرور",
  "auth.reset.submitting": "جارٍ التحديث...",
  "auth.reset.errTooShort": "يجب أن تتكوّن كلمة المرور من 8 أحرف على الأقل",
  "auth.reset.errMismatch": "كلمتا المرور غير متطابقتين",
  "auth.reset.errGeneric": "حدث خطأ ما. حاول مرة أخرى.",

  // Verify email
  "auth.verify.okTitle": "تم تأكيد البريد الإلكتروني",
  "auth.verify.okSubtitle": "اكتمل إعداد حسابك في FlowSpace بالكامل.",
  "auth.verify.failTitle": "تعذّر التحقّق",
  "auth.verify.failGeneric": "حدث خطأ ما.",
  "auth.verify.openApp": "فتح FlowSpace",
}
