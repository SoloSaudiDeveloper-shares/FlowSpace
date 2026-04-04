"use client"

import { usePathname, useRouter } from "next/navigation"
import {
  FolderKanban,
  FileText,
  Layout,
  ListTodo,
  Bell,
  GitBranch,
  Plus,
  Home,
  Star,
  Trash2,
  Settings,
  ChevronDown,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuAction,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { createElement } from "@/lib/actions/element-actions"
import type { Element, ElementType } from "@/lib/db/schema"

const ELEMENT_TYPE_CONFIG: Record<
  ElementType,
  { label: string; icon: React.ComponentType<{ className?: string }>; href: string }
> = {
  project: { label: "Projects", icon: FolderKanban, href: "/projects" },
  page: { label: "Pages", icon: FileText, href: "/pages" },
  canvas: { label: "Canvases", icon: Layout, href: "/canvas" },
  todo_list: { label: "Todo Lists", icon: ListTodo, href: "/todos" },
  reminder: { label: "Reminders", icon: Bell, href: "/reminders" },
  process: { label: "Processes", icon: GitBranch, href: "/process" },
}

function getElementHref(element: Element): string {
  switch (element.type) {
    case "project":
      return `/projects/${element.id}`
    case "page":
      return `/pages/${element.id}`
    case "canvas":
      return `/canvas/${element.id}`
    case "todo_list":
      return `/todos/${element.id}`
    case "reminder":
      return `/reminders`
    case "process":
      return `/process/${element.id}`
    default:
      return "/"
  }
}

interface AppSidebarProps {
  elements: Element[]
  favorites: Element[]
}

export function AppSidebar({ elements, favorites }: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleCreate(type: ElementType) {
    const result = await createElement(type)
    const href = getElementHref({ ...result, title: "Untitled" } as Element)
    router.push(href)
  }

  // Group elements by type
  const grouped = elements.reduce(
    (acc, el) => {
      if (!acc[el.type]) acc[el.type] = []
      acc[el.type].push(el)
      return acc
    },
    {} as Record<string, Element[]>
  )

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              onClick={() => router.push("/")}
              isActive={pathname === "/"}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Home className="size-4" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">FlowSpace</span>
                <span className="text-xs text-muted-foreground">Workspace</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Quick Create */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  >
                    <Plus className="size-4" />
                    <span>New Element</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start" className="w-48">
                    {(Object.entries(ELEMENT_TYPE_CONFIG) as [ElementType, typeof ELEMENT_TYPE_CONFIG[ElementType]][]).map(
                      ([type, config]) => (
                        <DropdownMenuItem
                          key={type}
                          onClick={() => handleCreate(type)}
                        >
                          <config.icon className="mr-2 size-4" />
                          {config.label.replace(/s$/, "")}
                        </DropdownMenuItem>
                      )
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Favorites */}
        {favorites.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>
              <Star className="mr-2 size-3" />
              Favorites
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {favorites.map((el) => {
                  const config = ELEMENT_TYPE_CONFIG[el.type]
                  const Icon = config.icon
                  const href = getElementHref(el)
                  return (
                    <SidebarMenuItem key={el.id}>
                      <SidebarMenuButton
                        isActive={pathname === href}
                        onClick={() => router.push(href)}
                        tooltip={el.title}
                      >
                        <Icon className="size-4" />
                        <span className="truncate">{el.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Elements by type */}
        {(Object.entries(ELEMENT_TYPE_CONFIG) as [ElementType, typeof ELEMENT_TYPE_CONFIG[ElementType]][]).map(
          ([type, config]) => {
            const items = grouped[type] || []
            return (
              <SidebarGroup key={type}>
                <SidebarGroupLabel>
                  <config.icon className="mr-2 size-3" />
                  {config.label}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {items.length === 0 ? (
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          className="text-muted-foreground text-xs"
                          onClick={() => handleCreate(type)}
                        >
                          <Plus className="size-3" />
                          <span>Add {config.label.replace(/s$/, "").toLowerCase()}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ) : (
                      items.map((el) => {
                        const href = getElementHref(el)
                        return (
                          <SidebarMenuItem key={el.id}>
                            <SidebarMenuButton
                              isActive={pathname === href}
                              onClick={() => router.push(href)}
                              tooltip={el.title}
                            >
                              <span className="truncate">{el.title}</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        )
                      })
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )
          }
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center justify-between px-2">
              <ThemeToggle />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
