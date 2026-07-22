export type StaffRole = "admin" | "operator"

export function isAdmin(role: StaffRole | null | undefined): boolean {
  return role === "admin"
}

export function filterNavigationForRole<T extends { label: string }>(
  groups: T[],
  role: StaffRole | null | undefined
): T[] {
  if (isAdmin(role)) return groups
  return groups.filter((group) => group.label !== "ADMINISTRATION")
}
