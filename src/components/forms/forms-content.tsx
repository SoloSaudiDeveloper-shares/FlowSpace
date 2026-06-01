"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Plus,
  FileInput,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Send,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Type,
  AlignLeft,
  Hash,
  Calendar,
  List,
  ListChecks,
  CheckSquare,
  Mail,
  Link,
  Phone,
  Paperclip,
  User,
  Star,
  X,
  Check,
  XCircle,
  ClipboardList,
  Inbox,
  FolderKanban,
  AlertTriangle,
  CircleDot,
  Clock,
} from "lucide-react"
import { useT } from "@/lib/hooks/use-i18n"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
  createForm,
  updateForm,
  deleteForm,
  publishForm,
  unpublishForm,
  addFormField,
  updateFormField,
  removeFormField,
  getFormSubmissions,
  processSubmission,
  rejectSubmission,
} from "@/lib/actions/form-actions"

// ─── Types ─────────────────────────────────────────────────────────────

type FormType =
  | "task_intake"
  | "project_request"
  | "issue_report"
  | "approval_request"
  | "checklist_submission"

type FieldType =
  | "text"
  | "long_text"
  | "number"
  | "date"
  | "select"
  | "multi_select"
  | "checkbox"
  | "email"
  | "url"
  | "phone"
  | "file"
  | "user"
  | "rating"

interface FormField {
  id: string
  formId: string
  label: string
  fieldType: FieldType
  placeholder: string | null
  helpText: string | null
  isRequired: boolean
  options: string | null
  config: string | null
  sortOrder: number
}

interface FormSubmission {
  id: string
  formId: string
  data: string
  submittedBy: string | null
  status: "pending" | "processed" | "rejected"
  resultElementId: string | null
  resultTaskId: string | null
  processedAt: string | null
  createdAt: string
}

interface Form {
  id: string
  title: string
  description: string | null
  icon: string | null
  color: string | null
  type: FormType
  isPublished: boolean
  isAnonymous: boolean
  confirmationMessage: string | null
  submissionCount: number
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

// ─── Constants ─────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  FormType,
  { label: string; color: string; bgClass: string; icon: React.ElementType }
> = {
  task_intake: {
    label: "forms.type.task_intake",
    color: "text-blue-600 dark:text-blue-400",
    bgClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    icon: Inbox,
  },
  project_request: {
    label: "forms.type.project_request",
    color: "text-indigo-600 dark:text-indigo-400",
    bgClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    icon: FolderKanban,
  },
  issue_report: {
    label: "forms.type.issue_report",
    color: "text-red-600 dark:text-red-400",
    bgClass: "bg-red-500/10 text-red-600 dark:text-red-400",
    icon: AlertTriangle,
  },
  approval_request: {
    label: "forms.type.approval_request",
    color: "text-amber-600 dark:text-amber-400",
    bgClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    icon: CircleDot,
  },
  checklist_submission: {
    label: "forms.type.checklist_submission",
    color: "text-green-600 dark:text-green-400",
    bgClass: "bg-green-500/10 text-green-600 dark:text-green-400",
    icon: ClipboardList,
  },
}

const FIELD_TYPE_CONFIG: Record<
  FieldType,
  { label: string; icon: React.ElementType }
> = {
  text: { label: "forms.field.text", icon: Type },
  long_text: { label: "forms.field.long_text", icon: AlignLeft },
  number: { label: "forms.field.number", icon: Hash },
  date: { label: "forms.field.date", icon: Calendar },
  select: { label: "forms.field.select", icon: List },
  multi_select: { label: "forms.field.multi_select", icon: ListChecks },
  checkbox: { label: "forms.field.checkbox", icon: CheckSquare },
  email: { label: "forms.field.email", icon: Mail },
  url: { label: "forms.field.url", icon: Link },
  phone: { label: "forms.field.phone", icon: Phone },
  file: { label: "forms.field.file", icon: Paperclip },
  user: { label: "forms.field.user", icon: User },
  rating: { label: "forms.field.rating", icon: Star },
}

// ─── Create Form Dialog ───────────────────────────────────────────────

function CreateFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useT()
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState<FormType>("task_intake")
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    if (!title.trim()) {
      toast.error(t("forms.create.titleRequired"))
      return
    }
    setSaving(true)
    try {
      await createForm({
        title: title.trim(),
        description: description.trim() || undefined,
        type,
      })
      toast.success(t("forms.create.success"))
      setTitle("")
      setDescription("")
      setType("task_intake")
      onOpenChange(false)
      router.refresh()
    } catch {
      toast.error(t("forms.create.error"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("forms.create.title")}</DialogTitle>
          <DialogDescription>
            {t("forms.create.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("forms.create.titleLabel")}</label>
            <Input
              placeholder={t("forms.create.titlePh")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate()
              }}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("forms.create.descLabel")}</label>
            <textarea
              className="flex w-full rounded-md border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[72px] resize-none"
              placeholder={t("forms.create.descPh")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("forms.create.typeLabel")}</label>
            <div className="grid grid-cols-1 gap-1.5">
              {(Object.keys(TYPE_CONFIG) as FormType[]).map((ft) => {
                const config = TYPE_CONFIG[ft]
                const Icon = config.icon
                return (
                  <button
                    key={ft}
                    type="button"
                    onClick={() => setType(ft)}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                      type === ft
                        ? "border-primary bg-primary/5 font-medium"
                        : "border-transparent hover:bg-accent"
                    }`}
                  >
                    <Icon className={`size-4 ${config.color}`} />
                    {t(config.label)}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {t("common.cancel")}
          </DialogClose>
          <Button onClick={handleCreate} disabled={saving || !title.trim()}>
            {saving ? t("forms.create.submitting") : t("forms.create.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Add Field Dialog ──────────────────────────────────────────────────

function AddFieldDialog({
  open,
  onOpenChange,
  formId,
  onAdded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  formId: string
  onAdded: () => void
}) {
  const { t } = useT()
  const [fieldType, setFieldType] = useState<FieldType | null>(null)
  const [label, setLabel] = useState("")
  const [placeholder, setPlaceholder] = useState("")
  const [required, setRequired] = useState(false)
  const [saving, setSaving] = useState(false)

  function reset() {
    setFieldType(null)
    setLabel("")
    setPlaceholder("")
    setRequired(false)
  }

  async function handleAdd() {
    if (!fieldType || !label.trim()) return
    setSaving(true)
    try {
      await addFormField(formId, {
        label: label.trim(),
        fieldType,
        placeholder: placeholder.trim() || undefined,
        isRequired: required,
      })
      toast.success(t("forms.addField.success"))
      reset()
      onOpenChange(false)
      onAdded()
    } catch {
      toast.error(t("forms.addField.error"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("forms.addField.title")}</DialogTitle>
          <DialogDescription>
            {t("forms.addField.description")}
          </DialogDescription>
        </DialogHeader>

        {!fieldType ? (
          <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto">
            {(Object.keys(FIELD_TYPE_CONFIG) as FieldType[]).map((ft) => {
              const config = FIELD_TYPE_CONFIG[ft]
              const Icon = config.icon
              return (
                <button
                  key={ft}
                  type="button"
                  onClick={() => setFieldType(ft)}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent transition-colors"
                >
                  <Icon className="size-4 text-muted-foreground" />
                  {t(config.label)}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {(() => {
                const Icon = FIELD_TYPE_CONFIG[fieldType].icon
                return <Icon className="size-4" />
              })()}
              <span>{t(FIELD_TYPE_CONFIG[fieldType].label)}</span>
              <button
                type="button"
                onClick={() => setFieldType(null)}
                className="ml-auto text-xs hover:text-foreground"
              >
                {t("forms.addField.change")}
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("forms.addField.labelLabel")}</label>
              <Input
                placeholder={t("forms.addField.labelPh")}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd()
                }}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("forms.addField.placeholderLabel")}</label>
              <Input
                placeholder={t("forms.addField.placeholderPh")}
                value={placeholder}
                onChange={(e) => setPlaceholder(e.target.value)}
              />
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
                className="rounded border"
              />
              {t("forms.addField.required")}
            </label>
          </div>
        )}

        {fieldType && (
          <DialogFooter>
            <DialogClose
              className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              {t("common.cancel")}
            </DialogClose>
            <Button onClick={handleAdd} disabled={saving || !label.trim()}>
              {saving ? t("forms.addField.submitting") : t("forms.addField.submit")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Edit Field Dialog ─────────────────────────────────────────────────

function EditFieldDialog({
  open,
  onOpenChange,
  field,
  onUpdated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  field: FormField
  onUpdated: () => void
}) {
  const { t } = useT()
  const [label, setLabel] = useState(field.label)
  const [placeholder, setPlaceholder] = useState(field.placeholder ?? "")
  const [required, setRequired] = useState(field.isRequired)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!label.trim()) return
    setSaving(true)
    try {
      await updateFormField(field.id, {
        label: label.trim(),
        placeholder: placeholder.trim() || undefined,
        isRequired: required,
      })
      toast.success(t("forms.editField.success"))
      onOpenChange(false)
      onUpdated()
    } catch {
      toast.error(t("forms.editField.error"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("forms.editField.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {(() => {
              const Icon = FIELD_TYPE_CONFIG[field.fieldType].icon
              return <Icon className="size-4" />
            })()}
            <span>{t(FIELD_TYPE_CONFIG[field.fieldType].label)}</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("forms.addField.labelLabel")}</label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave()
              }}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("forms.addField.placeholderLabel")}</label>
            <Input
              value={placeholder}
              onChange={(e) => setPlaceholder(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="rounded border"
            />
            {t("forms.addField.required")}
          </label>
        </div>

        <DialogFooter>
          <DialogClose
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {t("common.cancel")}
          </DialogClose>
          <Button onClick={handleSave} disabled={saving || !label.trim()}>
            {saving ? t("forms.editField.submitting") : t("forms.editField.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Field Row ─────────────────────────────────────────────────────────

function FieldRow({
  field,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDelete,
  onEdit,
}: {
  field: FormField
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  onEdit: () => void
}) {
  const { t } = useT()
  const config = FIELD_TYPE_CONFIG[field.fieldType]
  const Icon = config.icon

  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-2 group hover:bg-accent/50 transition-colors">
      <GripVertical className="size-4 text-muted-foreground/50 shrink-0" />
      <Icon className="size-4 text-muted-foreground shrink-0" />
      <span className="text-sm flex-1 truncate">{field.label}</span>
      {field.isRequired && (
        <Badge variant="secondary" className="text-xs px-1.5 py-0 shrink-0">
          {t("forms.fieldRow.required")}
        </Badge>
      )}
      <span className="text-xs text-muted-foreground shrink-0">
        {t(config.label)}
      </span>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={isFirst}
          onClick={onMoveUp}
        >
          <ArrowUp className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={isLast}
          onClick={onMoveDown}
        >
          <ArrowDown className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onEdit}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ─── Submissions Panel ─────────────────────────────────────────────────

function SubmissionsPanel({
  formId,
  formTitle,
}: {
  formId: string
  formTitle: string
}) {
  const { t } = useT()
  const [submissions, setSubmissions] = useState<FormSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  async function loadSubmissions() {
    setLoading(true)
    try {
      const data = await getFormSubmissions(formId)
      setSubmissions(data as FormSubmission[])
    } catch {
      toast.error(t("forms.submissions.loadError"))
    } finally {
      setLoading(false)
    }
  }

  useState(() => {
    loadSubmissions()
  })

  function parseData(dataStr: string): Record<string, unknown> {
    try {
      return JSON.parse(dataStr)
    } catch {
      return {}
    }
  }

  async function handleProcess(id: string) {
    setProcessing(id)
    try {
      await processSubmission(id)
      toast.success(t("forms.submissions.processSuccess"))
      loadSubmissions()
    } catch {
      toast.error(t("forms.submissions.processError"))
    } finally {
      setProcessing(null)
    }
  }

  async function handleReject(id: string) {
    setProcessing(id)
    try {
      await rejectSubmission(id)
      toast.success(t("forms.submissions.rejectSuccess"))
      loadSubmissions()
    } catch {
      toast.error(t("forms.submissions.rejectError"))
    } finally {
      setProcessing(null)
    }
  }

  const STATUS_STYLE: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    processed: "bg-green-500/10 text-green-600 dark:text-green-400",
    rejected: "bg-red-500/10 text-red-600 dark:text-red-400",
  }

  if (loading) {
    return (
      <div className="py-4 text-sm text-muted-foreground text-center">
        {t("forms.submissions.loading")}
      </div>
    )
  }

  if (submissions.length === 0) {
    return (
      <div className="py-6 text-sm text-muted-foreground text-center border rounded-lg border-dashed">
        {t("forms.submissions.empty")}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground mb-2">
        {(submissions.length === 1
          ? t("forms.submissions.count")
          : t("forms.submissions.countPlural")
        ).replace("{n}", String(submissions.length))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-2 pr-4 font-medium text-muted-foreground">{t("forms.submissions.colDate")}</th>
              <th className="pb-2 pr-4 font-medium text-muted-foreground">{t("forms.submissions.colSubmittedBy")}</th>
              <th className="pb-2 pr-4 font-medium text-muted-foreground">{t("forms.submissions.colStatus")}</th>
              <th className="pb-2 pr-4 font-medium text-muted-foreground">{t("forms.submissions.colDataPreview")}</th>
              <th className="pb-2 font-medium text-muted-foreground">{t("forms.submissions.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((sub) => {
              const data = parseData(sub.data)
              const preview = Object.entries(data)
                .slice(0, 2)
                .map(([k, v]) => `${k}: ${String(v)}`)
                .join(", ")

              return (
                <tr key={sub.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 whitespace-nowrap">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="size-3" />
                      {new Date(sub.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {sub.submittedBy ?? t("forms.submissions.anonymous")}
                  </td>
                  <td className="py-2 pr-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_STYLE[sub.status] ?? ""
                      }`}
                    >
                      {t(`forms.status.${sub.status}`)}
                    </span>
                  </td>
                  <td className="py-2 pr-4 max-w-[200px] truncate text-muted-foreground">
                    {preview || t("forms.submissions.noData")}
                  </td>
                  <td className="py-2">
                    {sub.status === "pending" && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-green-600"
                          disabled={processing === sub.id}
                          onClick={() => handleProcess(sub.id)}
                          title={t("forms.submissions.process")}
                        >
                          <Check className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-red-600"
                          disabled={processing === sub.id}
                          onClick={() => handleReject(sub.id)}
                          title={t("forms.submissions.reject")}
                        >
                          <XCircle className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Form Card ─────────────────────────────────────────────────────────

function FormCard({
  form,
  onRefresh,
}: {
  form: Form
  onRefresh: () => void
}) {
  const { t } = useT()
  const router = useRouter()
  const [expanded, setExpanded] = useState<"fields" | "submissions" | null>(null)
  const [fields, setFields] = useState<FormField[]>([])
  const [loadingFields, setLoadingFields] = useState(false)
  const [addFieldOpen, setAddFieldOpen] = useState(false)
  const [editField, setEditField] = useState<FormField | null>(null)
  const [deleting, setDeleting] = useState(false)

  const typeConfig = TYPE_CONFIG[form.type]
  const TypeIcon = typeConfig.icon

  async function loadFields() {
    setLoadingFields(true)
    try {
      const { getFormFields } = await import("@/lib/actions/form-actions")
      const data = await getFormFields(form.id)
      setFields(data as FormField[])
    } catch {
      toast.error(t("forms.card.loadFieldsError"))
    } finally {
      setLoadingFields(false)
    }
  }

  function handleToggle(section: "fields" | "submissions") {
    if (expanded === section) {
      setExpanded(null)
    } else {
      setExpanded(section)
      if (section === "fields" && fields.length === 0) {
        loadFields()
      }
    }
  }

  async function handlePublishToggle() {
    try {
      if (form.isPublished) {
        await unpublishForm(form.id)
        toast.success(t("forms.card.unpublishSuccess"))
      } else {
        await publishForm(form.id)
        toast.success(t("forms.card.publishSuccess"))
      }
      onRefresh()
    } catch {
      toast.error(t("forms.card.updateError"))
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteForm(form.id)
      toast.success(t("forms.card.deleteSuccess"))
      onRefresh()
    } catch {
      toast.error(t("forms.card.deleteError"))
    } finally {
      setDeleting(false)
    }
  }

  async function handleMoveField(fieldId: string, direction: "up" | "down") {
    const idx = fields.findIndex((f) => f.id === fieldId)
    if (idx < 0) return
    const swapIdx = direction === "up" ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= fields.length) return

    const updated = [...fields]
    const tempOrder = updated[idx].sortOrder
    updated[idx] = { ...updated[idx], sortOrder: updated[swapIdx].sortOrder }
    updated[swapIdx] = { ...updated[swapIdx], sortOrder: tempOrder }
    updated.sort((a, b) => a.sortOrder - b.sortOrder)
    setFields(updated)

    try {
      await updateFormField(fields[idx].id, {
        sortOrder: updated.find((f) => f.id === fields[idx].id)!.sortOrder,
      })
      await updateFormField(fields[swapIdx].id, {
        sortOrder: updated.find((f) => f.id === fields[swapIdx].id)!.sortOrder,
      })
    } catch {
      toast.error(t("forms.card.reorderError"))
      loadFields()
    }
  }

  async function handleDeleteField(fieldId: string) {
    try {
      await removeFormField(fieldId)
      toast.success(t("forms.card.fieldRemoved"))
      setFields((prev) => prev.filter((f) => f.id !== fieldId))
    } catch {
      toast.error(t("forms.card.removeFieldError"))
    }
  }

  return (
    <>
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        {/* Card Header */}
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`size-8 rounded-md flex items-center justify-center shrink-0 ${typeConfig.bgClass}`}
              >
                <TypeIcon className="size-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-medium truncate">{form.title}</h3>
                {form.description && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {form.description}
                  </p>
                )}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex items-center justify-center rounded-md size-8 hover:bg-accent transition-colors shrink-0"
              >
                <ChevronDown className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleToggle("fields")}>
                  <Pencil />
                  {t("forms.card.editFields")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handlePublishToggle}>
                  {form.isPublished ? <EyeOff /> : <Eye />}
                  {form.isPublished ? t("forms.card.unpublish") : t("forms.card.publish")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleToggle("submissions")}>
                  <Send />
                  {t("forms.card.viewSubmissions")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  <Trash2 />
                  {deleting ? t("forms.card.deleting") : t("forms.card.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeConfig.bgClass}`}
            >
              {t(typeConfig.label)}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                form.isPublished
                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {form.isPublished ? t("forms.card.published") : t("forms.card.draft")}
            </span>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Send className="size-3" />
              {(form.submissionCount === 1
                ? t("forms.card.submissionCount")
                : t("forms.card.submissionCountPlural")
              ).replace("{n}", String(form.submissionCount))}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {new Date(form.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>

          {/* Action buttons row */}
          <div className="flex items-center gap-1.5 pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => handleToggle("fields")}
            >
              <Pencil className="size-3 mr-1" />
              {t("forms.card.edit")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={handlePublishToggle}
            >
              {form.isPublished ? (
                <>
                  <EyeOff className="size-3 mr-1" />
                  {t("forms.card.unpublish")}
                </>
              ) : (
                <>
                  <Eye className="size-3 mr-1" />
                  {t("forms.card.publish")}
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => handleToggle("submissions")}
            >
              <Send className="size-3 mr-1" />
              {t("forms.card.submissions")}
            </Button>
          </div>
        </div>

        {/* Expanded: Fields Builder */}
        {expanded === "fields" && (
          <div className="border-t p-4 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">{t("forms.card.formFields")}</h4>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setAddFieldOpen(true)}
                >
                  <Plus className="size-3 mr-1" />
                  {t("forms.card.addField")}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setExpanded(null)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>

            {loadingFields ? (
              <div className="py-4 text-sm text-muted-foreground text-center">
                {t("forms.card.loadingFields")}
              </div>
            ) : fields.length === 0 ? (
              <div className="py-6 text-sm text-muted-foreground text-center border rounded-lg border-dashed">
                {t("forms.card.noFields")}
              </div>
            ) : (
              <div className="space-y-1.5">
                {fields.map((field, idx) => (
                  <FieldRow
                    key={field.id}
                    field={field}
                    isFirst={idx === 0}
                    isLast={idx === fields.length - 1}
                    onMoveUp={() => handleMoveField(field.id, "up")}
                    onMoveDown={() => handleMoveField(field.id, "down")}
                    onDelete={() => handleDeleteField(field.id)}
                    onEdit={() => setEditField(field)}
                  />
                ))}
              </div>
            )}

            <AddFieldDialog
              open={addFieldOpen}
              onOpenChange={setAddFieldOpen}
              formId={form.id}
              onAdded={loadFields}
            />
          </div>
        )}

        {/* Expanded: Submissions */}
        {expanded === "submissions" && (
          <div className="border-t p-4 bg-muted/30">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium">{t("forms.card.submissionsHeading")}</h4>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => setExpanded(null)}
              >
                <X className="size-3.5" />
              </Button>
            </div>
            <SubmissionsPanel formId={form.id} formTitle={form.title} />
          </div>
        )}
      </div>

      {/* Edit Field Dialog */}
      {editField && (
        <EditFieldDialog
          open={!!editField}
          onOpenChange={(open) => {
            if (!open) setEditField(null)
          }}
          field={editField}
          onUpdated={loadFields}
        />
      )}
    </>
  )
}

// ─── Main Content ──────────────────────────────────────────────────────

export function FormsContent({ forms }: { forms: any[] }) {
  const { t } = useT()
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)

  function handleRefresh() {
    router.refresh()
  }

  return (
    <div className="space-y-6 animate-page-enter">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("forms.main.allForms")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("forms.main.subtitle")}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4 mr-1.5" />
          {t("forms.main.newForm")}
        </Button>
      </div>

      {/* Forms grid */}
      {forms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg border-dashed">
          <FileInput className="size-10 text-muted-foreground/50 mb-3" />
          <h3 className="text-sm font-medium">{t("forms.main.emptyTitle")}</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {t("forms.main.emptyDescription")}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-4 mr-1.5" />
            {t("forms.main.createForm")}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(forms as Form[]).map((form) => (
            <FormCard key={form.id} form={form} onRefresh={handleRefresh} />
          ))}
        </div>
      )}

      {/* Create Form Dialog */}
      <CreateFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
