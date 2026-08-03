"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { getUserRole } from "@/lib/auth/get-user-role"
import { logAuditEvent } from "@/lib/audit-logger"

const MIN_PASSWORD_LENGTH = 12
const STUDENT_ID_PREFIX = "23011"
type ProfileRole = "student" | "faculty"
type Profile = {
  id: string; role: ProfileRole; user_id: string | null; rfid_uid: string; first_name: string; last_name: string; email: string | null;
  department: string | null; course: string | null; year_level: string | null; position: string | null; student_number: string | null;
  employee_number: string | null; clinic_photo_url: string | null; active_status: boolean
}

async function requireAdmin() {
  const cookieStore = await cookies(); const supabase = createClient(cookieStore)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user || await getUserRole(user.id) !== "admin") return null
  return user
}

function normalizeProfile(row: Record<string, unknown>, role: ProfileRole): Profile {
  return {
    id: String(row.id), role, user_id: (row.user_id as string | null) ?? null, rfid_uid: String(row.rfid_uid ?? ""), first_name: String(row.first_name ?? ""), last_name: String(row.last_name ?? ""), email: (row.email as string | null) ?? null,
    department: (row.department as string | null) ?? null, course: role === "student" ? (row.course as string | null) ?? null : null, year_level: role === "student" && row.year_level != null ? String(row.year_level) : null,
    position: role === "faculty" ? (row.position as string | null) ?? null : null, student_number: role === "student" ? (row.student_number as string | null) ?? null : null, employee_number: role === "faculty" ? (row.employee_number as string | null) ?? null : null,
    clinic_photo_url: role === "student" ? (row.profile_photo_url as string | null) ?? null : null, active_status: row.status === "active",
  }
}

async function findProfile(admin: ReturnType<typeof createAdminClient>, id: string): Promise<Profile | null> {
  const { data: student } = await admin.from("students").select("id, user_id, rfid_uid, first_name, last_name, email, department, course, year_level, student_number, profile_photo_url, status").eq("id", id).maybeSingle()
  if (student) return normalizeProfile(student, "student")
  const { data: faculty } = await admin.from("faculty").select("id, user_id, rfid_uid, first_name, last_name, email, department, position, employee_number, status").eq("id", id).maybeSingle()
  return faculty ? normalizeProfile(faculty, "faculty") : null
}

export async function registerStudentProfile(formData: FormData) {
  const actor = await requireAdmin(); if (!actor) return { error: "Unauthorized" }
  const role = String(formData.get("role") ?? "student") === "student" ? "student" : "faculty" as ProfileRole
  const rfidUid = String(formData.get("rfidUid") ?? "").trim(); const firstName = String(formData.get("firstName") ?? "").trim(); const lastName = String(formData.get("lastName") ?? "").trim()
  const identifier = String(formData.get(role === "student" ? "studentNumber" : "employeeNumber") ?? "").trim()
  if (!rfidUid || !firstName || !lastName || !identifier) return { error: "RFID UID, name, and ID number are required" }
  const admin = createAdminClient()
  const [{ data: studentRfid }, { data: facultyRfid }] = await Promise.all([admin.from("students").select("id").eq("rfid_uid", rfidUid).maybeSingle(), admin.from("faculty").select("id").eq("rfid_uid", rfidUid).maybeSingle()])
  if (studentRfid || facultyRfid) return { error: "RFID card is already registered" }
  const email = String(formData.get("email") ?? "").trim().toLowerCase() || null
  const shared = { rfid_uid: rfidUid, first_name: firstName, last_name: lastName, email, department: String(formData.get("department") ?? "").trim() || null, status: "active" }
  const result = role === "student"
    ? await admin.from("students").insert({ ...shared, student_number: identifier, course: String(formData.get("course") ?? "").trim() || null, year_level: Number(formData.get("yearLevel")) || null, profile_photo_url: String(formData.get("clinicPhotoUrl") ?? "").trim() || null }).select("id, user_id, rfid_uid, first_name, last_name, email, department, course, year_level, student_number, profile_photo_url, status").single()
    : await admin.from("faculty").insert({ ...shared, employee_number: identifier, position: String(formData.get("position") ?? "").trim() || null }).select("id, user_id, rfid_uid, first_name, last_name, email, department, position, employee_number, status").single()
  if (result.error || !result.data) return { error: result.error?.message ?? "Unable to register profile" }
  await logAuditEvent({ action: "STUDENT_ACCOUNT_CREATED", userId: actor.id, email: actor.email, resource: result.data.id, details: { role } })
  revalidatePath("/admin/rfid-registration")
  return { success: true, data: normalizeProfile(result.data, role) }
}

export async function updateStudentProfile(formData: FormData) {
  const actor = await requireAdmin(); if (!actor) return { error: "Unauthorized" }
  const id = String(formData.get("profileId") ?? "").trim(); const role = String(formData.get("role") ?? "student") === "student" ? "student" : "faculty" as ProfileRole
  const firstName = String(formData.get("firstName") ?? "").trim(); const lastName = String(formData.get("lastName") ?? "").trim(); const identifier = String(formData.get(role === "student" ? "studentNumber" : "employeeNumber") ?? "").trim()
  if (!id || !firstName || !lastName || !identifier) return { error: "Name and ID number are required" }
  const admin = createAdminClient(); const shared = { first_name: firstName, last_name: lastName, email: String(formData.get("email") ?? "").trim().toLowerCase() || null, department: String(formData.get("department") ?? "").trim() || null }
  const result = role === "student"
    ? await admin.from("students").update({ ...shared, student_number: identifier, course: String(formData.get("course") ?? "").trim() || null, year_level: Number(formData.get("yearLevel")) || null, profile_photo_url: String(formData.get("clinicPhotoUrl") ?? "").trim() || null }).eq("id", id).select("id, user_id, rfid_uid, first_name, last_name, email, department, course, year_level, student_number, profile_photo_url, status").single()
    : await admin.from("faculty").update({ ...shared, employee_number: identifier, position: String(formData.get("position") ?? "").trim() || null }).eq("id", id).select("id, user_id, rfid_uid, first_name, last_name, email, department, position, employee_number, status").single()
  if (result.error || !result.data) return { error: result.error?.message ?? "Unable to update profile" }
  await logAuditEvent({ action: "STUDENT_ACCOUNT_CREATED", userId: actor.id, email: actor.email, resource: id, details: { action: "PROFILE_UPDATED", role } })
  return { success: true, data: normalizeProfile(result.data, role) }
}

export async function lookupStudentByRfid(formData: FormData) {
  const actor = await requireAdmin(); if (!actor) return { error: "Unauthorized", data: null }
  const uid = String(formData.get("rfidUid") ?? "").trim(); if (!uid) return { error: "RFID UID is required", data: null }
  const admin = createAdminClient()
  const { data: student } = await admin.from("students").select("id, user_id, rfid_uid, first_name, last_name, email, department, course, year_level, student_number, profile_photo_url, status").eq("rfid_uid", uid).maybeSingle()
  if (student) return { error: null, data: normalizeProfile(student, "student") }
  const { data: faculty } = await admin.from("faculty").select("id, user_id, rfid_uid, first_name, last_name, email, department, position, employee_number, status").eq("rfid_uid", uid).maybeSingle()
  return { error: null, data: faculty ? normalizeProfile(faculty, "faculty") : null }
}

export async function generateStudentId() {
  const actor = await requireAdmin(); if (!actor) return { error: "Unauthorized" }
  const { data, error } = await createAdminClient().from("students").select("student_number").like("student_number", `${STUDENT_ID_PREFIX}%`).order("student_number", { ascending: false }).limit(1)
  if (error) return { error: error.message }
  const last = data?.[0]?.student_number?.slice(STUDENT_ID_PREFIX.length) ?? "0"; const next = Number(last) + 1
  if (next > 9999) return { error: "All student IDs in the configured range are taken." }
  return { success: true, suffix: String(next).padStart(4, "0") }
}

export async function createStudentAccount(formData: FormData) {
  const actor = await requireAdmin(); if (!actor) return { error: "Unauthorized" }
  const email = String(formData.get("email") ?? "").trim().toLowerCase(); const password = String(formData.get("password") ?? ""); const profileId = String(formData.get("studentAccountId") ?? "").trim()
  if (!email || !profileId || password.length < MIN_PASSWORD_LENGTH) return { error: "Valid email, profile, and a 12-character password are required" }
  const admin = createAdminClient(); const profile = await findProfile(admin, profileId)
  if (!profile) return { error: "Patient profile not found" }; if (profile.user_id) return { error: "This profile already has a portal account" }
  const { data: created, error: authError } = await admin.auth.admin.createUser({ email, password, email_confirm: true }); if (authError || !created.user) return { error: authError?.message ?? "Unable to create login" }
  const { data: roleRow } = await admin.from("roles").select("id").eq("name", profile.role).maybeSingle()
  if (!roleRow) { await admin.auth.admin.deleteUser(created.user.id); return { error: `The ${profile.role} role has not been seeded` } }
  const { error: userError } = await admin.from("users").insert({ id: created.user.id, email })
  if (!userError) await admin.from("user_roles").insert({ user_id: created.user.id, role_id: roleRow.id })
  const table = profile.role === "student" ? "students" : "faculty"; const { error: linkError } = await admin.from(table).update({ user_id: created.user.id, email }).eq("id", profile.id)
  if (userError || linkError) { await admin.auth.admin.deleteUser(created.user.id); return { error: userError?.message ?? linkError?.message ?? "Unable to link account" } }
  await logAuditEvent({ action: "STUDENT_ACCOUNT_CREATED", userId: actor.id, email: actor.email, resource: created.user.id, details: { profile_id: profile.id, role: profile.role } })
  return { success: true, userId: created.user.id, email, password }
}

export async function resetStudentPassword(formData: FormData) {
  const actor = await requireAdmin(); if (!actor) return { error: "Unauthorized" }
  const profileId = String(formData.get("studentAccountId") ?? "").trim(); const password = String(formData.get("newPassword") ?? "")
  if (!profileId || password.length < MIN_PASSWORD_LENGTH) return { error: "A profile and a 12-character password are required" }
  const admin = createAdminClient(); const profile = await findProfile(admin, profileId)
  if (!profile?.user_id) return { error: "This profile has no portal login" }
  const { error } = await admin.auth.admin.updateUserById(profile.user_id, { password }); if (error) return { error: error.message }
  await admin.from("user_sessions").update({ revoked_at: new Date().toISOString() }).eq("user_id", profile.user_id).is("revoked_at", null)
  await logAuditEvent({ action: "AUTH_PASSWORD_RESET", userId: actor.id, email: actor.email, resource: profile.user_id })
  return { success: true, email: profile.email, password }
}
