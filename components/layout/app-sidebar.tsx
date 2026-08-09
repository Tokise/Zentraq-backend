"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { getNavigationForRole } from "@/lib/navigation";
import { filterNavigationForRole, type UserRole } from "@/lib/auth/roles";

type AppSidebarProps = {
  onNavigate?: () => void;
  collapsed?: boolean;
  userRole?: UserRole;
  hasPatientProfile?: boolean;
};

// Renders role-scoped clinic navigation with expandable workflow modules.
export function AppSidebar({
  onNavigate,
  collapsed = false,
  userRole = "nurse",
  hasPatientProfile = false,
}: AppSidebarProps) {
  const pathname = usePathname();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );
  const navGroups = getNavigationForRole(userRole, hasPatientProfile);
  const visibleNavigation = filterNavigationForRole(navGroups, userRole);

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-sidebar-border bg-sidebar",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div
        className={cn(
          "flex h-14 items-center border-b border-sidebar-border px-4",
          collapsed && "justify-center px-2",
        )}
      >
        {collapsed ? (
          <Image
            src="/logo.png"
            alt="Logo"
            width={32}
            height={32}
            className="size-8 object-contain"
          />
        ) : (
          <div className="flex items-center ml-1 gap-3">
            <Image
              src="/logo.png"
              alt="Logo"
              width={40}
              height={40}
              className="size-8 object-contain"
            />
            <div className="flex flex-col leading-none">
              <span className="ml-4 text-lg font-bold tracking-tight text-sidebar-foreground">
                BCP CLINIC
              </span>
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {visibleNavigation.map((group) => {
          const isCollapsible =
            group.collapsible !== false && group.items.length > 4;
          const hasActiveItem = group.items.some((item) =>
            item.href === "/admin" ||
            item.href === "/doctor" ||
            item.href === "/nurse"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`),
          );
          const isExpanded =
            !isCollapsible ||
            (hasActiveItem
              ? !collapsedGroups.has(group.label)
              : expandedGroups.has(group.label));
          return (
            <div key={group.label || "dashboard"} className="mb-3">
              {group.label && !collapsed && isCollapsible && (
                <button
                  type="button"
                  onClick={() => {
                    setExpandedGroups((current) => {
                      const next = new Set(current);
                      if (next.has(group.label)) next.delete(group.label);
                      else next.add(group.label);
                      return next;
                    });
                    setCollapsedGroups((current) => {
                      const next = new Set(current);
                      if (hasActiveItem) {
                        if (next.has(group.label)) next.delete(group.label);
                        else next.add(group.label);
                      } else {
                        next.delete(group.label);
                      }
                      return next;
                    });
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    hasActiveItem &&
                      !isExpanded &&
                      "bg-sidebar-accent text-primary",
                  )}
                  aria-expanded={isExpanded}
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    className={cn(
                      "size-3.5 transition-transform",
                      isExpanded && "rotate-180",
                    )}
                  />
                </button>
              )}
              {group.label && !collapsed && !isCollapsible && (
                <p className="mb-1 px-2 text-xs font-medium tracking-wider text-muted-foreground">
                  {group.label}
                </p>
              )}
              <ul className={cn("space-y-0.5", !isExpanded && "hidden")}>
                {group.items.map((item) => {
                  const isVisitRoot = item.href.endsWith("/visits");
                  const isActive =
                    item.href === "/admin" ||
                    item.href === "/doctor" ||
                    item.href === "/nurse"
                      ? pathname === item.href
                      : isVisitRoot
                        ? pathname === item.href ||
                          pathname.startsWith(`${item.href}/consultation/`)
                        : pathname === item.href ||
                          pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        target={item.target}
                        rel={
                          item.target === "_blank"
                            ? "noopener noreferrer"
                            : undefined
                        }
                        onClick={() => {
                          if (item.target === "_blank") return;
                          if (onNavigate) onNavigate();
                        }}
                        className={cn(
                          "flex items-center gap-3 px-2 py-2 text-sm transition-colors duration-150",
                          isActive
                            ? "bg-sidebar-accent text-primary font-medium"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          collapsed && "justify-center px-2",
                        )}
                        title={collapsed ? item.title : undefined}
                      >
                        <Icon
                          className={cn(
                            "size-4 shrink-0",
                            isActive ? "text-primary" : "text-muted-foreground",
                          )}
                        />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
