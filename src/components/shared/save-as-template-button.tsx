"use client"

import { useState } from "react"
import { BookTemplate, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Hint } from "@/components/shared/hint"
import { useT } from "@/lib/hooks/use-i18n"
import { saveElementAsTemplate } from "@/lib/actions/save-as-template-actions"

interface Props {
  /** Any element id — project, canvas, todo list, process, or page. */
  elementId: string
  initialName?: string
}

export function SaveAsTemplateButton({ elementId, initialName }: Props) {
  const router = useRouter()
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(initialName ?? "")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const r = await saveElementAsTemplate({
        elementId,
        templateName: name.trim(),
        templateDescription: description.trim() || undefined,
      })
      if (r.ok) {
        toast.success(t("shared.template.saved"))
        setOpen(false)
        router.push(`/templates#${r.templateId}`)
      } else {
        toast.error(r.error)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Hint label={t("shared.template.hint")} delay={350}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setName(initialName ?? "")
            setDescription("")
            setOpen(true)
          }}
          className="size-8"
        >
          <BookTemplate className="size-3.5" />
        </Button>
      </Hint>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookTemplate className="size-4 text-primary" />
              {t("shared.template.dialogTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("shared.template.dialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                {t("shared.template.nameLabel")}
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("shared.template.namePlaceholder")}
                maxLength={100}
                autoFocus
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                {t("shared.template.descLabel")} <span className="opacity-50">{t("shared.template.optional")}</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder={t("shared.template.descPlaceholder")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              {t("shared.template.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={!name.trim() || saving}>
              {saving ? (
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              ) : (
                <BookTemplate className="size-3.5 mr-1.5" />
              )}
              {saving ? t("shared.template.saving") : t("shared.template.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
