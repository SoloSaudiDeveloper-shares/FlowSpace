/**
 * Customizable Telegram bot reply templates.
 *
 * The bot ships with a default reply for each "moment" (greeting,
 * capture success, task done, etc.) but users can override any of them
 * in Settings → Telegram → Reply templates.
 *
 * Each template:
 *   - has a unique slug used to look it up
 *   - declares which variables it can interpolate
 *   - has a default string
 *
 * The user's overrides live in `user_preferences.prefs_json.botReplies`
 * keyed by slug. Empty/missing entries fall back to defaults.
 *
 * Rendering uses simple `{{path}}` interpolation. Markdown formatting
 * (Telegram MarkdownV2) is preserved as-is. We deliberately don't
 * support {{#if}} / {{#each}} here — bot replies are short and a single
 * pass keeps them predictable for non-technical users.
 */

import "server-only"
import { sqlite } from "@/lib/db"

export type BotReplySlug =
  | "greeting"
  | "capture_added"
  | "task_done"
  | "todo_done"
  | "voice_received"
  | "unknown"

export interface BotReplyTemplate {
  slug: BotReplySlug
  label: string
  description: string
  /** Variables you can drop into the body, e.g. {{list}}. */
  variables: { name: string; description: string; example: string }[]
  /** Default body. Telegram MarkdownV2 syntax. */
  default: string
}

export const BOT_REPLY_TEMPLATES: BotReplyTemplate[] = [
  {
    slug: "greeting",
    label: "Greeting (/start)",
    description: "Shown when the user first connects, or types /start.",
    variables: [],
    default:
      "👋 You're connected to FlowSpace.\n\nSend me text and I'll capture it as a todo item.\nSlash commands let you do more — try /help.",
  },
  {
    slug: "capture_added",
    label: "Captured to default list",
    description:
      "Confirmation after a freeform message gets added to the default todo list.",
    variables: [
      { name: "list", description: "The list name it landed in", example: "Inbox" },
      {
        name: "detail",
        description: "Smart-capture summary line (priority/due/tags), or empty",
        example: "\n· captured: priority *high* · due *2026-06-15*",
      },
    ],
    default: "✅ Added to *{{list}}*{{detail}}",
  },
  {
    slug: "task_done",
    label: "Task marked done",
    description: "Confirmation when /done <id-prefix> completes a project task.",
    variables: [
      { name: "title", description: "The task title", example: "Ship v1" },
    ],
    default: "✅ Marked task done: *{{title}}*",
  },
  {
    slug: "todo_done",
    label: "Todo item marked done",
    description: "Confirmation when /done completes a todo-list item.",
    variables: [
      { name: "title", description: "The todo item title", example: "Buy milk" },
    ],
    default: "✅ Marked done: *{{title}}*",
  },
  {
    slug: "voice_received",
    label: "Voice received",
    description:
      "Sent right after a voice message arrives — before transcription. Lets the user know we're processing.",
    variables: [],
    default: "🎙 Got your voice note. Transcribing…",
  },
  {
    slug: "unknown",
    label: "Unknown command",
    description: "Reply when the user sends a slash command we don't recognise.",
    variables: [
      { name: "command", description: "What they typed", example: "/foo" },
    ],
    default: "Unknown command `{{command}}`. Try /help.",
  },
]

/**
 * Look up the user's override for `slug`. Returns the default string when
 * there is no override or the prefs blob is missing/malformed.
 */
function getRawBody(userId: string, slug: BotReplySlug): string {
  const tpl = BOT_REPLY_TEMPLATES.find((t) => t.slug === slug)
  if (!tpl) return ""
  const row = sqlite
    .prepare(`SELECT prefs_json FROM user_preferences WHERE user_id = ?`)
    .get(userId) as { prefs_json: string } | undefined
  if (!row?.prefs_json) return tpl.default
  try {
    const prefs = JSON.parse(row.prefs_json) as {
      botReplies?: Partial<Record<BotReplySlug, string>>
    }
    const override = prefs.botReplies?.[slug]
    if (typeof override === "string" && override.trim().length > 0) {
      return override
    }
    return tpl.default
  } catch {
    return tpl.default
  }
}

/**
 * Render a bot reply for `slug`. `vars` is interpolated into `{{var}}`
 * placeholders. Unknown placeholders are replaced with empty string so a
 * malformed template never spits out raw `{{whatever}}` to the user.
 */
export function renderBotReply(
  userId: string,
  slug: BotReplySlug,
  vars: Record<string, string | number | undefined> = {},
): string {
  const body = getRawBody(userId, slug)
  return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = vars[key]
    return v === undefined || v === null ? "" : String(v)
  })
}

/**
 * Read the user's full override map. Used by the Settings UI to populate
 * the editor with the user's current overrides (or empty strings when
 * they're still using the default).
 */
export function getBotReplyOverrides(
  userId: string,
): Partial<Record<BotReplySlug, string>> {
  const row = sqlite
    .prepare(`SELECT prefs_json FROM user_preferences WHERE user_id = ?`)
    .get(userId) as { prefs_json: string } | undefined
  if (!row?.prefs_json) return {}
  try {
    const prefs = JSON.parse(row.prefs_json) as {
      botReplies?: Partial<Record<BotReplySlug, string>>
    }
    return prefs.botReplies ?? {}
  } catch {
    return {}
  }
}
