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

export async function updateEmergencyComplaint(id: string, complaint: string) {
    try {
        const auth = await requireClinicStaff()
        if (auth.error || !auth.user) return { error: auth.error }
        const admin = createAdminClient()
        const { error } = await admin.from("consultations").update({ student_complaint: complaint }).eq("id", id)
        if (error) return { error: error.message }
        revalidatePath("/consultations/emergency")
        return { success: true }
    } catch (err: any) { return { error: err?.message || "Server error" } }
}

export async function updateEmergencyStatus(id: string, status: string) {
    try {
        const auth = await requireClinicStaff()
        if (auth.error || !auth.user) return { error: auth.error }
        const admin = createAdminClient()
        const { error } = await admin.from("consultations").update({ status }).eq("id", id)
        if (error) return { error: error.message }
        await logAuditEvent({ action: "APPOINTMENT_CHANGE", userId: auth.user.id, email: auth.user.email, resource: id, details: { action: "EMERGENCY_STATUS_UPDATE", status } })
        revalidatePath("/consultations/emergency")
        return { success: true }
    } catch (err: any) { return { error: err?.message || "Server error" } }
}

export async function completeEmergencyCase(id: string, complaint: string, notesJson: string, disposition: string, patientName: string) {
    try {
        const auth = await requireClinicStaff()
        if (auth.error || !auth.user) return { error: auth.error }
        const admin = createAdminClient()
        const now = new Date().toISOString()
        const { error: consultError } = await admin.from("consultations").update({ status: "completed", student_complaint: complaint, handled_at: now, notes: notesJson }).eq("id", id)
        if (consultError) return { error: consultError.message }
        const report = JSON.parse(notesJson)
        const { error: visitError } = await admin.from("visit_logs").insert({ consultation_id: id, patient_name: patientName, student_complaint: complaint, origin: "emergency", diagnosis: report.diagnosis, treatment: report.treatment, recommendations: report.recommendations, handled_at: now, status: disposition })
        if (visitError) return { error: visitError.message }
        await logAuditEvent({ action: "MEDICAL_RECORD_MODIFY", userId: auth.user.id, email: auth.user.email, resource: id, details: { action: "EMERGENCY_COMPLETED", disposition } })
        revalidatePath("/consultations/emergency")
        return { success: true }
    } catch (err: any) { return { error: err?.message || "Server error" } }
}