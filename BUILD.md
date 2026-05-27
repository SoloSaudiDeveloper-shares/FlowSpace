# FlowSpace — Build, Run, & Portable Deploy

This document captures the fixes applied to the dev server and the process
for producing a portable executable build. Keep it next to `FEATURES.md`
and `OLLAMA.md` as the canonical reference for anything related to
running or shipping FlowSpace.

---

## 1. Fixes applied to the dev workflow

### 1.1 Turbopack panic on `data/app.db-shm`

**Symptom.** Running `npm run dev` would panic with:

```
FATAL: An unexpected Turbopack error occurred.
Caused by:
- reading file "...\data\app.db-shm"
- The process cannot access the file because another process has locked
  a portion of the file. (os error 33)
```

**Root cause.** Tailwind v4's content scanner (`@tailwindcss/oxide`) walks
the project root looking for files containing class names. It was reading
`data/app.db-shm` — the SQLite WAL shared-memory file — which
`better-sqlite3` keeps exclusively locked while the dev server is
running. The `.gitignore` covered `*.db`, `*.db-wal`, and `*.db-journal`
but missed `.db-shm`, and Tailwind respects `.gitignore` for source
discovery.

**Fix.** Two complementary changes:

1. **[`.gitignore`](.gitignore)** — replaced the per-extension SQLite
   rules with `/data/` (the whole user-data dir) plus `flowspace.db*`
   for the stray root-level copy. Tailwind v4 reads `.gitignore`, so
   this is now enough on its own.

2. **[`src/app/globals.css`](src/app/globals.css)** — added explicit
   `@source not` directives as a belt-and-suspenders guard:

   ```css
   @source not "../../data/**";
   @source not "../../*.db";
   @source not "../../*.db-shm";
   @source not "../../*.db-wal";
   ```

**To verify after pulling these changes:** delete `.next/`, run
`npm run dev`, hit `http://localhost:3000`. The login page should render
cleanly with zero Turbopack panics in the terminal.

### 1.2 Missing tables on fresh installs

**Symptom.** A fresh `data/` directory crashes on first request with:

```
SqliteError: no such table: main.elements
```

**Root cause.** `src/lib/db/index.ts` creates FTS5 triggers that
reference the `elements`, `tasks`, etc. tables — but those tables are
defined in `src/lib/db/schema.ts` (drizzle) and were only ever applied
to your dev DB via `drizzle-kit push` at some earlier point. The
project ships no migration files, so a brand-new install has no way to
bootstrap them.

**Fix.** Generated [`src/lib/db/bootstrap-schema.ts`](src/lib/db/bootstrap-schema.ts)
— a single string constant containing `CREATE TABLE IF NOT EXISTS …`
statements for all 60 drizzle-defined tables, dumped from a working
dev DB. `src/lib/db/index.ts` now applies it at startup, **before** the
FTS trigger creation. All statements are `IF NOT EXISTS`, so this is a
no-op on existing installs.

> **When to regenerate.** If you change `src/lib/db/schema.ts` (add or
> alter a drizzle table), regenerate `bootstrap-schema.ts` against an
> up-to-date dev DB — see [§3.3](#33-regenerating-the-bootstrap-schema).

---

## 2. Producing a portable executable build

The project is configured to produce a self-contained folder you can
zip and run on any Windows machine with Node.js 20+ installed. No
`npm install` required on the target.

### 2.1 One-time config (already in place)

[`next.config.ts`](next.config.ts) has:

```ts
output: "standalone",
serverExternalPackages: ["@axols/webai-js", "better-sqlite3"],
outputFileTracingIncludes: {
  "/*": [
    "node_modules/better-sqlite3/build/Release/*.node",
    "node_modules/bindings/**/*",
    "node_modules/file-uri-to-path/**/*",
  ],
},
```

`output: "standalone"` tells Next.js to copy only the files a production
deploy actually needs into `.next/standalone/`. The
`outputFileTracingIncludes` block force-bundles the native
`better_sqlite3.node` binary, which `@vercel/nft` otherwise misses
because `better-sqlite3` loads it via a dynamic `require`.

### 2.2 Build steps

From the project root:

```bash
# 0. ALWAYS BACK UP FIRST — the build wipes .next/standalone/data/
node scripts/backup-data.mjs

# 1. Clean previous build (optional but recommended)
rm -rf .next

# 2. Build
npm run build

# 3. Stage static assets into the standalone folder
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/

# 4. Strip any DB files that got picked up during the build
rm -f .next/standalone/data/app.db \
      .next/standalone/data/app.db-shm \
      .next/standalone/data/app.db-wal

# 5. Re-add the launcher (the build wipes .next/standalone/)
cp BUILD-launcher.bat .next/standalone/FlowSpace.bat
cp BUILD-readme.txt   .next/standalone/README.txt
```

> Steps 5 assumes you've kept master copies of `FlowSpace.bat` and
> `README.txt` at the project root. The current `.next/standalone/`
> already contains both — if you ever need them again, copy them out
> before re-running `next build`.

### 2.3 What's in `.next/standalone/`

| Item | Purpose |
|------|---------|
| `server.js` | Next.js minimal production server. Entry point. |
| `node_modules/` | Only the deps used at runtime (~30 MB). Includes the native `better_sqlite3.node`. |
| `.next/` | Compiled app — routes, chunks, manifests. |
| `public/` | Static assets served from `/`. |
| `data/` | SQLite DB + uploads + backups. Created on first run if absent. |
| `package.json` | Minimal manifest the standalone server reads. |
| `FlowSpace.bat` | Double-click launcher (Windows). |
| `README.txt` | Install/usage notes for the recipient. |

Total size: **~37 MB**.

### 2.4 Running the portable build

**On Windows:** double-click `FlowSpace.bat`. The launcher:

1. Verifies Node.js is on `PATH`
2. Sets `PORT=3737`, `HOSTNAME=127.0.0.1`, `NODE_ENV=production`
3. Starts `node server.js`
4. Polls the port in the background and opens the default browser to
   `http://localhost:3737` **only after** the server is actually
   listening — so the browser can't land on a stale app squatting on
   the same port

Default port is `3737` (not 3000) because the standard Next.js dev
port collides with anything else you might have running. Override:
```cmd
set PORT=4040
FlowSpace.bat
```

**On macOS / Linux:** there's no `.bat`, just:
```bash
cd .next/standalone
PORT=3000 HOSTNAME=127.0.0.1 NODE_ENV=production node server.js
```

### 2.5 Distributing it

1. Right-click `.next/standalone/` → **Send to → Compressed (zipped) folder**
2. Send the `.zip` to the recipient
3. They extract anywhere, install Node.js 20+ from <https://nodejs.org>,
   and double-click `FlowSpace.bat`
4. First run enters setup mode and creates the owner account

---

## 3. Operational guidelines

### 3.1 Working with the SQLite database

The DB lives at `<cwd>/data/app.db`. `<cwd>` is whichever directory you
run the server from:

- `npm run dev` from the project root → `<project>/data/app.db`
- `FlowSpace.bat` (or `node server.js`) from `.next/standalone/` →
  `<standalone>/data/app.db`

These are **two separate databases**. Don't expect dev data to show
up in the portable build, or vice versa.

If you need to copy data between them, copy the entire `data/` folder
(not just `app.db` — the WAL and SHM files matter).

### 3.2 Resetting the owner account

If you forget your password, delete the user row directly. Sessions
cascade-delete automatically:

```bash
node -e "const D=require('better-sqlite3');const db=new D('data/app.db');db.pragma('foreign_keys = ON');db.prepare('DELETE FROM sessions').run();db.prepare('DELETE FROM users').run();db.close();console.log('reset');"
```

Clear the `flowspace-session` cookie in your browser, reload, and the
login page re-enters setup mode.

### 3.3 Regenerating the bootstrap schema

After any change to `src/lib/db/schema.ts`:

1. Run `npm run dev` once so drizzle (or your own SQL) materializes
   the new tables in `data/app.db`.
2. Re-dump the schema:
   ```bash
   node -e "const D=require('better-sqlite3'),fs=require('fs');const db=new D('data/app.db',{readonly:true});const r=db.prepare(\"SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%_fts%' AND type='table'\").all();const sql=r.map(x=>x.sql.replace(/^CREATE TABLE /,'CREATE TABLE IF NOT EXISTS ')+';').join('\n\n');fs.writeFileSync('src/lib/db/bootstrap-schema.ts','export const BOOTSTRAP_SCHEMA_SQL = '+JSON.stringify(sql)+';\n');console.log('regenerated');"
   ```
3. Commit the updated `bootstrap-schema.ts`.

This file is intentionally auto-generated — don't hand-edit it.

### 3.4 Don't put files inside `data/`

Tailwind v4 and Turbopack walk the project tree. SQLite WAL and SHM
files are short-term locked, which crashes the scanner.

The current setup keeps Tailwind out of `data/` via `.gitignore` and
explicit `@source not` directives in `globals.css`. If you add a new
location for user-writable files, either:

- put it inside `data/`, **or**
- add the new path to both `.gitignore` and the `@source not` list
  in `src/app/globals.css`.

### 3.5 If you change `next.config.ts`

The keys this project relies on, and what would break if you remove them:

| Key | Removing it breaks… |
|-----|---------------------|
| `output: "standalone"` | The whole portable build (`.next/standalone/` won't be produced). |
| `serverExternalPackages: ["better-sqlite3", …]` | Native binding resolution at runtime — server crashes on first DB call. |
| `outputFileTracingIncludes['/*']` | The `.node` binary is missing from the standalone folder — server crashes immediately. |
| `serverExternalPackages: ["@axols/webai-js", …]` | AI inference (uses ONNX runtime) — see [`OLLAMA.md`](OLLAMA.md). |

---

## 4. Quick reference

| I want to… | Do this |
|------------|---------|
| Run the dev server | `npm run dev` |
| Build the portable folder | See [§2.2](#22-build-steps) |
| Test the portable build locally | `cd .next/standalone && node server.js` |
| Ship the build to someone | Zip `.next/standalone/`, send, they need Node.js 20+ |
| Reset my forgotten password | See [§3.2](#32-resetting-the-owner-account) |
| Add a new drizzle table | Edit `schema.ts`, run migrations, regenerate `bootstrap-schema.ts` ([§3.3](#33-regenerating-the-bootstrap-schema)) |

---

## 5. Known caveats

- **Build evaluates `src/lib/db/index.ts`.** During `next build`, server
  modules get evaluated for prerendering. This means a fresh `data/`
  directory is created in the standalone folder at build time. Step 4
  of the build process strips the DB files that get auto-bundled so the
  shipped folder is truly fresh.

- **OneDrive paths with non-ASCII characters.** The project lives at a
  path containing Arabic text (`سطح المكتب`). Builds work, but if you
  move the source somewhere ASCII-only it's one less variable when
  debugging Turbopack/nft issues.

- **`patch-package` postinstall.** [`patches/@axols+webai-js+1.0.0.patch`](patches/)
  is applied automatically on `npm install`. The standalone build
  inherits the patched module, but if you ever rebuild `node_modules`
  in the standalone folder directly, run `npx patch-package` afterward.
