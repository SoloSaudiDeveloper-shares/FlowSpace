"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Zap,
  Plus,
  Pencil,
  Trash2,
  Power,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Filter,
  Play,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { useT } from "@/lib/hooks/use-i18n"
import {
  createAutomation,
  updateAutomation,
  deleteAutomation,
  toggleAutomation,
  addCondition,
  removeCondition,
  addAction,
  removeAction,
  getAutomationRuns,
} from "@/lib/actions/automation-actions"

// ─── Types & Constants ──────────────────────────────────────────────────

const TRIGGER_TYPES = [
  "task_created",
  "task_updated",
  "status_changed",
  "due_date_reached",
  "reminder_triggered",
  "comment_added",
  "dependency_resolved",
  "form_submitted",
  "element_linked",
  "page_created",
  "attachment_uploaded",
] as const

type TriggerType = (typeof TRIGGER_TYPES)[number]

const ACTION_TYPES = [
  "create_task",
  "update_status",
  "assign_user",
  "add_label",
  "post_notification",
  "create_reminder",
  "update_priority",
  "add_comment",
  "duplicate_template",
] as const

type ActionType = (typeof ACTION_TYPES)[number]

const OPERATORS = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "greater_than",
  "less_than",
  "is_empty",
  "is_not_empty",
] as const

type Operator = (typeof OPERATORS)[number]

const CONDITION_FIELDS = [
  "title",
  "description",
  "status",
  "priority",
  "assignee",
  "project",
  "label",
  "dueDate",
] as const

// ─── Prebuilt templates ─────────────────────────────────────────────────
// Ready-made automations the user can start from. Picking one pre-fills the
// builder (name, trigger, conditions, actions); the user can tweak before
// saving. Configs use only the action types that expose inputs in the
// builder (create_task → title, post_notification → title+message) so the
// pre-filled values are visible and editable.

interface AutomationTemplate {
  id: string
  name: string
  description: string
  icon: string
  trigger: TriggerType
  conditions: { field: string; operator: Operator; value: string; logicGate: "and" | "or" }[]
  actions: { actionType: ActionType; config: Record<string, string> }[]
}

const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: "high-priority-alert",
    name: "Alert on high-priority tasks",
    description: "Notify me whenever a new high-priority task is created.",
    icon: "🔥",
    trigger: "task_created",
    conditions: [{ field: "priority", operator: "equals", value: "high", logicGate: "and" }],
    actions: [
      {
        actionType: "post_notification",
        config: { title: "High-priority task created", message: "A new high-priority task was just added." },
      },
    ],
  },
  {
    id: "bug-flag",
    name: "Flag bugs from the title",
    description: "When a task title mentions \"bug\", raise a notification.",
    icon: "🐞",
    trigger: "task_created",
    conditions: [{ field: "title", operator: "contains", value: "bug", logicGate: "and" }],
    actions: [
      {
        actionType: "post_notification",
        config: { title: "Possible bug reported", message: "A task mentioning 'bug' was created — triage it." },
      },
    ],
  },
  {
    id: "celebrate-done",
    name: "Celebrate completed work",
    description: "Post a notification when a task is moved to Done.",
    icon: "🎉",
    trigger: "status_changed",
    conditions: [{ field: "status", operator: "equals", value: "done", logicGate: "and" }],
    actions: [
      {
        actionType: "post_notification",
        config: { title: "Task completed 🎉", message: "A task just moved to Done. Nice work!" },
      },
    ],
  },
  {
    id: "due-date-nudge",
    name: "Due-date reminder",
    description: "Get a heads-up the moment a task hits its due date.",
    icon: "⏰",
    trigger: "due_date_reached",
    conditions: [],
    actions: [
      {
        actionType: "post_notification",
        config: { title: "Task is due", message: "A task has reached its due date." },
      },
    ],
  },
  {
    id: "form-to-task",
    name: "Form submission → follow-up task",
    description: "Create a follow-up task whenever a form is submitted.",
    icon: "📥",
    trigger: "form_submitted",
    conditions: [],
    actions: [
      { actionType: "create_task", config: { title: "Follow up on new form submission" } },
    ],
  },
  {
    id: "dependency-unblocked",
    name: "Notify when unblocked",
    description: "Tell me when a blocking dependency is resolved.",
    icon: "🔓",
    trigger: "dependency_resolved",
    conditions: [],
    actions: [
      {
        actionType: "post_notification",
        config: { title: "Task unblocked", message: "A blocking dependency was just resolved." },
      },
    ],
  },
]

function humanize(str: string): string {
  return str
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function relativeTime(dateStr: string | null, t: (key: string) => string): string {
  if (!dateStr) return t("auto.time.never")
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return t("auto.time.justNow")
  if (diffMin < 60) return t("auto.time.minAgo").replace("{n}", String(diffMin))
  if (diffHr < 24) return t("auto.time.hrAgo").replace("{n}", String(diffHr))
  if (diffDay < 7) return t("auto.time.dayAgo").replace("{n}", String(diffDay))
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

// ─── Condition / Action Draft Types ─────────────────────────────────────

interface ConditionDraft {
  field: string
  operator: Operator
  value: string
  logicGate: "and" | "or"
}

interface ActionDraft {
  actionType: ActionType
  config: Record<string, string>
}

// ─── Component ──────────────────────────────────────────────────────────

interface AutomationsContentProps {
  automations: any[]
  failedRuns: any[]
}

export function AutomationsContent({
  automations,
  failedRuns,
}: AutomationsContentProps) {
  const router = useRouter()
  const { t } = useT()
  const [activeTab, setActiveTab] = useState<"automations" | "history">(
    "automations"
  )
  const [showBuilder, setShowBuilder] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Builder form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [trigger, setTrigger] = useState<TriggerType>("task_created")
  const [projectId, setProjectId] = useState("")
  const [conditions, setConditions] = useState<ConditionDraft[]>([])
  const [actions, setActions] = useState<ActionDraft[]>([])
  const [conditionsOpen, setConditionsOpen] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Run history state
  const [runHistory, setRunHistory] = useState<any[]>([])
  const [loadingRuns, setLoadingRuns] = useState(false)
  const [expandedRun, setExpandedRun] = useState<string | null>(null)

  // ─── Localized display-name helpers ─────────────────────────────────
  // Map enum logic values to translated labels; fall back to humanize()
  // so unknown values still render readably.
  const triggerLabel = (v: string) => t(`auto.trigger.${v}`) || humanize(v)
  const actionLabel = (v: string) => t(`auto.action.${v}`) || humanize(v)
  const operatorLabel = (v: string) => t(`auto.operator.${v}`) || humanize(v)
  const fieldLabel = (v: string) => t(`auto.field.${v}`) || humanize(v)
  const statusLabel = (v: string) => t(`auto.status.${v}`) || humanize(v)

  // ─── Builder helpers ────────────────────────────────────────────────

  function resetBuilder() {
    setName("")
    setDescription("")
    setTrigger("task_created")
    setProjectId("")
    setConditions([])
    setActions([])
    setConditionsOpen(false)
    setActionsOpen(false)
    setEditingId(null)
  }

  function openCreate() {
    resetBuilder()
    setShowBuilder(true)
  }

  /** Pre-fill the builder from a prebuilt template (create mode only). */
  function applyTemplate(tpl: AutomationTemplate) {
    setEditingId(null)
    setName(t(`auto.tpl.${tpl.id}.name`))
    setDescription(t(`auto.tpl.${tpl.id}.desc`))
    setTrigger(tpl.trigger)
    setProjectId("")
    setConditions(tpl.conditions.map((c) => ({ ...c })))
    setActions(
      tpl.actions.map((a) => ({
        actionType: a.actionType,
        config: localizeTemplateConfig(tpl.id, a.config),
      }))
    )
    setConditionsOpen(tpl.conditions.length > 0)
    setActionsOpen(tpl.actions.length > 0)
  }

  /**
   * Translate the user-visible string values inside a template's prefilled
   * action config (notification title/message, task title). Keys are mapped
   * by template id so the values shown in the builder inputs are localized.
   */
  function localizeTemplateConfig(
    tplId: string,
    config: Record<string, string>
  ): Record<string, string> {
    const next: Record<string, string> = { ...config }
    if ("title" in next) {
      // Notification configs use a notifTitle key; create_task uses taskTitle.
      const notifKey = `auto.tpl.${tplId}.notifTitle`
      const taskKey = `auto.tpl.${tplId}.taskTitle`
      const notif = t(notifKey)
      next.title = notif !== notifKey ? notif : t(taskKey)
    }
    if ("message" in next) {
      next.message = t(`auto.tpl.${tplId}.notifMsg`)
    }
    return next
  }

  function openEdit(automation: any) {
    setEditingId(automation.id)
    setName(automation.name)
    setDescription(automation.description ?? "")
    setTrigger(automation.trigger)
    setProjectId(automation.projectId ?? "")
    setConditions([])
    setActions([])
    setConditionsOpen(false)
    setActionsOpen(false)
    setShowBuilder(true)
  }

  // ─── Condition helpers ──────────────────────────────────────────────

  function addConditionRow() {
    setConditions((prev) => [
      ...prev,
      { field: "title", operator: "equals", value: "", logicGate: "and" },
    ])
  }

  function updateConditionRow(
    index: number,
    patch: Partial<ConditionDraft>
  ) {
    setConditions((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...patch } : c))
    )
  }

  function removeConditionRow(index: number) {
    setConditions((prev) => prev.filter((_, i) => i !== index))
  }

  // ─── Action helpers ─────────────────────────────────────────────────

  function addActionRow() {
    setActions((prev) => [
      ...prev,
      { actionType: "create_task", config: {} },
    ])
  }

  function updateActionRow(index: number, patch: Partial<ActionDraft>) {
    setActions((prev) =>
      prev.map((a, i) => (i === index ? { ...a, ...patch } : a))
    )
  }

  function removeActionRow(index: number) {
    setActions((prev) => prev.filter((_, i) => i !== index))
  }

  // ─── Save automation ───────────────────────────────────────────────

  async function handleSave() {
    if (!name.trim()) {
      toast.error(t("auto.toast.nameRequired"))
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        await updateAutomation(editingId, {
          name: name.trim(),
          description: description.trim() || undefined,
          trigger,
          projectId: projectId.trim() || undefined,
        })
        toast.success(t("auto.toast.updated"))
      } else {
        const automationId = await createAutomation({
          name: name.trim(),
          description: description.trim() || undefined,
          trigger,
          projectId: projectId.trim() || undefined,
        })

        // Save conditions
        for (const cond of conditions) {
          if (cond.value.trim() || cond.operator === "is_empty" || cond.operator === "is_not_empty") {
            await addCondition(automationId, {
              field: cond.field,
              operator: cond.operator,
              value: cond.value.trim(),
              logicGate: cond.logicGate,
            })
          }
        }

        // Save actions
        for (const act of actions) {
          await addAction(automationId, {
            actionType: act.actionType,
            config: JSON.stringify(act.config),
          })
        }

        toast.success(t("auto.toast.created"))
      }

      setShowBuilder(false)
      resetBuilder()
      router.refresh()
    } catch (err) {
      toast.error(t("auto.toast.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  // ─── Delete automation ─────────────────────────────────────────────

  async function handleDelete(id: string) {
    try {
      await deleteAutomation(id)
      toast.success(t("auto.toast.deleted"))
      router.refresh()
    } catch {
      toast.error(t("auto.toast.deleteFailed"))
    }
  }

  // ─── Toggle automation ─────────────────────────────────────────────

  async function handleToggle(id: string) {
    try {
      await toggleAutomation(id)
      router.refresh()
    } catch {
      toast.error(t("auto.toast.toggleFailed"))
    }
  }

  // ─── Load run history ──────────────────────────────────────────────

  async function loadAllRuns() {
    setLoadingRuns(true)
    try {
      const allRuns: any[] = []
      for (const automation of automations) {
        const runs = await getAutomationRuns(automation.id, 20)
        allRuns.push(
          ...runs.map((r: any) => ({ ...r, automationName: automation.name }))
        )
      }
      allRuns.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      setRunHistory(allRuns)
    } catch {
      toast.error(t("auto.toast.runsFailed"))
    } finally {
      setLoadingRuns(false)
    }
  }

  // ─── Status badge helper ───────────────────────────────────────────

  function StatusBadge({ status }: { status: string | null }) {
    if (!status) return null
    const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }> = {
      success: { variant: "default", icon: CheckCircle2 },
      failure: { variant: "destructive", icon: XCircle },
      skipped: { variant: "outline", icon: AlertTriangle },
    }
    const cfg = map[status] ?? { variant: "secondary" as const, icon: Zap }
    const Icon = cfg.icon
    return (
      <Badge variant={cfg.variant} className="gap-1">
        <Icon className="size-3" />
        {statusLabel(status)}
      </Badge>
    )
  }

  // ─── Action config inputs ─────────────────────────────────────────

  function ActionConfigInputs({
    actionType,
    config,
    onChange,
  }: {
    actionType: ActionType
    config: Record<string, string>
    onChange: (config: Record<string, string>) => void
  }) {
    function set(key: string, value: string) {
      onChange({ ...config, [key]: value })
    }

    switch (actionType) {
      case "create_task":
        return (
          <Input
            placeholder={t("auto.ph.taskTitle")}
            value={config.title ?? ""}
            onChange={(e) => set("title", e.target.value)}
            className="mt-1"
          />
        )
      case "update_status":
        return (
          <Input
            placeholder={t("auto.ph.statusId")}
            value={config.statusId ?? ""}
            onChange={(e) => set("statusId", e.target.value)}
            className="mt-1"
          />
        )
      case "assign_user":
        return (
          <Input
            placeholder={t("auto.ph.assigneeId")}
            value={config.assigneeId ?? ""}
            onChange={(e) => set("assigneeId", e.target.value)}
            className="mt-1"
          />
        )
      case "post_notification":
        return (
          <div className="mt-1 space-y-1.5">
            <Input
              placeholder={t("auto.ph.notifTitle")}
              value={config.title ?? ""}
              onChange={(e) => set("title", e.target.value)}
            />
            <Input
              placeholder={t("auto.ph.notifMessage")}
              value={config.message ?? ""}
              onChange={(e) => set("message", e.target.value)}
            />
          </div>
        )
      default:
        return null
    }
  }

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {/* Tab bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <button
            onClick={() => setActiveTab("automations")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "automations"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("auto.tab.automations")}
          </button>
          <button
            onClick={() => {
              setActiveTab("history")
              if (runHistory.length === 0) loadAllRuns()
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "history"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("auto.tab.history")}
          </button>
        </div>

        {activeTab === "automations" && (
          <Button onClick={openCreate} size="sm">
            <Plus className="size-4 mr-1" />
            {t("auto.create")}
          </Button>
        )}
      </div>

      {/* ─── Automations Tab ──────────────────────────────────────── */}
      {activeTab === "automations" && (
        <>
          {automations.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
              <Zap className="size-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                {t("auto.empty.title")}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {t("auto.empty.desc")}
              </p>
              <Button onClick={openCreate} size="sm" className="mt-4">
                <Plus className="size-4 mr-1" />
                {t("auto.create")}
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {automations.map((automation) => (
                <div
                  key={automation.id}
                  className="group relative flex flex-col rounded-lg border bg-background p-4 transition-shadow hover:shadow-md"
                >
                  {/* Header: name + status dot */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`mt-0.5 size-2 shrink-0 rounded-full ${
                          automation.isActive
                            ? "bg-green-500"
                            : "bg-muted-foreground/40"
                        }`}
                      />
                      <span className="text-sm font-semibold truncate">
                        {automation.name}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  {automation.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                      {automation.description}
                    </p>
                  )}

                  {/* Trigger badge */}
                  <div className="mb-3">
                    <Badge variant="secondary" className="text-xs">
                      {t("auto.card.when").replace("{trigger}", triggerLabel(automation.trigger))}
                    </Badge>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                    <span className="flex items-center gap-1">
                      <Filter className="size-3" />
                      {t("auto.card.conditions").replace("{count}", String(automation.conditionCount ?? 0))}
                    </span>
                    <span className="flex items-center gap-1">
                      <Play className="size-3" />
                      {t("auto.card.actions").replace("{count}", String(automation.actionCount ?? 0))}
                    </span>
                  </div>

                  {/* Run info */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                    <span>{t("auto.card.runs").replace("{count}", String(automation.runCount ?? 0))}</span>
                    {automation.lastRunStatus && (
                      <>
                        <span className="text-muted-foreground/40">|</span>
                        <StatusBadge status={automation.lastRunStatus} />
                      </>
                    )}
                    {automation.lastRunAt && (
                      <>
                        <span className="text-muted-foreground/40">|</span>
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {relativeTime(automation.lastRunAt, t)}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="mt-auto flex items-center gap-1 border-t pt-3">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => openEdit(automation)}
                      title={t("auto.card.edit")}
                    >
                      <Pencil className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleToggle(automation.id)}
                      title={
                        automation.isActive ? t("auto.card.deactivate") : t("auto.card.activate")
                      }
                    >
                      <Power
                        className={`size-3 ${
                          automation.isActive
                            ? "text-green-500"
                            : "text-muted-foreground"
                        }`}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDelete(automation.id)}
                      title={t("auto.card.delete")}
                      className="ml-auto text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── Run History Tab ──────────────────────────────────────── */}
      {activeTab === "history" && (
        <div className="rounded-lg border">
          {loadingRuns ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              {t("auto.history.loading")}
            </div>
          ) : runHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Clock className="size-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                {t("auto.history.empty")}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_100px_100px_80px_1fr_100px] gap-2 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/50">
                <span>{t("auto.history.col.automation")}</span>
                <span>{t("auto.history.col.status")}</span>
                <span>{t("auto.history.col.actions")}</span>
                <span>{t("auto.history.col.duration")}</span>
                <span>{t("auto.history.col.error")}</span>
                <span>{t("auto.history.col.time")}</span>
              </div>

              {runHistory.map((run) => (
                <div key={run.id}>
                  <button
                    onClick={() =>
                      setExpandedRun(
                        expandedRun === run.id ? null : run.id
                      )
                    }
                    className={`w-full grid grid-cols-[1fr_100px_100px_80px_1fr_100px] gap-2 px-4 py-3 text-xs text-left hover:bg-muted/30 transition-colors ${
                      run.status === "failure"
                        ? "border-l-2 border-l-red-500"
                        : ""
                    }`}
                  >
                    <span className="font-medium truncate">
                      {run.automationName ?? run.automationId}
                    </span>
                    <span>
                      <StatusBadge status={run.status} />
                    </span>
                    <span className="text-muted-foreground">
                      {t("auto.history.executed").replace("{count}", String(run.actionsExecuted ?? 0))}
                    </span>
                    <span className="text-muted-foreground">
                      {run.duration != null ? `${run.duration}ms` : "-"}
                    </span>
                    <span
                      className="text-destructive truncate"
                      title={run.error ?? undefined}
                    >
                      {run.error ?? "-"}
                    </span>
                    <span className="text-muted-foreground">
                      {relativeTime(run.createdAt, t)}
                    </span>
                  </button>

                  {/* Expanded action logs placeholder */}
                  {expandedRun === run.id && (
                    <div className="bg-muted/20 px-6 py-3 text-xs space-y-1 border-t">
                      <p className="text-muted-foreground font-medium mb-1">
                        {t("auto.history.details")}
                      </p>
                      <p>
                        <span className="text-muted-foreground">{t("auto.history.status")}</span>
                        {statusLabel(run.status)}
                      </p>
                      <p>
                        <span className="text-muted-foreground">
                          {t("auto.history.actionsExecuted")}
                        </span>
                        {run.actionsExecuted ?? 0}
                      </p>
                      <p>
                        <span className="text-muted-foreground">
                          {t("auto.history.duration")}
                        </span>
                        {run.duration != null ? `${run.duration}ms` : "-"}
                      </p>
                      {run.error && (
                        <p>
                          <span className="text-muted-foreground">
                            {t("auto.history.error")}
                          </span>
                          <span className="text-destructive">{run.error}</span>
                        </p>
                      )}
                      <p>
                        <span className="text-muted-foreground">
                          {t("auto.history.triggerData")}
                        </span>
                        <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
                          {run.triggerData ?? "{}"}
                        </code>
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Builder Dialog ───────────────────────────────────────── */}
      <Dialog open={showBuilder} onOpenChange={setShowBuilder}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t("auto.builder.editTitle") : t("auto.builder.createTitle")}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? t("auto.builder.editDesc")
                : t("auto.builder.createDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Templates — quick-start presets (create mode only) */}
            {!editingId && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  {t("auto.builder.templateLabel")}
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {AUTOMATION_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => applyTemplate(tpl)}
                      title={t(`auto.tpl.${tpl.id}.desc`)}
                      className="flex items-start gap-2 rounded-lg border border-border/60 p-2 text-left transition-colors hover:border-primary/40 hover:bg-accent/30"
                    >
                      <span className="text-base leading-none mt-0.5">{tpl.icon}</span>
                      <span className="min-w-0">
                        <span className="block text-xs font-medium truncate">{t(`auto.tpl.${tpl.id}.name`)}</span>
                        <span className="block text-[10px] text-muted-foreground leading-tight line-clamp-2">
                          {t(`auto.tpl.${tpl.id}.desc`)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground/70 mt-1.5">
                  {t("auto.builder.templateHint")}
                </p>
              </div>
            )}

            {/* Name */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {t("auto.builder.name")}
              </label>
              <Input
                placeholder={t("auto.builder.namePh")}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {t("auto.builder.description")}
              </label>
              <textarea
                placeholder={t("auto.builder.descriptionPh")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 resize-none"
              />
            </div>

            {/* Trigger */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {t("auto.builder.trigger")}
              </label>
              <select
                value={trigger}
                onChange={(e) => setTrigger(e.target.value as TriggerType)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {TRIGGER_TYPES.map((tr) => (
                  <option key={tr} value={tr}>
                    {triggerLabel(tr)}
                  </option>
                ))}
              </select>
            </div>

            {/* Project scope */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {t("auto.builder.projectScope")}
              </label>
              <Input
                placeholder={t("auto.builder.projectScopePh")}
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              />
            </div>

            {/* ─── Conditions ────────────────────────────────────── */}
            {!editingId && (
              <div className="rounded-lg border">
                <button
                  type="button"
                  onClick={() => setConditionsOpen(!conditionsOpen)}
                  className="flex w-full items-center justify-between p-3 text-sm font-medium hover:bg-muted/30 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Filter className="size-4 text-muted-foreground" />
                    {t("auto.builder.conditions")}
                    {conditions.length > 0 && (
                      <Badge variant="secondary" className="ml-1">
                        {conditions.length}
                      </Badge>
                    )}
                  </span>
                  {conditionsOpen ? (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 text-muted-foreground" />
                  )}
                </button>

                {conditionsOpen && (
                  <div className="border-t px-3 pb-3 space-y-2">
                    {conditions.map((cond, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1.5 pt-2"
                      >
                        {idx > 0 && (
                          <select
                            value={cond.logicGate}
                            onChange={(e) =>
                              updateConditionRow(idx, {
                                logicGate: e.target.value as "and" | "or",
                              })
                            }
                            className="h-7 w-16 shrink-0 rounded border border-input bg-transparent px-1 text-xs outline-none focus-visible:border-ring dark:bg-input/30"
                          >
                            <option value="and">{t("auto.builder.gate.and")}</option>
                            <option value="or">{t("auto.builder.gate.or")}</option>
                          </select>
                        )}
                        <select
                          value={cond.field}
                          onChange={(e) =>
                            updateConditionRow(idx, {
                              field: e.target.value,
                            })
                          }
                          className="h-7 flex-1 rounded border border-input bg-transparent px-1 text-xs outline-none focus-visible:border-ring dark:bg-input/30"
                        >
                          {CONDITION_FIELDS.map((f) => (
                            <option key={f} value={f}>
                              {fieldLabel(f)}
                            </option>
                          ))}
                        </select>
                        <select
                          value={cond.operator}
                          onChange={(e) =>
                            updateConditionRow(idx, {
                              operator: e.target.value as Operator,
                            })
                          }
                          className="h-7 flex-1 rounded border border-input bg-transparent px-1 text-xs outline-none focus-visible:border-ring dark:bg-input/30"
                        >
                          {OPERATORS.map((op) => (
                            <option key={op} value={op}>
                              {operatorLabel(op)}
                            </option>
                          ))}
                        </select>
                        {cond.operator !== "is_empty" &&
                          cond.operator !== "is_not_empty" && (
                            <Input
                              value={cond.value}
                              onChange={(e) =>
                                updateConditionRow(idx, {
                                  value: e.target.value,
                                })
                              }
                              placeholder={t("auto.builder.conditionValuePh")}
                              className="h-7 flex-1 text-xs"
                            />
                          )}
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => removeConditionRow(idx)}
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={addConditionRow}
                      className="mt-2"
                    >
                      <Plus className="size-3 mr-1" />
                      {t("auto.builder.addCondition")}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* ─── Actions ───────────────────────────────────────── */}
            {!editingId && (
              <div className="rounded-lg border">
                <button
                  type="button"
                  onClick={() => setActionsOpen(!actionsOpen)}
                  className="flex w-full items-center justify-between p-3 text-sm font-medium hover:bg-muted/30 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Play className="size-4 text-muted-foreground" />
                    {t("auto.builder.actions")}
                    {actions.length > 0 && (
                      <Badge variant="secondary" className="ml-1">
                        {actions.length}
                      </Badge>
                    )}
                  </span>
                  {actionsOpen ? (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 text-muted-foreground" />
                  )}
                </button>

                {actionsOpen && (
                  <div className="border-t px-3 pb-3 space-y-2">
                    {actions.map((act, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-1.5 pt-2"
                      >
                        <select
                          value={act.actionType}
                          onChange={(e) =>
                            updateActionRow(idx, {
                              actionType: e.target.value as ActionType,
                              config: {},
                            })
                          }
                          className="h-7 w-40 shrink-0 rounded border border-input bg-transparent px-1 text-xs outline-none focus-visible:border-ring dark:bg-input/30"
                        >
                          {ACTION_TYPES.map((a) => (
                            <option key={a} value={a}>
                              {actionLabel(a)}
                            </option>
                          ))}
                        </select>
                        <div className="flex-1">
                          <ActionConfigInputs
                            actionType={act.actionType}
                            config={act.config}
                            onChange={(config) =>
                              updateActionRow(idx, { config })
                            }
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => removeActionRow(idx)}
                          className="mt-1"
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={addActionRow}
                      className="mt-2"
                    >
                      <Plus className="size-3 mr-1" />
                      {t("auto.builder.addAction")}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">
              {t("auto.builder.cancel")}
            </DialogClose>
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? t("auto.builder.saving") : editingId ? t("auto.builder.update") : t("auto.builder.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
