"use server"

import { createAdminClient } from "@/utils/supabase/admin"
import { cookies } from "next/headers"
import { createClient } from "@/utils/supabase/server"
import { getUserRole } from "@/lib/auth/get-user-role"
import { isAdmin } from "@/lib/auth/roles"
import { logAuditEvent } from "@/lib/audit-logger"

const MIN_PASSWORD_LENGTH = 12

// ─────────────────────────────────────────────────────────────────────────────
// Authorization
// ─────────────────────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<{ userId: string; email: string | null } | { error: string }> {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { error: "Not authenticated" }
    const role = await getUserRole(user.id)
    if (!isAdmin(role)) return { error: "Access Denied: Only administrators can manage faculty accounts" }
    return { userId: user.id, email: user.email ?? null }
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface FacultyAccountDTO {
    id: string
    user_id: string | null
    rfid_uid: string | null
    first_name: string
    last_name: string
    email: string | null
    employee_number: string | null
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

// ─────────────────────────────────────────────────────────────────────────────
// Server Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch faculty accounts with pagination and search.
 */
export async function getFacultyAccountsAction(params?: GetFacultyAccountsParams): Promise<{
    error: string | null
    faculty: FacultyAccountDTO[]
    totalCount: number
}> {
    try {
        const auth = await requireAdmin()
        if ("error" in auth) return { error: auth.error, faculty: [], totalCount: 0 }

        const page = params?.page && params.page > 0 ? params.page : 1
        const pageSize = params?.pageSize && params.pageSize > 0 ? Math.min(params.pageSize, 100) : 20
        const fromIndex = (page - 1) * pageSize
        const toIndex = page * pageSize - 1

        const admin = createAdminClient()

        let query = admin
            .from("faculty_accounts")
            .select("id, user_id, rfid_uid, first_name, last_name, email, employee_number, department, position, specialization, clinic_license, phone, active_status, archived_at, created_at, updated_at", { count: "exact" })
            .order("created_at", { ascending: false })
            .range(fromIndex, toIndex)

        if (params?.searchQuery && params.searchQuery.trim()) {
            const q = params.searchQuery.trim()
            query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,employee_number.ilike.%${q}%`)
        }

        if (params?.department) {
            query = query.eq("department", params.department)
        }

        if (!params?.includeArchived) {
            query = query.is("archived_at", null)
        }

        const { data, error, count } = await query

        if (error) {
            console.error("[getFacultyAccountsAction DB Error]:", error)
            return { error: error.message, faculty: [], totalCount: 0 }
        }

        return {
            error: null,
            faculty: (data || []) as FacultyAccountDTO[],
            totalCount: count || 0,
        }
    } catch (err: any) {
        console.error("[getFacultyAccountsAction Exception]:", err)
        return { error: err?.message || "Failed to fetch faculty accounts", faculty: [], totalCount: 0 }
    }
}

/**
 * Create a new faculty account:
 * 1. Create Auth User (via admin)
 * 2. Create faculty profile
 * 3. Link auth user to profile
 * 4. Audit log
 */
export async function createFacultyAccountAction(formData: FormData): Promise<{
    success?: boolean
    error?: string
    userId?: string
    email?: string
}> {
    try {
        const auth = await requireAdmin()
        if ("error" in auth) return { error: auth.error }

        const firstName = (formData.get("firstName") as string)?.trim()
        const lastName = (formData.get("lastName") as string)?.trim()
        const email = (formData.get("email") as string)?.trim().toLowerCase()
        const password = formData.get("password") as string
        const employeeNumber = (formData.get("employeeNumber") as string)?.trim() || null
        const department = (formData.get("department") as string)?.trim() || null
        const position = (formData.get("position") as string)?.trim() || null
        const specialization = (formData.get("specialization") as string)?.trim() || null
        const clinicLicense = (formData.get("clinicLicense") as string)?.trim() || null
        const phone = (formData.get("phone") as string)?.trim() || null
        const rfidUid = (formData.get("rfidUid") as string)?.trim() || null

        // Validation
        if (!firstName || !lastName) {
            return { error: "First name and last name are required" }
        }
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
            return { error: createError?.message || "Failed to create authentication user" }
        }

        // 2 & 3. Create faculty profile and link auth user
        const { data: profile, error: profileError } = await admin
            .from("faculty_accounts")
            .insert({
                user_id: created.user.id,
                rfid_uid: rfidUid,
                first_name: firstName,
                last_name: lastName,
                email: email,
                employee_number: employeeNumber,
                department: department,
                position: position,
                specialization: specialization,
                clinic_license: clinicLicense,
                phone: phone,
                active_status: true,
            })
            .select()
            .single()

        if (profileError) {
            // Clean up Auth user if DB insert fails
            await admin.auth.admin.deleteUser(created.user.id)
            return { error: profileError.message }
        }

        // 4. Audit log
        await logAuditEvent({
            action: "FACULTY_ACCOUNT_CREATED",
            userId: auth.userId,
            email: auth.email,
            resource: created.user.id,
            details: { firstName, lastName, email, employeeNumber, department },
        })

        return { success: true, userId: created.user.id, email }
    } catch (err: any) {
        console.error("[createFacultyAccountAction Exception]:", err)
        return { error: err?.message || "Failed to create faculty account" }
    }
}

/**
 * Update an existing faculty profile (does NOT touch auth user email).
 */
export async function updateFacultyAccountAction(formData: FormData): Promise<{ success?: boolean; error?: string }> {
    try {
        const auth = await requireAdmin()
        if ("error" in auth) return { error: auth.error }

        const profileId = (formData.get("profileId") as string)?.trim()
        const firstName = (formData.get("firstName") as string)?.trim()
        const lastName = (formData.get("lastName") as string)?.trim()
        const employeeNumber = (formData.get("employeeNumber") as string)?.trim() || null
        const department = (formData.get("department") as string)?.trim() || null
        const position = (formData.get("position") as string)?.trim() || null
        const specialization = (formData.get("specialization") as string)?.trim() || null
        const clinicLicense = (formData.get("clinicLicense") as string)?.trim() || null
        const phone = (formData.get("phone") as string)?.trim() || null
        const activeStatus = (formData.get("activeStatus") as string) === "true"

        if (!profileId || !firstName || !lastName) {
            return { error: "Missing required fields" }
        }

        const admin = createAdminClient()

        const { error } = await admin
            .from("faculty_accounts")
            .update({
                first_name: firstName,
                last_name: lastName,
                employee_number: employeeNumber,
                department: department,
                position: position,
                specialization: specialization,
                clinic_license: clinicLicense,
                phone: phone,
                active_status: activeStatus,
            })
            .eq("id", profileId)

        if (error) {
            console.error("[updateFacultyAccountAction DB Error]:", error)
            return { error: error.message }
        }

        await logAuditEvent({
            action: "FACULTY_ACCOUNT_UPDATED",
            userId: auth.userId,
            email: auth.email,
            resource: profileId,
            details: { firstName, lastName, department },
        })

        return { success: true }
    } catch (err: any) {
        console.error("[updateFacultyAccountAction Exception]:", err)
        return { error: err?.message || "Failed to update faculty account" }
    }
}

/**
 * Archive (soft-delete) a faculty account.
 */
export async function archiveFacultyAccountAction(id: string): Promise<{ success?: boolean; error?: string }> {
    try {
        const auth = await requireAdmin()
        if ("error" in auth) return { error: auth.error }

        if (!id) return { error: "Faculty ID is required" }

        const admin = createAdminClient()

        const { error } = await admin
            .from("faculty_accounts")
            .update({
                active_status: false,
                archived_at: new Date().toISOString(),
            })
            .eq("id", id)

        if (error) {
            console.error("[archiveFacultyAccountAction DB Error]:", error)
            return { error: error.message }
        }

        await logAuditEvent({
            action: "FACULTY_ACCOUNT_ARCHIVED",
            userId: auth.userId,
            email: auth.email,
            resource: id,
            details: { action: "ARCHIVE" },
        })

        return { success: true }
    } catch (err: any) {
        console.error("[archiveFacultyAccountAction Exception]:", err)
        return { error: err?.message || "Failed to archive faculty account" }
    }
}

/**
 * Reset a faculty member's password.
 */
export async function resetFacultyPasswordAction(formData: FormData): Promise<{
    success?: boolean
    error?: string
    email?: string | null
    password?: string
}> {
    try {
        const auth = await requireAdmin()
        if ("error" in auth) return { error: auth.error }

        const facultyId = (formData.get("facultyId") as string)?.trim()
        const newPassword = formData.get("newPassword") as string

        if (!facultyId || !newPassword) {
            return { error: "Missing required fields" }
        }
        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }
        }

        const admin = createAdminClient()

        const { data: faculty, error: fetchError } = await admin
            .from("faculty_accounts")
            .select("user_id, email")
            .eq("id", facultyId)
            .maybeSingle()

        if (fetchError || !faculty) {
            return { error: fetchError?.message || "Faculty account not found" }
        }

        if (!faculty.user_id) {
            return { error: "This faculty member has no linked portal login" }
        }

        const { error: updateError } = await admin.auth.admin.updateUserById(
            faculty.user_id,
            { password: newPassword }
        )

        if (updateError) {
            return { error: updateError.message }
        }

        // Clear session token to invalidate existing logins
        await admin
            .from("faculty_accounts")
            .update({ current_session_token: null })
            .eq("id", facultyId)

        await logAuditEvent({
            action: "FACULTY_PASSWORD_RESET",
            userId: auth.userId,
            email: auth.email,
            resource: faculty.user_id,
            details: { facultyId },
        })

        return { success: true, email: faculty.email, password: newPassword }
    } catch (err: any) {
        console.error("[resetFacultyPasswordAction Exception]:", err)
        return { error: err?.message || "Failed to reset faculty password" }
    }
}