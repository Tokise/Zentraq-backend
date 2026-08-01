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

export interface VisitLogDTO {
    id: string
    consultation_id: string | null
    patient_name: string
    student_complaint: string
    origin: string
    diagnosis: string
    treatment: string
    recommendations: string
    handled_at: string
    created_at: string
    status: string
}

/**
 * Server Action: Fetch visit logs for the clinic staff.
 * Uses Service Role via createAdminClient() with explicit field selection.
 * Requires clinic staff authentication.
 */
export async function getVisitLogsAction() {
    try {
        const auth = await requireClinicStaff()
        if (auth.error || !auth.user) {
            return { error: auth.error, records: [] }
        }

        const admin = createAdminClient()
        const { data, error } = await admin
            .from("visit_logs")
            .select("id, consultation_id, patient_name, student_complaint, origin, diagnosis, treatment, recommendations, handled_at, created_at, status")
            .order("created_at", { ascending: false })
            .limit(100)

        if (error) {
            console.error("[getVisitLogsAction DB Error]:", error)
            return { error: error.message, records: [] }
        }

        return { error: null, records: (data || []) as VisitLogDTO[] }
    } catch (err: any) {
        console.error("[getVisitLogsAction Exception]:", err)
        return { error: err?.message || "Failed to fetch visit logs", records: [] }
    }
}