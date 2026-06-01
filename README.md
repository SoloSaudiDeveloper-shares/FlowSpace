# FlowSpace

A self-hosted, local-first productivity workspace — projects, tasks (board /
list / table / calendar / gantt), pages, canvases, todo lists, reminders,
processes, forms, automations, an activity feed, and a Telegram bot. Built to
run on your own box with no external database.

## Stack

- **Next.js 16** (App Router, `output: "standalone"`) — note: the middleware
  lives in `src/proxy.ts` (renamed in this Next version).
- **SQLite** via **better-sqlite3** + **Drizzle ORM** — the DB is a single file
  under `./data/app.db`; schema bootstraps itself on first boot (no migration
  CLI needed). Uploads + backups also live under `./data`.
- **React 19**, **Tailwind v4**, **base-ui** primitives, shadcn-style components.
- Optional integrations: Google OAuth + Calendar sync, outbound email
  (Resend or Gmail SMTP), inbound email, a per-user Telegram bot, and a generic
  AI provider (OpenAI-compatible, local Ollama, Gemini, or Anthropic).

## Quick start (development)

```bash
npm install
cp .env.example .env.local   # fill in only what you need; all of it is optional
npm run dev                  # http://localhost:3000
```

The first run creates `./data/app.db` and bootstraps the schema. To seed an
initial admin user, see the scripts under `scripts/` (e.g. `bootstrap-admin.mjs`).

## Configuration

Every integration is optional and toggled by environment variables — the app
boots fine with none set. See **`.env.example`** for the full annotated list
(public URL, Google OAuth/Calendar, email transports, inbound-email secret,
Telegram voice, local AI). AI provider keys for in-app features are configured
per-user in **Settings → AI** (stored in the DB, never in env).

## Production / self-hosting

- **`BUILD.md`** — building the standalone bundle.
- **`DEPLOY.md`** — general deployment notes.
- **`ORACLE-DEPLOY.md`** — the reference deployment: Docker on an Oracle ARM VM
  behind Caddy (HTTPS) + Cloudflare.
- **`OLLAMA.md`** — wiring up a local LLM.
- **`FEATURES.md`** — feature overview.

```bash
npm run build   # next build, standalone output
npm start       # serve the built app
```

Back up by copying the `./data` directory (DB + uploads) — that's the whole
application state.
