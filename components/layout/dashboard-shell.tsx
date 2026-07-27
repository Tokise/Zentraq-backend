"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Menu, X, Loader2, LogOut } from "lucide-react"
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
import { createClient } from "@/utils/supabase/client"
import type { UserRole } from "@/lib/auth/roles"

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
  useSessionSecurity()

  const [mobileOpen, setMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    if (loggingOut) return

    setLoggingOut(true)
    NProgress.start()

    try {
      const supabase = createClient()

      await supabase.auth.signOut()

      // Force a full page reload to ensure all state is cleared
      window.location.href = "/login"
    } catch (error) {
      console.error(error)
      NProgress.done()
      setLoggingOut(false)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden lg:block">
        <AppSidebar userRole={userRole} />
      </div>

      <div className="hidden md:block lg:hidden">
        <AppSidebar collapsed userRole={userRole} />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-64">
            <AppSidebar
              onNavigate={() => setMobileOpen(false)}
              userRole={userRole}
            />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-4 border-b border-border bg-background px-4 md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? (
              <X className="size-4" />
            ) : (
              <Menu className="size-4" />
            )}
          </Button>

          <div className="flex-1" />

          <DropdownMenu>
            <DropdownMenuTrigger className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full hover:bg-accent/50 transition-colors focus:outline-none ring-2 ring-transparent hover:ring-accent">
              <Avatar className="h-9 w-9 border-2 border-background shadow-sm">
                <AvatarImage alt={userEmail || "User"} className="object-cover" />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {userEmail?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-64 p-2" align="end" sideOffset={8}>
              <DropdownMenuGroup>
                <DropdownMenuLabel className="px-3 py-2.5">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      Account
                    </p>
                    <p className="text-xs text-muted-foreground break-all">
                      {userEmail}
                    </p>
                    <p className="text-[10px] capitalize text-muted-foreground font-medium">
                      {userRole}
                    </p>
                  </div>
                </DropdownMenuLabel>

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
        </header>

        <main className={cn("flex-1 overflow-y-auto p-4 md:p-6 lg:p-8")}>
          {children}
        </main>
      </div>
    </div>
  )
}
