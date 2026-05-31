"use client"

import { useState, useRef, useEffect } from "react"
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
import { AIResultPreview, type AIPreviewState } from "@/components/shared/ai-result-preview"
import {
  type AIAction,
  type SummaryStrength,
  DEFAULT_SYSTEM_PROMPTS,
  STRENGTH_PROMPTS,
  STRENGTH_MAX_TOKENS,
  DEFAULT_MAX_TOKENS,
  buildMessages,
} from "@/lib/ai/ai-actions"

export type { AIAction } from "@/lib/ai/ai-actions"

interface MenuItem {
  id: AIAction
  label: string
  icon: typeof Sparkles
}

const MENU: MenuItem[] = [
  { id: "summarize", label: "Summarize", icon: FileText },
  { id: "expand", label: "Expand", icon: Expand },
  { id: "fix_grammar", label: "Fix Grammar", icon: CheckCheck },
  { id: "improve", label: "Improve Writing", icon: Wand2 },
  { id: "continue", label: "Continue Writing", icon: Expand },
  { id: "generate_todos", label: "Generate Todos", icon: ListTodo },
]

// ─── Component ──────────────────────────────────────────────────────────

interface AIActionButtonProps {
  /** Current text to act on */
  text: string
  /** Called with the AI-generated result once the user applies it */
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
  const [preview, setPreview] = useState<AIPreviewState | null>(null)
  const [regenerating, setRegenerating] = useState(false)
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

  if (!preferences.aiEnabled || !enabled) return null

  const visibleActions = actions ? MENU.filter((a) => actions.includes(a.id)) : MENU

  const sizeClasses = { sm: "size-7", md: "size-8", lg: "size-10" }
  const iconSizes = { sm: "size-3", md: "size-3.5", lg: "size-4" }

  /** Resolve the effective system prompt + token budget for the first run. */
  function initialPromptFor(action: AIAction): { systemPrompt: string; maxTokens: number } {
    if (action === "summarize") {
      const strength = preferences.aiSummaryStrength ?? "short"
      const saved = preferences.aiSystemPrompts?.summarize
      const systemPrompt =
        saved && saved !== DEFAULT_SYSTEM_PROMPTS.summarize ? saved : STRENGTH_PROMPTS[strength]
      return { systemPrompt, maxTokens: STRENGTH_MAX_TOKENS[strength] }
    }
    return {
      systemPrompt: preferences.aiSystemPrompts?.[action] || DEFAULT_SYSTEM_PROMPTS[action],
      maxTokens: DEFAULT_MAX_TOKENS,
    }
  }

  async function runGenerate(action: AIAction, systemPrompt: string, maxTokens: number): Promise<string> {
    const result = await generateText({
      messages: buildMessages(action, text, systemPrompt),
      maxTokens,
      temperature: 0.7,
    })
    return result.text.trim()
  }

  async function handleAction(action: AIAction) {
    if (!text.trim()) return
    setOpen(false)
    setLoading(true)
    setActiveAction(action)
    try {
      const { systemPrompt, maxTokens } = initialPromptFor(action)
      const out = await runGenerate(action, systemPrompt, maxTokens)
      if (!out) return
      if (preferences.aiPreviewBeforeApply) {
        setPreview({ action, original: text, result: out })
      } else {
        onResult(out, action)
      }
    } catch (err) {
      console.error("[AI Action] Error:", err)
    } finally {
      setLoading(false)
      setActiveAction(null)
    }
  }

  async function handleRegenerate(systemPrompt: string, strength: SummaryStrength) {
    if (!preview) return
    setRegenerating(true)
    try {
      const maxTokens = preview.action === "summarize" ? STRENGTH_MAX_TOKENS[strength] : DEFAULT_MAX_TOKENS
      const out = await runGenerate(preview.action, systemPrompt, maxTokens)
      if (out) setPreview({ ...preview, result: out })
    } catch (err) {
      console.error("[AI Action] Regenerate error:", err)
    } finally {
      setRegenerating(false)
    }
  }

  function handleApply(finalText: string) {
    if (!preview) return
    onResult(finalText, preview.action)
    setPreview(null)
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
                onClick={() => handleAction(action.id)}
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

      {preview && (
        <AIResultPreview
          state={preview}
          busy={regenerating}
          onRegenerate={handleRegenerate}
          onApply={handleApply}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  )
}
