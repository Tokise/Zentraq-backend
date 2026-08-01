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

export interface MedicalRecordDTO {
    id: string
    student_number: string | null
    first_name: string
    last_name: string
    blood_type: string | null
    allergies: string | null
    medical_conditions: string | null
    emergency_contact_name: string | null
    emergency_contact_phone: string | null
    updated_at: string
}

/**
 * Server Action: Fetch medical records for clinic staff.
 * Uses Service Role via createAdminClient() with explicit field selection.
 * Requires clinic staff authentication.
 */
export async function getMedicalRecordsAction() {
    try {
        const auth = await requireClinicStaff()
        if (auth.error || !auth.user) {
            return { error: auth.error, records: [] }
        }

        const admin = createAdminClient()
        const { data, error } = await admin
            .from("medical_records")
            .select("id, student_number, first_name, last_name, blood_type, allergies, medical_conditions, emergency_contact_name, emergency_contact_phone, updated_at")
            .order("last_name")

        if (error) {
            console.error("[getMedicalRecordsAction DB Error]:", error)
            return { error: error.message, records: [] }
        }

        return { error: null, records: (data || []) as MedicalRecordDTO[] }
    } catch (err: any) {
        console.error("[getMedicalRecordsAction Exception]:", err)
        return { error: err?.message || "Failed to fetch medical records", records: [] }
    }
}