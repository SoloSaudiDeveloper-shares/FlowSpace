// Bootstrap the admin user when the DB has been wiped.
// Same SHA-256 + 8-byte hex salt format as src/lib/actions/user-actions.ts.
//
// Required env vars (no defaults — never ship a credential in code):
//   PASSWORD       — initial admin password
//   DISPLAY_NAME   — name shown in the sidebar / People page
// Optional:
//   USERNAME       — defaults to "admin"
//   DB_PATH        — defaults to .next/standalone/data/app.db
//
// Usage:
//   PASSWORD='a-strong-one' DISPLAY_NAME='Your Name' node scripts/bootstrap-admin.mjs

import Database from "better-sqlite3"
import crypto from "node:crypto"
import path from "node:path"
import process from "node:process"

const DB_PATH =
  process.env.DB_PATH ||
  path.join(process.cwd(), ".next", "standalone", "data", "app.db")

const USERNAME = process.env.USERNAME || "admin"
const PASSWORD = process.env.PASSWORD
const DISPLAY_NAME = process.env.DISPLAY_NAME

if (!PASSWORD || PASSWORD.length < 8) {
  console.error(
    "ERROR: set PASSWORD env var (8+ chars) before running bootstrap-admin.\n" +
    "Example: PASSWORD='a-strong-one' DISPLAY_NAME='Your Name' node scripts/bootstrap-admin.mjs",
  )
  process.exit(1)
}
if (!DISPLAY_NAME) {
  console.error("ERROR: set DISPLAY_NAME env var before running bootstrap-admin.")
  process.exit(1)
}

const db = new Database(DB_PATH)
db.pragma("foreign_keys = ON")

const existing = db.prepare("SELECT id FROM users WHERE username=?").get(USERNAME)
if (existing) {
  console.log("Admin already exists, id:", existing.id)
  db.close()
  process.exit(0)
}

const salt = crypto.randomBytes(8).toString("hex")
const hash = crypto.createHash("sha256").update(salt + PASSWORD).digest("hex")
const passwordHash = `${salt}:${hash}`
const id = "adm" + crypto.randomBytes(9).toString("base64url")
const now = new Date().toISOString()

db.prepare(`
  INSERT INTO users (id, username, display_name, email, password_hash,
    avatar_url, role, is_active, last_active_at, created_at, updated_at)
  VALUES (?, ?, ?, NULL, ?, NULL, 'owner', 1, NULL, ?, ?)
`).run(id, USERNAME, DISPLAY_NAME, passwordHash, now, now)

console.log("Admin created. id:", id, " username:", USERNAME)
db.close()
