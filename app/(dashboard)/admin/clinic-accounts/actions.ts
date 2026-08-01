"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { getUserRole } from "@/lib/auth/get-user-role"
import { isAdmin } from "@/lib/auth/roles"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
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
      error: "Access Denied: Only administrators can manage clinic operator accounts",
      user: null,
    }
  }

  return { error: null, user }
}

export async function createOperator(formData: FormData) {
  try {
    const auth = await requireAdmin()
    if (auth.error || !auth.user) {
      return { error: auth.error ?? "Unauthorized" }
    }

    const email = (formData.get("email") as string)?.trim().toLowerCase()
    const password = formData.get("password") as string
    const fullName = (formData.get("fullName") as string)?.trim()
    const role = (formData.get("role") as string)?.trim() || "nurse"

    if (!email || !password) {
      return { error: "Email and password are required" }
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }
    }

    const admin = createAdminClient()

    // 1. Create Auth User
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (createError || !created.user) {
      return { error: createError?.message || "Failed to create operator account" }
    }

    // 2. Insert into clinic_accounts table (Target table correctly updated from legacy profiles)
    const accountPayload = {
      id: created.user.id,
      email,
      role,
      full_name: fullName || null,
    }

    const { error: profileError } = await admin
      .from("clinic_accounts")
      .upsert(accountPayload)

    if (profileError) {
      // Clean up Auth user if DB insert fails
      await admin.auth.admin.deleteUser(created.user.id)
      return { error: profileError.message }
    }

    // 3. Log Audit Event
    await logAuditEvent({
      action: "OPERATOR_CREATED",
      userId: auth.user.id,
      email: auth.user.email,
      resource: created.user.id,
      details: { createdEmail: email, role, fullName },
    })

    revalidatePath("/admin/clinic-accounts")
    return { success: true }
  } catch (err: any) {
    console.error("[createOperator Exception]:", err)
    return { error: err?.message || "Unknown server error occurred." }
  }
}

export async function removeOperator(targetUserId: string) {
  try {
    const auth = await requireAdmin()
    if (auth.error || !auth.user) {
      return { error: auth.error ?? "Unauthorized" }
    }

    if (targetUserId === auth.user.id) {
      return { error: "Security Violation: You cannot remove your own administrator account" }
    }

    const admin = createAdminClient()

    // Delete clinic_accounts record
    const { error: dbDeleteError } = await admin
      .from("clinic_accounts")
      .delete()
      .eq("id", targetUserId)

    if (dbDeleteError) {
      return { error: dbDeleteError.message }
    }

    // Delete auth user
    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(targetUserId)
    if (deleteAuthError) {
      return { error: deleteAuthError.message }
    }

    // Log Audit Event
    await logAuditEvent({
      action: "OPERATOR_REMOVED",
      userId: auth.user.id,
      email: auth.user.email,
      resource: targetUserId,
    })

    revalidatePath("/admin/clinic-accounts")
    return { success: true }
  } catch (err: any) {
    console.error("[removeOperator Exception]:", err)
    return { error: err?.message || "Unknown server error occurred." }
  }
}

export interface StaffAccountDTO {
  id: string
  email: string
  role: "admin" | "nurse" | "doctor"
  full_name: string | null
  created_at: string
}

export async function getClinicAccountsAction() {
  try {
    const auth = await requireAdmin()
    if (auth.error || !auth.user) {
      return { error: auth.error, operators: [] }
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from("clinic_accounts")
      .select("id, email, role, full_name, created_at")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[getClinicAccountsAction DB Error]:", error)
      return { error: error.message, operators: [] }
    }

    return { error: null, operators: (data || []) as StaffAccountDTO[] }
  } catch (err: any) {
    console.error("[getClinicAccountsAction Exception]:", err)
    return { error: err?.message || "Failed to load staff accounts", operators: [] }
  }
}
