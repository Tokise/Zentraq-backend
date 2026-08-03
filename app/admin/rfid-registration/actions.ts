"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { getUserRole } from "@/lib/auth/get-user-role"
import { isAdmin } from "@/lib/auth/roles"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { logAuditEvent } from "@/lib/audit-logger"

const MIN_PASSWORD_LENGTH = 12
const STUDENT_ID_PREFIX = "23011"

async function requireAdmin() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", user: null }
  }

  const role = await getUserRole(user.id)

  if (!isAdmin(role)) {
    return {
      error: "Access Denied: Only administrators can execute student registration & password resets",
      user: null,
    }
  }

  return { error: null, user }
}

export type CreateStudentAccountResult =
  | { success: true; userId: string; email: string; password: string; error?: undefined }
  | { success?: false; error: string; userId?: undefined; email?: undefined; password?: undefined }

export type ResetStudentPasswordResult =
  | { success: true; email: string | null; password: string; error?: undefined }
  | { success?: false; error: string; email?: undefined; password?: undefined }

export type RegisterStudentProfileResult =
  | { success: true; data: any; error?: undefined }
  | { success?: false; error: string; data?: undefined }

export type UpdateStudentProfileResult =
  | { success: true; data: any; error?: undefined }
  | { success?: false; error: string; data?: undefined }

export type GenerateStudentIdResult =
  | { success: true; suffix: string; error?: undefined }
  | { success?: false; error: string; suffix?: undefined }

/**
 * Server Action: Register a new student profile.
 * Uses Service Role via createAdminClient() to bypass RLS.
 * Requires admin authentication.
 */
export async function registerStudentProfile(formData: FormData): Promise<RegisterStudentProfileResult> {
  try {
    const auth = await requireAdmin()
    if (auth.error || !auth.user) {
      return { error: auth.error }
    }

    const rfidUid = (formData.get("rfidUid") as string)?.trim()
    const firstName = (formData.get("firstName") as string)?.trim()
    const lastName = (formData.get("lastName") as string)?.trim()
    const email = (formData.get("email") as string)?.trim().toLowerCase() || null
    const department = (formData.get("department") as string)?.trim() || null
    const course = (formData.get("course") as string)?.trim() || null
    const yearLevel = (formData.get("yearLevel") as string)?.trim() || null
    const position = (formData.get("position") as string)?.trim() || null
    const studentNumber = (formData.get("studentNumber") as string)?.trim() || null
    const employeeNumber = (formData.get("employeeNumber") as string)?.trim() || null
    const clinicPhotoUrl = (formData.get("clinicPhotoUrl") as string)?.trim() || null
    const role = (formData.get("role") as string)?.trim() || "student"

    // Validate required fields
    if (!rfidUid || !firstName || !lastName) {
      return { error: "Missing required fields: RFID UID, first name, and last name are required" }
    }

    if (role === "student" && !studentNumber) {
      return { error: "Student number is required for student role" }
    }

    if (role !== "student" && !employeeNumber) {
      return { error: "Employee number is required for faculty/staff role" }
    }

    const admin = createAdminClient()

    // Check if RFID UID is already registered
    const { data: existingRfid, error: rfidError } = await admin
      .from("student_accounts")
      .select("id, first_name, last_name")
      .eq("rfid_uid", rfidUid)
      .maybeSingle()

    if (rfidError) {
      return { error: rfidError.message }
    }

    if (existingRfid) {
      return { error: `RFID card is already registered to ${existingRfid.first_name} ${existingRfid.last_name}` }
    }

    // Insert the new student profile
    const { data, error } = await admin
      .from("student_accounts")
      .insert({
        rfid_uid: rfidUid,
        first_name: firstName,
        last_name: lastName,
        email: email,
        department: department,
        course: role === "student" ? course : null,
        year_level: role === "student" ? yearLevel : null,
        position: role !== "student" ? position : null,
        student_number: role === "student" ? studentNumber : null,
        employee_number: role !== "student" ? employeeNumber : null,
        clinic_photo_url: clinicPhotoUrl,
        active_status: true,
      })
      .select()
      .single()

    if (error) {
      return { error: error.message }
    }

    // Log Audit Event
    await logAuditEvent({
      action: "STUDENT_ACCOUNT_CREATED",
      userId: auth.user.id,
      email: auth.user.email,
      resource: data.id,
      details: {
        firstName,
        lastName,
        role,
        studentNumber: studentNumber,
        rfidUid,
      },
    })

    revalidatePath("/admin/rfid-registration")
    return { success: true, data }
  } catch (err: any) {
    console.error("[registerStudentProfile Exception]:", err)
    return { error: err?.message || "Server error occurred during profile registration" }
  }
}

/**
 * Server Action: Update an existing student profile.
 * Uses Service Role via createAdminClient() to bypass RLS.
 * Requires admin authentication.
 */
export async function updateStudentProfile(formData: FormData): Promise<UpdateStudentProfileResult> {
  try {
    const auth = await requireAdmin()
    if (auth.error || !auth.user) {
      return { error: auth.error }
    }

    const profileId = (formData.get("profileId") as string)?.trim()
    const firstName = (formData.get("firstName") as string)?.trim()
    const lastName = (formData.get("lastName") as string)?.trim()
    const email = (formData.get("email") as string)?.trim().toLowerCase() || null
    const department = (formData.get("department") as string)?.trim() || null
    const course = (formData.get("course") as string)?.trim() || null
    const yearLevel = (formData.get("yearLevel") as string)?.trim() || null
    const position = (formData.get("position") as string)?.trim() || null
    const studentNumber = (formData.get("studentNumber") as string)?.trim() || null
    const employeeNumber = (formData.get("employeeNumber") as string)?.trim() || null
    const clinicPhotoUrl = (formData.get("clinicPhotoUrl") as string)?.trim() || null
    const role = (formData.get("role") as string)?.trim() || "student"

    if (!profileId || !firstName || !lastName) {
      return { error: "Missing required fields: profile ID, first name, and last name are required" }
    }

    if (role === "student" && !studentNumber) {
      return { error: "Student number is required for student role" }
    }

    if (role !== "student" && !employeeNumber) {
      return { error: "Employee number is required for faculty/staff role" }
    }

    const admin = createAdminClient()

    const { data, error } = await admin
      .from("student_accounts")
      .update({
        first_name: firstName,
        last_name: lastName,
        email: email,
        department: department,
        course: role === "student" ? course : null,
        year_level: role === "student" ? yearLevel : null,
        position: role !== "student" ? position : null,
        student_number: role === "student" ? studentNumber : null,
        employee_number: role !== "student" ? employeeNumber : null,
        clinic_photo_url: clinicPhotoUrl,
      })
      .eq("id", profileId)
      .select()
      .single()

    if (error) {
      return { error: error.message }
    }

    // Log Audit Event
    await logAuditEvent({
      action: "STUDENT_ACCOUNT_CREATED",
      userId: auth.user.id,
      email: auth.user.email,
      resource: profileId,
      details: {
        action: "PROFILE_UPDATED",
        firstName,
        lastName,
        role,
      },
    })

    revalidatePath("/admin/rfid-registration")
    return { success: true, data }
  } catch (err: any) {
    console.error("[updateStudentProfile Exception]:", err)
    return { error: err?.message || "Server error occurred during profile update" }
  }
}

/**
 * Server Action: Look up a student profile by RFID UID.
 * Uses Service Role via createAdminClient() for consistent reads.
 */
export async function lookupStudentByRfid(formData: FormData) {
  try {
    const auth = await requireAdmin()
    if (auth.error || !auth.user) {
      return { error: auth.error, data: null }
    }

    const rfidUid = (formData.get("rfidUid") as string)?.trim()
    if (!rfidUid) {
      return { error: "RFID UID is required", data: null }
    }

    const admin = createAdminClient()

    const { data, error } = await admin
      .from("student_accounts")
      .select("*")
      .eq("rfid_uid", rfidUid)
      .maybeSingle()

    if (error) {
      return { error: error.message, data: null }
    }

    return { data, error: null }
  } catch (err: any) {
    console.error("[lookupStudentByRfid Exception]:", err)
    return { error: err?.message || "Server error occurred during lookup", data: null }
  }
}

/**
 * Server Action: Generate the next available student ID suffix.
 * Uses Service Role via createAdminClient() to ensure consistent reads.
 */
export async function generateStudentId(): Promise<GenerateStudentIdResult> {
  try {
    const auth = await requireAdmin()
    if (auth.error || !auth.user) {
      return { error: auth.error }
    }

    const admin = createAdminClient()

    const { data: lastRecords, error: lastError } = await admin
      .from("student_accounts")
      .select("student_number")
      .not("student_number", "is", null)
      .like("student_number", `${STUDENT_ID_PREFIX}%`)
      .order("student_number", { ascending: false })
      .limit(1)

    if (lastError) {
      return { error: lastError.message }
    }

    let nextNumber = 1
    if (lastRecords && lastRecords.length > 0) {
      const lastSuffix = lastRecords[0].student_number?.slice(STUDENT_ID_PREFIX.length) || "0000"
      const lastNum = parseInt(lastSuffix, 10)
      if (!isNaN(lastNum)) nextNumber = lastNum + 1
    }

    let suffix = String(nextNumber).padStart(4, "0")
    let attempts = 0
    while (attempts < 50) {
      const candidate = `${STUDENT_ID_PREFIX}${suffix}`
      const { data: existing, error: checkError } = await admin
        .from("student_accounts")
        .select("id")
        .eq("student_number", candidate)
        .maybeSingle()
      if (checkError) {
        return { error: checkError.message }
      }
      if (!existing) break
      nextNumber++
      suffix = String(nextNumber).padStart(4, "0")
      attempts++
    }

    if (nextNumber > 9999) {
      return { error: "All student IDs in the 23011-0001 to 23011-9999 range are taken." }
    }

    return { success: true, suffix }
  } catch (err: any) {
    console.error("[generateStudentId Exception]:", err)
    return { error: err?.message || "Server error occurred during ID generation" }
  }
}

export async function createStudentAccount(formData: FormData): Promise<CreateStudentAccountResult> {
  try {
    const auth = await requireAdmin()
    if (auth.error || !auth.user) {
      return { error: auth.error }
    }

    const email = (formData.get("email") as string)?.trim().toLowerCase()
    const password = formData.get("password") as string
    const studentAccountId = (formData.get("studentAccountId") as string)?.trim()

    if (!email || !password || !studentAccountId) {
      return { error: "Missing required fields: email, password, or student profile ID" }
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }
    }

    const admin = createAdminClient()

    // Verify student account exists and does not already have a user linked
    const { data: studentAccount, error: fetchError } = await admin
      .from("student_accounts")
      .select("id, user_id, email")
      .eq("id", studentAccountId)
      .maybeSingle()

    if (fetchError || !studentAccount) {
      return { error: fetchError?.message || "Student record not found" }
    }

    if (studentAccount.user_id) {
      return { error: "This student profile already has an active portal account linked." }
    }

    // Create Auth User
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (createError || !created.user) {
      return { error: createError?.message || "Failed to create authentication user" }
    }

    // Link user_id and email in student_accounts
    const { error: linkError } = await admin
      .from("student_accounts")
      .update({
        user_id: created.user.id,
        email: email,
      })
      .eq("id", studentAccountId)

    if (linkError) {
      // Clean up Auth user if linking fails
      await admin.auth.admin.deleteUser(created.user.id)
      return { error: linkError.message }
    }

    // Log Audit Event
    await logAuditEvent({
      action: "STUDENT_ACCOUNT_CREATED",
      userId: auth.user.id,
      email: auth.user.email,
      resource: created.user.id,
      details: { studentAccountId, studentEmail: email },
    })

    return {
      success: true,
      userId: created.user.id,
      email,
      password,
    }
  } catch (err: any) {
    console.error("[createStudentAccount Exception]:", err)
    return { error: err?.message || "Server error occurred during student account creation" }
  }
}

export async function resetStudentPassword(formData: FormData): Promise<ResetStudentPasswordResult> {
  try {
    const auth = await requireAdmin()
    if (auth.error || !auth.user) {
      return { error: auth.error }
    }

    const studentAccountId = (formData.get("studentAccountId") as string)?.trim()
    const newPassword = formData.get("newPassword") as string

    if (!studentAccountId || !newPassword) {
      return { error: "Missing required fields" }
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }
    }

    const admin = createAdminClient()

    const { data: studentAccount, error: fetchError } = await admin
      .from("student_accounts")
      .select("user_id, email")
      .eq("id", studentAccountId)
      .maybeSingle()

    if (fetchError || !studentAccount) {
      return { error: fetchError?.message || "Student account record not found" }
    }

    if (!studentAccount.user_id) {
      return { error: "This student account has no linked portal login" }
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(
      studentAccount.user_id,
      { password: newPassword }
    )

    if (updateError) {
      return { error: updateError.message }
    }

    // Clear session token to invalidate existing active logins for this student
    await admin
      .from("student_accounts")
      .update({ current_session_token: null })
      .eq("id", studentAccountId)

    // Log Audit Event
    await logAuditEvent({
      action: "AUTH_PASSWORD_RESET",
      userId: auth.user.id,
      email: auth.user.email,
      resource: studentAccount.user_id,
      details: { studentAccountId },
    })

    return {
      success: true,
      email: studentAccount.email,
      password: newPassword,
    }
  } catch (err: any) {
    console.error("[resetStudentPassword Exception]:", err)
    return { error: err?.message || "Server error occurred during password reset" }
  }
}