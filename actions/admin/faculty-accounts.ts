"use server"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/utils/supabase/admin"
import { getActionActor, hasAnyRole } from "@/lib/security/action-guard"
import { logAuditEvent } from "@/lib/audit-logger"

const MIN_PASSWORD_LENGTH = 12

export interface FacultyAccountDTO {
  id: string
  user_id: string | null
  rfid_uid: string | null
  first_name: string
  last_name: string
  email: string | null
  employee_number: string
  department: string | null
  position: string | null
  specialization: string | null
  clinic_license: string | null
  phone: string | null
  active_status: boolean
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface GetFacultyAccountsParams {
  page?: number
  pageSize?: number
  searchQuery?: string
  department?: string
  includeArchived?: boolean
}

async function requireAdmin() {
  const actor = await getActionActor()
  return actor && hasAnyRole(actor, ["admin"]) ? actor : null
}

export async function getFacultyAccountsAction(params?: GetFacultyAccountsParams): Promise<{ error: string | null; faculty: FacultyAccountDTO[]; totalCount: number }> {
  const actor = await requireAdmin()
  if (!actor) return { error: "Unauthorized", faculty: [], totalCount: 0 }

  const page = Math.max(1, params?.page ?? 1)
  const pageSize = Math.min(Math.max(1, params?.pageSize ?? 20), 100)
  const admin = createAdminClient()
  let query = admin.from("faculty")
    .select("id, user_id, rfid_uid, first_name, last_name, email, employee_number, department, position, phone, status, created_at, updated_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (params?.searchQuery?.trim()) {
    const queryText = params.searchQuery.trim().replace(/[,%()]/g, "")
    query = query.or(`first_name.ilike.%${queryText}%,last_name.ilike.%${queryText}%,email.ilike.%${queryText}%,employee_number.ilike.%${queryText}%`)
  }
  if (params?.department) query = query.eq("department", params.department)
  if (!params?.includeArchived) query = query.eq("status", "active")

  const { data, error, count } = await query
  if (error) return { error: error.message, faculty: [], totalCount: 0 }
  return {
    error: null,
    totalCount: count ?? 0,
    faculty: (data ?? []).map((member) => ({
      id: member.id, user_id: member.user_id, rfid_uid: member.rfid_uid, first_name: member.first_name, last_name: member.last_name,
      email: member.email, employee_number: member.employee_number, department: member.department, position: member.position, phone: member.phone,
      specialization: null, clinic_license: null, active_status: member.status === "active", archived_at: member.status === "inactive" ? member.updated_at : null,
      created_at: member.created_at, updated_at: member.updated_at,
    })),
  }
}

export async function createFacultyAccountAction(formData: FormData): Promise<{ success?: boolean; error?: string; userId?: string; email?: string }> {
  const actor = await requireAdmin()
  if (!actor) return { error: "Unauthorized" }
  const firstName = value(formData, "firstName"), lastName = value(formData, "lastName"), email = value(formData, "email").toLowerCase()
  const password = value(formData, "password"), employeeNumber = value(formData, "employeeNumber")
  if (!firstName || !lastName || !email || !employeeNumber) return { error: "First name, last name, email, and employee number are required" }
  if (password.length < MIN_PASSWORD_LENGTH) return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }

  const admin = createAdminClient()
  const { data: created, error: authError } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (authError || !created.user) return { error: authError?.message ?? "Failed to create authentication user" }

  const cleanup = async () => { await admin.auth.admin.deleteUser(created.user.id) }
  const { error: userError } = await admin.from("users").insert({ id: created.user.id, email })
  if (userError) { await cleanup(); return { error: userError.message } }
  const { data: role } = await admin.from("roles").select("id").eq("name", "faculty").maybeSingle()
  if (!role) { await cleanup(); return { error: "The faculty role has not been seeded" } }
  const { error: roleError } = await admin.from("user_roles").insert({ user_id: created.user.id, role_id: role.id })
  if (roleError) { await cleanup(); return { error: roleError.message } }
  const { error: facultyError } = await admin.from("faculty").insert({
    user_id: created.user.id, employee_number: employeeNumber, first_name: firstName, last_name: lastName, email,
    department: value(formData, "department") || null, position: value(formData, "position") || null,
    phone: value(formData, "phone") || null, rfid_uid: value(formData, "rfidUid") || null, status: "active",
  })
  if (facultyError) { await cleanup(); return { error: facultyError.message } }

  await logAuditEvent({ action: "FACULTY_ACCOUNT_CREATED", userId: actor.id, email: actor.email, resource: created.user.id, details: { employee_number: employeeNumber } })
  revalidatePath("/admin/faculty-accounts")
  return { success: true, userId: created.user.id, email }
}

export async function updateFacultyAccountAction(formData: FormData): Promise<{ success?: boolean; error?: string }> {
  const actor = await requireAdmin()
  if (!actor) return { error: "Unauthorized" }
  const id = value(formData, "profileId"), firstName = value(formData, "firstName"), lastName = value(formData, "lastName"), employeeNumber = value(formData, "employeeNumber")
  if (!id || !firstName || !lastName || !employeeNumber) return { error: "First name, last name, and employee number are required" }
  const { error } = await createAdminClient().from("faculty").update({
    first_name: firstName, last_name: lastName, employee_number: employeeNumber, department: value(formData, "department") || null,
    position: value(formData, "position") || null, phone: value(formData, "phone") || null,
    status: value(formData, "activeStatus") === "true" ? "active" : "inactive",
  }).eq("id", id)
  if (error) return { error: error.message }
  await logAuditEvent({ action: "FACULTY_ACCOUNT_UPDATED", userId: actor.id, email: actor.email, resource: id })
  revalidatePath("/admin/faculty-accounts")
  return { success: true }
}

export async function archiveFacultyAccountAction(id: string): Promise<{ success?: boolean; error?: string }> {
  const actor = await requireAdmin()
  if (!actor) return { error: "Unauthorized" }
  if (!id) return { error: "Faculty ID is required" }
  const { error } = await createAdminClient().from("faculty").update({ status: "inactive" }).eq("id", id)
  if (error) return { error: error.message }
  await logAuditEvent({ action: "FACULTY_ACCOUNT_ARCHIVED", userId: actor.id, email: actor.email, resource: id })
  revalidatePath("/admin/faculty-accounts")
  return { success: true }
}

export async function resetFacultyPasswordAction(formData: FormData): Promise<{ success?: boolean; error?: string; email?: string | null; password?: string }> {
  const actor = await requireAdmin()
  if (!actor) return { error: "Unauthorized" }
  const id = value(formData, "facultyId"), password = value(formData, "newPassword")
  if (!id || password.length < MIN_PASSWORD_LENGTH) return { error: `A faculty ID and a ${MIN_PASSWORD_LENGTH}-character password are required` }
  const admin = createAdminClient()
  const { data: faculty, error: fetchError } = await admin.from("faculty").select("user_id, email").eq("id", id).maybeSingle()
  if (fetchError || !faculty?.user_id) return { error: fetchError?.message ?? "Faculty member has no linked portal login" }
  const { error } = await admin.auth.admin.updateUserById(faculty.user_id, { password })
  if (error) return { error: error.message }
  await admin.from("user_sessions").update({ revoked_at: new Date().toISOString() }).eq("user_id", faculty.user_id).is("revoked_at", null)
  await logAuditEvent({ action: "FACULTY_PASSWORD_RESET", userId: actor.id, email: actor.email, resource: faculty.user_id })
  return { success: true, email: faculty.email, password }
}

function value(formData: FormData, key: string): string { return String(formData.get(key) ?? "").trim() }
