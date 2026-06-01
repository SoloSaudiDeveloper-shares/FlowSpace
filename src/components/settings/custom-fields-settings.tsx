"use client"

import { useState, useEffect, useTransition } from "react"
import {
  Plus,
  Trash2,
  Settings2,
  Tag,
  Hash,
  Calendar,
  CheckSquare,
  Link2,
  Mail,
  Type,
  List,
  ChevronDown,
  ChevronRight,
  X,
  Loader2,
  Globe,
  FolderKanban,
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
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  createField,
  getFields,
  deleteField,
  addFieldOption,
  addFieldScope,
  removeFieldOption,
} from "@/lib/actions/custom-field-actions"
import { SectionHelp } from "@/components/shared/section-help"
import { useT } from "@/lib/hooks/use-i18n"

const FIELD_TYPES = [
  { value: "text", labelKey: "settings.fields.type.text", icon: Type },
  { value: "long_text", labelKey: "settings.fields.type.longText", icon: Type },
  { value: "number", labelKey: "settings.fields.type.number", icon: Hash },
  { value: "date", labelKey: "settings.fields.type.date", icon: Calendar },
  { value: "checkbox", labelKey: "settings.fields.type.checkbox", icon: CheckSquare },
  { value: "select", labelKey: "settings.fields.type.select", icon: List },
  { value: "multi_select", labelKey: "settings.fields.type.multiSelect", icon: List },
  { value: "url", labelKey: "settings.fields.type.url", icon: Link2 },
  { value: "email", labelKey: "settings.fields.type.email", icon: Mail },
  { value: "rating", labelKey: "settings.fields.type.rating", icon: Tag },
] as const

type FieldType = (typeof FIELD_TYPES)[number]["value"]

const SCOPE_TYPES = [
  { value: "global", labelKey: "settings.fields.scope.global", icon: Globe },
  { value: "element_type", labelKey: "settings.fields.scope.elementType", icon: Settings2 },
  { value: "project", labelKey: "settings.fields.scope.project", icon: FolderKanban },
] as const

const ELEMENT_TYPES = [
  { value: "project", labelKey: "settings.fields.element.project" },
  { value: "page", labelKey: "settings.fields.element.page" },
  { value: "canvas", labelKey: "settings.fields.element.canvas" },
  { value: "todo_list", labelKey: "settings.fields.element.todoList" },
  { value: "reminder", labelKey: "settings.fields.element.reminder" },
  { value: "process", labelKey: "settings.fields.element.process" },
] as const

type FieldWithOptions = Awaited<ReturnType<typeof getFields>>[number]

function getFieldIcon(fieldType: string) {
  const found = FIELD_TYPES.find((f) => f.value === fieldType)
  return found?.icon ?? Type
}

function getFieldLabelKey(fieldType: string) {
  const found = FIELD_TYPES.find((f) => f.value === fieldType)
  return found?.labelKey ?? null
}

export function CustomFieldsSettings() {
  const { t } = useT()
  const [fields, setFields] = useState<FieldWithOptions[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [expandedField, setExpandedField] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Create form state
  const [newName, setNewName] = useState("")
  const [newType, setNewType] = useState<FieldType>("text")
  const [newRequired, setNewRequired] = useState(false)
  const [newScopeType, setNewScopeType] = useState<string>("global")
  const [newScopeValue, setNewScopeValue] = useState("")
  const [newOptions, setNewOptions] = useState<string[]>([])
  const [newOptionInput, setNewOptionInput] = useState("")

  async function loadFields() {
    try {
      const result = await getFields()
      setFields(result)
    } catch {
      toast.error(t("settings.fields.loadFailed"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFields()
  }, [])

  function resetForm() {
    setNewName("")
    setNewType("text")
    setNewRequired(false)
    setNewScopeType("global")
    setNewScopeValue("")
    setNewOptions([])
    setNewOptionInput("")
  }

  async function handleCreate() {
    if (!newName.trim()) {
      toast.error(t("settings.fields.nameRequired"))
      return
    }

    startTransition(async () => {
      try {
        const fieldId = await createField({
          name: newName.trim(),
          fieldType: newType,
          isRequired: newRequired,
        })

        // Add scope
        if (newScopeType === "global") {
          await addFieldScope(fieldId, "global")
        } else if (newScopeType === "element_type" && newScopeValue) {
          await addFieldScope(fieldId, "element_type", newScopeValue)
        } else if (newScopeType === "project" && newScopeValue) {
          await addFieldScope(fieldId, "project", newScopeValue)
        }

        // Add options for select/multi_select
        if ((newType === "select" || newType === "multi_select") && newOptions.length > 0) {
          for (let i = 0; i < newOptions.length; i++) {
            await addFieldOption(fieldId, { label: newOptions[i], sortOrder: i })
          }
        }

        toast.success(t("settings.fields.created").replace("{name}", newName))
        setCreateDialogOpen(false)
        resetForm()
        await loadFields()
      } catch {
        toast.error(t("settings.fields.createFailed"))
      }
    })
  }

  async function handleDelete(id: string, name: string) {
    startTransition(async () => {
      try {
        await deleteField(id)
        toast.success(t("settings.fields.deleted").replace("{name}", name))
        await loadFields()
      } catch {
        toast.error(t("settings.fields.deleteFailed"))
      }
    })
  }

  async function handleCreateExample() {
    // Seed a realistic example so the user can see one end-to-end.
    try {
      const fieldId = await createField({
        name: "Estimated hours",
        fieldType: "number",
        description: "How long you think this will take. Used by Gantt + capacity planning.",
        isRequired: false,
      })
      if (fieldId) {
        await addFieldScope(fieldId, "type", "task").catch(() => undefined)
      }
      toast.success(t("settings.fields.exampleCreated"))
      await loadFields()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.fields.exampleFailed"))
    }
  }

  function addOption() {
    const trimmed = newOptionInput.trim()
    if (!trimmed) return
    if (newOptions.includes(trimmed)) {
      toast.error(t("settings.fields.optionExists"))
      return
    }
    setNewOptions([...newOptions, trimmed])
    setNewOptionInput("")
  }

  const isSelectType = newType === "select" || newType === "multi_select"

  if (loading) {
    return (
      <section>
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <Settings2 className="size-4" />
          {t("settings.fields.title")}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t("settings.fields.loading")}
        </p>
      </section>
    )
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Settings2 className="size-4" />
          {t("settings.fields.title")}
        </h2>
        <div className="flex items-center gap-2.5">
          <SectionHelp guideId="customFields" />
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="size-3 mr-1.5" />
            {t("settings.fields.newField")}
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {t("settings.fields.subtitle")}
      </p>

      {/* Field list */}
      {fields.length === 0 ? (
        <div className="px-4 py-8 rounded-lg border bg-card text-center">
          <Settings2 className="size-8 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground mb-1">{t("settings.fields.emptyTitle")}</p>
          <p className="text-xs text-muted-foreground mb-4">
            {t("settings.fields.emptyDesc")}
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="size-3.5 mr-1.5" />
              {t("settings.fields.createField")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => startTransition(handleCreateExample)}
            >
              <Plus className="size-3.5 mr-1.5" />
              {t("settings.fields.createExample")}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground/70 mt-2">
            {t("settings.fields.exampleNote")}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {fields.map((field) => {
            const Icon = getFieldIcon(field.fieldType)
            const isExpanded = expandedField === field.id
            return (
              <div key={field.id} className="rounded-lg border bg-card overflow-hidden">
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/30 transition-colors"
                  onClick={() => setExpandedField(isExpanded ? null : field.id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                  )}
                  <Icon className="size-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{field.name}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {(() => { const k = getFieldLabelKey(field.fieldType); return k ? t(k) : field.fieldType })()}
                      </Badge>
                      {field.isRequired && (
                        <Badge variant="outline" className="text-[10px]">
                          {t("settings.fields.required")}
                        </Badge>
                      )}
                    </div>
                    {field.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {field.description}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                    disabled={isPending}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(field.id, field.name)
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-3 pt-1 border-t bg-muted/20">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">{t("settings.fields.type")}</span>{" "}
                        <span className="font-medium">{(() => { const k = getFieldLabelKey(field.fieldType); return k ? t(k) : field.fieldType })()}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t("settings.fields.requiredLabel")}</span>{" "}
                        <span className="font-medium">{field.isRequired ? t("settings.fields.yes") : t("settings.fields.no")}</span>
                      </div>
                      {field.groupName && (
                        <div>
                          <span className="text-muted-foreground">{t("settings.fields.group")}</span>{" "}
                          <span className="font-medium">{field.groupName}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">{t("settings.fields.createdAt")}</span>{" "}
                        <span className="font-medium">
                          {new Date(field.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Options for select fields */}
                    {field.options && field.options.length > 0 && (
                      <div className="mt-3">
                        <span className="text-xs text-muted-foreground">{t("settings.fields.options")}</span>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {field.options.map((opt) => (
                            <Badge
                              key={opt.id}
                              variant="secondary"
                              className="text-[10px]"
                              style={
                                opt.color
                                  ? { backgroundColor: opt.color, color: "#fff" }
                                  : undefined
                              }
                            >
                              {opt.label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create Field Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("settings.fields.dialog.title")}</DialogTitle>
            <DialogDescription>
              {t("settings.fields.dialog.desc")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Name */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t("settings.fields.name")}</label>
              <Input
                placeholder={t("settings.fields.namePlaceholder")}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>

            {/* Type */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t("settings.fields.fieldType")}</label>
              <div className="grid grid-cols-2 gap-2">
                {FIELD_TYPES.map((ft) => {
                  const FtIcon = ft.icon
                  const isActive = newType === ft.value
                  return (
                    <button
                      key={ft.value}
                      type="button"
                      onClick={() => setNewType(ft.value)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm transition-all text-left ${
                        isActive
                          ? "border-primary bg-primary/5 font-medium"
                          : "border-border hover:border-primary/50 hover:bg-accent/30"
                      }`}
                    >
                      <FtIcon className="size-3.5 shrink-0" />
                      {t(ft.labelKey)}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Options for select types */}
            {isSelectType && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  {t("settings.fields.optionsLabel")}
                </label>
                {newOptions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {newOptions.map((opt, i) => (
                      <Badge key={i} variant="secondary" className="text-xs gap-1">
                        {opt}
                        <button
                          type="button"
                          onClick={() => setNewOptions(newOptions.filter((_, idx) => idx !== i))}
                          className="hover:text-destructive"
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    placeholder={t("settings.fields.optionPlaceholder")}
                    value={newOptionInput}
                    onChange={(e) => setNewOptionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addOption()
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addOption}
                  >
                    {t("settings.fields.add")}
                  </Button>
                </div>
              </div>
            )}

            {/* Scope */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t("settings.fields.scope")}</label>
              <div className="space-y-2">
                {SCOPE_TYPES.map((scope) => {
                  const ScopeIcon = scope.icon
                  const isActive = newScopeType === scope.value
                  return (
                    <button
                      key={scope.value}
                      type="button"
                      onClick={() => {
                        setNewScopeType(scope.value)
                        setNewScopeValue("")
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm transition-all text-left ${
                        isActive
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50 hover:bg-accent/30"
                      }`}
                    >
                      <ScopeIcon className="size-3.5 shrink-0" />
                      {t(scope.labelKey)}
                    </button>
                  )
                })}
              </div>

              {/* Element type selector */}
              {newScopeType === "element_type" && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {ELEMENT_TYPES.map((et) => (
                    <button
                      key={et.value}
                      type="button"
                      onClick={() => setNewScopeValue(et.value)}
                      className={`px-3 py-1.5 rounded-md border text-xs transition-all ${
                        newScopeValue === et.value
                          ? "border-primary bg-primary/5 font-medium"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {t(et.labelKey)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Required toggle */}
            <div className="flex items-center justify-between">
              <span className="text-sm">{t("settings.fields.requiredField")}</span>
              <button
                type="button"
                role="switch"
                aria-checked={newRequired}
                onClick={() => setNewRequired(!newRequired)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  newRequired ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`inline-block size-4 transform rounded-full bg-white shadow-sm transition-transform ${
                    newRequired ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCreateDialogOpen(false)
                resetForm()
              }}
            >
              {t("settings.fields.cancel")}
            </Button>
            <Button
              size="sm"
              disabled={isPending || !newName.trim()}
              onClick={handleCreate}
            >
              {isPending ? (
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              ) : (
                <Plus className="size-3.5 mr-1.5" />
              )}
              {t("settings.fields.createField")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
