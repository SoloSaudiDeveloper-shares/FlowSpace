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
import { MarkdownTemplatesPanel } from "@/components/settings/markdown-templates-panel"
import { useT } from "@/lib/hooks/use-i18n"
import type { templates } from "@/lib/db/schema"

type Template = typeof templates.$inferSelect

type TemplateType = Template["type"]

const TEMPLATE_TYPES: { value: TemplateType | "all"; labelKey: string }[] = [
  { value: "all", labelKey: "tpl.type.all" },
  { value: "project", labelKey: "tpl.type.project" },
  { value: "task", labelKey: "tpl.type.task" },
  { value: "page", labelKey: "tpl.type.page" },
  { value: "canvas", labelKey: "tpl.type.canvas" },
  { value: "process", labelKey: "tpl.type.process" },
  { value: "checklist", labelKey: "tpl.type.checklist" },
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
  const { t } = useT()
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
      toast.success(t("tpl.toast.created").replace("{type}", result.type))
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
      toast.error(t("tpl.toast.createFailed"))
    }
  }

  async function handleCreateTemplate() {
    if (!newName.trim()) {
      toast.error(t("tpl.toast.nameRequired"))
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
      toast.success(t("tpl.toast.tplCreated"))
      setCreateDialogOpen(false)
      setNewName("")
      setNewType("project")
      setNewDescription("")
      setNewIcon("")
      setNewColor("")
      router.refresh()
    } catch {
      toast.error(t("tpl.toast.tplCreateFailed"))
    }
  }

  async function handleToggleFavorite(id: string) {
    try {
      await toggleTemplateFavorite(id)
      router.refresh()
    } catch {
      toast.error(t("tpl.toast.favFailed"))
    }
  }

  async function handleDuplicate(id: string) {
    try {
      await duplicateTemplate(id)
      toast.success(t("tpl.toast.duplicated"))
      router.refresh()
    } catch {
      toast.error(t("tpl.toast.dupFailed"))
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteTemplate(id)
      toast.success(t("tpl.toast.deleted"))
      router.refresh()
    } catch {
      toast.error(t("tpl.toast.deleteFailed"))
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
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-md border"
              style={{ borderColor: template.color || undefined }}
            >
              <TypeIcon
                className="size-4"
                style={{ color: template.color || undefined }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="font-semibold text-sm leading-snug line-clamp-2 break-words"
                title={template.name}
              >
                {template.name}
              </p>
              <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium mt-1 ${badgeColor}`}>
                {t(`tpl.type.${template.type}`)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => handleToggleFavorite(template.id)}
              className="p-1 rounded hover:bg-accent transition-colors"
              title={isFav ? t("tpl.card.fav.remove") : t("tpl.card.fav.add")}
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
                  {t("tpl.card.duplicate")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDelete(template.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="size-4 mr-2" />
                  {t("tpl.card.delete")}
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
            {t(template.usageCount === 1 ? "tpl.card.used.one" : "tpl.card.used.other").replace("{count}", String(template.usageCount))}
          </span>
          <Button size="sm" className="h-7 text-xs px-3" onClick={() => openUseDialog(template)}>
            {t("tpl.card.use")}
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
            placeholder={t("tpl.search.ph")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {TEMPLATE_TYPES.map((typeOpt) => (
            <button
              key={typeOpt.value}
              onClick={() => setTypeFilter(typeOpt.value)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                typeFilter === typeOpt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {t(typeOpt.labelKey)}
            </button>
          ))}
        </div>
        <Button size="sm" className="h-9 gap-1.5" onClick={() => setCreateDialogOpen(true)}>
          <Plus className="size-4" />
          {t("tpl.new")}
        </Button>
      </div>

      {/* Markdown blueprints — paste-to-import starters, surfaced here in
          /templates (they used to live only in Settings → Help). */}
      {typeFilter === "all" && !search && (
        <details className="rounded-lg border border-border/60 bg-card/40">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-medium select-none hover:bg-accent/30 rounded-lg">
            <Sparkles className="size-4 text-primary" />
            {t("tpl.blueprints.title")}
            <span className="text-xs text-muted-foreground font-normal">
              {t("tpl.blueprints.help")}
            </span>
          </summary>
          <div className="px-4 pb-4">
            <MarkdownTemplatesPanel />
          </div>
        </details>
      )}

      {/* Recent section */}
      {recent.length > 0 && typeFilter === "all" && !search && (
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {t("tpl.section.recent")}
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
            {t("tpl.section.favorites")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {favorites.map((t) => renderTemplateCard(t))}
          </div>
        </section>
      )}

      {/* All templates grid */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {typeFilter === "all"
            ? t("tpl.section.all")
            : t("tpl.section.typed").replace("{type}", t(`tpl.type.${typeFilter}`))}
        </h2>
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((t) => renderTemplateCard(t))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Sparkles className="size-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm">{t("tpl.empty.title")}</p>
            <p className="text-xs mt-1">{t("tpl.empty.help")}</p>
          </div>
        )}
      </section>

      {/* Use Template dialog */}
      <Dialog open={useDialogOpen} onOpenChange={setUseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("tpl.use.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              {t("tpl.use.from").replace("{type}", selectedTemplate?.type ?? "")} <span className="font-medium text-foreground">{selectedTemplate?.name}</span>
            </p>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t("tpl.use.titleLbl")}</label>
              <Input
                placeholder={t("tpl.use.title.ph")}
                value={titleOverride}
                onChange={(e) => setTitleOverride(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUseTemplate()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUseDialogOpen(false)}>
              {t("tpl.use.cancel")}
            </Button>
            <Button onClick={handleUseTemplate}>{t("tpl.use.create")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Template dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("tpl.create.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t("tpl.create.nameLbl")}</label>
              <Input
                placeholder={t("tpl.create.name.ph")}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t("tpl.create.typeLbl")}</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as TemplateType)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="project">{t("tpl.type.project")}</option>
                <option value="task">{t("tpl.type.task")}</option>
                <option value="page">{t("tpl.type.page")}</option>
                <option value="canvas">{t("tpl.type.canvas")}</option>
                <option value="process">{t("tpl.type.process")}</option>
                <option value="checklist">{t("tpl.type.checklist")}</option>
                <option value="dashboard">{t("tpl.type.dashboard")}</option>
                <option value="form">{t("tpl.type.form")}</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t("tpl.create.descLbl")}</label>
              <Input
                placeholder={t("tpl.create.desc.ph")}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t("tpl.create.iconLbl")}</label>
                <Input
                  placeholder={t("tpl.create.icon.ph")}
                  value={newIcon}
                  onChange={(e) => setNewIcon(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t("tpl.create.colorLbl")}</label>
                <Input
                  placeholder={t("tpl.create.color.ph")}
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              {t("tpl.create.cancel")}
            </Button>
            <Button onClick={handleCreateTemplate}>{t("tpl.create.create")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
