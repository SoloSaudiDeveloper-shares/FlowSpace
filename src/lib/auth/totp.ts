/**
 * RFC 6238 TOTP — Time-Based One-Time Password.
 *
 * Hand-rolled to avoid a runtime dependency. Uses Node's built-in
 * crypto and is compatible with every common authenticator app
 * (Google Authenticator, Authy, 1Password, Bitwarden, etc.).
 *
 *  - secret: 20+ bytes random, base32-encoded
 *  - algorithm: HMAC-SHA1 (default in Google Authenticator)
 *  - digits: 6
 *  - period: 30 seconds
 *
 * Verification accepts ±1 step (±30s) to absorb clock drift.
 */

import "server-only"
import crypto from "crypto"

// ─── Base32 (RFC 4648, no padding) — required by authenticator apps ──

const B32_ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

export function base32Encode(buf: Buffer): string {
  let bits = 0
  let value = 0
  let out = ""
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += B32_ALPHA[(value >>> (bits - 5)) & 0x1f]
      bits -= 5
    }
  }
  if (bits > 0) {
    out += B32_ALPHA[(value << (5 - bits)) & 0x1f]
  }
  return out
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "")
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    const idx = B32_ALPHA.indexOf(ch)
    if (idx === -1) throw new Error(`Invalid base32 character: ${ch}`)
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

// ─── TOTP ────────────────────────────────────────────────────────────

/** Generate a new 20-byte secret, encoded as base32 for QR/manual entry. */
export function generateTOTPSecret(): string {
  return base32Encode(crypto.randomBytes(20))
}

/**
 * Compute the current 6-digit TOTP code for a base32 secret. Use
 * `verifyTOTPCode` for checks — it accepts drift.
 */
function generateCode(secret: string, timestepIndex: number): string {
  const key = base32Decode(secret)
  const counter = Buffer.alloc(8)
  // 64-bit big-endian. Timesteps stay safely under 2^32 for a long time
  // (year 6053 at 30s/step), so we can pack the low half as a 32-bit
  // unsigned int and leave the high half zero — avoids BigInt literals
  // that need ES2020+.
  const low = timestepIndex >>> 0
  counter.writeUInt32BE(0, 0)
  counter.writeUInt32BE(low, 4)
  const hmac = crypto.createHmac("sha1", key).update(counter).digest()
  // Dynamic truncation (RFC 4226 §5.4)
  const offset = hmac[hmac.length - 1] & 0x0f
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  const code = bin % 10 ** 6
  return code.toString().padStart(6, "0")
}

/** Verify a 6-digit TOTP code. Accepts ±1 step (±30s) to absorb drift. */
export function verifyTOTPCode(secret: string, code: string): boolean {
  const cleanCode = code.replace(/\s+/g, "")
  if (!/^\d{6}$/.test(cleanCode)) return false
  const now = Math.floor(Date.now() / 1000 / 30)
  for (const step of [-1, 0, 1]) {
    if (generateCode(secret, now + step) === cleanCode) return true
  }
  return false
}

/** Build the otpauth URI for a QR code. */
export function buildOTPAuthURI(opts: {
  secret: string
  account: string
  issuer: string
}): string {
  const label = encodeURIComponent(`${opts.issuer}:${opts.account}`)
  const params = new URLSearchParams({
    secret: opts.secret,
    issuer: opts.issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  })
  return `otpauth://totp/${label}?${params.toString()}`
}

// ─── Recovery codes ──────────────────────────────────────────────────

/** Eight random 10-char recovery codes. Format: XXXXX-XXXXX (digits +
 *  upper letters, no ambiguous chars). Stored hashed; only shown once. */
export function generateRecoveryCodes(): string[] {
  const out: string[] = []
  const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no 0/O/1/I
  for (let i = 0; i < 8; i++) {
    let raw = ""
    for (let j = 0; j < 10; j++) {
      raw += alpha[crypto.randomInt(alpha.length)]
    }
    out.push(`${raw.slice(0, 5)}-${raw.slice(5)}`)
  }
  return out
}

/** SHA-256 hex of a normalized recovery code. */
export function hashRecoveryCode(code: string): string {
  const normalized = code.replace(/[-\s]/g, "").toUpperCase()
  return crypto.createHash("sha256").update(normalized).digest("hex")
}
