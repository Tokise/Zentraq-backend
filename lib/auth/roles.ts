export type UserRole = "admin" | "nurse" | "doctor" | "student"

export function isAdmin(role: UserRole | null | undefined): boolean {
  return role === "admin"
}

export function isNurse(role: UserRole | null | undefined): boolean {
  return role === "nurse"
}

export function isDoctor(role: UserRole | null | undefined): boolean {
  return role === "doctor"
}

export function isStudent(role: UserRole | null | undefined): boolean {
  return role === "student"
}

export function isStaff(role: UserRole | null | undefined): boolean {
  return role === "admin" || role === "nurse" || role === "doctor"
}

export function filterNavigationForRole<T extends { label: string; items?: any[] }>(
  groups: T[],
  role: UserRole | null | undefined
): T[] {
  if (isAdmin(role)) return groups
  if (isStudent(role)) {
    return groups.filter((group) => group.label === "STUDENT")
  }
  // nurse/doctor: hide admin-only sections and admin-only items
  return groups
    .filter((group) => group.label !== "ADMINISTRATION")
    .map((group) => ({
      ...group,
      items: group.items?.filter((item: any) => !item.roles || item.roles.includes(role as string)),
    }))
}
