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

const FIELD_TYPES = [
  { value: "text", label: "Text", icon: Type },
  { value: "long_text", label: "Long Text", icon: Type },
  { value: "number", label: "Number", icon: Hash },
  { value: "date", label: "Date", icon: Calendar },
  { value: "checkbox", label: "Checkbox", icon: CheckSquare },
  { value: "select", label: "Select", icon: List },
  { value: "multi_select", label: "Multi Select", icon: List },
  { value: "url", label: "URL", icon: Link2 },
  { value: "email", label: "Email", icon: Mail },
  { value: "rating", label: "Rating", icon: Tag },
] as const

type FieldType = (typeof FIELD_TYPES)[number]["value"]

const SCOPE_TYPES = [
  { value: "global", label: "All Elements", icon: Globe },
  { value: "element_type", label: "Element Type", icon: Settings2 },
  { value: "project", label: "Specific Project", icon: FolderKanban },
] as const

const ELEMENT_TYPES = [
  { value: "project", label: "Projects" },
  { value: "page", label: "Pages" },
  { value: "canvas", label: "Canvases" },
  { value: "todo_list", label: "Todo Lists" },
  { value: "reminder", label: "Reminders" },
  { value: "process", label: "Processes" },
] as const

type FieldWithOptions = Awaited<ReturnType<typeof getFields>>[number]

function getFieldIcon(fieldType: string) {
  const found = FIELD_TYPES.find((f) => f.value === fieldType)
  return found?.icon ?? Type
}

function getFieldLabel(fieldType: string) {
  const found = FIELD_TYPES.find((f) => f.value === fieldType)
  return found?.label ?? fieldType
}

export function CustomFieldsSettings() {
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
      toast.error("Failed to load custom fields")
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
      toast.error("Field name is required")
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

        toast.success(`Field "${newName}" created`)
        setCreateDialogOpen(false)
        resetForm()
        await loadFields()
      } catch {
        toast.error("Failed to create field")
      }
    })
  }

  async function handleDelete(id: string, name: string) {
    startTransition(async () => {
      try {
        await deleteField(id)
        toast.success(`Field "${name}" deleted`)
        await loadFields()
      } catch {
        toast.error("Failed to delete field")
      }
    })
  }

  function addOption() {
    const trimmed = newOptionInput.trim()
    if (!trimmed) return
    if (newOptions.includes(trimmed)) {
      toast.error("Option already exists")
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
          Custom Fields
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Loading custom fields...
        </p>
      </section>
    )
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Settings2 className="size-4" />
          Custom Fields
        </h2>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setCreateDialogOpen(true)}
        >
          <Plus className="size-3 mr-1.5" />
          New Field
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Define custom metadata fields for your elements and tasks.
      </p>

      {/* Field list */}
      {fields.length === 0 ? (
        <div className="px-4 py-8 rounded-lg border bg-card text-center">
          <Settings2 className="size-8 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground mb-1">No custom fields yet</p>
          <p className="text-xs text-muted-foreground mb-4">
            Create your first custom field to add structured metadata to your elements.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="size-3.5 mr-1.5" />
            Create Field
          </Button>
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
                        {getFieldLabel(field.fieldType)}
                      </Badge>
                      {field.isRequired && (
                        <Badge variant="outline" className="text-[10px]">
                          Required
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
                        <span className="text-muted-foreground">Type:</span>{" "}
                        <span className="font-medium">{getFieldLabel(field.fieldType)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Required:</span>{" "}
                        <span className="font-medium">{field.isRequired ? "Yes" : "No"}</span>
                      </div>
                      {field.groupName && (
                        <div>
                          <span className="text-muted-foreground">Group:</span>{" "}
                          <span className="font-medium">{field.groupName}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Created:</span>{" "}
                        <span className="font-medium">
                          {new Date(field.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Options for select fields */}
                    {field.options && field.options.length > 0 && (
                      <div className="mt-3">
                        <span className="text-xs text-muted-foreground">Options:</span>
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
            <DialogTitle>Create Custom Field</DialogTitle>
            <DialogDescription>
              Add a new custom field to your workspace. Fields appear on elements matching the chosen scope.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Name */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Name</label>
              <Input
                placeholder="e.g. Priority Level, Budget, Client..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>

            {/* Type */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Field Type</label>
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
                      {ft.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Options for select types */}
            {isSelectType && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Options
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
                    placeholder="Add an option..."
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
                    Add
                  </Button>
                </div>
              </div>
            )}

            {/* Scope */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Scope</label>
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
                      {scope.label}
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
                      {et.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Required toggle */}
            <div className="flex items-center justify-between">
              <span className="text-sm">Required field</span>
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
              Cancel
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
              Create Field
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
