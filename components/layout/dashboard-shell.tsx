"use client"

import { useState } from "react"
import { Menu, X } from "lucide-react"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type DashboardShellProps = {
  children: React.ReactNode
}

export function DashboardShell({ children }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <AppSidebar />
      </div>

      {/* Tablet collapsed sidebar */}
      <div className="hidden md:block lg:hidden">
        <AppSidebar collapsed />
      </div>

      {/* Mobile overlay sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-64">
            <AppSidebar onNavigate={() => setMobileOpen(false)} />
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
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
          <div className="flex-1" />
          <span className="text-sm text-muted-foreground">Clinic Management</span>
        </header>

        <main className={cn("flex-1 overflow-y-auto p-4 md:p-6 lg:p-8")}>
          {children}
        </main>
      </div>
    </div>
  )
}
