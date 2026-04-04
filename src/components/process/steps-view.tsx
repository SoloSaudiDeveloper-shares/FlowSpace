"use client"

import { useState } from "react"
import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  createProcessStep,
  updateProcessStep,
  deleteProcessStep,
} from "@/lib/actions/process-actions"
import type { processSteps } from "@/lib/db/schema"

type ProcessStep = typeof processSteps.$inferSelect

interface StepsViewProps {
  processId: string
  steps: ProcessStep[]
}

export function StepsView({ processId, steps }: StepsViewProps) {
  const [newTitle, setNewTitle] = useState("")

  const completedCount = steps.filter((s) => s.isCompleted).length
  const progress = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0

  async function handleAdd() {
    if (!newTitle.trim()) return
    await createProcessStep(processId, newTitle.trim())
    setNewTitle("")
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      {steps.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-sm text-muted-foreground font-medium">
            {completedCount}/{steps.length}
          </span>
        </div>
      )}

      {/* Steps */}
      <div className="space-y-2">
        {steps.map((step, index) => (
          <StepItem key={step.id} step={step} index={index} processId={processId} />
        ))}
      </div>

      {/* Add step */}
      <div className="flex gap-2">
        <Input
          placeholder="Add a new step..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd() }}
        />
        <Button onClick={handleAdd} size="icon" variant="outline">
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  )
}

function StepItem({
  step,
  index,
  processId,
}: {
  step: ProcessStep
  index: number
  processId: string
}) {
  const [expanded, setExpanded] = useState(false)
  const [title, setTitle] = useState(step.title)
  const [description, setDescription] = useState(step.description ?? "")

  return (
    <div className={`rounded-lg border transition-colors ${step.isCompleted ? "bg-muted/50" : ""}`}>
      <div className="flex items-center gap-3 p-3">
        <GripVertical className="size-4 text-muted-foreground cursor-grab shrink-0" />
        <div
          className={`flex items-center justify-center size-6 rounded-full border-2 text-xs font-bold shrink-0 cursor-pointer transition-colors ${
            step.isCompleted
              ? "bg-green-500 border-green-500 text-white"
              : "border-muted-foreground/30 text-muted-foreground hover:border-green-500"
          }`}
          onClick={() =>
            updateProcessStep(step.id, processId, {
              isCompleted: !step.isCompleted,
            })
          }
        >
          {step.isCompleted ? "✓" : index + 1}
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (title !== step.title) {
              updateProcessStep(step.id, processId, { title: title || "Untitled" })
            }
          }}
          className={`flex-1 bg-transparent outline-none text-sm font-medium ${
            step.isCompleted ? "line-through text-muted-foreground" : ""
          }`}
        />
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-destructive"
          onClick={() => deleteProcessStep(step.id, processId)}
        >
          <Trash2 className="size-3" />
        </Button>
      </div>
      {expanded && (
        <div className="px-3 pb-3 pl-14">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => {
              if (description !== (step.description ?? "")) {
                updateProcessStep(step.id, processId, { description })
              }
            }}
            placeholder="Add details for this step..."
            className="w-full bg-transparent text-sm text-muted-foreground outline-none resize-none min-h-[60px] placeholder:text-muted-foreground/50"
          />
        </div>
      )}
    </div>
  )
}
