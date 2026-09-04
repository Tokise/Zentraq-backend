import { getActionActor } from "../../../runtime/context.ts";
import { createAdminClient } from "../../../runtime/context.ts";

export type ClinicRole = "admin" | "doctor" | "nurse";

// Resolves the active authenticated clinic operator for an RFID workflow.
export async function requireClinicStaff() {
  const actor = await getActionActor();
  if (!actor) {
    return { error: "Not authenticated", user: null, role: null };
  }

  if (!["admin", "doctor", "nurse"].includes(actor.role)) {
    return { error: "Access denied", user: null, role: null };
  }

  const { data: clinicAccount } = await createAdminClient()
    .from("clinic_accounts")
    .select("id")
    .eq("user_id", actor.id)
    .eq("role", actor.role)
    .eq("is_active", true)
    .maybeSingle();

  if (!clinicAccount) {
    return { error: "Access denied", user: null, role: null };
  }

  return {
    error: null,
    user: actor,
    role: actor.role as ClinicRole,
  };
}

// Normalizes Supabase to-one relationships returned as an object or an array.
export function firstRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}
