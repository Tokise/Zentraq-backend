import type { UserRole } from "@/lib/auth/roles";

const DEFAULT_ROUTE_BY_ROLE: Record<UserRole, string> = {
  admin: "/admin",
  doctor: "/doctor",
  nurse: "/nurse",
  student: "/student",
  faculty: "/faculty",
  staff: "/staff",
};

// Returns the dashboard route assigned to an authenticated role.
export function getDefaultRouteForRole(role: UserRole): string {
  return DEFAULT_ROUTE_BY_ROLE[role];
}

// Checks whether a route belongs to the authenticated role's dashboard tree.
export function isRoleRoute(role: UserRole, pathname: string): boolean {
  const route = getDefaultRouteForRole(role);
  return pathname === route || pathname.startsWith(`${route}/`);
}
