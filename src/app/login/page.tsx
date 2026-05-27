import { getSignupsEnabled } from "@/lib/actions/server-settings-actions"
import { LoginForm } from "./login-form"

/**
 * Server component wrapper: reads the `signupsEnabled` server setting and
 * passes it as an initial prop to the client-side form. Keeps the toggle
 * server-authoritative (a client that flips the flag in DevTools can't
 * bypass it — createUser still enforces it).
 */
export default async function LoginPage() {
  const signupsEnabled = await getSignupsEnabled().catch(() => false)
  return <LoginForm signupsEnabled={signupsEnabled} />
}
