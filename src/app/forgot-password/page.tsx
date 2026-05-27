import { ForgotPasswordForm } from "./forgot-password-form"
import { isEmailConfigured } from "@/lib/email/send"

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm emailConfigured={isEmailConfigured()} />
}
