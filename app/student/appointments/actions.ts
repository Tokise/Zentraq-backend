"use server"

import { createAdminClient } from "@/utils/supabase/admin"
import { cookies } from "next/headers"
import { createClient } from "@/utils/supabase/server"
import { getUserRole } from "@/lib/auth/get-user-role"
import { revalidatePath } from "next/cache"
import { logAuditEvent } from "@/lib/audit-logger"

async function requireStudent() {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { error: "Not authenticated", user: null }
    const role = await getUserRole(user.id)
    if (role !== "student") return { error: "Access Denied: Students only", user: null }
    return { error: null, user }
}

export async function createAppointment(data: {
    studentUserId: string
    appointmentDate: string
    timeSlot: string
    complaint: string
    patientName: string
    department: string
}) {
    try {
        const auth = await requireStudent()
        if (auth.error || !auth.user) return { error: auth.error }
        const admin = createAdminClient()
        const { error } = await admin.from("student_appointments").insert({
            student_user_id: data.studentUserId,
            appointment_date: data.appointmentDate,
            time_slot: data.timeSlot,
            complaint: data.complaint,
            patient_name: data.patientName,
            department: data.department,
            status: "pending",
        })
        if (error) return { error: error.message }
        await logAuditEvent({ action: "APPOINTMENT_CHANGE", userId: auth.user.id, email: auth.user.email, details: { action: "STUDENT_CREATED", ...data } })
        revalidatePath("/student/appointments")
        return { success: true }
    } catch (err: any) { return { error: err?.message || "Server error" } }
}

export async function cancelAppointment(id: string) {
    try {
        const auth = await requireStudent()
        if (auth.error || !auth.user) return { error: auth.error }
        const admin = createAdminClient()
        const { error } = await admin.from("student_appointments").update({ status: "cancelled" }).eq("id", id)
        if (error) return { error: error.message }
        await logAuditEvent({ action: "APPOINTMENT_CHANGE", userId: auth.user.id, email: auth.user.email, resource: id, details: { action: "STUDENT_CANCELLED" } })
        revalidatePath("/student/appointments")
        return { success: true }
    } catch (err: any) { return { error: err?.message || "Server error" } }
}
