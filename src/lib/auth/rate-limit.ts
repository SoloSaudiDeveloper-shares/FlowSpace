import "server-only"

/**
 * In-memory sliding-window rate limiter for login attempts. Keyed by a
 * combination of IP + username so:
 *   - Someone hammering one account from one IP gets locked out fast.
 *   - A shared-IP NAT (office network) can still try several different
 *     accounts before any one of them is throttled.
 *   - A single attacker trying many usernames from one IP gets noticed
 *     too (separate aggregate key), but that aggregate is more lenient.
 *
 * In-memory means the limiter resets on container restart and isn't
 * shared across multiple Node processes. For our single-container
 * deployment that's fine — for HA we'd switch to Redis later.
 */

const PER_IP_USERNAME_WINDOW_MS = 15 * 60 * 1000   // 15 min
const PER_IP_USERNAME_MAX_FAILS = 5

const PER_IP_WINDOW_MS = 15 * 60 * 1000            // 15 min
const PER_IP_MAX_FAILS = 30                        // looser cap across all usernames

interface AttemptLog {
  timestamps: number[]
}

const perKey = new Map<string, AttemptLog>()

function prune(log: AttemptLog, windowMs: number, now: number) {
  const cutoff = now - windowMs
  while (log.timestamps.length > 0 && log.timestamps[0] < cutoff) {
    log.timestamps.shift()
  }
}

/**
 * Check if a login attempt should be blocked. Call BEFORE password verify.
 * Returns null on success, or an error message + retry-after seconds on block.
 */
export function checkLoginRateLimit(ip: string, username: string): {
  blocked: false
} | {
  blocked: true
  retryAfterSec: number
  reason: string
} {
  const now = Date.now()
  const userKey = `${ip}|${username.toLowerCase()}`
  const ipKey = `ip|${ip}`

  // Per (IP, username) — the strict gate
  const userLog = perKey.get(userKey) ?? { timestamps: [] }
  prune(userLog, PER_IP_USERNAME_WINDOW_MS, now)
  if (userLog.timestamps.length >= PER_IP_USERNAME_MAX_FAILS) {
    const oldest = userLog.timestamps[0]
    const retryAfterSec = Math.ceil((oldest + PER_IP_USERNAME_WINDOW_MS - now) / 1000)
    return {
      blocked: true,
      retryAfterSec,
      reason: `Too many failed attempts. Try again in ${formatDuration(retryAfterSec)}.`,
    }
  }

  // Per IP — the broad gate (catches credential-stuffing across usernames)
  const ipLog = perKey.get(ipKey) ?? { timestamps: [] }
  prune(ipLog, PER_IP_WINDOW_MS, now)
  if (ipLog.timestamps.length >= PER_IP_MAX_FAILS) {
    const oldest = ipLog.timestamps[0]
    const retryAfterSec = Math.ceil((oldest + PER_IP_WINDOW_MS - now) / 1000)
    return {
      blocked: true,
      retryAfterSec,
      reason: `This IP has too many failed attempts. Try again in ${formatDuration(retryAfterSec)}.`,
    }
  }

  return { blocked: false }
}

/** Record a failed attempt — call after a password mismatch. */
export function recordFailedLogin(ip: string, username: string) {
  const now = Date.now()
  const userKey = `${ip}|${username.toLowerCase()}`
  const ipKey = `ip|${ip}`

  const userLog = perKey.get(userKey) ?? { timestamps: [] }
  prune(userLog, PER_IP_USERNAME_WINDOW_MS, now)
  userLog.timestamps.push(now)
  perKey.set(userKey, userLog)

  const ipLog = perKey.get(ipKey) ?? { timestamps: [] }
  prune(ipLog, PER_IP_WINDOW_MS, now)
  ipLog.timestamps.push(now)
  perKey.set(ipKey, ipLog)
}

/** Successful login — clear the per-username record for this IP. */
export function clearLoginAttempts(ip: string, username: string) {
  const userKey = `${ip}|${username.toLowerCase()}`
  perKey.delete(userKey)
  // Don't clear the per-IP record — a successful login by user A shouldn't
  // pardon prior failed attempts on user B from the same attacker.
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`
  const minutes = Math.ceil(seconds / 60)
  return `${minutes} minute${minutes === 1 ? "" : "s"}`
}
