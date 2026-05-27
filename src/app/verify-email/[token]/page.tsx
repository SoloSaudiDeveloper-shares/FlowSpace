import { completeEmailVerification, isVerifyTokenValid } from "@/lib/actions/email-verification-actions"
import { VerifyEmailResult } from "./verify-email-result"

export default async function VerifyEmailPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // Server-side: try to verify on the first render. The page then shows
  // the resulting message (success / error). Idempotent — re-loading the
  // same URL says "already used" rather than re-verifying.
  const valid = await isVerifyTokenValid(token)
  let result: { ok: true } | { ok: false; error: string } | null = null
  if (valid) {
    result = await completeEmailVerification(token).then((r) =>
      r.ok ? { ok: true as const } : { ok: false as const, error: r.error }
    )
  } else {
    result = { ok: false, error: "This verification link is not valid or has expired." }
  }

  return <VerifyEmailResult result={result} />
}
