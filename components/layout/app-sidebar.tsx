"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { getNavigationForRole, studentNavigation } from "@/lib/navigation"
import { filterNavigationForRole, isStudent, type UserRole } from "@/lib/auth/roles"

type AppSidebarProps = {
  onNavigate?: () => void
  collapsed?: boolean
  userRole?: UserRole
}

export function AppSidebar({ onNavigate, collapsed = false, userRole = "nurse" }: AppSidebarProps) {
  const pathname = usePathname()

  const navGroups = getNavigationForRole(userRole)
  const visibleNavigation = filterNavigationForRole(navGroups, userRole)

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-sidebar-border bg-sidebar",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className={cn("flex h-14 items-center border-b border-sidebar-border px-4", collapsed && "justify-center px-2")}>
        {collapsed ? (
          <Image src="/logo.png" alt="Logo" width={32} height={32} className="size-8 object-contain" />
        ) : (
          <div className="flex items-center ml-1 gap-3">
            <Image src="/logo.png" alt="Logo" width={40} height={40} className="size-8 object-contain" />
            <div className="flex flex-col leading-none">
              <span className="text-lg font-bold ml-4 text-sidebar-foreground tracking-tight">BCP CLINIC</span>
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {visibleNavigation.map((group) => (
          <div key={group.label || "dashboard"} className="mb-4">
            {group.label && !collapsed && (
              <p className="mb-2 px-2 text-xs font-medium tracking-wider text-muted-foreground">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      target={item.target}
                      rel={item.target === "_blank" ? "noopener noreferrer" : undefined}
                      onClick={(e) => {
                        if (item.target === "_blank") return
                        if (onNavigate) onNavigate()
                      }}
                      className={cn(
                        "flex items-center gap-3 px-2 py-2 text-sm transition-colors duration-150 rounded-md",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        collapsed && "justify-center px-2"
                      )}
                      title={collapsed ? item.title : undefined}
                    >
                      <Icon className={cn("size-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  )
}