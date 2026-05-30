"use client"

/**
 * Chat-with-your-workspace drawer.
 *
 * Mounted globally; toggled by a floating button in the lower-right
 * corner. Slides in from the right with a messages list, an input
 * with mic, and an "Ask" button. Each turn sends the conversation +
 * a fresh workspace snapshot to the user's AI provider.
 *
 * State is in-memory per-tab — refresh clears the conversation.
 * Suggested prompts at the bottom of an empty chat give people a
 * landing pad.
 */

import { useEffect, useRef, useState } from "react"
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Sparkles,
  Trash2,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SpeechButton } from "@/components/shared/speech-button"
import { chatWithPlatform, type ChatMessage } from "@/lib/actions/platform-chat-actions"

const SUGGESTIONS = [
  "What should I focus on today?",
  "Summarise my AGE project",
  "What's overdue and why?",
  "Which projects haven't moved this week?",
  "Draft a weekly status update I can email out",
]

export function PlatformChatDrawer() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      // Keyboard shortcut: Escape closes
      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false)
      }
      window.addEventListener("keydown", handler)
      return () => window.removeEventListener("keydown", handler)
    }
  }, [open])

  useEffect(() => {
    // Scroll to bottom whenever messages or sending state changes.
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, sending])

  async function send(text: string) {
    const clean = text.trim()
    if (!clean || sending) return
    const next: ChatMessage[] = [
      ...messages,
      { role: "user", content: clean },
    ]
    setMessages(next)
    setInput("")
    setError(null)
    setSending(true)
    try {
      const r = await chatWithPlatform(next)
      if (!r.ok) {
        setError(r.error)
        return
      }
      setMessages((m) => [...m, { role: "assistant", content: r.reply }])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error")
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {/* Floating launch button — bottom-right; matches the timer FAB style. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-4 right-4 z-40 size-12 rounded-full shadow-lg border border-primary/30 backdrop-blur-md transition-all flex items-center justify-center ${
          open
            ? "bg-card text-foreground rotate-90"
            : "bg-card/80 text-primary hover:bg-card hover:scale-105"
        }`}
        aria-label={open ? "Close assistant" : "Open assistant"}
      >
        {open ? <X className="size-5" /> : <MessageCircle className="size-5" />}
      </button>

      {/* Drawer */}
      <aside
        className={`fixed top-0 right-0 z-40 h-full w-full sm:w-[440px] max-w-full bg-card border-l border-border shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <Sparkles className="size-4 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Assistant</p>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Asks your AI provider about your workspace
              </p>
            </div>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  setMessages([])
                  setError(null)
                }}
              >
                <Trash2 className="size-3" />
                Clear
              </Button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <p className="text-xs text-primary/90 leading-relaxed">
                    Ask me anything about your workspace. I see your
                    elements, your open tasks, and what's overdue.
                  </p>
                </div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
                  Try
                </p>
                <ul className="space-y-1">
                  {SUGGESTIONS.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        onClick={() => send(s)}
                        disabled={sending}
                        className="w-full text-left px-3 py-2 rounded-md border border-border/60 text-xs hover:border-primary/40 hover:bg-accent/30 transition-colors"
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/60 text-foreground"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-muted/60 rounded-2xl px-3 py-2 text-sm flex items-center gap-2">
                  <Loader2 className="size-3.5 animate-spin" />
                  <span className="text-muted-foreground">Thinking…</span>
                </div>
              </div>
            )}
            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-md border border-destructive/40 bg-destructive/5 text-xs text-destructive">
                <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                <div className="leading-relaxed">{error}</div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Composer */}
          <div className="border-t p-3 space-y-2">
            <div className="relative">
              <Input
                placeholder="Ask anything…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    void send(input)
                  }
                }}
                disabled={sending}
                className="pr-20"
              />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                <SpeechButton
                  onTranscript={(t) => setInput((p) => (p ? `${p} ${t}` : t))}
                  size="sm"
                  showPulse={false}
                  tooltip="Speak your question"
                  preferAccuracy
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => void send(input)}
                  disabled={!input.trim() || sending}
                  aria-label="Send"
                >
                  <Send className="size-3.5" />
                </Button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/70 text-center">
              Uses your AI provider (Settings → AI features). Workspace
              context refreshed every turn.
            </p>
          </div>
        </div>
      </aside>
    </>
  )
}
