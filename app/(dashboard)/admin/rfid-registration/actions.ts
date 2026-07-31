"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { getUserRole } from "@/lib/auth/get-user-role"
import { isAdmin } from "@/lib/auth/roles"
import { cookies } from "next/headers"
import { logAuditEvent } from "@/lib/audit-logger"

const MIN_PASSWORD_LENGTH = 12

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