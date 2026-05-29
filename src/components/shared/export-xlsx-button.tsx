"use client"

/**
 * "Export to Excel" button for todo lists.
 *
 * Two paths:
 *  - Click → download the .xlsx straight to the user's computer
 *  - Click the chevron → "Email this list as Excel" — opens a small
 *    dialog asking for the recipient, then sends the file as an
 *    attachment through the existing email transport.
 *
 * The download path returns base64 from the server action; we decode it
 * client-side into a Blob and trigger a download via an <a> click.
 * Avoids needing a separate API route for the file response.
 */

import { useState } from "react"
import { FileSpreadsheet, Loader2, Mail, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Hint } from "@/components/shared/hint"
import {
  getTodoListXlsx,
  emailTodoListXlsx,
} from "@/lib/actions/todo-export-actions"

interface Props {
  listId: string
}

export function ExportXlsxButton({ listId }: Props) {
  const [downloading, setDownloading] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailTo, setEmailTo] = useState("")
  const [sending, setSending] = useState(false)

  async function handleDownload() {
    if (downloading) return
    setDownloading(true)
    try {
      const r = await getTodoListXlsx(listId)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      // Decode base64 → Blob → click an anchor to download
      const binary = atob(r.base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = r.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`Downloaded "${r.filename}"`)
    } catch {
      toast.error("Couldn't build the spreadsheet.")
    } finally {
      setDownloading(false)
    }
  }

  async function handleSendEmail() {
    if (!emailTo.trim() || sending) return
    setSending(true)
    try {
      const r = await emailTodoListXlsx(listId, emailTo.trim())
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(`Spreadsheet sent to ${emailTo.trim()}`)
      setEmailOpen(false)
      setEmailTo("")
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div className="inline-flex items-center">
        <Hint label="Download as Excel" delay={350}>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-r-none"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="size-3.5" />
            )}
          </Button>
        </Hint>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex items-center justify-center size-7 rounded-l-none -ml-px text-muted-foreground/60 hover:text-foreground hover:bg-accent rounded-md"
            aria-label="Export options"
          >
            <ChevronDown className="size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={handleDownload}>
              <FileSpreadsheet className="size-3.5 mr-2" />
              Download .xlsx
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setEmailOpen(true)}>
              <Mail className="size-3.5 mr-2" />
              Email as Excel…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="size-4 text-primary" />
              Email list as Excel
            </DialogTitle>
            <DialogDescription>
              Send the spreadsheet to anyone — no FlowSpace account
              needed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Recipient email
              </label>
              <Input
                type="email"
                placeholder="name@example.com"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setEmailOpen(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={
                !emailTo.trim() ||
                sending ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTo.trim())
              }
            >
              {sending ? (
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              ) : (
                <Mail className="size-3.5 mr-1.5" />
              )}
              {sending ? "Sending…" : "Send"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
