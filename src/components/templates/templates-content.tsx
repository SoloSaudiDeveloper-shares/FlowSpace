"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  Plus,
  Star,
  Copy,
  Trash2,
  MoreHorizontal,
  FolderKanban,
  CheckSquare,
  FileText,
  Layout,
  GitBranch,
  ListChecks,
  LayoutDashboard,
  FormInput,
  Clock,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  createTemplate,
  createFromTemplate,
  deleteTemplate,
  toggleTemplateFavorite,
  duplicateTemplate,
} from "@/lib/actions/template-actions"
import { toast } from "sonner"
import type { templates } from "@/lib/db/schema"

type Template = typeof templates.$inferSelect

type TemplateType = Template["type"]

const TEMPLATE_TYPES: { value: TemplateType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "project", label: "Project" },
  { value: "task", label: "Task" },
  { value: "page", label: "Page" },
  { value: "canvas", label: "Canvas" },
  { value: "process", label: "Process" },
  { value: "checklist", label: "Checklist" },
]

const TYPE_BADGE_COLORS: Record<string, string> = {
  project: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
  task: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  page: "bg-violet-500/15 text-violet-400 border-violet-500/20",
  canvas: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  process: "bg-pink-500/15 text-pink-400 border-pink-500/20",
  checklist: "bg-green-500/15 text-green-400 border-green-500/20",
  dashboard: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  form: "bg-amber-500/15 text-amber-400 border-amber-500/20",
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  project: FolderKanban,
  task: CheckSquare,
  page: FileText,
  canvas: Layout,
  process: GitBranch,
  checklist: ListChecks,
  dashboard: LayoutDashboard,
  form: FormInput,
}

interface TemplatesContentProps {
  templates: Template[]
  favorites: Template[]
  recent: Template[]
}

export function TemplatesContent({ templates: allTemplates, favorites, recent }: TemplatesContentProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<TemplateType | "all">("all")

  // Use Template dialog
  const [useDialogOpen, setUseDialogOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [titleOverride, setTitleOverride] = useState("")

  // Create Template dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newType, setNewType] = useState<TemplateType>("project")
  const [newDescription, setNewDescription] = useState("")
  const [newIcon, setNewIcon] = useState("")
  const [newColor, setNewColor] = useState("")

  const filtered = allTemplates.filter((t) => {
    const matchesType = typeFilter === "all" || t.type === typeFilter
    const matchesSearch = !search || t.name.toLowerCase().includes(search.toLowerCase())
    return matchesType && matchesSearch
  })

  async function handleUseTemplate() {
    if (!selectedTemplate) return
    try {
      const result = await createFromTemplate(selectedTemplate.id, {
        title: titleOverride || undefined,
      })
      toast.success(`Created ${result.type} from template`)
      setUseDialogOpen(false)
      setSelectedTemplate(null)
      setTitleOverride("")

      if (result.type === "project") {
        router.push(`/projects/${result.id}`)
      } else if (result.type === "page") {
        router.push(`/pages/${result.id}`)
      } else if (result.type === "canvas") {
        router.push(`/canvas/${result.id}`)
      } else if (result.type === "process") {
        router.push(`/process/${result.id}`)
      } else {
        router.refresh()
      }
    } catch {
      toast.error("Failed to create from template")
    }
  }

  async function handleCreateTemplate() {
    if (!newName.trim()) {
      toast.error("Template name is required")
      return
    }
    try {
      await createTemplate({
        name: newName.trim(),
        type: newType,
        description: newDescription.trim() || undefined,
        icon: newIcon.trim() || undefined,
        color: newColor.trim() || undefined,
      })
      toast.success("Template created")
      setCreateDialogOpen(false)
      setNewName("")
      setNewType("project")
      setNewDescription("")
      setNewIcon("")
      setNewColor("")
      router.refresh()
    } catch {
      toast.error("Failed to create template")
    }
  }

  async function handleToggleFavorite(id: string) {
    try {
      await toggleTemplateFavorite(id)
      router.refresh()
    } catch {
      toast.error("Failed to update favorite")
    }
  }

  async function handleDuplicate(id: string) {
    try {
      await duplicateTemplate(id)
      toast.success("Template duplicated")
      router.refresh()
    } catch {
      toast.error("Failed to duplicate template")
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteTemplate(id)
      toast.success("Template deleted")
      router.refresh()
    } catch {
      toast.error("Failed to delete template")
    }
  }

  function openUseDialog(template: Template) {
    setSelectedTemplate(template)
    setTitleOverride(template.name)
    setUseDialogOpen(true)
  }

  function renderTemplateCard(template: Template) {
    const TypeIcon = TYPE_ICONS[template.type] || Sparkles
    const badgeColor = TYPE_BADGE_COLORS[template.type] || "bg-muted text-muted-foreground"
    const isFav = template.isFavorite

    return (
      <div
        key={template.id}
        className="bg-card border rounded-lg p-4 flex flex-col gap-3 hover:border-primary/30 transition-colors"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="flex size-9 items-center justify-center rounded-md border"
              style={{ borderColor: template.color || undefined }}
            >
              <TypeIcon
                className="size-4"
                style={{ color: template.color || undefined }}
              />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{template.name}</p>
              <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${badgeColor}`}>
                {template.type}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => handleToggleFavorite(template.id)}
              className="p-1 rounded hover:bg-accent transition-colors"
              title={isFav ? "Remove from favorites" : "Add to favorites"}
            >
              <Star
                className={`size-3.5 ${isFav ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
              />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger className="p-1 rounded hover:bg-accent transition-colors">
                <MoreHorizontal className="size-3.5 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleDuplicate(template.id)}>
                  <Copy className="size-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDelete(template.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="size-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {template.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
        )}

        <div className="flex items-center justify-between mt-auto pt-1">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Clock className="size-3" />
            Used {template.usageCount} {template.usageCount === 1 ? "time" : "times"}
          </span>
          <Button size="sm" className="h-7 text-xs px-3" onClick={() => openUseDialog(template)}>
            Use Template
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {TEMPLATE_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setTypeFilter(t.value)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                typeFilter === t.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Button size="sm" className="h-9 gap-1.5" onClick={() => setCreateDialogOpen(true)}>
          <Plus className="size-4" />
          New Template
        </Button>
      </div>

      {/* Recent section */}
      {recent.length > 0 && typeFilter === "all" && !search && (
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Recently Used
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {recent.map((t) => (
              <div key={t.id} className="min-w-[220px] max-w-[260px] shrink-0">
                {renderTemplateCard(t)}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Favorites section */}
      {favorites.length > 0 && typeFilter === "all" && !search && (
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Favorites
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {favorites.map((t) => renderTemplateCard(t))}
          </div>
        </section>
      )}

      {/* All templates grid */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {typeFilter === "all" ? "All Templates" : `${TEMPLATE_TYPES.find((t) => t.value === typeFilter)?.label} Templates`}
        </h2>
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((t) => renderTemplateCard(t))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Sparkles className="size-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No templates found</p>
            <p className="text-xs mt-1">Try a different filter or create a new template</p>
          </div>
        )}
      </section>

      {/* Use Template dialog */}
      <Dialog open={useDialogOpen} onOpenChange={setUseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Use Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Create a new {selectedTemplate?.type} from <span className="font-medium text-foreground">{selectedTemplate?.name}</span>
            </p>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Title</label>
              <Input
                placeholder="Enter a title..."
                value={titleOverride}
                onChange={(e) => setTitleOverride(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUseTemplate()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUseDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUseTemplate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Template dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Name</label>
              <Input
                placeholder="Template name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as TemplateType)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="project">Project</option>
                <option value="task">Task</option>
                <option value="page">Page</option>
                <option value="canvas">Canvas</option>
                <option value="process">Process</option>
                <option value="checklist">Checklist</option>
                <option value="dashboard">Dashboard</option>
                <option value="form">Form</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Description</label>
              <Input
                placeholder="Optional description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Icon</label>
                <Input
                  placeholder="e.g. FolderKanban"
                  value={newIcon}
                  onChange={(e) => setNewIcon(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Color</label>
                <Input
                  placeholder="e.g. #6366f1"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTemplate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
