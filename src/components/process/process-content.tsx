"use client"

import { useState } from "react"
import { ListOrdered, Workflow } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StepsView } from "./steps-view"
import { FlowchartView } from "./flowchart-view"
import { useT } from "@/lib/hooks/use-i18n"
import type { processSteps } from "@/lib/db/schema"

type ProcessStep = typeof processSteps.$inferSelect

interface ProcessContentProps {
  processId: string
  steps: ProcessStep[]
}

export function ProcessContent({ processId, steps }: ProcessContentProps) {
  const [view, setView] = useState<"steps" | "flowchart">("steps")
  const { t } = useT()

  return (
    <div className="space-y-4">
      {/* View Toggle */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        <Button
          variant={view === "steps" ? "secondary" : "ghost"}
          size="sm"
          className="gap-1.5"
          onClick={() => setView("steps")}
        >
          <ListOrdered className="size-4" />
          {t("process.steps")}
        </Button>
        <Button
          variant={view === "flowchart" ? "secondary" : "ghost"}
          size="sm"
          className="gap-1.5"
          onClick={() => setView("flowchart")}
        >
          <Workflow className="size-4" />
          {t("process.flowchart")}
        </Button>
      </div>

      {view === "steps" ? (
        <StepsView processId={processId} steps={steps} />
      ) : (
        <FlowchartView processId={processId} steps={steps} />
      )}
    </div>
  )
}
