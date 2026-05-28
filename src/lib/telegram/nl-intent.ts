/**
 * Natural-language command routing for the Telegram bot.
 *
 * When the user texts something that ISN'T a slash command, isn't smart-
 * capture syntax, and isn't FlowSpace AI-import markdown, AND they've
 * enabled natural-language commands AND have an OpenAI-compatible AI
 * provider configured — we send the message to their AI provider with a
 * tightly-scoped system prompt that returns a structured intent. We then
 * dispatch the intent like any other command.
 *
 * The AI provider config lives in `user_preferences.prefs_json` (the same
 * pref blob the in-app AI features read from). That keeps configuration
 * in one place — users don't paste their key twice.
 *
 * Intents we recognise:
 *   { "kind": "command", "name": "tasks" | "deadlines" | "projects" |
 *     "lists" | "stats" | "help" }
 *   { "kind": "capture", "text": "<extracted task title>" }
 *   { "kind": "unknown" }  (we fall through to capture as a courtesy)
 *
 * If the AI returns garbage or errors, we silently fall back to the
 * existing capture flow so the user's message never just disappears.
 */

import "server-only"
import { sqlite } from "@/lib/db"

interface AIConfig {
  baseUrl: string
  apiKey: string
  model: string
  enabled: boolean
}

export function getUserAIConfig(userId: string): AIConfig | null {
  const row = sqlite
    .prepare(`SELECT prefs_json FROM user_preferences WHERE user_id = ?`)
    .get(userId) as { prefs_json: string } | undefined
  if (!row?.prefs_json) return null
  try {
    const prefs = JSON.parse(row.prefs_json) as {
      aiEnabled?: boolean
      aiOpenAIBaseUrl?: string
      aiOpenAIApiKey?: string
      aiOpenAIModel?: string
    }
    if (!prefs.aiOpenAIApiKey || !prefs.aiOpenAIBaseUrl || !prefs.aiOpenAIModel) {
      return null
    }
    return {
      baseUrl: prefs.aiOpenAIBaseUrl.replace(/\/+$/, ""),
      apiKey: prefs.aiOpenAIApiKey,
      model: prefs.aiOpenAIModel,
      enabled: prefs.aiEnabled === true,
    }
  } catch {
    return null
  }
}

export interface NLIntent {
  kind: "command" | "capture" | "unknown"
  name?: "tasks" | "deadlines" | "projects" | "lists" | "stats" | "help"
  text?: string
}

const SYSTEM_PROMPT = `You are an intent classifier for a productivity app's Telegram bot. The user texts a message and you decide what they want.

Output ONLY valid JSON matching one of these shapes:
  { "kind": "command", "name": "tasks" }       - they want to see their open tasks
  { "kind": "command", "name": "deadlines" }   - they want to see what's due
  { "kind": "command", "name": "projects" }    - they want a project list
  { "kind": "command", "name": "lists" }       - they want their todo lists
  { "kind": "command", "name": "stats" }       - they want their weekly stats
  { "kind": "command", "name": "help" }        - they want help / commands
  { "kind": "capture", "text": "<title>" }     - they want to capture a new item; "title" is the cleaned action

Examples:
  "what am I working on" -> { "kind": "command", "name": "tasks" }
  "what's due this week" -> { "kind": "command", "name": "deadlines" }
  "show my projects" -> { "kind": "command", "name": "projects" }
  "stats" -> { "kind": "command", "name": "stats" }
  "remind me to call mom" -> { "kind": "capture", "text": "call mom" }
  "buy milk on the way home" -> { "kind": "capture", "text": "buy milk on the way home" }
  "I need to fix the bug" -> { "kind": "capture", "text": "fix the bug" }

Output ONLY the JSON. No markdown fence, no preamble. If unsure, default to capture with the message text.`

export async function classifyIntent(
  userId: string,
  message: string,
): Promise<NLIntent | null> {
  const cfg = getUserAIConfig(userId)
  if (!cfg || !cfg.enabled) return null
  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: message },
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const raw = data.choices?.[0]?.message?.content?.trim() ?? ""
    if (!raw) return null
    // Strip markdown fences just in case the model adds them despite
    // response_format. Some providers ignore the parameter.
    const cleaned = raw.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "")
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(cleaned) as Record<string, unknown>
    } catch {
      return null
    }
    if (parsed.kind === "command" && typeof parsed.name === "string") {
      const validCommands = ["tasks", "deadlines", "projects", "lists", "stats", "help"]
      if (validCommands.includes(parsed.name)) {
        return { kind: "command", name: parsed.name as NLIntent["name"] }
      }
    }
    if (parsed.kind === "capture" && typeof parsed.text === "string") {
      return { kind: "capture", text: parsed.text.slice(0, 500) }
    }
    return { kind: "unknown" }
  } catch {
    return null
  }
}

export function isNLEnabled(userId: string): boolean {
  const row = sqlite
    .prepare(`SELECT nl_commands_enabled FROM telegram_bots WHERE user_id = ?`)
    .get(userId) as { nl_commands_enabled: number } | undefined
  return row?.nl_commands_enabled === 1
}
