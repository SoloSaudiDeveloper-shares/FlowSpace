import { getSignupsEnabled } from "@/lib/actions/server-settings-actions"
import { isGoogleConfigured } from "@/lib/auth/google"
import { LoginForm } from "./login-form"

/**
 * Server wrapper for the login form. Passes server-authoritative flags
 * (signupsEnabled, googleConfigured) so the client can't fake them. Any
 * server action / route called from the form also re-checks the same
 * flags before mutating anything.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>
}) {
  const params = await searchParams
  const signupsEnabled = await getSignupsEnabled().catch(() => false)
  const googleConfigured = isGoogleConfigured()
  return (
    <LoginForm
      signupsEnabled={signupsEnabled}
      googleConfigured={googleConfigured}
      initialError={params.error}
    />
  )
}
