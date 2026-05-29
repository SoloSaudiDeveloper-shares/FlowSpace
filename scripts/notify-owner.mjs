// Send a Telegram message to the workspace owner using their already-
// registered bot. The token is read from the DB inside this process and
// never logged or printed — only the API result (ok/error) surfaces.
//
// Usage:
//   node scripts/notify-owner.mjs "Hello from the agent"
//   echo "long body" | node scripts/notify-owner.mjs --stdin
//
// Optional env:
//   DB_PATH      override the SQLite file (default: data/app.db)
//   PARSE_MODE   Markdown | MarkdownV2 | HTML  (default: Markdown)

import Database from "better-sqlite3"
import path from "node:path"
import process from "node:process"

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "app.db")

async function main() {
  let text = ""
  if (process.argv.includes("--stdin")) {
    text = await readStdin()
  } else {
    text = process.argv.slice(2).join(" ").trim()
  }
  if (!text) {
    console.error("Usage: node scripts/notify-owner.mjs <message>")
    process.exit(2)
  }

  const db = new Database(DB_PATH, { readonly: false })
  // Pick the owner's bot. We never select bot_token into a variable name
  // that prints — only pass it through to fetch().
  const row = db
    .prepare(
      `SELECT tb.bot_token, tb.chat_id
         FROM telegram_bots tb
         JOIN users u ON u.id = tb.user_id
        WHERE u.role = 'owner' AND tb.chat_id IS NOT NULL
        LIMIT 1`,
    )
    .get()
  db.close()

  if (!row) {
    console.error("No owner bot registered, or owner hasn't messaged the bot yet.")
    process.exit(1)
  }

  const parseMode = process.env.PARSE_MODE || "Markdown"
  const res = await fetch(`https://api.telegram.org/bot${row.bot_token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: row.chat_id,
      text,
      parse_mode: parseMode,
      disable_web_page_preview: true,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!data.ok) {
    console.error("Telegram error:", data.description || res.status)
    process.exit(1)
  }
  console.log(`✓ Sent to chat ${row.chat_id} (${text.length} chars)`)
}

function readStdin() {
  return new Promise((resolve) => {
    let buf = ""
    process.stdin.setEncoding("utf8")
    process.stdin.on("data", (c) => (buf += c))
    process.stdin.on("end", () => resolve(buf.trim()))
  })
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
