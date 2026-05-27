"use client"

import { useRouter } from "next/navigation"
import { FolderKanban } from "lucide-react"
import type { Element } from "@/lib/db/schema"

interface SubProjectBarProps {
  parentId: string
  subProjects: Element[]
}

export function SubProjectBar({ subProjects }: SubProjectBarProps) {
  const router = useRouter()

  return (
    <div className="flex items-center gap-1 px-4 py-1.5 border-b bg-muted/20 overflow-x-auto shrink-0">
      <span className="text-xs text-muted-foreground mr-1 shrink-0">Sub-projects:</span>
      {subProjects.map((sp) => (
        <button
          key={sp.id}
          onClick={() => router.push(`/projects/${sp.id}`)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-card border hover:bg-accent transition-colors shrink-0"
          style={{ color: sp.color ?? undefined }}
        >
          <FolderKanban className="size-3" />
          {sp.title}
        </button>
      ))}
    </div>
  )
}
