"use server"

import { createAdminClient } from "@/utils/supabase/admin"
import { cookies } from "next/headers"
import { createClient } from "@/utils/supabase/server"
import { getUserRole } from "@/lib/auth/get-user-role"
import { revalidatePath } from "next/cache"
import { logAuditEvent } from "@/lib/audit-logger"

async function requireClinicStaff() {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { error: "Not authenticated", user: null }
    const role = await getUserRole(user.id)
    if (!["admin", "doctor", "nurse"].includes(role)) return { error: "Access Denied", user: null }
    return { error: null, user }
}

export async function createConsultation(profileId: string, patientName: string, complaint: string) {
    try {
        const auth = await requireClinicStaff()
        if (auth.error || !auth.user) return { error: auth.error }
        const admin = createAdminClient()
        const { data, error } = await admin.from("consultations").insert({
            profile_id: profileId,
            patient_name: patientName,
            student_complaint: complaint,
            status: "waiting",
        }).select().single()
        if (error) return { error: error.message }
        await logAuditEvent({ action: "RFID_SCAN", userId: auth.user.id, email: auth.user.email, resource: data?.id, details: { patientName, complaint } })
        revalidatePath("/consultations")
        return { success: true, data }
    } catch (err: any) { return { error: err?.message || "Server error" } }
}