"use client"

import { useState, useEffect, useTransition } from "react"
import {
  Settings2,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Loader2,
  Type,
  Hash,
  Calendar,
  CheckSquare,
  Link2,
  Mail,
  List,
  Tag,
  Star,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useT } from "@/lib/hooks/use-i18n"
import {
  getFieldsForEntity,
  setFieldValue,
} from "@/lib/actions/custom-field-actions"

const FIELD_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  text: Type,
  long_text: Type,
  number: Hash,
  currency: Hash,
  date: Calendar,
  date_range: Calendar,
  checkbox: CheckSquare,
  select: List,
  multi_select: List,
  url: Link2,
  email: Mail,
  phone: Type,
  rating: Star,
  user: Type,
  team: Type,
  formula: Hash,
  relation: Tag,
}

type FieldOption = {
  id: string
  fieldId: string
  label: string
  color: string | null
  sortOrder: number
}

type FieldWithValue = {
  id: string
  name: string
  description: string | null
  fieldType: string
  icon: string | null
  color: string | null
  config: string | null
  isRequired: boolean
  sortOrder: number
  groupName: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
  options: FieldOption[]
  currentValue: {
    id: string
    fieldId: string
    entityType: string
    entityId: string
    value: string | null
    createdAt: string
    updatedAt: string
  } | null
}

interface CustomFieldsPanelProps {
  entityType: "element" | "task"
  entityId: string
  projectId?: string
}

export function CustomFieldsPanel({
  entityType,
  entityId,
  projectId,
}: CustomFieldsPanelProps) {
  const { t } = useT()
  const [fields, setFields] = useState<FieldWithValue[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(true)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [isPending, startTransition] = useTransition()

  async function loadFields() {
    try {
      const result = await getFieldsForEntity(entityType, entityId, projectId)
      setFields(result as FieldWithValue[])
    } catch {
      // Silently fail - custom fields are optional
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFields()
  }, [entityType, entityId, projectId])

  function startEditing(field: FieldWithValue) {
    setEditingField(field.id)
    setEditValue(field.currentValue?.value ?? "")
  }

  function cancelEditing() {
    setEditingField(null)
    setEditValue("")
  }

  async function saveValue(fieldId: string) {
    startTransition(async () => {
      try {
        await setFieldValue({
          fieldId,
          entityType,
          entityId,
          value: editValue || null,
        })
        setEditingField(null)
        setEditValue("")
        await loadFields()
      } catch {
        toast.error(t("shared.customFields.failSaveValue"))
      }
    })
  }

  async function handleCheckboxToggle(field: FieldWithValue) {
    const newValue = field.currentValue?.value === "true" ? "false" : "true"
    startTransition(async () => {
      try {
        await setFieldValue({
          fieldId: field.id,
          entityType,
          entityId,
          value: newValue,
        })
        await loadFields()
      } catch {
        toast.error(t("shared.customFields.failUpdateField"))
      }
    })
  }

  async function handleSelectValue(fieldId: string, value: string) {
    startTransition(async () => {
      try {
        await setFieldValue({
          fieldId,
          entityType,
          entityId,
          value,
        })
        setEditingField(null)
        await loadFields()
      } catch {
        toast.error(t("shared.customFields.failSaveValue"))
      }
    })
  }

  async function handleRatingClick(field: FieldWithValue, rating: number) {
    const currentRating = parseInt(field.currentValue?.value ?? "0", 10)
    const newValue = currentRating === rating ? "0" : String(rating)
    startTransition(async () => {
      try {
        await setFieldValue({
          fieldId: field.id,
          entityType,
          entityId,
          value: newValue,
        })
        await loadFields()
      } catch {
        toast.error(t("shared.customFields.failUpdateRating"))
      }
    })
  }

  if (loading) return null
  if (fields.length === 0) return null

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        className="flex items-center gap-2 w-full px-4 py-2.5 text-left hover:bg-accent/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3.5 text-muted-foreground" />
        )}
        <Settings2 className="size-3.5 text-muted-foreground" />
        <span className="text-sm font-medium">{t("shared.customFields.title")}</span>
        <Badge variant="secondary" className="text-[10px] ml-auto">
          {fields.length}
        </Badge>
      </button>

      {expanded && (
        <div className="border-t">
          {fields.map((field) => {
            const Icon = FIELD_TYPE_ICONS[field.fieldType] ?? Type
            const isEditing = editingField === field.id
            const displayValue = field.currentValue?.value

            return (
              <div
                key={field.id}
                className="flex items-start gap-3 px-4 py-2 border-b last:border-b-0 min-h-[40px]"
              >
                <div className="flex items-center gap-2 min-w-[120px] shrink-0 pt-0.5">
                  <Icon className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground truncate">
                    {field.name}
                    {field.isRequired && <span className="text-destructive ml-0.5">*</span>}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  {/* Checkbox field */}
                  {field.fieldType === "checkbox" && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleCheckboxToggle(field)}
                      className={`size-4 rounded border-2 flex items-center justify-center transition-colors ${
                        displayValue === "true"
                          ? "bg-primary border-primary"
                          : "border-muted-foreground/30 hover:border-primary"
                      }`}
                    >
                      {displayValue === "true" && (
                        <Check className="size-3 text-primary-foreground" />
                      )}
                    </button>
                  )}

                  {/* Rating field */}
                  {field.fieldType === "rating" && (
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => {
                        const currentRating = parseInt(displayValue ?? "0", 10)
                        return (
                          <button
                            key={star}
                            type="button"
                            disabled={isPending}
                            onClick={() => handleRatingClick(field, star)}
                            className="p-0"
                          >
                            <Star
                              className={`size-4 transition-colors ${
                                star <= currentRating
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-muted-foreground/30 hover:text-yellow-400/50"
                              }`}
                            />
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Select field */}
                  {(field.fieldType === "select" || field.fieldType === "multi_select") && (
                    <>
                      {isEditing ? (
                        <div className="flex flex-wrap gap-1.5">
                          {field.options.map((opt) => {
                            const isSelected = displayValue === opt.label
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                disabled={isPending}
                                onClick={() => handleSelectValue(field.id, opt.label)}
                                className={`px-2 py-0.5 rounded-md text-xs border transition-all ${
                                  isSelected
                                    ? "border-primary bg-primary/10 font-medium"
                                    : "border-border hover:border-primary/50"
                                }`}
                                style={
                                  opt.color && isSelected
                                    ? { backgroundColor: opt.color, color: "#fff", borderColor: opt.color }
                                    : undefined
                                }
                              >
                                {opt.label}
                              </button>
                            )
                          })}
                          <button
                            type="button"
                            onClick={cancelEditing}
                            className="p-0.5 hover:text-destructive"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditing(field)}
                          className="text-xs text-left hover:bg-accent/30 rounded px-1.5 py-0.5 -ml-1.5 transition-colors"
                        >
                          {displayValue ? (
                            <Badge variant="secondary" className="text-[10px]">
                              {displayValue}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground/50">{t("shared.customFields.selectPlaceholder")}</span>
                          )}
                        </button>
                      )}
                    </>
                  )}

                  {/* Text-based fields */}
                  {field.fieldType !== "checkbox" &&
                    field.fieldType !== "rating" &&
                    field.fieldType !== "select" &&
                    field.fieldType !== "multi_select" && (
                      <>
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <Input
                              type={
                                field.fieldType === "number" || field.fieldType === "currency"
                                  ? "number"
                                  : field.fieldType === "date" || field.fieldType === "date_range"
                                    ? "date"
                                    : field.fieldType === "email"
                                      ? "email"
                                      : field.fieldType === "url"
                                        ? "url"
                                        : "text"
                              }
                              className="h-7 text-xs"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveValue(field.id)
                                if (e.key === "Escape") cancelEditing()
                              }}
                              autoFocus
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 shrink-0"
                              disabled={isPending}
                              onClick={() => saveValue(field.id)}
                            >
                              {isPending ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <Check className="size-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 shrink-0"
                              onClick={cancelEditing}
                            >
                              <X className="size-3" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditing(field)}
                            className="text-xs text-left w-full hover:bg-accent/30 rounded px-1.5 py-0.5 -ml-1.5 transition-colors truncate"
                          >
                            {displayValue ? (
                              <span>
                                {field.fieldType === "url" ? (
                                  <a
                                    href={displayValue}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-primary underline underline-offset-2"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {displayValue}
                                  </a>
                                ) : field.fieldType === "email" ? (
                                  <a
                                    href={`mailto:${displayValue}`}
                                    className="text-primary underline underline-offset-2"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {displayValue}
                                  </a>
                                ) : (
                                  displayValue
                                )}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/50">
                                {field.fieldType === "date" || field.fieldType === "date_range"
                                  ? t("shared.customFields.setDate")
                                  : field.fieldType === "number" || field.fieldType === "currency"
                                    ? "0"
                                    : t("shared.customFields.empty")}
                              </span>
                            )}
                          </button>
                        )}
                      </>
                    )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
