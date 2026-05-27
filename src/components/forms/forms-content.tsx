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
    label: "Task Intake",
    color: "text-blue-600 dark:text-blue-400",
    bgClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    icon: Inbox,
  },
  project_request: {
    label: "Project Request",
    color: "text-indigo-600 dark:text-indigo-400",
    bgClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    icon: FolderKanban,
  },
  issue_report: {
    label: "Issue Report",
    color: "text-red-600 dark:text-red-400",
    bgClass: "bg-red-500/10 text-red-600 dark:text-red-400",
    icon: AlertTriangle,
  },
  approval_request: {
    label: "Approval Request",
    color: "text-amber-600 dark:text-amber-400",
    bgClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    icon: CircleDot,
  },
  checklist_submission: {
    label: "Checklist Submission",
    color: "text-green-600 dark:text-green-400",
    bgClass: "bg-green-500/10 text-green-600 dark:text-green-400",
    icon: ClipboardList,
  },
}

const FIELD_TYPE_CONFIG: Record<
  FieldType,
  { label: string; icon: React.ElementType }
> = {
  text: { label: "Short Text", icon: Type },
  long_text: { label: "Long Text", icon: AlignLeft },
  number: { label: "Number", icon: Hash },
  date: { label: "Date", icon: Calendar },
  select: { label: "Select", icon: List },
  multi_select: { label: "Multi Select", icon: ListChecks },
  checkbox: { label: "Checkbox", icon: CheckSquare },
  email: { label: "Email", icon: Mail },
  url: { label: "URL", icon: Link },
  phone: { label: "Phone", icon: Phone },
  file: { label: "File", icon: Paperclip },
  user: { label: "User", icon: User },
  rating: { label: "Rating", icon: Star },
}

// ─── Create Form Dialog ───────────────────────────────────────────────

function CreateFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState<FormType>("task_intake")
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    if (!title.trim()) {
      toast.error("Title is required")
      return
    }
    setSaving(true)
    try {
      await createForm({
        title: title.trim(),
        description: description.trim() || undefined,
        type,
      })
      toast.success("Form created")
      setTitle("")
      setDescription("")
      setType("task_intake")
      onOpenChange(false)
      router.refresh()
    } catch {
      toast.error("Failed to create form")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Form</DialogTitle>
          <DialogDescription>
            Set up a new form to collect submissions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Title</label>
            <Input
              placeholder="e.g. Bug Report Form"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate()
              }}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Description</label>
            <textarea
              className="flex w-full rounded-md border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[72px] resize-none"
              placeholder="Describe the purpose of this form..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Type</label>
            <div className="grid grid-cols-1 gap-1.5">
              {(Object.keys(TYPE_CONFIG) as FormType[]).map((t) => {
                const config = TYPE_CONFIG[t]
                const Icon = config.icon
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                      type === t
                        ? "border-primary bg-primary/5 font-medium"
                        : "border-transparent hover:bg-accent"
                    }`}
                  >
                    <Icon className={`size-4 ${config.color}`} />
                    {config.label}
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
            Cancel
          </DialogClose>
          <Button onClick={handleCreate} disabled={saving || !title.trim()}>
            {saving ? "Creating..." : "Create Form"}
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
      toast.success("Field added")
      reset()
      onOpenChange(false)
      onAdded()
    } catch {
      toast.error("Failed to add field")
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
          <DialogTitle>Add Field</DialogTitle>
          <DialogDescription>
            Choose a field type and configure it.
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
                  {config.label}
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
              <span>{FIELD_TYPE_CONFIG[fieldType].label}</span>
              <button
                type="button"
                onClick={() => setFieldType(null)}
                className="ml-auto text-xs hover:text-foreground"
              >
                Change
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Label</label>
              <Input
                placeholder="e.g. Full Name"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd()
                }}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Placeholder</label>
              <Input
                placeholder="e.g. Enter your name..."
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
              Required field
            </label>
          </div>
        )}

        {fieldType && (
          <DialogFooter>
            <DialogClose
              className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Cancel
            </DialogClose>
            <Button onClick={handleAdd} disabled={saving || !label.trim()}>
              {saving ? "Adding..." : "Add Field"}
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
      toast.success("Field updated")
      onOpenChange(false)
      onUpdated()
    } catch {
      toast.error("Failed to update field")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Field</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {(() => {
              const Icon = FIELD_TYPE_CONFIG[field.fieldType].icon
              return <Icon className="size-4" />
            })()}
            <span>{FIELD_TYPE_CONFIG[field.fieldType].label}</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Label</label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave()
              }}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Placeholder</label>
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
            Required field
          </label>
        </div>

        <DialogFooter>
          <DialogClose
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Cancel
          </DialogClose>
          <Button onClick={handleSave} disabled={saving || !label.trim()}>
            {saving ? "Saving..." : "Save Changes"}
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
  const config = FIELD_TYPE_CONFIG[field.fieldType]
  const Icon = config.icon

  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-2 group hover:bg-accent/50 transition-colors">
      <GripVertical className="size-4 text-muted-foreground/50 shrink-0" />
      <Icon className="size-4 text-muted-foreground shrink-0" />
      <span className="text-sm flex-1 truncate">{field.label}</span>
      {field.isRequired && (
        <Badge variant="secondary" className="text-xs px-1.5 py-0 shrink-0">
          Required
        </Badge>
      )}
      <span className="text-xs text-muted-foreground shrink-0">
        {config.label}
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
  const [submissions, setSubmissions] = useState<FormSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  async function loadSubmissions() {
    setLoading(true)
    try {
      const data = await getFormSubmissions(formId)
      setSubmissions(data as FormSubmission[])
    } catch {
      toast.error("Failed to load submissions")
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
      toast.success("Submission processed")
      loadSubmissions()
    } catch {
      toast.error("Failed to process submission")
    } finally {
      setProcessing(null)
    }
  }

  async function handleReject(id: string) {
    setProcessing(id)
    try {
      await rejectSubmission(id)
      toast.success("Submission rejected")
      loadSubmissions()
    } catch {
      toast.error("Failed to reject submission")
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
        Loading submissions...
      </div>
    )
  }

  if (submissions.length === 0) {
    return (
      <div className="py-6 text-sm text-muted-foreground text-center border rounded-lg border-dashed">
        No submissions yet
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground mb-2">
        {submissions.length} submission{submissions.length !== 1 ? "s" : ""}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-2 pr-4 font-medium text-muted-foreground">Date</th>
              <th className="pb-2 pr-4 font-medium text-muted-foreground">Submitted By</th>
              <th className="pb-2 pr-4 font-medium text-muted-foreground">Status</th>
              <th className="pb-2 pr-4 font-medium text-muted-foreground">Data Preview</th>
              <th className="pb-2 font-medium text-muted-foreground">Actions</th>
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
                    {sub.submittedBy ?? "Anonymous"}
                  </td>
                  <td className="py-2 pr-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_STYLE[sub.status] ?? ""
                      }`}
                    >
                      {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                    </span>
                  </td>
                  <td className="py-2 pr-4 max-w-[200px] truncate text-muted-foreground">
                    {preview || "No data"}
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
                          title="Process"
                        >
                          <Check className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-red-600"
                          disabled={processing === sub.id}
                          onClick={() => handleReject(sub.id)}
                          title="Reject"
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
      toast.error("Failed to load fields")
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
        toast.success("Form unpublished")
      } else {
        await publishForm(form.id)
        toast.success("Form published")
      }
      onRefresh()
    } catch {
      toast.error("Failed to update form")
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteForm(form.id)
      toast.success("Form deleted")
      onRefresh()
    } catch {
      toast.error("Failed to delete form")
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
      toast.error("Failed to reorder fields")
      loadFields()
    }
  }

  async function handleDeleteField(fieldId: string) {
    try {
      await removeFormField(fieldId)
      toast.success("Field removed")
      setFields((prev) => prev.filter((f) => f.id !== fieldId))
    } catch {
      toast.error("Failed to remove field")
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
                  Edit Fields
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handlePublishToggle}>
                  {form.isPublished ? <EyeOff /> : <Eye />}
                  {form.isPublished ? "Unpublish" : "Publish"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleToggle("submissions")}>
                  <Send />
                  View Submissions
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  <Trash2 />
                  {deleting ? "Deleting..." : "Delete"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeConfig.bgClass}`}
            >
              {typeConfig.label}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                form.isPublished
                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {form.isPublished ? "Published" : "Draft"}
            </span>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Send className="size-3" />
              {form.submissionCount} submission
              {form.submissionCount !== 1 ? "s" : ""}
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
              Edit
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
                  Unpublish
                </>
              ) : (
                <>
                  <Eye className="size-3 mr-1" />
                  Publish
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
              Submissions
            </Button>
          </div>
        </div>

        {/* Expanded: Fields Builder */}
        {expanded === "fields" && (
          <div className="border-t p-4 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Form Fields</h4>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setAddFieldOpen(true)}
                >
                  <Plus className="size-3 mr-1" />
                  Add Field
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
                Loading fields...
              </div>
            ) : fields.length === 0 ? (
              <div className="py-6 text-sm text-muted-foreground text-center border rounded-lg border-dashed">
                No fields yet. Add your first field to get started.
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
              <h4 className="text-sm font-medium">Submissions</h4>
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
          <h2 className="text-lg font-semibold">All Forms</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage forms to collect submissions.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4 mr-1.5" />
          New Form
        </Button>
      </div>

      {/* Forms grid */}
      {forms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg border-dashed">
          <FileInput className="size-10 text-muted-foreground/50 mb-3" />
          <h3 className="text-sm font-medium">No forms yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Create your first form to start collecting task intakes, project
            requests, issue reports, and more.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-4 mr-1.5" />
            Create Form
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
