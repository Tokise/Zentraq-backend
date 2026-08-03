"use server"

import { createAdminClient } from "@/utils/supabase/admin"
import { cookies } from "next/headers"
import { createClient } from "@/utils/supabase/server"
import { getUserRole } from "@/lib/auth/get-user-role"
import { isAdmin } from "@/lib/auth/roles"
import { revalidatePath } from "next/cache"
import { logAuditEvent } from "@/lib/audit-logger"

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
            error: "Access Denied: Only administrators can manage student accounts",
            user: null,
        }
    }

    return { error: null, user }
}

export async function toggleStudentActiveStatus(profileId: string, currentStatus: boolean) {
    try {
        const auth = await requireAdmin()
        if (auth.error || !auth.user) {
            return { error: auth.error }
        }

        const admin = createAdminClient()

        const { error } = await admin
            .from("student_accounts")
            .update({ active_status: !currentStatus })
            .eq("id", profileId)

        if (error) {
            return { error: error.message }
        }

        await logAuditEvent({
            action: "STUDENT_ACCOUNT_CREATED",
            userId: auth.user.id,
            email: auth.user.email,
            resource: profileId,
            details: {
                action: "ACTIVE_STATUS_TOGGLED",
                previousStatus: currentStatus,
                newStatus: !currentStatus,
            },
        })

        revalidatePath("/admin/student-accounts")
        return { success: true }
    } catch (err: any) {
        console.error("[toggleStudentActiveStatus Exception]:", err)
        return { error: err?.message || "Server error occurred" }
    }
}

export async function saveStudentProfileEdit(profileId: string, formData: {
    firstName: string
    lastName: string
    email: string | null
    department: string | null
    course: string | null
    yearLevel: string | null
    position: string | null
    studentNumber: string | null
    employeeNumber: string | null
}) {
    try {
        const auth = await requireAdmin()
        if (auth.error || !auth.user) {
            return { error: auth.error }
        }

        const isStudent = !!formData.studentNumber

        const admin = createAdminClient()

        const payload = {
            first_name: formData.firstName,
            last_name: formData.lastName,
            email: formData.email || null,
            department: formData.department || null,
            course: isStudent ? (formData.course || null) : null,
            year_level: isStudent ? (formData.yearLevel || null) : null,
            position: !isStudent ? (formData.position || null) : null,
            student_number: isStudent ? formData.studentNumber : null,
            employee_number: !isStudent ? formData.employeeNumber : null,
        }

        const { data, error } = await admin
            .from("student_accounts")
            .update(payload)
            .eq("id", profileId)
            .select()
            .maybeSingle()

        if (error) {
            return { error: error.message }
        }

        await logAuditEvent({
            action: "STUDENT_ACCOUNT_CREATED",
            userId: auth.user.id,
            email: auth.user.email,
            resource: profileId,
            details: {
                action: "PROFILE_EDITED",
                ...payload,
            },
        })

        revalidatePath("/admin/student-accounts")
        return { success: true, data }
    } catch (err: any) {
        console.error("[saveStudentProfileEdit Exception]:", err)
        return { error: err?.message || "Server error occurred" }
    }
}

export async function archiveStudentProfile(profileId: string, isArchived: boolean) {
    try {
        const auth = await requireAdmin()
        if (auth.error || !auth.user) {
            return { error: auth.error }
        }

        const admin = createAdminClient()

        const nextArchivedAt = isArchived ? null : new Date().toISOString()

        const { error } = await admin
            .from("student_accounts")
            .update({ archived_at: nextArchivedAt })
            .eq("id", profileId)

        if (error) {
            return { error: error.message }
        }

        await logAuditEvent({
            action: "STUDENT_ACCOUNT_CREATED",
            userId: auth.user.id,
            email: auth.user.email,
            resource: profileId,
            details: {
                action: isArchived ? "ARCHIVE_REMOVED" : "PROFILE_ARCHIVED",
            },
        })

        revalidatePath("/admin/student-accounts")
        return { success: true }
    } catch (err: any) {
        console.error("[archiveStudentProfile Exception]:", err)
        return { error: err?.message || "Server error occurred" }
    }
}

export async function getStudentAccountsAction() {
    try {
        const auth = await requireAdmin()
        if (auth.error || !auth.user) {
            return { error: auth.error, patients: [] }
        }

        const admin = createAdminClient()
        const { data, error } = await admin
            .from("student_accounts")
            .select("id, rfid_uid, first_name, last_name, email, department, course, year_level, position, student_number, employee_number, clinic_photo_url, active_status, archived_at, created_at")
            .order("last_name", { ascending: true })

        if (error) {
            console.error("[getStudentAccountsAction DB Error]:", error)
            return { error: error.message, patients: [] }
        }

        return { error: null, patients: data || [] }
    } catch (err: any) {
        console.error("[getStudentAccountsAction Exception]:", err)
        return { error: err?.message || "Failed to fetch student accounts", patients: [] }
    }
}