"use server"

/**
 * Chat with an LLM about your workspace.
 *
 * The drawer assembles a short conversation: a system prompt that frames
 * the assistant + a one-shot "context" message dump of the user's
 * workspace (top elements, recent tasks, overdue items) + the user's
 * actual messages. We rebuild the context on every turn so the model
 * always sees current state without having to plumb tool calls.
 *
 * For larger workspaces (>200 elements) the context message is the
 * 50 most-recently-active items + the 20 most-recent open tasks. Good
 * enough for "what should I focus on?" / "find me the blockers" /
 * "summarise the AGE project" without the latency + complexity of
 * function-calling tool roundtrips.
 *
 * The reply is plain text; the drawer renders it as markdown.
 */

import { sqlite } from "@/lib/db"
import { requireAuth } from "@/lib/auth/scope"

export type ChatRole = "user" | "assistant"

export interface ChatMessage {
  role: ChatRole
  content: string
}

interface UserAIConfig {
  baseUrl: string
  apiKey: string
  model: string
  locale: "en" | "ar"
}

function readUserAI(userId: string): UserAIConfig | null {
  const row = sqlite
    .prepare(`SELECT prefs_json FROM user_preferences WHERE user_id = ?`)
    .get(userId) as { prefs_json: string } | undefined
  if (!row?.prefs_json) return null
  try {
    const prefs = JSON.parse(row.prefs_json) as {
      aiOpenAIBaseUrl?: string
      aiOpenAIApiKey?: string
      aiOpenAIModel?: string
      locale?: string
    }
    if (!prefs.aiOpenAIBaseUrl || !prefs.aiOpenAIApiKey) return null
    return {
      baseUrl: prefs.aiOpenAIBaseUrl.replace(/\/+$/, ""),
      apiKey: prefs.aiOpenAIApiKey,
      model: prefs.aiOpenAIModel?.trim() || "gpt-4o-mini",
      locale: prefs.locale === "ar" ? "ar" : "en",
    }
  } catch {
    return null
  }
}

interface ContextSnapshot {
  elements: { id: string; type: string; title: string; description: string | null; updatedAt: string }[]
  openTasks: { id: string; title: string; priority: string | null; dueDate: string | null; projectTitle: string }[]
  overdueTasks: number
  overdueReminders: number
}

function snapshotWorkspace(userId: string): ContextSnapshot {
  const elements = sqlite
    .prepare(
      `SELECT id, type, title, description, updated_at AS updatedAt
         FROM elements
        WHERE created_by = ? AND is_deleted = 0 AND is_archived = 0
        ORDER BY datetime(updated_at) DESC
        LIMIT 50`,
    )
    .all(userId) as {
      id: string; type: string; title: string; description: string | null; updatedAt: string
    }[]

  const openTasks = sqlite
    .prepare(
      `SELECT t.id, t.title, t.priority, t.due_date AS dueDate, e.title AS projectTitle
         FROM tasks t
         INNER JOIN elements e ON e.id = t.project_id
         LEFT JOIN task_statuses s ON s.id = t.status_id
        WHERE e.created_by = ?
          AND e.is_deleted = 0
          AND (s.is_done_state IS NULL OR s.is_done_state = 0)
        ORDER BY CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
                 t.due_date ASC,
                 t.priority ASC
        LIMIT 20`,
    )
    .all(userId) as {
      id: string; title: string; priority: string | null; dueDate: string | null; projectTitle: string
    }[]

  const nowIso = new Date().toISOString()
  const overdueTasks = (sqlite
    .prepare(
      `SELECT COUNT(*) AS n
         FROM tasks t
         INNER JOIN elements e ON e.id = t.project_id
         LEFT JOIN task_statuses s ON s.id = t.status_id
        WHERE e.created_by = ?
          AND e.is_deleted = 0
          AND t.due_date IS NOT NULL AND t.due_date < ?
          AND (s.is_done_state IS NULL OR s.is_done_state = 0)`,
    )
    .get(userId, nowIso) as { n: number }).n

  const overdueReminders = (sqlite
    .prepare(
      `SELECT COUNT(*) AS n
         FROM reminders r
         INNER JOIN elements e ON e.id = r.id
        WHERE e.created_by = ?
          AND r.is_dismissed = 0
          AND r.remind_at < ?`,
    )
    .get(userId, nowIso) as { n: number }).n

  return { elements, openTasks, overdueTasks, overdueReminders }
}

function buildContextMessage(snapshot: ContextSnapshot, displayName: string): string {
  const lines: string[] = []
  lines.push(`### Workspace context (snapshot for ${displayName})`)
  lines.push(``)
  lines.push(`Today's date: ${new Date().toISOString().slice(0, 10)}`)
  lines.push(`Overdue tasks: ${snapshot.overdueTasks}`)
  lines.push(`Overdue reminders: ${snapshot.overdueReminders}`)
  lines.push(``)
  if (snapshot.elements.length > 0) {
    lines.push(`### Top 50 active elements (most-recently-updated first)`)
    for (const e of snapshot.elements) {
      const desc = (e.description ?? "").replace(/\s+/g, " ").slice(0, 120)
      lines.push(`- [${e.type}] ${e.title}${desc ? ` — ${desc}` : ""}`)
    }
    lines.push(``)
  }
  if (snapshot.openTasks.length > 0) {
    lines.push(`### 20 most-pressing open tasks`)
    for (const t of snapshot.openTasks) {
      const pri = t.priority ? `[${t.priority}] ` : ""
      const due = t.dueDate ? `due ${t.dueDate.slice(0, 10)} · ` : ""
      lines.push(`- ${pri}${due}${t.title} (in *${t.projectTitle}*)`)
    }
  }
  return lines.join("\n")
}

const SYSTEM_PROMPT = `You are a friendly, concise assistant inside FlowSpace — a personal productivity workspace. The user is the owner; everything in the workspace context belongs to them.

Guidelines:
- When asked "what should I focus on?" or "what's blocking me?", look at overdue items + high-priority tasks first.
- When asked for summaries, be specific: cite element names verbatim.
- Markdown is fine — bullet lists, bold, etc. Don't use H1.
- Don't ask for permission to do things you can't actually do (you can't edit their workspace; you can only answer questions).
- Keep replies to 4-8 sentences unless the user explicitly asks for detail.
- If the context doesn't have enough info, say so plainly. Don't fabricate item names.`

export async function chatWithPlatform(
  messages: ChatMessage[],
): Promise<
  | { ok: true; reply: string }
  | { ok: false; error: string }
> {
  const me = await requireAuth()
  const cfg = readUserAI(me.id)
  if (!cfg) {
    return {
      ok: false,
      error:
        "Configure an OpenAI-compatible AI provider in Settings → AI features first.",
    }
  }
  if (messages.length === 0) {
    return { ok: false, error: "No messages." }
  }
  if (messages.length > 30) {
    // Trim oldest first; keep the most recent 20 turns.
    messages = messages.slice(-20)
  }

  const snapshot = snapshotWorkspace(me.id)
  const context = buildContextMessage(snapshot, me.displayName || me.username)

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
          ...(cfg.locale === "ar"
            ? [
                {
                  role: "system" as const,
                  content:
                    "Respond in Arabic (العربية) using Modern Standard Arabic. Keep proper nouns (project names, people's names, file names) exactly as written in the workspace context — do not transliterate or translate them.",
                },
              ]
            : []),
          { role: "system", content: context },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        max_tokens: 700,
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(45_000),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      const friendly =
        res.status === 401
          ? "Auth failed — check your API key."
          : res.status === 429
            ? "Provider rate-limit hit."
            : `Provider ${res.status}: ${body.slice(0, 200)}`
      return { ok: false, error: friendly }
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const reply = data.choices?.[0]?.message?.content?.trim() ?? ""
    if (!reply) return { ok: false, error: "Empty response from provider." }
    return { ok: true, reply }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    }
  }
}
