"use client"

export type ShapeCategory = "basic" | "flowchart"

export interface ShapeDef {
  id: string
  label: string
  category: ShapeCategory
}

export const SHAPES: ShapeDef[] = [
  // Basic
  { id: "rectangle",         label: "Rectangle",          category: "basic" },
  { id: "rounded-rect",      label: "Rounded Rect",       category: "basic" },
  { id: "circle",            label: "Circle",             category: "basic" },
  { id: "triangle",          label: "Triangle",           category: "basic" },
  { id: "diamond",           label: "Diamond",            category: "basic" },
  { id: "parallelogram",     label: "Parallelogram",      category: "basic" },
  { id: "hexagon",           label: "Hexagon",            category: "basic" },
  { id: "pentagon",          label: "Pentagon",           category: "basic" },
  { id: "octagon",           label: "Octagon",            category: "basic" },
  { id: "star",              label: "Star",               category: "basic" },
  { id: "arrow-right",       label: "Arrow Right",        category: "basic" },
  { id: "arrow-left",        label: "Arrow Left",         category: "basic" },
  { id: "arrow-double",      label: "Double Arrow",       category: "basic" },
  { id: "cross",             label: "Cross",              category: "basic" },
  { id: "speech-bubble",     label: "Speech Bubble",      category: "basic" },
  // Flowchart
  { id: "process",           label: "Process",            category: "flowchart" },
  { id: "decision",          label: "Decision",           category: "flowchart" },
  { id: "terminal",          label: "Terminal",           category: "flowchart" },
  { id: "data",              label: "Data / I/O",         category: "flowchart" },
  { id: "document",          label: "Document",           category: "flowchart" },
  { id: "predefined-process",label: "Predefined Process", category: "flowchart" },
  { id: "database",          label: "Database",           category: "flowchart" },
  { id: "manual-input",      label: "Manual Input",       category: "flowchart" },
  { id: "delay",             label: "Delay",              category: "flowchart" },
  { id: "preparation",       label: "Preparation",        category: "flowchart" },
  { id: "loop-limit",        label: "Loop Limit",         category: "flowchart" },
  { id: "display",           label: "Display",            category: "flowchart" },
]

interface ShapeElementProps {
  shapeId: string
  fill: string
  stroke: string
  strokeWidth?: number
}

export function ShapeElement({ shapeId, fill, stroke, strokeWidth = 3 }: ShapeElementProps) {
  const p = { fill, stroke, strokeWidth }

  switch (shapeId) {
    case "rectangle":
    case "process":
      return <rect x="2" y="2" width="96" height="96" {...p} />

    case "rounded-rect":
      return <rect x="2" y="2" width="96" height="96" rx="15" {...p} />

    case "circle":
      return <ellipse cx="50" cy="50" rx="48" ry="48" {...p} />

    case "triangle":
      return <polygon points="50,2 98,98 2,98" {...p} />

    case "diamond":
    case "decision":
      return <polygon points="50,2 98,50 50,98 2,50" {...p} />

    case "parallelogram":
    case "data":
      return <polygon points="20,2 98,2 80,98 2,98" {...p} />

    case "hexagon":
      return <polygon points="26,2 74,2 98,50 74,98 26,98 2,50" {...p} />

    case "pentagon":
      return <polygon points="50,2 98,38 80,98 20,98 2,38" {...p} />

    case "octagon":
      return <polygon points="29,2 71,2 98,29 98,71 71,98 29,98 2,71 2,29" {...p} />

    case "star":
      return <polygon points="50,2 61,35 98,35 68,57 79,93 50,72 21,93 32,57 2,35 39,35" {...p} />

    case "arrow-right":
      return <polygon points="2,30 65,30 65,10 98,50 65,90 65,70 2,70" {...p} />

    case "arrow-left":
      return <polygon points="98,30 35,30 35,10 2,50 35,90 35,70 98,70" {...p} />

    case "arrow-double":
      return <polygon points="2,50 20,25 20,40 80,40 80,25 98,50 80,75 80,60 20,60 20,75" {...p} />

    case "cross":
      return <polygon points="35,2 65,2 65,35 98,35 98,65 65,65 65,98 35,98 35,65 2,65 2,35 35,35" {...p} />

    case "speech-bubble":
      return <path d="M10,2 Q2,2 2,10 L2,65 Q2,73 10,73 L35,73 L25,95 L50,73 L90,73 Q98,73 98,65 L98,10 Q98,2 90,2 Z" {...p} />

    case "terminal":
      return <rect x="2" y="25" width="96" height="50" rx="25" {...p} />

    case "document":
      return <path d="M2,2 L98,2 L98,78 Q75,98 50,78 Q25,58 2,78 Z" {...p} />

    case "predefined-process":
      return (
        <>
          <rect x="2" y="2" width="96" height="96" {...p} />
          <line x1="18" y1="2" x2="18" y2="98" stroke={stroke} strokeWidth={strokeWidth} />
          <line x1="82" y1="2" x2="82" y2="98" stroke={stroke} strokeWidth={strokeWidth} />
        </>
      )

    case "database":
      return (
        <>
          <rect x="2" y="22" width="96" height="56" fill={fill} stroke="none" />
          <ellipse cx="50" cy="78" rx="48" ry="18" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
          <line x1="2" y1="22" x2="2" y2="78" stroke={stroke} strokeWidth={strokeWidth} />
          <line x1="98" y1="22" x2="98" y2="78" stroke={stroke} strokeWidth={strokeWidth} />
          <ellipse cx="50" cy="22" rx="48" ry="18" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        </>
      )

    case "manual-input":
      return <polygon points="2,28 98,2 98,98 2,98" {...p} />

    case "delay":
      return <path d="M2,2 L65,2 Q98,2 98,50 Q98,98 65,98 L2,98 Z" {...p} />

    case "preparation":
      return <polygon points="2,50 20,2 80,2 98,50 80,98 20,98" {...p} />

    case "loop-limit":
      return <polygon points="2,35 30,2 70,2 98,35 98,98 2,98" {...p} />

    case "display":
      return <path d="M25,2 L90,2 Q98,2 98,50 Q98,98 90,98 L25,98 L2,50 Z" {...p} />

    default:
      return <rect x="2" y="2" width="96" height="96" {...p} />
  }
}
