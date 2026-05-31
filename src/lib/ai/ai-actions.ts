/**
 * Shared definitions for the inline AI writing actions (Summarize, Expand,
 * Fix Grammar, …). Kept framework-free so both the trigger button and the
 * result-preview dialog can import them without a circular dependency.
 */

import type { LLMMessage } from "@/lib/ai/types"

export type AIAction =
  | "summarize"
  | "expand"
  | "fix_grammar"
  | "improve"
  | "generate_todos"
  | "continue"

/** How aggressively to summarize. Only relevant to the "summarize" action. */
export type SummaryStrength = "one_line" | "short" | "detailed"

export const ACTION_LABELS: Record<AIAction, string> = {
  summarize: "Summarize",
  expand: "Expand",
  fix_grammar: "Fix grammar",
  improve: "Improve writing",
  generate_todos: "Generate to-dos",
  continue: "Continue writing",
}

export const DEFAULT_SYSTEM_PROMPTS: Record<AIAction, string> = {
  summarize: "You are a concise summarizer. Provide a brief summary in 1-3 sentences.",
  expand: "You are a writing assistant. Expand the given text with more detail while keeping the same tone.",
  fix_grammar: "You are a proofreader. Fix grammar and spelling errors. Return only the corrected text, no explanations.",
  improve: "You are a writing assistant. Improve the clarity and flow of the text. Return only the improved text.",
  continue: "You are a writing assistant. Continue the text naturally, matching the style and tone. Write 2-3 more sentences.",
  generate_todos: "You are a task planner. Given a goal or description, generate a concise numbered list of actionable todo items (3-7 items). Return only the numbered list.",
}

/** Summarize strength → system prompt. */
export const STRENGTH_PROMPTS: Record<SummaryStrength, string> = {
  one_line:
    "You are a concise summarizer. Summarize the text in ONE short sentence. No preamble, no list.",
  short:
    "You are a concise summarizer. Summarize the text in 3–5 short bullet points. Be specific about names, numbers, and dates. No preamble.",
  detailed:
    "You are a summarizer. Write a thorough summary in one or two paragraphs, preserving the key points, names, numbers, and dates. No preamble.",
}

// NOTE: budgets are deliberately generous. "Thinking" models (e.g. Gemini
// 2.5 Flash) via the OpenAI-compat endpoint count their hidden reasoning
// tokens against max_tokens, so a tight cap gets eaten by thinking and the
// visible answer is truncated mid-sentence. These leave ample headroom; a
// non-thinking model simply stops at the natural end of its answer.
export const STRENGTH_MAX_TOKENS: Record<SummaryStrength, number> = {
  one_line: 1024,
  short: 2048,
  detailed: 4096,
}

/** Token budget for the non-summarize actions (expand, improve, continue…). */
export const DEFAULT_MAX_TOKENS = 2048

export const STRENGTH_LABELS: Record<SummaryStrength, string> = {
  one_line: "One line",
  short: "Short",
  detailed: "Detailed",
}

/** The user-turn content for each action (the system prompt carries the instruction). */
export function userContentFor(action: AIAction, text: string): string {
  switch (action) {
    case "summarize":
      return `Summarize this:\n\n${text}`
    case "expand":
      return `Expand this text:\n\n${text}`
    case "continue":
      return `Continue this:\n\n${text}`
    case "generate_todos":
      return `Generate todo items for:\n\n${text}`
    case "fix_grammar":
    case "improve":
    default:
      return text
  }
}

/**
 * Build the chat messages for an action.
 *  - `systemPrompt` overrides the system turn (used by the preview's custom
 *    instructions / strength picker). Falls back to the per-action default.
 */
export function buildMessages(
  action: AIAction,
  text: string,
  systemPrompt?: string,
): LLMMessage[] {
  return [
    { role: "system", content: systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPTS[action] },
    { role: "user", content: userContentFor(action, text) },
  ]
}
