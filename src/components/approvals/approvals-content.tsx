"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  ShieldCheck,
  ShieldX,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MessageSquare,
  Send,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  createApproval,
  resolveApproval,
  deleteApproval,
} from "@/lib/actions/approval-actions"
import { toast } from "sonner"
import { useT } from "@/lib/hooks/use-i18n"
import type { User } from "@/lib/db/schema"

type ApprovalWithRequester = {
  approval: {
    id: string
    elementId: string | null
    taskId: string | null
    requestedBy: string
    assignedTo: string
    status: string
    comment: string | null
    resolvedAt: string | null
    createdAt: string
  }
  requester: User
}

const STATUS_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  pending: { icon: Clock, color: "text-amber-500", label: "Pending" },
  approved: { icon: CheckCircle2, color: "text-green-500", label: "Approved" },
  rejected: { icon: XCircle, color: "text-red-500", label: "Rejected" },
  changes_requested: { icon: AlertTriangle, color: "text-orange-500", label: "Changes Requested" },
}

const TABS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
] as const

type TabId = (typeof TABS)[number]["id"]

interface ApprovalsContentProps {
  approvals: ApprovalWithRequester[]
  users: User[]
}

export function ApprovalsContent({ approvals: allApprovals, users }: ApprovalsContentProps) {
  const router = useRouter()
  const { t } = useT()
  // Localized display labels keyed by status / tab id (logic ids stay as-is).
  const statusLabel = (id: string) => t(`auto.approval.status.${id}`)
  const tabLabel = (id: string) => t(`auto.approval.tab.${id}`)
  const [activeTab, setActiveTab] = useState<TabId>("all")
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false)
  const [selectedApproval, setSelectedApproval] = useState<ApprovalWithRequester | null>(null)
  const [resolveComment, setResolveComment] = useState("")

  // New approval dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newAssignee, setNewAssignee] = useState("")
  const [newComment, setNewComment] = useState("")

  const filtered = activeTab === "all"
    ? allApprovals
    : allApprovals.filter((a) => a.approval.status === activeTab)

  const pendingCount = allApprovals.filter((a) => a.approval.status === "pending").length

  function openResolve(item: ApprovalWithRequester) {
    setSelectedApproval(item)
    setResolveComment("")
    setResolveDialogOpen(true)
  }

  async function handleResolve(status: "approved" | "rejected" | "changes_requested") {
    if (!selectedApproval) return
    try {
      await resolveApproval(selectedApproval.approval.id, status, resolveComment || undefined)
      toast.success(
        t("auto.approval.toast.resolved").replace(
          "{status}",
          t(`auto.approval.resolvedStatus.${status}`)
        )
      )
      setResolveDialogOpen(false)
      setSelectedApproval(null)
      router.refresh()
    } catch {
      toast.error(t("auto.approval.toast.resolveFailed"))
    }
  }

  async function handleCreate() {
    if (!newAssignee) {
      toast.error(t("auto.approval.toast.selectAssignee"))
      return
    }
    try {
      await createApproval({
        assignedTo: newAssignee,
        comment: newComment || undefined,
      })
      toast.success(t("auto.approval.toast.created"))
      setCreateDialogOpen(false)
      setNewAssignee("")
      setNewComment("")
      router.refresh()
    } catch {
      toast.error(t("auto.approval.toast.createFailed"))
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteApproval(id)
      toast.success(t("auto.approval.toast.deleted"))
      router.refresh()
    } catch {
      toast.error(t("auto.approval.toast.deleteFailed"))
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
          {TABS.map((tab) => {
            const count = tab.id === "all"
              ? allApprovals.length
              : allApprovals.filter((a) => a.approval.status === tab.id).length
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tabLabel(tab.id)}
                {count > 0 && (
                  <span className="bg-primary/10 text-primary text-[10px] rounded-full px-1.5 min-w-[18px] text-center">
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setCreateDialogOpen(true)}>
          <Send className="size-4" />
          {t("auto.approval.request")}
        </Button>
      </div>

      {/* Pending banner */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <ShieldCheck className="size-5 text-amber-500 shrink-0" />
          <p className="text-sm">
            {(pendingCount > 1 ? t("auto.approval.banner.many") : t("auto.approval.banner.one"))
              .split("{count}")
              .flatMap((part, i) =>
                i === 0
                  ? [part]
                  : [
                      <span key="count" className="font-semibold">
                        {pendingCount}
                      </span>,
                      part,
                    ]
              )}
          </p>
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <ShieldX className="size-12 mb-3 opacity-30" />
          <p className="text-sm">{t("auto.approval.empty.title")}</p>
          <p className="text-xs mt-1">{t("auto.approval.empty.desc")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(({ approval, requester }) => {
            const config = STATUS_CONFIG[approval.status] ?? STATUS_CONFIG.pending
            const Icon = config.icon
            const labelStatus = STATUS_CONFIG[approval.status] ? approval.status : "pending"
            return (
              <div
                key={approval.id}
                className="flex items-start gap-3 px-4 py-3 rounded-lg border bg-card transition-colors hover:border-primary/20"
              >
                <div className={`shrink-0 mt-0.5 ${config.color}`}>
                  <Icon className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">
                      {t("auto.approval.from").replace("{name}", requester.displayName)}
                    </p>
                    <Badge variant="outline" className={`text-[10px] ${config.color}`}>
                      {statusLabel(labelStatus)}
                    </Badge>
                  </div>
                  {approval.comment && (
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <MessageSquare className="size-3" />
                      {approval.comment}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(approval.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {approval.resolvedAt && (
                      <span>
                        {t("auto.approval.resolved").replace(
                          "{date}",
                          new Date(approval.resolvedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })
                        )}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {approval.status === "pending" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => openResolve({ approval, requester })}
                    >
                      {t("auto.approval.review")}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Resolve Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("auto.approval.reviewTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              {t("auto.approval.requestedBy")
                .split("{name}")
                .flatMap((part, i) =>
                  i === 0
                    ? [part]
                    : [
                        <span key="name" className="font-medium text-foreground">
                          {selectedApproval?.requester.displayName}
                        </span>,
                        part,
                      ]
                )}
            </p>
            {selectedApproval?.approval.comment && (
              <div className="p-3 rounded-md bg-muted text-sm">
                {selectedApproval.approval.comment}
              </div>
            )}
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t("auto.approval.commentOptional")}</label>
              <Input
                placeholder={t("auto.approval.commentPh")}
                value={resolveComment}
                onChange={(e) => setResolveComment(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-orange-500 border-orange-500/30 hover:bg-orange-500/10"
              onClick={() => handleResolve("changes_requested")}
            >
              {t("auto.approval.requestChanges")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-500 border-red-500/30 hover:bg-red-500/10"
              onClick={() => handleResolve("rejected")}
            >
              {t("auto.approval.reject")}
            </Button>
            <Button
              size="sm"
              onClick={() => handleResolve("approved")}
            >
              {t("auto.approval.approve")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Approval Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("auto.approval.request")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t("auto.approval.assignTo")}</label>
              <select
                value={newAssignee}
                onChange={(e) => setNewAssignee(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">{t("auto.approval.selectUser")}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName} (@{u.username})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t("auto.approval.comment")}</label>
              <Input
                placeholder={t("auto.approval.createCommentPh")}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              {t("auto.approval.cancel")}
            </Button>
            <Button onClick={handleCreate}>{t("auto.approval.sendRequest")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
