"use server"

import { createAdminClient } from "@/utils/supabase/admin"
import { cookies } from "next/headers"
import { createClient } from "@/utils/supabase/server"
import { getUserRole } from "@/lib/auth/get-user-role"

async function requireClinicStaff() {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { error: "Not authenticated", user: null }
    const role = await getUserRole(user.id)
    if (!["admin", "doctor", "nurse"].includes(role)) return { error: "Access Denied", user: null }
    return { error: null, user }
}

export interface PatientDTO {
    id: string
    student_number: string | null
    employee_number: string | null
    first_name: string
    last_name: string
    email: string | null
    department: string | null
    rfid_uid: string | null
    active_status: boolean
}

/**
 * Server Action: Fetch patient directory for clinic staff.
 * Uses Service Role via createAdminClient() with explicit field selection.
 * Requires clinic staff authentication.
 */
export async function getPatientsAction() {
    try {
        const auth = await requireClinicStaff()
        if (auth.error || !auth.user) {
            return { error: auth.error, patients: [] }
        }

        const admin = createAdminClient()
        const { data, error } = await admin
            .from("student_accounts")
            .select("id, student_number, employee_number, first_name, last_name, email, department, rfid_uid, active_status")
            .order("last_name")

        if (error) {
            console.error("[getPatientsAction DB Error]:", error)
            return { error: error.message, patients: [] }
        }

        return { error: null, patients: (data || []) as PatientDTO[] }
    } catch (err: any) {
        console.error("[getPatientsAction Exception]:", err)
        return { error: err?.message || "Failed to fetch patients", patients: [] }
    }
}