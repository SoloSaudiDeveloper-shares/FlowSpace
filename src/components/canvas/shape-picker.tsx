"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, X } from "lucide-react"
import { SHAPES, ShapeElement, type ShapeDef } from "./shapes"
import { useT } from "@/lib/hooks/use-i18n"

interface ShapePickerProps {
  onSelect: (shapeId: string) => void
  onClose: () => void
}

export function ShapePicker({ onSelect, onClose }: ShapePickerProps) {
  const { t } = useT()
  const [basicOpen, setBasicOpen] = useState(true)
  const [flowchartOpen, setFlowchartOpen] = useState(true)

  const basicShapes = SHAPES.filter((s) => s.category === "basic")
  const flowchartShapes = SHAPES.filter((s) => s.category === "flowchart")

  return (
    <div className="fixed z-50 left-4 top-20 w-56 bg-background border rounded-lg shadow-xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
        <span className="text-sm font-medium">{t("canvas.shapes")}</span>
        <button
          onClick={onClose}
          className="size-5 flex items-center justify-center rounded hover:bg-accent"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="overflow-y-auto max-h-[70vh] p-2 space-y-2">
        {/* Basic Shapes */}
        <div>
          <button
            className="flex items-center gap-1 w-full text-xs font-medium text-muted-foreground hover:text-foreground py-1 px-1"
            onClick={() => setBasicOpen((v) => !v)}
          >
            {basicOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            {t("canvas.shapes.basic")}
          </button>
          {basicOpen && (
            <div className="grid grid-cols-5 gap-0.5 mt-1">
              {basicShapes.map((shape) => (
                <ShapeIcon key={shape.id} shape={shape} onSelect={onSelect} label={t("canvas.shape." + shape.id)} />
              ))}
            </div>
          )}
        </div>

        {/* Flowchart */}
        <div>
          <button
            className="flex items-center gap-1 w-full text-xs font-medium text-muted-foreground hover:text-foreground py-1 px-1"
            onClick={() => setFlowchartOpen((v) => !v)}
          >
            {flowchartOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            {t("canvas.shapes.flowchart")}
          </button>
          {flowchartOpen && (
            <div className="grid grid-cols-5 gap-0.5 mt-1">
              {flowchartShapes.map((shape) => (
                <ShapeIcon key={shape.id} shape={shape} onSelect={onSelect} label={t("canvas.shape." + shape.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ShapeIcon({ shape, onSelect, label }: { shape: ShapeDef; onSelect: (id: string) => void; label: string }) {
  return (
    <button
      title={label}
      onClick={() => onSelect(shape.id)}
      className="flex items-center justify-center rounded hover:bg-accent p-1 aspect-square"
    >
      <svg viewBox="0 0 100 100" className="w-7 h-7">
        <ShapeElement shapeId={shape.id} fill="#6366f122" stroke="#6366f1" strokeWidth={5} />
      </svg>
    </button>
  )
}
