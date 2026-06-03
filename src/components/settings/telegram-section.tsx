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
  AlertCircle,
  ExternalLink,
  MessageSquare,
  Trash2,
  ArrowDown,
  ArrowUp,
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
  setTelegramVoiceKeyUseShared,
  setTelegramCaptionLanguage,
  type TelegramBotStatus,
  type TelegramHistoryEntry,
} from "@/lib/actions/telegram-actions"
import { BotReplyTemplatesPanel } from "@/components/settings/bot-reply-templates"
import { SectionHelp } from "@/components/shared/section-help"
import { useT } from "@/lib/hooks/use-i18n"

export function TelegramSection({
  featureEnabled,
}: {
  featureEnabled: boolean
}) {
  const { t } = useT()
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
      setStatus({ connected: false, webhookConfigured: false, targetListId: null, voiceLanguage: "en", voiceAutoSkip: false, voiceKeyUseShared: false, captionLanguage: "auto", sharedVoiceKeyAvailable: false })
    }
  }
  useEffect(() => { refresh() }, [])

  async function handleSetTargetList(id: string | null) {
    setSavingList(true)
    try {
      await setTelegramTargetList(id)
      toast.success(id ? t("settings.telegram.captureUpdated") : t("settings.telegram.captureReverted"))
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.telegram.captureFailed"))
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
      toast.error(t("settings.telegram.historyLoadFailed"))
    } finally {
      setHistoryLoading(false)
    }
  }

  async function handleSetVoiceLanguage(lang: string) {
    setSavingVoice(true)
    try {
      await setTelegramVoiceLanguage(lang)
      toast.success(t("settings.telegram.langUpdated"))
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.telegram.langFailed"))
    } finally {
      setSavingVoice(false)
    }
  }

  async function handleSetCaptionLanguage(lang: string) {
    setSavingVoice(true)
    try {
      await setTelegramCaptionLanguage(lang)
      toast.success("Caption language updated")
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update caption language")
    } finally {
      setSavingVoice(false)
    }
  }

  async function handleToggleAutoSkip(enabled: boolean) {
    setSavingVoice(true)
    try {
      await setTelegramVoiceAutoSkip(enabled)
      toast.success(enabled ? t("settings.telegram.autoSkipOn") : t("settings.telegram.autoSkipOff"))
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.telegram.updateFailed"))
    } finally {
      setSavingVoice(false)
    }
  }

  async function handleToggleSharedKey(useShared: boolean) {
    setSavingVoice(true)
    try {
      await setTelegramVoiceKeyUseShared(useShared)
      toast.success(useShared
        ? t("settings.telegram.switchedShared")
        : t("settings.telegram.switchedOwn"))
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.telegram.updateFailed"))
    } finally {
      setSavingVoice(false)
    }
  }

  async function handleClearHistory() {
    if (!confirm(t("settings.telegram.clearConfirm"))) return
    try {
      const r = await clearMyTelegramHistory()
      toast.success(
        t(r.deleted === 1 ? "settings.telegram.clearedOne" : "settings.telegram.cleared")
          .replace("{count}", String(r.deleted)),
      )
      setHistory([])
    } catch {
      toast.error(t("settings.telegram.clearFailed"))
    }
  }

  async function handleConnect() {
    if (!token.trim() || connecting) return
    setConnecting(true)
    try {
      const result = await connectTelegramBot(token.trim())
      if (result.ok) {
        toast.success(t("settings.telegram.connectedTo").replace("{username}", result.botUsername ?? ""))
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
    if (!confirm(t("settings.telegram.disconnectConfirm"))) return
    setDisconnecting(true)
    try {
      await disconnectTelegramBot()
      toast.success(t("settings.telegram.disconnected"))
      await refresh()
    } finally {
      setDisconnecting(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    try {
      const r = await sendTestTelegramMessage()
      if (r.ok) toast.success(t("settings.telegram.testSent"))
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
          <p className="font-medium text-amber-200">{t("settings.telegram.disabledTitle")}</p>
          <p className="text-xs text-amber-200/70 mt-0.5 leading-relaxed">
            {t("settings.telegram.disabledHelp")}
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
              {t("settings.telegram.connected")}
              <Check className="size-3.5 text-emerald-400" />
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {status.botUsername ? <>@{status.botUsername}</> : t("settings.telegram.botOnline")}
            </p>
            {status.lastSeenAt && (
              <p className="text-[11px] text-muted-foreground/70 mt-1">
                {t("settings.telegram.lastMessage").replace("{when}", new Date(status.lastSeenAt).toLocaleString())}
              </p>
            )}
            {!status.webhookConfigured && (
              <p className="text-xs text-amber-400 mt-2 leading-relaxed">
                {t("settings.telegram.webhookWarn")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <SectionHelp guideId="telegramBot" label={t("settings.telegram.howToUse")} />
            <Button size="sm" variant="outline" onClick={handleTest} disabled={testing}>
              {testing ? <Loader2 className="size-3 animate-spin mr-1.5" /> : <Send className="size-3 mr-1.5" />}
              {t("settings.telegram.testBtn")}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDisconnect} disabled={disconnecting}>
              {disconnecting ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
            </Button>
          </div>
        </div>

        {/* Voice notes defaults */}
        <div className="px-4 py-3 rounded-lg border bg-card">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
            {t("settings.telegram.voiceNotes")}
          </p>
          <p className="text-[11px] text-muted-foreground/80 mb-3 leading-relaxed">
            {t("settings.telegram.voiceNotesHelp")}
          </p>

          {/* Default language */}
          <label className="block text-[11px] font-medium text-muted-foreground mb-1">{t("settings.telegram.defaultLanguage")}</label>
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
              <p className="text-sm font-medium">{t("settings.telegram.autoSkip")}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {t("settings.telegram.autoSkipHelp")}
              </p>
            </div>
          </div>

          {/* Groq key source */}
          {status.sharedVoiceKeyAvailable ? (
            <div className="flex items-center gap-3 pt-3 mt-3 border-t border-border/40">
              <button
                role="switch"
                aria-checked={status.voiceKeyUseShared}
                onClick={() => handleToggleSharedKey(!status.voiceKeyUseShared)}
                disabled={savingVoice}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                  status.voiceKeyUseShared ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`inline-block size-4 transform rounded-full bg-white shadow-sm transition-transform ${
                    status.voiceKeyUseShared ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {t("settings.telegram.useSharedKey")}
                  {status.voiceKeyUseShared && (
                    <span className="ml-1.5 text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
                      {t("settings.telegram.rateLimited")}
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {status.voiceKeyUseShared
                    ? t("settings.telegram.sharedKeyOn")
                    : t("settings.telegram.sharedKeyOff")}
                </p>
              </div>
            </div>
          ) : (
            <div className="pt-3 mt-3 border-t border-border/40">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                💡 <strong className="text-foreground/80">{t("settings.telegram.usingPersonalKey")}</strong>
                {" "}{t("settings.telegram.personalKeyNote")}{" "}
                <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="underline hover:text-foreground">
                  console.groq.com/keys
                </a>.
              </p>
            </div>
          )}
        </div>

        {/* Gallery caption language */}
        <div className="px-4 py-3 rounded-lg border bg-card">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
            🖼 Gallery captions
          </p>
          <label className="block text-[11px] font-medium text-muted-foreground mb-1">Caption language</label>
          <select
            value={status.captionLanguage}
            onChange={(e) => handleSetCaptionLanguage(e.target.value)}
            disabled={savingVoice}
            className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="auto">🌐 Auto (match the image)</option>
            <option value="en">🇬🇧 English</option>
            <option value="ar">🇸🇦 Arabic</option>
            <option value="es">🇪🇸 Spanish</option>
            <option value="fr">🇫🇷 French</option>
            <option value="de">🇩🇪 German</option>
            <option value="tr">🇹🇷 Turkish</option>
            <option value="ur">🇵🇰 Urdu</option>
            <option value="fa">🇮🇷 Persian</option>
            <option value="hi">🇮🇳 Hindi</option>
          </select>
          <p className="text-[11px] text-muted-foreground leading-relaxed mt-1.5">
            Photos you send the bot are auto-captioned for search. Captions are written in this language (needs a vision-capable AI provider, e.g. Gemini). Also settable in the bot with <code>/caption</code>.
          </p>
        </div>

        {/* Where captures go */}
        <div className="px-4 py-3 rounded-lg border bg-card">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
            {t("settings.telegram.captureLand")}
          </p>
          <p className="text-[11px] text-muted-foreground/80 mb-2 leading-relaxed">
            {t("settings.telegram.captureHelp")}
          </p>
          <div className="flex items-center gap-2">
            <select
              value={status.targetListId ?? ""}
              onChange={(e) => handleSetTargetList(e.target.value || null)}
              disabled={savingList || lists.length === 0}
              className="flex-1 h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">{t("settings.telegram.autoList")}</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {t(l.itemCount === 1 ? "settings.telegram.listOptionOne" : "settings.telegram.listOption")
                    .replace("{title}", l.title)
                    .replace("{count}", String(l.itemCount))}
                </option>
              ))}
            </select>
            {savingList && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
          </div>
          {lists.length === 0 && (
            <p className="text-[11px] text-amber-400 mt-1.5">
              {t("settings.telegram.noLists")}
            </p>
          )}
        </div>


        {/* Reply templates — customize what the bot says back */}
        <div className="px-4 py-3 rounded-lg border bg-card">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
            <Bot className="size-3 text-primary" />
            {t("settings.telegram.replyTemplates")}
          </p>
          <BotReplyTemplatesPanel />
        </div>

        {/* Message history */}
        <div className="px-4 py-3 rounded-lg border bg-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <MessageSquare className="size-3 text-primary" />
              {t("settings.telegram.messageHistory")}
            </p>
            <div className="flex items-center gap-1.5">
              {showHistory && history.length > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={handleClearHistory}>
                  <Trash2 className="size-3 mr-1" />
                  {t("settings.telegram.clear")}
                </Button>
              )}
              <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={loadHistory} disabled={historyLoading}>
                {historyLoading ? <Loader2 className="size-3 mr-1 animate-spin" /> : null}
                {showHistory ? t("settings.telegram.refresh") : t("settings.telegram.loadHistory")}
              </Button>
            </div>
          </div>
          {showHistory && (
            <>
              {history.length === 0 ? (
                <p className="text-[11px] text-muted-foreground text-center py-6">
                  {t("settings.telegram.historyEmpty")}
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
            <p className="text-sm font-medium">{t("settings.telegram.connectTitle")}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {t("settings.telegram.connectHelp")}
            </p>
          </div>
        </div>

        {/* Steps */}
        <ol className="text-xs space-y-1.5 pl-1">
          <Step n={1}>
            {t("settings.telegram.step1.pre")}{" "}
            <a
              href="https://t.me/BotFather"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline inline-flex items-center gap-0.5"
            >
              @BotFather
              <ExternalLink className="size-2.5" />
            </a>{" "}
            {(() => {
              const [a, b] = t("settings.telegram.step1.post").split("{cmd}")
              return (
                <>
                  {a}
                  <code className="px-1 py-0.5 rounded bg-muted text-[10px]">/newbot</code>
                  {b}
                </>
              )
            })()}
          </Step>
          <Step n={2}>
            {(() => {
              const [a, b] = t("settings.telegram.step2").split("{sample}")
              return (
                <>
                  {a}
                  <code className="px-1 py-0.5 rounded bg-muted text-[10px]">123456:ABC-DEF…</code>
                  {b}
                </>
              )
            })()}
          </Step>
          <Step n={3}>{t("settings.telegram.step3")}</Step>
          <Step n={4}>
            {(() => {
              const [a, b] = t("settings.telegram.step4").split("{cmd}")
              return (
                <>
                  {a}
                  <code className="px-1 py-0.5 rounded bg-muted text-[10px]">/start</code>
                  {b}
                </>
              )
            })()}
          </Step>
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
            {t("settings.telegram.connect")}
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
          {t("settings.telegram.tokenNote")}
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

