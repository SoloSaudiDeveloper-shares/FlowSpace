// Bootstrap the admin user when the DB has been wiped.
// Same SHA-256 + 8-byte hex salt format as src/lib/actions/user-actions.ts.

import Database from "better-sqlite3"
import crypto from "node:crypto"
import path from "node:path"
import process from "node:process"

const DB_PATH =
  process.env.DB_PATH ||
  path.join(process.cwd(), ".next", "standalone", "data", "app.db")

const USERNAME = process.env.USERNAME || "admin"
const PASSWORD = process.env.PASSWORD || "***REDACTED***"
const DISPLAY_NAME = process.env.DISPLAY_NAME || "Admin"

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
