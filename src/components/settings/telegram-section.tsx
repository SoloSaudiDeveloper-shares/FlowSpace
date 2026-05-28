"use client"

/**
 * Settings → Telegram panel.
 *
 * Lets the user paste a bot token from @BotFather, validates it with
 * the Telegram API, registers the webhook so messages route back to
 * FlowSpace, and shows the connection status. Once connected, the user
 * texts their bot — those texts become todo items, tasks, or trigger
 * info commands like /tasks, /deadlines, etc.
 */

import { useEffect, useState } from "react"
import {
  Bot,
  Check,
  Loader2,
  LinkIcon as LinkIconLucide,
  Send,
  X,
  Sparkles,
  AlertCircle,
  ExternalLink,
  MessageSquare,
  Trash2,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Zap,
} from "lucide-react"
const LinkIcon = LinkIconLucide
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  getMyTelegramStatus,
  connectTelegramBot,
  disconnectTelegramBot,
  sendTestTelegramMessage,
  setTelegramTargetList,
  getMyTodoListsForTelegram,
  getMyTelegramHistory,
  clearMyTelegramHistory,
  setTelegramVoiceLanguage,
  setTelegramVoiceAutoSkip,
  type TelegramBotStatus,
  type TelegramHistoryEntry,
} from "@/lib/actions/telegram-actions"

export function TelegramSection({
  featureEnabled,
}: {
  featureEnabled: boolean
}) {
  const [status, setStatus] = useState<TelegramBotStatus | null>(null)
  const [token, setToken] = useState("")
  const [connecting, setConnecting] = useState(false)
  const [testing, setTesting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  // Per-user target list — where freeform quick-captures land.
  const [lists, setLists] = useState<{ id: string; title: string; itemCount: number }[]>([])
  const [savingList, setSavingList] = useState(false)
  // Bot message history (last 50 inbound + outbound).
  const [history, setHistory] = useState<TelegramHistoryEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  // Voice settings
  const [savingVoice, setSavingVoice] = useState(false)

  async function refresh() {
    try {
      const s = await getMyTelegramStatus()
      setStatus(s)
      if (s.connected) {
        const ls = await getMyTodoListsForTelegram().catch(() => [])
        setLists(ls)
      }
    } catch {
      setStatus({ connected: false, webhookConfigured: false, targetListId: null, voiceLanguage: "en", voiceAutoSkip: false })
    }
  }
  useEffect(() => { refresh() }, [])

  async function handleSetTargetList(id: string | null) {
    setSavingList(true)
    try {
      await setTelegramTargetList(id)
      toast.success(id ? "Capture target updated" : "Reverted to most-recent list")
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update target list")
    } finally {
      setSavingList(false)
    }
  }

  async function loadHistory() {
    setHistoryLoading(true)
    try {
      const h = await getMyTelegramHistory(50)
      setHistory(h)
      setShowHistory(true)
    } catch {
      toast.error("Couldn't load history")
    } finally {
      setHistoryLoading(false)
    }
  }

  async function handleSetVoiceLanguage(lang: string) {
    setSavingVoice(true)
    try {
      await setTelegramVoiceLanguage(lang)
      toast.success("Voice language updated")
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set language")
    } finally {
      setSavingVoice(false)
    }
  }

  async function handleToggleAutoSkip(enabled: boolean) {
    setSavingVoice(true)
    try {
      await setTelegramVoiceAutoSkip(enabled)
      toast.success(enabled ? "Auto-skip ON — voice notes use defaults" : "Auto-skip OFF — pickers will show")
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update setting")
    } finally {
      setSavingVoice(false)
    }
  }

  async function handleClearHistory() {
    if (!confirm("Delete all logged bot messages? This can't be undone.")) return
    try {
      const r = await clearMyTelegramHistory()
      toast.success(`Cleared ${r.deleted} message${r.deleted === 1 ? "" : "s"}`)
      setHistory([])
    } catch {
      toast.error("Couldn't clear history")
    }
  }

  async function handleConnect() {
    if (!token.trim() || connecting) return
    setConnecting(true)
    try {
      const result = await connectTelegramBot(token.trim())
      if (result.ok) {
        toast.success(`Connected to @${result.botUsername}`)
        setToken("")
        await refresh()
      } else {
        toast.error(result.error)
      }
    } finally {
      setConnecting(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect this Telegram bot? You can reconnect any time.")) return
    setDisconnecting(true)
    try {
      await disconnectTelegramBot()
      toast.success("Disconnected")
      await refresh()
    } finally {
      setDisconnecting(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    try {
      const r = await sendTestTelegramMessage()
      if (r.ok) toast.success("Test message sent")
      else toast.error(r.error)
    } finally {
      setTesting(false)
    }
  }

  if (!featureEnabled) {
    return (
      <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-amber-500/40 bg-amber-500/5">
        <AlertCircle className="size-4 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-amber-200">Telegram integration is disabled</p>
          <p className="text-xs text-amber-200/70 mt-0.5 leading-relaxed">
            Ask an admin to enable it under <strong>Admin → Telegram</strong>.
            Once enabled, you can connect your own bot here and it&apos;ll
            stay private to your account.
          </p>
        </div>
      </div>
    )
  }

  // ── Connected state ────────────────────────────────────────────────
  if (status?.connected) {
    return (
      <div className="space-y-3">
        <div className="px-4 py-4 rounded-lg border bg-card flex items-start gap-3">
          <div className="size-9 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
            <Bot className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium flex items-center gap-1.5">
              Connected
              <Check className="size-3.5 text-emerald-400" />
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {status.botUsername ? <>@{status.botUsername}</> : "Bot is online"}
            </p>
            {status.lastSeenAt && (
              <p className="text-[11px] text-muted-foreground/70 mt-1">
                Last message: {new Date(status.lastSeenAt).toLocaleString()}
              </p>
            )}
            {!status.webhookConfigured && (
              <p className="text-xs text-amber-400 mt-2 leading-relaxed">
                ⚠️ Webhook URL couldn&apos;t be registered (PUBLIC_APP_URL not set
                in env). Inbound messages won&apos;t arrive until that&apos;s configured.
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button size="sm" variant="outline" onClick={handleTest} disabled={testing}>
              {testing ? <Loader2 className="size-3 animate-spin mr-1.5" /> : <Send className="size-3 mr-1.5" />}
              Test
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDisconnect} disabled={disconnecting}>
              {disconnecting ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
            </Button>
          </div>
        </div>

        {/* Voice notes defaults */}
        <div className="px-4 py-3 rounded-lg border bg-card">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
            Voice notes
          </p>
          <p className="text-[11px] text-muted-foreground/80 mb-3 leading-relaxed">
            What happens when you send a voice note to the bot. The defaults
            below are used by the &ldquo;⚡ Skip&rdquo; button on each
            picker and by auto-skip mode.
          </p>

          {/* Default language */}
          <label className="block text-[11px] font-medium text-muted-foreground mb-1">Default language</label>
          <select
            value={status.voiceLanguage}
            onChange={(e) => handleSetVoiceLanguage(e.target.value)}
            disabled={savingVoice}
            className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring mb-3"
          >
            <option value="en">🇬🇧 English</option>
            <option value="ar">🇸🇦 Arabic</option>
            <option value="es">🇪🇸 Spanish</option>
            <option value="fr">🇫🇷 French</option>
            <option value="de">🇩🇪 German</option>
            <option value="pt">🇵🇹 Portuguese</option>
            <option value="ru">🇷🇺 Russian</option>
            <option value="tr">🇹🇷 Turkish</option>
            <option value="ur">🇵🇰 Urdu</option>
            <option value="fa">🇮🇷 Persian</option>
            <option value="he">🇮🇱 Hebrew</option>
            <option value="zh">🇨🇳 Chinese</option>
            <option value="ja">🇯🇵 Japanese</option>
            <option value="ko">🇰🇷 Korean</option>
            <option value="hi">🇮🇳 Hindi</option>
            <option value="auto">🌐 Auto-detect</option>
          </select>

          {/* Auto-skip toggle */}
          <div className="flex items-center gap-3 pt-1">
            <button
              role="switch"
              aria-checked={status.voiceAutoSkip}
              onClick={() => handleToggleAutoSkip(!status.voiceAutoSkip)}
              disabled={savingVoice}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                status.voiceAutoSkip ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`inline-block size-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  status.voiceAutoSkip ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <div className="flex-1">
              <p className="text-sm font-medium">Skip pickers automatically</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                When on, every voice note goes straight to the default
                language + default list with zero taps.
              </p>
            </div>
          </div>
        </div>

        {/* Where captures go */}
        <div className="px-4 py-3 rounded-lg border bg-card">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
            Where freeform messages land
          </p>
          <p className="text-[11px] text-muted-foreground/80 mb-2 leading-relaxed">
            When you text the bot without a slash command, the message gets
            captured as a todo item. Pick which list it lands in here.
          </p>
          <div className="flex items-center gap-2">
            <select
              value={status.targetListId ?? ""}
              onChange={(e) => handleSetTargetList(e.target.value || null)}
              disabled={savingList || lists.length === 0}
              className="flex-1 h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Most-recently-updated list (auto)</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title} ({l.itemCount} item{l.itemCount === 1 ? "" : "s"})
                </option>
              ))}
            </select>
            {savingList && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
          </div>
          {lists.length === 0 && (
            <p className="text-[11px] text-amber-400 mt-1.5">
              You don&apos;t have any todo lists yet. The bot will auto-create one
              called &ldquo;Inbox&rdquo; on your first message.
            </p>
          )}
        </div>

        {/* Smart-capture syntax */}
        <div className="px-4 py-3 rounded-lg border bg-card">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Sparkles className="size-3 text-primary" />
            Smart capture — inline syntax
          </p>
          <p className="text-[11px] text-muted-foreground/80 mb-3 leading-relaxed">
            Sprinkle these anywhere in a freeform message. The bot pulls them
            out and tells you what it captured.
          </p>
          <div className="grid grid-cols-1 gap-y-1.5 text-xs">
            <CheatRow code="!high" desc="Set priority (urgent/high/medium/low)" />
            <CheatRow code="@2026-06-15" desc="Set ISO due date" />
            <CheatRow code="@tomorrow" desc="Or @today / @tomorrow / @next-week" />
            <CheatRow code="#release" desc="Add a tag (alphanumeric + dashes)" />
          </div>
          <p className="text-[11px] text-muted-foreground/60 mt-2.5 leading-relaxed">
            <strong className="text-foreground/80">Example:</strong>{" "}
            <code className="text-primary">ship v1 @2026-06-15 !high #release</code>
            {" "}→ title <em>&ldquo;ship v1&rdquo;</em>, due 2026-06-15, priority high, tag <code>#release</code>
          </p>
        </div>

        {/* Commands cheatsheet */}
        <div className="px-4 py-3 rounded-lg border bg-card">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Sparkles className="size-3 text-primary" />
            Commands
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-1.5 gap-x-4 text-xs">
            <CheatRow code="<text>" desc="Capture as todo (smart syntax above)" />
            <CheatRow code="/tasks" desc="Open tasks across projects" />
            <CheatRow code="/deadlines 7" desc="Due in the next N days" />
            <CheatRow code="/projects" desc="Projects + completion %" />
            <CheatRow code="/lists" desc="Your todo lists" />
            <CheatRow code="/add buy milk" desc="Quick add to default" />
            <CheatRow code='/todo "Work" review PRs' desc="Add to a specific list" />
            <CheatRow code="/task NorthStar Ship v1" desc="New task in a project" />
            <CheatRow code="/done a1b2c3d4" desc="Mark a task/todo done" />
            <CheatRow code="/help" desc="Full command list" />
          </div>
        </div>

        {/* AI-import via bot — explainer */}
        <div className="px-4 py-3 rounded-lg border border-primary/40 bg-gradient-to-r from-primary/5 to-transparent">
          <p className="text-xs font-medium uppercase tracking-wider text-primary mb-2 flex items-center gap-1.5">
            <Zap className="size-3" />
            Paste-from-AI inbox
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            Brainstorm with Claude or ChatGPT, ask them to output in FlowSpace
            format, then paste the markdown to your bot. FlowSpace recognises
            the structure and queues it for your approval instead of acting
            immediately — you review on the home page (pending-imports banner)
            and click <strong className="text-foreground">Approve</strong> to
            materialise the project/page/etc.
          </p>
          <div className="text-[11px] font-mono bg-muted/60 rounded-md p-2.5 leading-relaxed text-muted-foreground border border-border/40">
            <span className="text-primary"># Project:</span> NorthStar
            <br />
            <span className="text-primary">Status:</span> active
            <br />
            <span className="text-primary">Due:</span> 2026-07-15
            <br />
            <br />
            <span className="text-primary">## Tasks</span>
            <br />
            - [ ] (high) Extract toolkit components
            <br />
            - [ ] @2026-06-15 Stage toolkits in Hub
          </div>
          <p className="text-[11px] text-muted-foreground/70 mt-2">
            Get the ready-made AI prompt from the home page →
            &ldquo;Import from AI&rdquo; → &ldquo;Copy AI prompt&rdquo;.
          </p>
        </div>

        {/* What's possible — comprehensive guide */}
        <div className="px-4 py-3 rounded-lg border bg-card">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <BookOpen className="size-3 text-primary" />
            What you can do
          </p>
          <ul className="text-xs space-y-1.5 leading-relaxed">
            <GuideRow title="Capture ideas on the go">
              Text the bot anything — it becomes a todo item in your chosen
              list. Add <code>!high</code>, <code>@tomorrow</code>, or
              <code>#tag</code> to enrich without typing fields.
            </GuideRow>
            <GuideRow title="Query your work from anywhere">
              <code>/tasks</code>, <code>/deadlines</code>,{" "}
              <code>/projects</code>, <code>/lists</code> — quick read-only
              summaries pulled live from your workspace.
            </GuideRow>
            <GuideRow title="Mark things done">
              <code>/done &lt;id-prefix&gt;</code> — the 8-character ID shown
              after each task/todo in any reply. Fuzzy match — first 4 chars
              are enough.
            </GuideRow>
            <GuideRow title="Push a whole project structure">
              Paste FlowSpace AI-import markdown to the bot. It queues for
              human review (no auto-mutate) — you approve on the home page.
            </GuideRow>
            <GuideRow title="Choose where captures land">
              Set the target list above. Captures route there until you
              switch. Default is most-recently-updated.
            </GuideRow>
            <GuideRow title="Test the connection">
              The &ldquo;Test&rdquo; button up top sends a hello-world. Useful
              after reconnecting or moving between dev/prod.
            </GuideRow>
            <GuideRow title="See history">
              The block below logs the last 50 messages — handy for
              debugging or auditing.
            </GuideRow>
          </ul>
        </div>

        {/* Message history */}
        <div className="px-4 py-3 rounded-lg border bg-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <MessageSquare className="size-3 text-primary" />
              Message history
            </p>
            <div className="flex items-center gap-1.5">
              {showHistory && history.length > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={handleClearHistory}>
                  <Trash2 className="size-3 mr-1" />
                  Clear
                </Button>
              )}
              <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={loadHistory} disabled={historyLoading}>
                {historyLoading ? <Loader2 className="size-3 mr-1 animate-spin" /> : null}
                {showHistory ? "Refresh" : "Load history"}
              </Button>
            </div>
          </div>
          {showHistory && (
            <>
              {history.length === 0 ? (
                <p className="text-[11px] text-muted-foreground text-center py-6">
                  No bot messages logged yet. Send something to your bot and reload.
                </p>
              ) : (
                <div className="max-h-72 overflow-y-auto space-y-1 -mx-1 px-1">
                  {history.map((m) => (
                    <div
                      key={m.id}
                      className={`flex items-start gap-2 px-2 py-1.5 rounded-md text-xs ${
                        m.direction === "in"
                          ? "bg-muted/40"
                          : "bg-primary/5 border-l-2 border-primary/40"
                      }`}
                    >
                      {m.direction === "in" ? (
                        <ArrowDown className="size-3 text-muted-foreground shrink-0 mt-0.5" />
                      ) : (
                        <ArrowUp className="size-3 text-primary shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="whitespace-pre-wrap break-words leading-relaxed">{m.text}</p>
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                          {new Date(m.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Disconnected state — show setup wizard ─────────────────────────
  return (
    <div className="space-y-3">
      <div className="px-4 py-4 rounded-lg border bg-card space-y-3">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Bot className="size-4" />
          </div>
          <div>
            <p className="text-sm font-medium">Connect your bot</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Each user has their own bot — your messages stay yours. Once
              connected, text the bot from anywhere and ideas become real
              items in FlowSpace.
            </p>
          </div>
        </div>

        {/* Steps */}
        <ol className="text-xs space-y-1.5 pl-1">
          <Step n={1}>
            Open Telegram and message{" "}
            <a
              href="https://t.me/BotFather"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline inline-flex items-center gap-0.5"
            >
              @BotFather
              <ExternalLink className="size-2.5" />
            </a>{" "}
            — send <code className="px-1 py-0.5 rounded bg-muted text-[10px]">/newbot</code> and follow the prompts.
          </Step>
          <Step n={2}>Copy the bot token BotFather gives you (looks like <code className="px-1 py-0.5 rounded bg-muted text-[10px]">123456:ABC-DEF…</code>).</Step>
          <Step n={3}>Paste it below — FlowSpace verifies it and wires the webhook automatically.</Step>
          <Step n={4}>Open your bot in Telegram and send <code className="px-1 py-0.5 rounded bg-muted text-[10px]">/start</code>.</Step>
        </ol>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleConnect() }}
            placeholder="123456:ABC-DEF1234ghIkl…"
            autoComplete="off"
            className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm font-mono placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button onClick={handleConnect} disabled={!token.trim() || connecting}>
            {connecting ? (
              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
            ) : (
              <LinkIcon className="size-3.5 mr-1.5" />
            )}
            Connect
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
          🔒 Your token is stored server-side, scoped to your account only,
          and never sent back to the browser after this initial paste.
        </p>
      </div>
    </div>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="size-5 rounded-full bg-muted text-foreground/70 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-semibold">
        {n}
      </span>
      <span className="text-foreground/90 leading-snug">{children}</span>
    </li>
  )
}

function CheatRow({ code, desc }: { code: string; desc: string }) {
  return (
    <div className="flex items-baseline gap-2 min-w-0">
      <code className="text-[11px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0 truncate max-w-[200px]">
        {code}
      </code>
      <span className="text-muted-foreground truncate">{desc}</span>
    </div>
  )
}

function GuideRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="text-primary mt-0.5 shrink-0">▸</span>
      <span>
        <strong className="text-foreground/90">{title}.</strong>{" "}
        <span className="text-muted-foreground [&_code]:font-mono [&_code]:text-primary [&_code]:bg-primary/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[10px]">
          {children}
        </span>
      </span>
    </li>
  )
}
