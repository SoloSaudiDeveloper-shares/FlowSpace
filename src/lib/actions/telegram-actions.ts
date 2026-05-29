"use server"

/**
 * Telegram bot connection management.
 *
 * Per-user only — a bot belongs to exactly one FlowSpace account and is
 * never shared. The token never reaches the browser after setup (the
 * status query returns metadata, not the secret).
 */

import { sqlite } from "@/lib/db"
import { requireAuth } from "@/lib/auth/scope"
import { getMe, setWebhook, deleteWebhook, sendMessage, setMyCommands } from "@/lib/telegram/client"
import { randomBytes } from "crypto"

export interface TelegramBotStatus {
  connected: boolean
  botUsername?: string
  botId?: number
  webhookUrl?: string
  webhookConfigured: boolean
  targetListId: string | null
  lastSeenAt?: string | null
  voiceLanguage: string
  voiceAutoSkip: boolean
  voiceKeyUseShared: boolean
  /** True if the server has TELEGRAM_VOICE_GROQ_KEY set — used by the UI
   *  to decide whether to even offer the "shared key" toggle. */
  sharedVoiceKeyAvailable: boolean
}

interface BotRow {
  user_id: string
  bot_token: string
  bot_username: string | null
  bot_id: number | null
  webhook_secret: string
  target_list_id: string | null
  last_seen_at: string | null
  voice_language: string | null
  voice_auto_skip: number | null
  voice_key_use_shared: number | null
}

/** Compute the base URL for outbound webhook registration. We MUST send a
 * publicly reachable URL to Telegram — `localhost` will fail outright. */
function publicBaseUrl(): string {
  return (process.env.PUBLIC_APP_URL || "").replace(/\/+$/, "")
}

function buildWebhookUrl(secret: string): string {
  const base = publicBaseUrl()
  if (!base) return ""
  return `${base}/api/telegram/webhook/${secret}`
}

export async function getMyTelegramStatus(): Promise<TelegramBotStatus> {
  const me = await requireAuth()
  const row = sqlite
    .prepare(`SELECT * FROM telegram_bots WHERE user_id = ?`)
    .get(me.id) as BotRow | undefined
  if (!row) {
    return { connected: false, webhookConfigured: false, targetListId: null, voiceLanguage: "en", voiceAutoSkip: false, voiceKeyUseShared: false, sharedVoiceKeyAvailable: !!process.env.TELEGRAM_VOICE_GROQ_KEY }
  }
  const url = buildWebhookUrl(row.webhook_secret)
  return {
    connected: true,
    botUsername: row.bot_username ?? undefined,
    botId: row.bot_id ?? undefined,
    webhookUrl: url,
    webhookConfigured: !!url,
    targetListId: row.target_list_id,
    lastSeenAt: row.last_seen_at,
    voiceLanguage: row.voice_language ?? "en",
    voiceAutoSkip: row.voice_auto_skip === 1,
    voiceKeyUseShared: row.voice_key_use_shared === 1,
    sharedVoiceKeyAvailable: !!process.env.TELEGRAM_VOICE_GROQ_KEY,
  }
}

/**
 * Connect a bot. Validates the token via getMe, registers a webhook (if
 * we have a public base URL), and persists the binding.
 *
 * Returns the bot's username on success so the UI can confirm
 * "✅ Connected as @yourbot".
 */
export async function connectTelegramBot(
  token: string,
): Promise<{ ok: true; botUsername: string } | { ok: false; error: string }> {
  const me = await requireAuth()
  const trimmed = token.trim()
  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(trimmed)) {
    return { ok: false, error: "That doesn't look like a Telegram bot token. Get one from @BotFather." }
  }

  // Verify the token works.
  const info = await getMe(trimmed)
  if (!info.ok) {
    return { ok: false, error: `Telegram says: ${info.description}` }
  }

  // Generate a per-user webhook secret. It rides in the URL path so each
  // inbound update arrives at a path unique to this user — that's how we
  // resolve which user's bot the update belongs to.
  const secret = randomBytes(24).toString("hex")

  // Upsert the binding. We DELETE any previous row first so we don't
  // hit the UNIQUE constraint on webhook_secret with a stale one.
  sqlite.prepare(`DELETE FROM telegram_bots WHERE user_id = ?`).run(me.id)
  sqlite
    .prepare(
      `INSERT INTO telegram_bots (user_id, bot_token, bot_username, bot_id, webhook_secret, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
    )
    .run(me.id, trimmed, info.result.username ?? null, info.result.id, secret)

  // Try to register the webhook so Telegram pushes updates to us.
  const url = buildWebhookUrl(secret)
  if (url) {
    const setRes = await setWebhook(trimmed, url, secret)
    if (!setRes.ok) {
      // Connect succeeded but webhook registration failed — keep the
      // binding (user can retry) and surface a clear warning.
      return {
        ok: false,
        error: `Bot connected but webhook setup failed: ${setRes.description}. The bot won't receive messages until this is fixed (often a PUBLIC_APP_URL config issue).`,
      }
    }
  }

  // Register the slash commands with Telegram so the "/" autocomplete
  // surfaces them. Best-effort — if this fails the bot still works, just
  // less polished. We do it on every connect so updates take effect.
  await setMyCommands(trimmed, [
    { command: "menu",      description: "🏠 Main menu" },
    { command: "tasks",     description: "📋 Open tasks across projects" },
    { command: "deadlines", description: "🗓 What's due soon" },
    { command: "projects",  description: "📂 Browse projects" },
    { command: "lists",     description: "📝 Browse todo lists" },
    { command: "stats",     description: "📊 Last 7 days at a glance" },
    { command: "search",    description: "🔍 Search across everything" },
    { command: "digest",    description: "🌅 Daily morning digest" },
    { command: "voice",     description: "🎙 Set voice transcription language" },
    { command: "nl",        description: "🤖 Toggle natural-language commands" },
    { command: "voiceout",  description: "🔊 Toggle voice-note replies (TTS)" },
    { command: "clear",     description: "🗑 Clear my bot message history" },
    { command: "help",      description: "🆘 Show commands & smart syntax" },
    { command: "cancel",    description: "❌ Cancel current action" },
  ]).catch(() => undefined)

  return { ok: true, botUsername: info.result.username ?? `bot${info.result.id}` }
}

export async function disconnectTelegramBot(): Promise<{ ok: true }> {
  const me = await requireAuth()
  const row = sqlite
    .prepare(`SELECT bot_token FROM telegram_bots WHERE user_id = ?`)
    .get(me.id) as { bot_token: string } | undefined
  if (row) {
    await deleteWebhook(row.bot_token).catch(() => undefined)
    sqlite.prepare(`DELETE FROM telegram_bots WHERE user_id = ?`).run(me.id)
  }
  return { ok: true }
}

export async function setTelegramTargetList(
  listId: string | null,
): Promise<{ ok: true }> {
  const me = await requireAuth()
  // Optional ownership check on the list ID, when one is provided.
  if (listId) {
    const owned = sqlite
      .prepare(`SELECT id FROM elements WHERE id = ? AND created_by = ? AND type = 'todo_list'`)
      .get(listId, me.id)
    if (!owned) throw new Error("List not found or not yours")
  }
  sqlite
    .prepare(`UPDATE telegram_bots SET target_list_id = ?, updated_at = datetime('now') WHERE user_id = ?`)
    .run(listId, me.id)
  return { ok: true }
}

/** All of the current user's todo lists — used by the Settings UI dropdown
 *  for picking which list quick-captures land in. */
export async function getMyTodoListsForTelegram(): Promise<
  { id: string; title: string; itemCount: number }[]
> {
  const me = await requireAuth()
  const rows = sqlite
    .prepare(
      `SELECT e.id, e.title,
              COALESCE((SELECT COUNT(*) FROM todo_items ti WHERE ti.list_id = e.id), 0) AS item_count
       FROM elements e
       WHERE e.created_by = ?
         AND e.type = 'todo_list'
         AND e.is_archived = 0
         AND e.is_deleted = 0
       ORDER BY e.updated_at DESC`,
    )
    .all(me.id) as { id: string; title: string; item_count: number }[]
  return rows.map((r) => ({ id: r.id, title: r.title, itemCount: r.item_count }))
}

/** Send a one-shot message to the user's bound chat (if known). Used as a
 *  hello-world test from the Settings UI to confirm the bot can talk to
 *  the user. Will only work AFTER the user has sent the bot any message
 *  (Telegram doesn't allow bots to message strangers). */
export async function sendTestTelegramMessage(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const me = await requireAuth()
  const row = sqlite
    .prepare(`SELECT bot_token, chat_id FROM telegram_bots WHERE user_id = ?`)
    .get(me.id) as { bot_token: string; chat_id: string | null } | undefined
  if (!row) return { ok: false, error: "No bot connected." }
  if (!row.chat_id) {
    return {
      ok: false,
      error: "Telegram needs you to message your bot first. Open your bot in Telegram and send /start.",
    }
  }
  const res = await sendMessage(
    row.bot_token,
    row.chat_id,
    "👋 Hello from FlowSpace! Your bot is wired up. Try /help.",
    { parseMode: "Markdown" },
  )
  if (!res.ok) return { ok: false, error: res.description }
  return { ok: true }
}

// ─── Workspace-wide enable flag (admin only) ─────────────────────────────

export async function getTelegramFeatureEnabled(): Promise<boolean> {
  const row = sqlite
    .prepare(`SELECT value FROM server_settings WHERE key = 'telegramEnabled'`)
    .get() as { value: string } | undefined
  return row?.value === "true"
}

export async function setTelegramFeatureEnabled(enabled: boolean): Promise<{ ok: true }> {
  const me = await requireAuth()
  if (me.role !== "owner") throw new Error("Owner only")
  sqlite
    .prepare(
      `INSERT INTO server_settings (key, value, updated_at)
       VALUES ('telegramEnabled', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(enabled ? "true" : "false")
  return { ok: true }
}

// ── Message history ─────────────────────────────────────────────────────

export interface TelegramHistoryEntry {
  id: string
  direction: "in" | "out"
  text: string
  createdAt: string
}

export async function getMyTelegramHistory(limit = 50): Promise<TelegramHistoryEntry[]> {
  const me = await requireAuth()
  const rows = sqlite
    .prepare(
      `SELECT id, direction, text, created_at
       FROM telegram_messages
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(me.id, limit) as { id: string; direction: "in" | "out"; text: string; created_at: string }[]
  return rows.map((r) => ({ id: r.id, direction: r.direction, text: r.text, createdAt: r.created_at }))
}

export async function setTelegramVoiceLanguage(language: string): Promise<{ ok: true }> {
  const me = await requireAuth()
  const lang = language.trim().toLowerCase()
  // Accept any 2-letter ISO 639-1 code OR "auto"
  if (lang !== "auto" && !/^[a-z]{2}$/.test(lang)) {
    throw new Error("Use a 2-letter ISO code (en, ar, es, …) or 'auto'.")
  }
  sqlite
    .prepare(`UPDATE telegram_bots SET voice_language = ?, updated_at = datetime('now') WHERE user_id = ?`)
    .run(lang, me.id)
  return { ok: true }
}

export async function setTelegramVoiceAutoSkip(enabled: boolean): Promise<{ ok: true }> {
  const me = await requireAuth()
  sqlite
    .prepare(`UPDATE telegram_bots SET voice_auto_skip = ?, updated_at = datetime('now') WHERE user_id = ?`)
    .run(enabled ? 1 : 0, me.id)
  return { ok: true }
}

export async function setTelegramVoiceKeyUseShared(enabled: boolean): Promise<{ ok: true }> {
  const me = await requireAuth()
  sqlite
    .prepare(`UPDATE telegram_bots SET voice_key_use_shared = ?, updated_at = datetime('now') WHERE user_id = ?`)
    .run(enabled ? 1 : 0, me.id)
  return { ok: true }
}

export async function clearMyTelegramHistory(): Promise<{ ok: true; deleted: number }> {
  const me = await requireAuth()
  const r = sqlite.prepare(`DELETE FROM telegram_messages WHERE user_id = ?`).run(me.id)
  return { ok: true, deleted: r.changes }
}
