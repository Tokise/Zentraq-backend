"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Loader2, LogOut, User, Shield, Menu, Sun, Moon } from "lucide-react"
import NProgress from "nprogress"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useSessionSecurity } from "@/lib/auth/session"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { UserRole } from "@/lib/auth/roles"
import { NotificationDropdown } from "@/components/layout/notification-dropdown"
import { getPageTitle } from "@/lib/navigation"
import { signOutAction } from "@/actions/system/auth"

type DashboardShellProps = {
  children: React.ReactNode
  userEmail?: string
  userRole?: UserRole
}

export function DashboardShell({
  children,
  userEmail,
  userRole = "nurse",
}: DashboardShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  useSessionSecurity()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("theme") as "light" | "dark" | null
      return stored || "light"
    }
    return "light"
  })
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const root = document.documentElement
    if (theme === "dark") {
      root.classList.add("dark")
    } else {
      root.classList.remove("dark")
    }
    localStorage.setItem("theme", theme)
  }, [theme])

  const pageTitle = getPageTitle(pathname)

  // Keyboard shortcut: Ctrl+K or Cmd+K to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  async function handleLogout() {
    if (loggingOut) return

    setLoggingOut(true)
    NProgress.start()

    try {
      await signOutAction()
    } catch (error) {
      console.error(error)
      NProgress.done()
      setLoggingOut(false)
    }
  }

  const roleLabel = userRole === "admin" ? "Admin" : userRole === "nurse" ? "Nurse" : userRole === "doctor" ? "Doctor" : userRole === "faculty" ? "Faculty" : userRole === "student" ? "Student" : userRole || "User"
  const roleIcon = userRole === "admin" ? Shield : User

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar — responsive */}
      <div
        className={cn(
          "hidden lg:block transition-all duration-300",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        <AppSidebar collapsed={sidebarCollapsed} userRole={userRole} />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-64 animate-in slide-in-from-left">
            <AppSidebar
              onNavigate={() => setMobileOpen(false)}
              userRole={userRole}
            />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-background px-3 md:px-4 shrink-0  z-10">
          <div className="flex items-center gap-2 min-w-0">
            {/* Hamburger for mobile + sidebar toggle on desktop */}
            <Button
              variant="ghost"
              size="icon"
              className="size-9 shrink-0 cursor-pointer"
              onClick={() => {
                if (window.innerWidth < 1024) {
                  setMobileOpen(!mobileOpen)
                } else {
                  setSidebarCollapsed(!sidebarCollapsed)
                }
              }}
              aria-label="Toggle sidebar"
              title="Toggle sidebar"
            >
              <Menu className="size-4" />
            </Button>
          </div>

          {/* Right side: Notification bell + Avatar */}
          <div className="flex items-center gap-1.5 shrink-0">
            <NotificationDropdown userRole={userRole} />

            <DropdownMenu>
              <DropdownMenuTrigger className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full hover:bg-accent/50 transition-colors focus:outline-none">
                <Avatar className="h-8 w-8 border border-border">
                  <AvatarImage alt={userEmail || "User"} className="object-cover" />
                  <AvatarFallback className="bg-card text-primary font-semibold text-xs">
                    {userEmail?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>

              <DropdownMenuContent className="w-64 p-2 bg-card bg-hover:bg-accentup" align="end" sideOffset={8}>
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border border-border">
                        <AvatarImage alt={userEmail || "User"} className="object-cover" />
                        <AvatarFallback className="bg-muted text-primary font-semibold">
                          {userEmail?.charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {userEmail?.split("@")[0] || "User"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {userEmail}
                        </p>
                        <p className="text-[10px] capitalize text-muted-foreground font-medium flex items-center gap-1 mt-0.5">
                          <span className={cn(
                            "size-1.5 rounded-full",
                            userRole === "admin" ? "bg-purple-500" :
                              userRole === "nurse" ? "bg-blue-500" :
                                userRole === "doctor" ? "bg-emerald-500" :
                                  userRole === "faculty" ? "bg-orange-500" :
                                    userRole === "student" ? "bg-cyan-500" : "bg-zinc-400"
                          )} />
                          {roleLabel}
                        </p>
                      </div>
                    </div>
                  </DropdownMenuLabel>

                  <DropdownMenuSeparator className="my-1.5" />

                  <DropdownMenuItem
                    className="cursor-pointer px-3 py-2 text-sm"
                    onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                  >
                    {theme === "light" ? (
                      <>
                        <Moon className="mr-2 size-4" />
                        <span>Dark Mode</span>
                      </>
                    ) : (
                      <>
                        <Sun className="mr-2 size-4" />
                        <span>Light Mode</span>
                      </>
                    )}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="my-1.5" />

                  <DropdownMenuItem
                    className="cursor-pointer px-3 py-2.5 text-sm text-destructive focus:bg-destructive/10 focus:text-destructive"
                    disabled={loggingOut}
                    onClick={handleLogout}
                  >
                    {loggingOut ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        <span>Signing out...</span>
                      </>
                    ) : (
                      <>
                        <LogOut className="mr-2 size-4" />
                        <span className="font-medium">Log out</span>
                      </>
                    )}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main content */}
        <main className={cn("flex-1 overflow-y-auto p-4 md:p-6 lg:p-8")}>
          <div className="mx-auto w-full max-w-[1400px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}