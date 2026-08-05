"use server"

import { revalidatePath } from "next/cache"
import { getActionActor, hasAnyRole } from "@/lib/security/action-guard"
import { createAdminClient } from "@/utils/supabase/admin"
import { logAuditEvent } from "@/lib/audit-logger"

const MIN_PASSWORD_LENGTH = 12
const CLINIC_ROLES = ["admin", "doctor", "nurse"] as const

async function requireAdmin() {
  const actor = await getActionActor()
  return actor && hasAnyRole(actor, ["admin"]) ? actor : null
}

export async function createOperator(formData: FormData) {
  const actor = await requireAdmin()
  if (!actor) return { error: "Unauthorized" }
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")
  const displayName = String(formData.get("fullName") ?? "").trim()
  const role = String(formData.get("role") ?? "nurse")
  if (!email || !displayName || !CLINIC_ROLES.includes(role as typeof CLINIC_ROLES[number])) return { error: "Valid name, email, and clinic role are required" }
  if (password.length < MIN_PASSWORD_LENGTH) return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }

  const admin = createAdminClient()
  const { data: created, error: authError } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (authError || !created.user) return { error: authError?.message ?? "Failed to create user" }
  const { data: roleRow } = await admin.from("roles").select("id").eq("name", role).maybeSingle()
  if (!roleRow) { await admin.auth.admin.deleteUser(created.user.id); return { error: `The ${role} role has not been seeded` } }
  const { error } = await admin.from("users").insert({ id: created.user.id, email }).then(async (result) => {
    if (result.error) return result
    const roleResult = await admin.from("user_roles").insert({ user_id: created.user.id, role_id: roleRow.id })
    if (roleResult.error) return roleResult
    return admin.from("clinic_accounts").insert({ user_id: created.user.id, role, display_name: displayName })
  })
  if (error) { await admin.auth.admin.deleteUser(created.user.id); return { error: error.message } }
  await logAuditEvent({ action: "OPERATOR_CREATED", userId: actor.id, email: actor.email, resource: created.user.id, details: { role } })
  revalidatePath("/admin/clinic-accounts")
  return { success: true }
}

export async function removeOperator(targetUserId: string) {
  const actor = await requireAdmin()
  if (!actor) return { error: "Unauthorized" }
  if (targetUserId === actor.id) return { error: "You cannot remove your own administrator account" }
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(targetUserId)
  if (error) return { error: error.message }
  await logAuditEvent({ action: "OPERATOR_REMOVED", userId: actor.id, email: actor.email, resource: targetUserId })
  revalidatePath("/admin/clinic-accounts")
  return { success: true }
}

export interface StaffAccountDTO { id: string; email: string; role: "admin" | "nurse" | "doctor"; full_name: string | null; created_at: string }

export async function getClinicAccountsAction() {
  const actor = await requireAdmin()
  if (!actor) return { error: "Unauthorized", operators: [] as StaffAccountDTO[] }
  const { data, error } = await createAdminClient().from("clinic_accounts").select("user_id, role, display_name, created_at, user:users(email)").order("created_at", { ascending: false })
  if (error) return { error: error.message, operators: [] as StaffAccountDTO[] }
  const operators = (data ?? []).map((row) => {
    const user = Array.isArray(row.user) ? row.user[0] : row.user
    return { id: row.user_id, email: user?.email ?? "", role: row.role as StaffAccountDTO["role"], full_name: row.display_name, created_at: row.created_at }
  })
  return { error: null, operators }
}
