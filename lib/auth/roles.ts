export type UserRole = "admin" | "nurse" | "doctor" | "student" | "faculty"

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

export function isFaculty(role: UserRole | null | undefined): boolean {
  return role === "faculty"
}

export function isStaff(role: UserRole | null | undefined): boolean {
  return role === "admin" || role === "nurse" || role === "doctor"
}

export function filterNavigationForRole<T extends { label: string; items?: any[] }>(
  groups: T[],
  role: UserRole | null | undefined
): T[] {
  if (isAdmin(role)) return groups
  if (isStudent(role) || isFaculty(role)) {
    return groups.filter((group) => group.label === "STUDENT")
  }
  // nurse/doctor: show all groups but filter out items restricted to admin
  return groups.map((group) => ({
    ...group,
    items: group.items?.filter((item: any) => !item.roles || item.roles.includes(role as string)),
  }))
}