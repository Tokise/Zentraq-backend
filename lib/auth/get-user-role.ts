import { createAdminClient } from "@/utils/supabase/admin";
import type { UserRole } from "@/types";

/** Resolve a role solely from the SAD user_roles / roles mapping. */
export async function getUserRole(userId: string): Promise<UserRole | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_roles")
    .select("role:roles(name)")
    .eq("user_id", userId)
    .limit(1);

  if (error || !data?.[0]) return null;
  const relation = data[0].role as unknown;
  const role = Array.isArray(relation) ? relation[0] : relation;
  const name =
    typeof role === "object" && role !== null && "name" in role
      ? (role as { name?: unknown }).name
      : null;
  return isUserRole(name) ? name : null;
}

function isUserRole(value: unknown): value is UserRole {
  return (
    value === "admin" ||
    value === "doctor" ||
    value === "nurse" ||
    value === "student" ||
    value === "faculty" ||
    value === "staff"
  );
}
