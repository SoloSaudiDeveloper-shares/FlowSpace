"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import {
  Flag,
  Calendar,
  ChevronDown,
  ChevronRight,
  Trash2,
  Plus,
  X,
  CircleDot,
  ArrowRight,
  Tag,
  ListChecks,
  GitBranch,
  Square,
  CheckSquare,
  Clock,
  Timer,
  Play,
  Pause,
  Link2,
  FileText,
  MoreHorizontal,
  Copy,
  ClipboardCopy,
  MessageCircle,
  Send,
  Paperclip,
  Upload,
  Download,
  File,
  Mail,
} from "lucide-react"
import { SpeechButton } from "@/components/shared/speech-button"
import { SendTaskEmailDialog } from "@/components/project/send-task-email-dialog"
import { TTSButton } from "@/components/shared/tts-button"
import { AIActionButton } from "@/components/shared/ai-action-button"
import { CustomFieldsPanel } from "@/components/shared/custom-fields-panel"
import {
  updateTask,
  deleteTask,
  duplicateTask,
  getSubtasks,
  createSubtask,
  getAllLabels,
  getTaskLabels,
  addLabelToTask,
  removeLabelFromTask,
  createLabel,
  getTaskChecklists,
  createChecklist,
  deleteChecklist,
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  getTaskDependencies,
  addTaskDependency,
  removeTaskDependency,
  getTasksByProject,
  getTaskAttachments,
} from "@/lib/actions/task-actions"
import {
  getTaskComments,
  addTaskComment,
  deleteComment,
} from "@/lib/actions/comment-actions"
import { toast } from "sonner"
import type { tasks, taskStatuses, taskLabels as taskLabelsTable } from "@/lib/db/schema"

type Task = typeof tasks.$inferSelect
type TaskStatus = typeof taskStatuses.$inferSelect
type TaskLabel = typeof taskLabelsTable.$inferSelect
type Comment = { id: string; taskId: string; content: string; createdAt: string; updatedAt: string }
type Attachment = { id: string; taskId: string; fileName: string; filePath: string; fileSize: number; mimeType: string | null; createdAt: string }

const PRIORITIES = [
  { value: "urgent" as const, label: "Urgent", color: "#ef4444" },
  { value: "high" as const, label: "High", color: "#f97316" },
  { value: "medium" as const, label: "Medium", color: "#eab308" },
  { value: "low" as const, label: "Low", color: "#3b82f6" },
  { value: "none" as const, label: "None", color: "#94a3b8" },
]

const LABEL_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280",
]

const DEP_TYPES = [
  { value: "blocks" as const, label: "Blocks" },
  { value: "blocked_by" as const, label: "Blocked by" },
  { value: "relates_to" as const, label: "Relates to" },
]

interface TaskDetailSheetProps {
  task: Task | null
  statuses: TaskStatus[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ChecklistWithItems = {
  id: string
  taskId: string
  title: string
  sortOrder: number
  createdAt: string
  items: {
    id: string
    checklistId: string
    title: string
    isCompleted: boolean
    sortOrder: number
    completedAt: string | null
  }[]
}

type Dependency = {
  id: string
  taskId: string
  dependsOnTaskId: string
  type: "blocks" | "blocked_by" | "relates_to"
  createdAt: string
}

function formatDuration(seconds: number) {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const hms = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  return d > 0 ? `${d}d ${hms}` : hms
}

/** Human total like "2h 15m" / "1d 3h" for the small label under the timer. */
function humanDuration(seconds: number) {
  if (seconds <= 0) return ""
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (d) parts.push(`${d}d`)
  if (h) parts.push(`${h}h`)
  if (m && !d) parts.push(`${m}m`)
  if (!parts.length) parts.push(`${seconds}s`)
  return parts.join(" ")
}

// ── Collapsible section ──

function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  count,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  defaultOpen?: boolean
  count?: number
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-6 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        <Icon className="size-3.5" />
        <span>{title}</span>
        {count !== undefined && (
          <span className="ml-auto text-xs text-muted-foreground/60">{count}</span>
        )}
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  )
}

export function TaskDetailSheet({
  task,
  statuses,
  open,
  onOpenChange,
}: TaskDetailSheetProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")

  // Editable properties mirror the task locally so a change shows immediately
  // (the `task` prop is stale until the parent re-fetches).
  const [statusId, setStatusId] = useState("")
  const [priority, setPriority] = useState<Task["priority"]>("none")
  const [startDate, setStartDate] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [timeEstimate, setTimeEstimate] = useState<number | null>(null)

  // Subtasks
  const [subtasks, setSubtasks] = useState<Task[]>([])
  const [isAddingSubtask, setIsAddingSubtask] = useState(false)
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("")

  // Labels
  const [taskLabelsList, setTaskLabelsList] = useState<TaskLabel[]>([])
  const [allLabels, setAllLabels] = useState<TaskLabel[]>([])
  const [showLabelPicker, setShowLabelPicker] = useState(false)
  const [newLabelName, setNewLabelName] = useState("")
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0])

  // Checklists
  const [checklists, setChecklists] = useState<ChecklistWithItems[]>([])
  const [isAddingChecklist, setIsAddingChecklist] = useState(false)
  const [newChecklistTitle, setNewChecklistTitle] = useState("")
  const [addingItemTo, setAddingItemTo] = useState<string | null>(null)
  const [newItemTitle, setNewItemTitle] = useState("")

  // Dependencies
  const [dependencies, setDependencies] = useState<Dependency[]>([])
  const [projectTasks, setProjectTasks] = useState<Task[]>([])
  const [showDepPicker, setShowDepPicker] = useState(false)
  const [depType, setDepType] = useState<"blocks" | "blocked_by" | "relates_to">("blocks")

  // Time tracking. `committedRef` = seconds already saved to the task;
  // `runningSinceRef` = epoch-ms the live stopwatch started (null = stopped).
  // Display = committed + (now - runningSince). We flush (commit + persist) on
  // stop, on close, on unmount, and on tab unload so seconds aren't lost.
  const [isTracking, setIsTracking] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const trackingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const committedRef = useRef<number>(0)
  const runningSinceRef = useRef<number | null>(null)
  const taskRef = useRef<Task | null>(null)

  // Comments
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")

  // Attachments
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Right sidebar tab
  const [rightTab, setRightTab] = useState<"details" | "comments">("details")

  // Clipboard notification
  const [copied, setCopied] = useState(false)
  // Send-as-email dialog
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)

  useEffect(() => {
    if (task && open) {
      setTitle(task.title)
      setDescription(task.description ?? "")
      setStatusId(task.statusId)
      setPriority(task.priority)
      setStartDate(task.startDate?.split("T")[0] ?? "")
      setDueDate(task.dueDate?.split("T")[0] ?? "")
      setTimeEstimate(task.timeEstimate ?? null)
      committedRef.current = task.timeTracked ?? 0
      setElapsed(task.timeTracked ?? 0)
      loadData(task)
    }
    if (!open) {
      stopTracking()
    }
  }, [task?.id, open])

  // Keep a ref to the current task so unmount/unload handlers can save without
  // a stale closure.
  useEffect(() => {
    taskRef.current = task
  }, [task])

  // Save in-progress time when navigating away (unmount) or closing the tab.
  useEffect(() => {
    const onUnload = () => flushTracking()
    window.addEventListener("beforeunload", onUnload)
    return () => {
      window.removeEventListener("beforeunload", onUnload)
      if (trackingRef.current) clearInterval(trackingRef.current)
      flushTracking()
    }
  }, [])

  async function loadData(t: Task) {
    const [subs, tLabels, aLabels, cls, deps, allTasks, cmts, atts] = await Promise.all([
      getSubtasks(t.id),
      getTaskLabels(t.id),
      getAllLabels(),
      getTaskChecklists(t.id),
      getTaskDependencies(t.id),
      getTasksByProject(t.projectId),
      getTaskComments(t.id),
      getTaskAttachments(t.id),
    ])
    setSubtasks(subs)
    setTaskLabelsList(tLabels.map((r) => r.label))
    setAllLabels(aLabels)
    setChecklists(cls)
    setDependencies(deps)
    setProjectTasks(allTasks.filter((pt) => pt.id !== t.id))
    setComments(cmts)
    setAttachments(atts)
  }

  function startTracking() {
    if (runningSinceRef.current != null) return
    setIsTracking(true)
    runningSinceRef.current = Date.now()
    trackingRef.current = setInterval(() => {
      const since = runningSinceRef.current
      if (since == null) return
      setElapsed(committedRef.current + Math.floor((Date.now() - since) / 1000))
    }, 1000)
  }

  /** Commit elapsed-since-start into the running total and persist it.
   *  Idempotent: advances the start marker so repeat calls don't double-count. */
  function flushTracking() {
    if (runningSinceRef.current == null) return
    const now = Date.now()
    const delta = Math.floor((now - runningSinceRef.current) / 1000)
    runningSinceRef.current = now
    if (delta > 0) {
      committedRef.current += delta
      setElapsed(committedRef.current)
      const t = taskRef.current
      if (t) updateTask(t.id, t.projectId, { timeTracked: committedRef.current })
    }
  }

  function stopTracking() {
    if (runningSinceRef.current == null) return
    if (trackingRef.current) {
      clearInterval(trackingRef.current)
      trackingRef.current = null
    }
    flushTracking()
    runningSinceRef.current = null
    setIsTracking(false)
  }

  if (!task) return null

  const currentStatus =
    statuses.find((s) => s.id === statusId) ?? statuses.find((s) => s.id === task.statusId)
  const currentPriority = PRIORITIES.find((p) => p.value === priority)

  function handleTitleBlur() {
    if (task && title !== task.title) {
      updateTask(task.id, task.projectId, { title: title || "Untitled" })
    }
  }

  function handleDescBlur() {
    if (task && description !== (task.description ?? "")) {
      updateTask(task.id, task.projectId, { description })
    }
  }

  async function handleAddSubtask() {
    if (!newSubtaskTitle.trim() || !task || statuses.length === 0) return
    await createSubtask(task.projectId, statuses[0].id, task.id, newSubtaskTitle.trim())
    setNewSubtaskTitle("")
    setIsAddingSubtask(false)
    setSubtasks(await getSubtasks(task.id))
  }

  async function handleToggleSubtask(sub: Task) {
    await updateTask(sub.id, sub.projectId, { isCompleted: !sub.isCompleted })
    setSubtasks(await getSubtasks(task!.id))
  }

  async function handleAddLabel(labelId: string) {
    if (!task) return
    await addLabelToTask(task.id, labelId, task.projectId)
    const updated = await getTaskLabels(task.id)
    setTaskLabelsList(updated.map((r) => r.label))
  }

  async function handleRemoveLabel(labelId: string) {
    if (!task) return
    await removeLabelFromTask(task.id, labelId, task.projectId)
    const updated = await getTaskLabels(task.id)
    setTaskLabelsList(updated.map((r) => r.label))
  }

  async function handleCreateLabel() {
    if (!newLabelName.trim() || !task) return
    const id = await createLabel(newLabelName.trim(), newLabelColor)
    await addLabelToTask(task.id, id, task.projectId)
    setNewLabelName("")
    setAllLabels(await getAllLabels())
    const updated = await getTaskLabels(task.id)
    setTaskLabelsList(updated.map((r) => r.label))
  }

  async function handleCreateChecklist() {
    if (!newChecklistTitle.trim() || !task) return
    await createChecklist(task.id, newChecklistTitle.trim(), task.projectId)
    setNewChecklistTitle("")
    setIsAddingChecklist(false)
    setChecklists(await getTaskChecklists(task.id))
  }

  async function handleDeleteChecklist(clId: string) {
    if (!task) return
    await deleteChecklist(clId, task.projectId)
    setChecklists(await getTaskChecklists(task.id))
  }

  async function handleAddChecklistItem(checklistId: string) {
    if (!newItemTitle.trim() || !task) return
    await addChecklistItem(checklistId, newItemTitle.trim(), task.projectId)
    setNewItemTitle("")
    setAddingItemTo(null)
    setChecklists(await getTaskChecklists(task.id))
  }

  async function handleToggleChecklistItem(itemId: string, current: boolean) {
    if (!task) return
    await toggleChecklistItem(itemId, !current, task.projectId)
    setChecklists(await getTaskChecklists(task.id))
  }

  async function handleDeleteChecklistItem(itemId: string) {
    if (!task) return
    await deleteChecklistItem(itemId, task.projectId)
    setChecklists(await getTaskChecklists(task.id))
  }

  async function handleAddDependency(targetTaskId: string) {
    if (!task) return
    await addTaskDependency(task.id, targetTaskId, depType, task.projectId)
    setDependencies(await getTaskDependencies(task.id))
    setShowDepPicker(false)
  }

  async function handleRemoveDependency(depId: string) {
    if (!task) return
    await removeTaskDependency(depId, task.projectId)
    setDependencies(await getTaskDependencies(task.id))
  }

  async function handleAddComment() {
    if (!newComment.trim() || !task) return
    await addTaskComment(task.id, newComment.trim(), task.projectId)
    setNewComment("")
    setComments(await getTaskComments(task.id))
  }

  async function handleDeleteComment(commentId: string) {
    if (!task) return
    await deleteComment(commentId, task.projectId)
    setComments(await getTaskComments(task.id))
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !task) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("taskId", task.id)
      formData.append("projectId", task.projectId)
      const res = await fetch("/api/attachments", { method: "POST", body: formData })
      if (!res.ok) throw new Error("Upload failed")
      toast.success("File attached")
      setAttachments(await getTaskAttachments(task.id))
    } catch {
      toast.error("Upload failed")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleDeleteAttachment(id: string) {
    if (!task) return
    try {
      await fetch("/api/attachments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, projectId: task.projectId }),
      })
      toast.success("Attachment removed")
      setAttachments(await getTaskAttachments(task.id))
    } catch {
      toast.error("Failed to remove attachment")
    }
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  async function handleDuplicate() {
    if (!task) return
    await duplicateTask(task.id, task.projectId)
    toast.success("Task duplicated")
    onOpenChange(false)
  }

  function handleCopyId() {
    if (!task) return
    navigator.clipboard.writeText(task.id)
    setCopied(true)
    toast.success("Task ID copied")
    setTimeout(() => setCopied(false), 2000)
  }

  const assignedLabelIds = new Set(taskLabelsList.map((l) => l.id))
  const unassignedLabels = allLabels.filter((l) => !assignedLabelIds.has(l.id))
  const depTaskIds = new Set(dependencies.map((d) => d.dependsOnTaskId))
  const availableDepTasks = projectTasks.filter((t) => !depTaskIds.has(t.id))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[85vh] p-0 overflow-hidden" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>Edit task details</DialogDescription>
        </DialogHeader>

        <div className="flex h-[75vh]" role="dialog" aria-label={`Task: ${task.title}`}>
          {/* ── Left sidebar: subtask tree ── */}
          <div className="w-56 shrink-0 border-r bg-muted/20 flex flex-col overflow-y-auto">
            <div className="px-3 py-3 border-b">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-accent/50">
                <CircleDot className="size-3" style={{ color: currentStatus?.color }} />
                <span className="text-sm font-medium truncate">{task.title}</span>
              </div>
            </div>

            <div className="flex-1 px-3 py-2" role="list" aria-label="Subtasks">
              {subtasks.length === 0 && (
                <p className="text-xs text-muted-foreground/50 px-2 py-4 text-center">No subtasks</p>
              )}
              {subtasks.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/50 cursor-pointer group"
                  role="listitem"
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleToggleSubtask(sub)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleToggleSubtask(sub) }}
                    aria-label={sub.isCompleted ? "Mark incomplete" : "Mark complete"}
                  >
                    {sub.isCompleted ? (
                      <CheckSquare className="size-3 text-primary" />
                    ) : (
                      <Square className="size-3 text-muted-foreground" />
                    )}
                  </div>
                  <span className={`text-sm truncate flex-1 ${sub.isCompleted ? "line-through text-muted-foreground" : ""}`}>
                    {sub.title}
                  </span>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={async () => {
                      await deleteTask(sub.id, sub.projectId)
                      setSubtasks(await getSubtasks(task.id))
                    }}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter") {
                        await deleteTask(sub.id, sub.projectId)
                        setSubtasks(await getSubtasks(task.id))
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive cursor-pointer"
                    aria-label="Delete subtask"
                  >
                    <X className="size-3" />
                  </div>
                </div>
              ))}
            </div>

            <div className="px-3 pb-3 border-t pt-2">
              {isAddingSubtask ? (
                <div className="space-y-1.5">
                  <div className="relative flex items-center">
                    <Input
                      autoFocus
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      placeholder="Subtask name..."
                      className="h-7 text-xs pr-8"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddSubtask()
                        if (e.key === "Escape") {
                          setIsAddingSubtask(false)
                          setNewSubtaskTitle("")
                        }
                      }}
                    />
                    <div className="absolute right-1 top-1/2 -translate-y-1/2">
                      <SpeechButton
                        onTranscript={(text) => setNewSubtaskTitle((prev) => prev ? `${prev} ${text}` : text)}
                        size="sm"
                        showPulse={false}
                        tooltip="Dictate subtask"
                      />
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" className="h-6 text-xs" onClick={handleAddSubtask}>Add</Button>
                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { setIsAddingSubtask(false); setNewSubtaskTitle("") }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setIsAddingSubtask(true)}
                  onKeyDown={(e) => { if (e.key === "Enter") setIsAddingSubtask(true) }}
                  className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer rounded-md hover:bg-accent/50"
                >
                  <GitBranch className="size-3" />
                  Add Subtask
                </div>
              )}
            </div>
          </div>

          {/* ── Center: main content ── */}
          <div className="flex-1 overflow-y-auto min-w-0">
            {/* Title bar with settings menu */}
            <div className="px-6 pt-5 pb-2 flex items-start justify-between gap-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                className="w-full text-2xl font-bold bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
                placeholder="Task title"
                aria-label="Task title"
              />
              {/* Settings menu (per ClickUp spec: task settings menu) */}
              <DropdownMenu>
                <DropdownMenuTrigger className="shrink-0 p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground" aria-label="Task actions">
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleDuplicate}>
                    <Copy className="size-3.5 mr-2" />
                    Duplicate task
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCopyId}>
                    <ClipboardCopy className="size-3.5 mr-2" />
                    {copied ? "Copied!" : "Copy task ID"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setEmailDialogOpen(true)}>
                    <Mail className="size-3.5 mr-2" />
                    Send as email…
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => { deleteTask(task.id, task.projectId); toast.success("Task deleted"); onOpenChange(false) }}
                  >
                    <Trash2 className="size-3.5 mr-2" />
                    Delete task
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* ── Properties section (collapsible) ── */}
            <Section title="Properties" icon={CircleDot} defaultOpen={true}>
              <div className="px-6 space-y-1">
                {/* Status */}
                <div className="flex items-center h-9">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground w-36 shrink-0">
                    <CircleDot className="size-3.5" />
                    Status
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: currentStatus?.color }} />
                      <span className="font-medium">{currentStatus?.name}</span>
                      <ChevronDown className="size-3 text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {statuses.map((s) => (
                        <DropdownMenuItem key={s.id} onClick={() => { setStatusId(s.id); updateTask(task.id, task.projectId, { statusId: s.id }) }}>
                          <span className="size-2.5 rounded-full mr-2" style={{ backgroundColor: s.color }} />
                          {s.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Priority */}
                <div className="flex items-center h-9">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground w-36 shrink-0">
                    <Flag className="size-3.5" />
                    Priority
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent">
                      <Flag className="size-3" style={{ color: currentPriority?.color }} />
                      <span className="font-medium">{currentPriority?.label ?? "None"}</span>
                      <ChevronDown className="size-3 text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {PRIORITIES.map((p) => (
                        <DropdownMenuItem key={p.value} onClick={() => { setPriority(p.value); updateTask(task.id, task.projectId, { priority: p.value }) }}>
                          <Flag className="size-3 mr-2" style={{ color: p.color }} />
                          {p.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Dates */}
                <div className="flex items-center h-9">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground w-36 shrink-0">
                    <Calendar className="size-3.5" />
                    Dates
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => { setStartDate(e.target.value); updateTask(task.id, task.projectId, { startDate: e.target.value || null }) }}
                      className="bg-transparent text-sm border rounded px-1.5 py-0.5 w-[120px]"
                      aria-label="Start date"
                    />
                    <ArrowRight className="size-3 text-muted-foreground" />
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => { setDueDate(e.target.value); updateTask(task.id, task.projectId, { dueDate: e.target.value || null }) }}
                      className="bg-transparent text-sm border rounded px-1.5 py-0.5 w-[120px]"
                      aria-label="Due date"
                    />
                  </div>
                </div>

                {/* Tags */}
                <div className="flex items-center min-h-[36px]">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground w-36 shrink-0">
                    <Tag className="size-3.5" />
                    Tags
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {taskLabelsList.map((label) => (
                      <Badge
                        key={label.id}
                        variant="secondary"
                        className="gap-1 text-xs cursor-default"
                        style={{ backgroundColor: `${label.color}20`, color: label.color, borderColor: `${label.color}40` }}
                      >
                        {label.name}
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={() => handleRemoveLabel(label.id)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleRemoveLabel(label.id) }}
                          className="ml-0.5 hover:opacity-70 cursor-pointer"
                          aria-label={`Remove tag ${label.name}`}
                        >
                          <X className="size-2.5" />
                        </span>
                      </Badge>
                    ))}
                    <DropdownMenu open={showLabelPicker} onOpenChange={setShowLabelPicker}>
                      <DropdownMenuTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-accent">
                        <Plus className="size-3" />
                        {taskLabelsList.length === 0 ? "Add tag" : ""}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56">
                        {unassignedLabels.map((label) => (
                          <DropdownMenuItem key={label.id} onClick={() => handleAddLabel(label.id)}>
                            <span className="size-2.5 rounded-full mr-2" style={{ backgroundColor: label.color }} />
                            {label.name}
                          </DropdownMenuItem>
                        ))}
                        {unassignedLabels.length > 0 && <DropdownMenuSeparator />}
                        <div className="px-2 py-1.5">
                          <p className="text-xs text-muted-foreground mb-1.5">Create new tag</p>
                          <div className="flex gap-1.5">
                            <Input
                              value={newLabelName}
                              onChange={(e) => setNewLabelName(e.target.value)}
                              placeholder="Tag name"
                              className="h-7 text-xs"
                              onKeyDown={(e) => { if (e.key === "Enter") handleCreateLabel(); e.stopPropagation() }}
                            />
                            <DropdownMenu>
                              <DropdownMenuTrigger className="size-7 rounded-md border shrink-0" style={{ backgroundColor: newLabelColor }} />
                              <DropdownMenuContent className="w-auto p-2">
                                <div className="grid grid-cols-4 gap-1">
                                  {LABEL_COLORS.map((c) => (
                                    <div
                                      key={c}
                                      role="button"
                                      tabIndex={0}
                                      className={`size-6 rounded-md cursor-pointer ${newLabelColor === c ? "ring-2 ring-offset-1 ring-foreground" : ""}`}
                                      style={{ backgroundColor: c }}
                                      onClick={() => setNewLabelColor(c)}
                                      onKeyDown={(e) => { if (e.key === "Enter") setNewLabelColor(c) }}
                                    />
                                  ))}
                                </div>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          {newLabelName.trim() && (
                            <Button size="sm" className="mt-1.5 h-6 text-xs w-full" onClick={handleCreateLabel}>
                              Create
                            </Button>
                          )}
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            </Section>

            {/* ── Time tracking section ── */}
            <Section title="Time Tracking" icon={Timer}>
              <div className="px-6 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => isTracking ? stopTracking() : startTracking()}
                      onKeyDown={(e) => { if (e.key === "Enter") isTracking ? stopTracking() : startTracking() }}
                      className="flex items-center gap-2 cursor-pointer select-none"
                      aria-label={isTracking ? "Stop timer" : "Start timer"}
                    >
                      {isTracking ? (
                        <span className="size-6 rounded-full bg-red-500/20 flex items-center justify-center">
                          <Pause className="size-3 text-red-400" />
                        </span>
                      ) : (
                        <span className="size-6 rounded-full bg-primary/20 flex items-center justify-center">
                          <Play className="size-3 text-primary" />
                        </span>
                      )}
                      <span className="flex flex-col leading-tight">
                        <span className={`text-lg font-mono ${isTracking ? "text-red-400" : ""}`}>
                          {formatDuration(elapsed)}
                        </span>
                        {elapsed >= 60 && (
                          <span className="text-[10px] text-muted-foreground">
                            {humanDuration(elapsed)} tracked
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="size-3.5" />
                      Estimate:
                    </div>
                    <input
                      type="number"
                      min={0}
                      placeholder="min"
                      value={timeEstimate ?? ""}
                      onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value) : null
                        setTimeEstimate(val)
                        updateTask(task.id, task.projectId, { timeEstimate: val })
                      }}
                      className="bg-transparent text-sm border rounded px-2 py-0.5 w-16"
                      aria-label="Time estimate in minutes"
                    />
                    <span className="text-xs text-muted-foreground">
                      {timeEstimate ? (timeEstimate >= 60 ? `${Math.floor(timeEstimate / 60)}h ${timeEstimate % 60}m` : `${timeEstimate}m`) : ""}
                    </span>
                  </div>
                </div>
                {timeEstimate && timeEstimate > 0 && (
                  <div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Progress</span>
                      <span>{Math.min(100, Math.round((elapsed / (timeEstimate * 60)) * 100))}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.min(100, (elapsed / (timeEstimate * 60)) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </Section>

            {/* ── Description section ── */}
            <Section title="Description" icon={FileText}>
              <div className="px-6">
                <div className="relative">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={handleDescBlur}
                    placeholder="Add a detailed description..."
                    className="w-full min-h-[80px] bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground/50 leading-relaxed pr-9"
                    aria-label="Task description"
                  />
                  <div className="absolute top-1 right-1 flex gap-0.5">
                    <AIActionButton
                      text={description}
                      onResult={(result, action) => {
                        if (action === "continue" || action === "expand") {
                          setDescription((prev) => prev ? `${prev}\n\n${result}` : result)
                        } else {
                          setDescription(result)
                        }
                      }}
                      actions={["summarize", "expand", "fix_grammar", "improve", "continue"]}
                      size="sm"
                    />
                    <TTSButton text={description} size="sm" tooltip="Read description" />
                    <SpeechButton
                      onTranscript={(text) => setDescription((prev) => prev ? `${prev} ${text}` : text)}
                      size="sm"
                      tooltip="Dictate description"
                    />
                  </div>
                </div>
              </div>
            </Section>

            {/* Custom Fields section */}
            {task && (
              <div className="px-6 pb-2">
                <CustomFieldsPanel
                  entityType="task"
                  entityId={task.id}
                  projectId={task.projectId}
                />
              </div>
            )}

            {/* ── Checklists section ── */}
            <Section title="Checklists" icon={ListChecks} count={checklists.length}>
              <div className="px-6">
                {checklists.map((cl) => {
                  const completed = cl.items.filter((i) => i.isCompleted).length
                  const total = cl.items.length
                  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

                  return (
                    <div key={cl.id} className="mb-4 last:mb-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <ListChecks className="size-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium">{cl.title}</span>
                          {total > 0 && <span className="text-[10px] text-muted-foreground">{completed}/{total}</span>}
                        </div>
                        <div className="flex items-center gap-1">
                          <div role="button" tabIndex={0} onClick={() => { setAddingItemTo(cl.id); setNewItemTitle("") }} onKeyDown={(e) => { if (e.key === "Enter") { setAddingItemTo(cl.id); setNewItemTitle("") } }} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer p-0.5" aria-label="Add item">
                            <Plus className="size-3" />
                          </div>
                          <div role="button" tabIndex={0} onClick={() => handleDeleteChecklist(cl.id)} onKeyDown={(e) => { if (e.key === "Enter") handleDeleteChecklist(cl.id) }} className="text-xs text-muted-foreground hover:text-destructive cursor-pointer p-0.5" aria-label="Delete checklist">
                            <Trash2 className="size-3" />
                          </div>
                        </div>
                      </div>
                      {total > 0 && (
                        <div className="h-1 rounded-full bg-muted overflow-hidden mb-2">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                      <div className="space-y-0.5" role="list">
                        {cl.items.map((item) => (
                          <div key={item.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-accent/50 group" role="listitem">
                            <div role="button" tabIndex={0} onClick={() => handleToggleChecklistItem(item.id, item.isCompleted)} onKeyDown={(e) => { if (e.key === "Enter") handleToggleChecklistItem(item.id, item.isCompleted) }} className="cursor-pointer" aria-label={item.isCompleted ? "Mark incomplete" : "Mark complete"}>
                              {item.isCompleted ? <CheckSquare className="size-3.5 text-primary" /> : <Square className="size-3.5 text-muted-foreground" />}
                            </div>
                            <span className={`text-sm flex-1 ${item.isCompleted ? "line-through text-muted-foreground" : ""}`}>{item.title}</span>
                            <div role="button" tabIndex={0} onClick={() => handleDeleteChecklistItem(item.id)} onKeyDown={(e) => { if (e.key === "Enter") handleDeleteChecklistItem(item.id) }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive cursor-pointer" aria-label="Delete item">
                              <X className="size-3" />
                            </div>
                          </div>
                        ))}
                      </div>
                      {addingItemTo === cl.id && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="relative flex-1">
                            <Input autoFocus value={newItemTitle} onChange={(e) => setNewItemTitle(e.target.value)} placeholder="Item name..." className="h-7 text-sm pr-8" onKeyDown={(e) => { if (e.key === "Enter") handleAddChecklistItem(cl.id); if (e.key === "Escape") setAddingItemTo(null) }} />
                            <div className="absolute right-1 top-1/2 -translate-y-1/2">
                              <SpeechButton onTranscript={(text) => setNewItemTitle((prev) => prev ? `${prev} ${text}` : text)} size="sm" showPulse={false} tooltip="Dictate item" />
                            </div>
                          </div>
                          <Button size="sm" className="h-7 text-xs" onClick={() => handleAddChecklistItem(cl.id)}>Add</Button>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Add checklist */}
                {isAddingChecklist ? (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="relative flex-1">
                      <Input autoFocus value={newChecklistTitle} onChange={(e) => setNewChecklistTitle(e.target.value)} placeholder="Checklist name..." className="h-8 text-sm pr-8" onKeyDown={(e) => { if (e.key === "Enter") handleCreateChecklist(); if (e.key === "Escape") { setIsAddingChecklist(false); setNewChecklistTitle("") } }} />
                      <div className="absolute right-1 top-1/2 -translate-y-1/2">
                        <SpeechButton onTranscript={(text) => setNewChecklistTitle((prev) => prev ? `${prev} ${text}` : text)} size="sm" showPulse={false} tooltip="Dictate name" />
                      </div>
                    </div>
                    <Button size="sm" className="h-8" onClick={handleCreateChecklist}>Add</Button>
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => { setIsAddingChecklist(false); setNewChecklistTitle("") }}>Cancel</Button>
                  </div>
                ) : (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setIsAddingChecklist(true)}
                    onKeyDown={(e) => { if (e.key === "Enter") setIsAddingChecklist(true) }}
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer py-1.5 mt-1"
                  >
                    <Plus className="size-3" />
                    Add checklist
                  </div>
                )}
              </div>
            </Section>

            {/* ── Attachments section ── */}
            <Section title="Attachments" icon={Paperclip} count={attachments.length}>
              <div className="px-6">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-md hover:bg-accent/50 group mb-1"
                  >
                    <File className="size-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{att.fileName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatFileSize(att.fileSize)} &middot;{" "}
                        {new Date(att.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <a
                      href={`/api/attachments/${att.id}`}
                      download={att.fileName}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground shrink-0 p-1"
                      aria-label="Download"
                    >
                      <Download className="size-3.5" />
                    </a>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => handleDeleteAttachment(att.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleDeleteAttachment(att.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive cursor-pointer shrink-0 p-1"
                      aria-label="Remove attachment"
                    >
                      <Trash2 className="size-3.5" />
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-md border border-dashed text-xs text-muted-foreground hover:text-foreground hover:border-foreground/20 cursor-pointer transition-colors mt-1"
                >
                  <Upload className="size-3" />
                  {uploading ? "Uploading..." : "Attach file"}
                </button>
              </div>
            </Section>
          </div>

          {/* ── Right sidebar: tabs (Details / Comments) ── */}
          <div className="w-64 shrink-0 border-l bg-muted/10 flex flex-col overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b shrink-0">
              <button
                onClick={() => setRightTab("details")}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                  rightTab === "details" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Link2 className="size-3" />
                Details
              </button>
              <button
                onClick={() => setRightTab("comments")}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                  rightTab === "comments" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <MessageCircle className="size-3" />
                Comments
                {comments.length > 0 && (
                  <span className="text-[10px] bg-muted rounded-full px-1.5">{comments.length}</span>
                )}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {rightTab === "details" && (
                <div className="px-4 py-4">
                  <h3 className="text-sm font-medium mb-3">Dependencies</h3>

                  {dependencies.length > 0 && (
                    <div className="space-y-1.5 mb-3">
                      {dependencies.map((dep) => {
                        const depTask = projectTasks.find((t) => t.id === dep.dependsOnTaskId)
                        const typeLabel = DEP_TYPES.find((d) => d.value === dep.type)?.label ?? dep.type
                        return (
                          <div key={dep.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-accent/30 text-sm group">
                            <Link2 className="size-3 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-xs">{depTask?.title ?? "Unknown"}</p>
                              <p className="text-[10px] text-muted-foreground">{typeLabel}</p>
                            </div>
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => handleRemoveDependency(dep.id)}
                              onKeyDown={(e) => { if (e.key === "Enter") handleRemoveDependency(dep.id) }}
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive cursor-pointer shrink-0"
                              aria-label="Remove dependency"
                            >
                              <X className="size-3" />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {showDepPicker ? (
                    <div className="space-y-2">
                      <div className="flex gap-1">
                        {DEP_TYPES.map((dt) => (
                          <button
                            key={dt.value}
                            onClick={() => setDepType(dt.value)}
                            className={`text-[10px] px-2 py-0.5 rounded-full border ${depType === dt.value ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:bg-accent"}`}
                          >
                            {dt.label}
                          </button>
                        ))}
                      </div>
                      <div className="max-h-32 overflow-y-auto border rounded-md">
                        {availableDepTasks.length === 0 && (
                          <p className="text-xs text-muted-foreground p-2 text-center">No tasks available</p>
                        )}
                        {availableDepTasks.map((pt) => (
                          <button
                            key={pt.id}
                            onClick={() => handleAddDependency(pt.id)}
                            className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent truncate border-b last:border-b-0"
                          >
                            {pt.title}
                          </button>
                        ))}
                      </div>
                      <Button size="sm" variant="ghost" className="h-6 text-xs w-full" onClick={() => setShowDepPicker(false)}>Cancel</Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowDepPicker(true)}
                      className="flex items-center gap-2 w-full px-3 py-2 rounded-md border border-dashed text-xs text-muted-foreground hover:text-foreground hover:border-foreground/20 cursor-pointer transition-colors"
                    >
                      <Plus className="size-3" />
                      Add dependency
                    </button>
                  )}

                  {/* Metadata */}
                  <div className="mt-8 space-y-2.5 text-xs text-muted-foreground">
                    <h4 className="text-sm font-medium text-foreground mb-2">Info</h4>
                    <div className="flex justify-between">
                      <span>Created</span>
                      <span>{new Date(task.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Updated</span>
                      <span>{new Date(task.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>
                    {task.completedAt && (
                      <div className="flex justify-between text-green-500">
                        <span>Completed</span>
                        <span>{new Date(task.completedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Task ID</span>
                      <span className="font-mono text-[10px]">{task.id.slice(0, 8)}...</span>
                    </div>
                  </div>
                </div>
              )}

              {rightTab === "comments" && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 px-3 py-3 space-y-3 overflow-y-auto">
                    {comments.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-8">No comments yet</p>
                    )}
                    {comments.map((cmt) => (
                      <div key={cmt.id} className="group">
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-xs text-muted-foreground">
                            {new Date(cmt.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}{" "}
                            {new Date(cmt.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                          </p>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => handleDeleteComment(cmt.id)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleDeleteComment(cmt.id) }}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive cursor-pointer shrink-0"
                            aria-label="Delete comment"
                          >
                            <X className="size-3" />
                          </div>
                        </div>
                        <p className="text-sm mt-0.5 whitespace-pre-wrap">{cmt.content}</p>
                      </div>
                    ))}
                  </div>
                  {/* Comment input */}
                  <div className="border-t px-3 py-2 shrink-0">
                    <div className="flex gap-1.5">
                      <div className="relative flex-1">
                        <Input
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Add a comment..."
                          className="h-8 text-xs pr-8"
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddComment() } }}
                        />
                        <div className="absolute right-1 top-1/2 -translate-y-1/2">
                          <SpeechButton
                            onTranscript={(text) => setNewComment((prev) => prev ? `${prev} ${text}` : text)}
                            size="sm"
                            showPulse={false}
                            tooltip="Dictate comment"
                          />
                        </div>
                      </div>
                      <Button size="sm" className="h-8 px-2" onClick={handleAddComment} disabled={!newComment.trim()}>
                        <Send className="size-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
      <SendTaskEmailDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        task={task}
      />
    </Dialog>
  )
}
