// Backup the standalone (and dev) FlowSpace data directories to a timestamped
// folder at <project>/backups/data-YYYYMMDD-HHMMSS/.
//
// Run BEFORE any `next build` or destructive operation that touches the DBs.
//   node scripts/backup-data.mjs
//
// Each backup is a complete copy of:
//   .next/standalone/data/   (the portable app's DB + uploads + backups)
//   data/                    (the dev mode DB)
//
// Backups live OUTSIDE .next/ so they survive build wipes. Keeps last 20
// automatically; older ones are pruned.

import { promises as fs } from "node:fs"
import path from "node:path"
import process from "node:process"

const ROOT = process.cwd()
const BACKUP_ROOT = path.join(ROOT, "backups")
const KEEP_LAST = 20

function timestamp() {
  const d = new Date()
  const pad = (n) => n.toString().padStart(2, "0")
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "-" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  )
}

async function exists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function copyDir(src, dst) {
  await fs.mkdir(dst, { recursive: true })
  const entries = await fs.readdir(src, { withFileTypes: true })
  for (const e of entries) {
    const s = path.join(src, e.name)
    const d = path.join(dst, e.name)
    if (e.isDirectory()) {
      await copyDir(s, d)
    } else if (e.isFile()) {
      // Skip lock files that SQLite holds open — they're regenerated anyway
      if (e.name.endsWith(".db-shm") || e.name.endsWith(".db-wal")) {
        try {
          await fs.copyFile(s, d)
        } catch {
          // locked — fall back to checkpoint-only behaviour: skip
        }
      } else {
        await fs.copyFile(s, d)
      }
    }
  }
}

async function pruneOldBackups() {
  if (!(await exists(BACKUP_ROOT))) return
  const entries = await fs.readdir(BACKUP_ROOT, { withFileTypes: true })
  const dirs = entries
    .filter((e) => e.isDirectory() && /^data-\d{8}-\d{6}$/.test(e.name))
    .map((e) => e.name)
    .sort()
  if (dirs.length <= KEEP_LAST) return
  const toRemove = dirs.slice(0, dirs.length - KEEP_LAST)
  for (const name of toRemove) {
    await fs.rm(path.join(BACKUP_ROOT, name), { recursive: true, force: true })
    console.log("  pruned:", name)
  }
}

const stamp = timestamp()
const target = path.join(BACKUP_ROOT, `data-${stamp}`)
console.log("Backing up to", target)
await fs.mkdir(target, { recursive: true })

const sources = [
  { src: path.join(ROOT, "data"), name: "dev-data" },
  { src: path.join(ROOT, ".next", "standalone", "data"), name: "standalone-data" },
]

let totalFiles = 0
for (const s of sources) {
  if (!(await exists(s.src))) {
    console.log(`  skip: ${s.name} (no source at ${s.src})`)
    continue
  }
  const dst = path.join(target, s.name)
  await copyDir(s.src, dst)
  // count files copied
  async function count(p) {
    let n = 0
    for (const e of await fs.readdir(p, { withFileTypes: true })) {
      if (e.isDirectory()) n += await count(path.join(p, e.name))
      else n += 1
    }
    return n
  }
  const n = await count(dst)
  totalFiles += n
  console.log(`  ${s.name}: ${n} files`)
}

console.log(`\nDone. ${totalFiles} files copied to ${target}`)

await pruneOldBackups()
