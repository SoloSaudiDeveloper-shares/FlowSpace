import { isResetTokenValid } from "@/lib/actions/password-reset-actions"
import { ResetPasswordForm } from "./reset-password-form"

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const valid = await isResetTokenValid(token)
  return <ResetPasswordForm token={token} initialValid={valid} />
}
