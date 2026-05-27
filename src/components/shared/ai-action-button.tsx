"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import {
  Sparkles,
  Loader2,
  FileText,
  Expand,
  CheckCheck,
  Wand2,
  ListTodo,
} from "lucide-react"
import { useAI } from "@/lib/hooks/use-ai"
import { usePreferences } from "@/lib/hooks/use-preferences"
import type { LLMMessage } from "@/lib/ai/types"

// ─── Action definitions ─────────────────────────────────────────────────

export type AIAction =
  | "summarize"
  | "expand"
  | "fix_grammar"
  | "improve"
  | "generate_todos"
  | "continue"

interface AIActionDef {
  id: AIAction
  label: string
  icon: typeof Sparkles
  prompt: (text: string) => LLMMessage[]
}

const DEFAULT_SYSTEM_PROMPTS: Record<AIAction, string> = {
  summarize: "You are a concise summarizer. Provide a brief summary in 1-3 sentences.",
  expand: "You are a writing assistant. Expand the given text with more detail while keeping the same tone.",
  fix_grammar: "You are a proofreader. Fix grammar and spelling errors. Return only the corrected text, no explanations.",
  improve: "You are a writing assistant. Improve the clarity and flow of the text. Return only the improved text.",
  continue: "You are a writing assistant. Continue the text naturally, matching the style and tone. Write 2-3 more sentences.",
  generate_todos: "You are a task planner. Given a goal or description, generate a concise numbered list of actionable todo items (3-7 items). Return only the numbered list.",
}

function buildActions(customPrompts: Record<string, string>): AIActionDef[] {
  function getPrompt(id: AIAction): string {
    return customPrompts[id] || DEFAULT_SYSTEM_PROMPTS[id]
  }

  return [
    {
      id: "summarize",
      label: "Summarize",
      icon: FileText,
      prompt: (text) => [
        { role: "system", content: getPrompt("summarize") },
        { role: "user", content: `Summarize this:\n\n${text}` },
      ],
    },
    {
      id: "expand",
      label: "Expand",
      icon: Expand,
      prompt: (text) => [
        { role: "system", content: getPrompt("expand") },
        { role: "user", content: `Expand this text:\n\n${text}` },
      ],
    },
    {
      id: "fix_grammar",
      label: "Fix Grammar",
      icon: CheckCheck,
      prompt: (text) => [
        { role: "system", content: getPrompt("fix_grammar") },
        { role: "user", content: text },
      ],
    },
    {
      id: "improve",
      label: "Improve Writing",
      icon: Wand2,
      prompt: (text) => [
        { role: "system", content: getPrompt("improve") },
        { role: "user", content: text },
      ],
    },
    {
      id: "continue",
      label: "Continue Writing",
      icon: Expand,
      prompt: (text) => [
        { role: "system", content: getPrompt("continue") },
        { role: "user", content: `Continue this:\n\n${text}` },
      ],
    },
    {
      id: "generate_todos",
      label: "Generate Todos",
      icon: ListTodo,
      prompt: (text) => [
        { role: "system", content: getPrompt("generate_todos") },
        { role: "user", content: `Generate todo items for:\n\n${text}` },
      ],
    },
  ]
}

// ─── Component ──────────────────────────────────────────────────────────

interface AIActionButtonProps {
  /** Current text to act on */
  text: string
  /** Called with the AI-generated result */
  onResult: (result: string, action: AIAction) => void
  /** Filter which actions to show */
  actions?: AIAction[]
  /** Optional class */
  className?: string
  /** Size variant */
  size?: "sm" | "md" | "lg"
}

export function AIActionButton({
  text,
  onResult,
  actions,
  className = "",
  size = "md",
}: AIActionButtonProps) {
  const { preferences } = usePreferences()
  const { enabled, generateText } = useAI()
  const [loading, setLoading] = useState(false)
  const [activeAction, setActiveAction] = useState<AIAction | null>(null)
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  // Close menu on outside click — must be before any early return
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  const ACTIONS = useMemo(
    () => buildActions(preferences.aiSystemPrompts ?? {}),
    [preferences.aiSystemPrompts],
  )

  if (!preferences.aiEnabled || !enabled) return null

  const visibleActions = actions
    ? ACTIONS.filter((a) => actions.includes(a.id))
    : ACTIONS

  const sizeClasses = {
    sm: "size-7",
    md: "size-8",
    lg: "size-10",
  }

  const iconSizes = {
    sm: "size-3",
    md: "size-3.5",
    lg: "size-4",
  }

  async function handleAction(action: AIActionDef) {
    if (!text.trim()) return

    setOpen(false)
    setLoading(true)
    setActiveAction(action.id)

    try {
      const result = await generateText({
        messages: action.prompt(text),
        maxTokens: 512,
        temperature: 0.7,
      })

      if (result.text.trim()) {
        onResult(result.text.trim(), action.id)
      }
    } catch (err) {
      console.error("[AI Action] Error:", err)
    } finally {
      setLoading(false)
      setActiveAction(null)
    }
  }

  return (
    <div className="relative nodrag nopan" onPointerDown={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        disabled={loading || !text.trim()}
        title={loading ? "AI processing..." : "AI actions"}
        onClick={() => setOpen((v) => !v)}
        className={`
          inline-flex items-center justify-center rounded-full transition-all
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
          ${sizeClasses[size]}
          ${
            loading
              ? "bg-primary/20 text-primary cursor-wait"
              : open
                ? "bg-accent text-foreground"
                : "bg-muted/60 text-muted-foreground hover:bg-accent hover:text-foreground"
          }
          ${className}
        `}
        aria-label="AI actions"
      >
        {loading ? (
          <Loader2 className={`${iconSizes[size]} animate-spin`} />
        ) : (
          <Sparkles className={iconSizes[size]} />
        )}
      </button>

      {open && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-lg border bg-popover p-1 text-sm shadow-lg"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
            AI Actions
          </div>
          <div className="my-1 border-t" />
          {visibleActions.map((action) => {
            const Icon = action.icon
            const isActive = activeAction === action.id
            return (
              <button
                key={action.id}
                type="button"
                disabled={loading}
                onClick={() => handleAction(action)}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-left rounded-md transition-colors hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isActive ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Icon className="size-4" />
                )}
                {action.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
