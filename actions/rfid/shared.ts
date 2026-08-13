import "server-only";

import { getUserRole } from "@/lib/auth/get-user-role";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export type ClinicRole = "admin" | "doctor" | "nurse";

// Resolves the active authenticated clinic operator for an RFID workflow.
export async function requireClinicStaff() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Not authenticated", user: null, role: null };
  }

  const role = await getUserRole(user.id);
  if (!role || !["admin", "doctor", "nurse"].includes(role)) {
    return { error: "Access denied", user: null, role: null };
  }

  const { data: clinicAccount } = await createAdminClient()
    .from("clinic_accounts")
    .select("id")
    .eq("user_id", user.id)
    .eq("role", role)
    .eq("is_active", true)
    .maybeSingle();

  if (!clinicAccount) {
    return { error: "Access denied", user: null, role: null };
  }

  return {
    error: null,
    user,
    role: role as ClinicRole,
  };
}

// Normalizes Supabase to-one relationships returned as an object or an array.
export function firstRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}
