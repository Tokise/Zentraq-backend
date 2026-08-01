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

export async function updateAppointmentStatus(id: string, status: string) {
    try {
        const auth = await requireClinicStaff()
        if (auth.error || !auth.user) return { error: auth.error }
        const admin = createAdminClient()
        const { error } = await admin.from("student_appointments").update({ status }).eq("id", id)
        if (error) return { error: error.message }
        await logAuditEvent({ action: "APPOINTMENT_CHANGE", userId: auth.user.id, email: auth.user.email, resource: id, details: { action: "STATUS_UPDATE", status } })
        revalidatePath("/appointments")
        return { success: true }
    } catch (err: any) { return { error: err?.message || "Server error" } }
}

export async function cancelAppointment(id: string) {
    try {
        const auth = await requireClinicStaff()
        if (auth.error || !auth.user) return { error: auth.error }
        const admin = createAdminClient()
        const { error } = await admin.from("student_appointments").update({ status: "cancelled" }).eq("id", id)
        if (error) return { error: error.message }
        await logAuditEvent({ action: "APPOINTMENT_CHANGE", userId: auth.user.id, email: auth.user.email, resource: id, details: { action: "CANCELLED" } })
        revalidatePath("/appointments")
        return { success: true }
    } catch (err: any) { return { error: err?.message || "Server error" } }
}

export async function rescheduleAppointment(id: string, date: string, time: string) {
    try {
        const auth = await requireClinicStaff()
        if (auth.error || !auth.user) return { error: auth.error }
        const admin = createAdminClient()
        const { error } = await admin.from("student_appointments").update({ appointment_date: date, time_slot: time }).eq("id", id)
        if (error) return { error: error.message }
        await logAuditEvent({ action: "APPOINTMENT_CHANGE", userId: auth.user.id, email: auth.user.email, resource: id, details: { action: "RESCHEDULED", date, time } })
        revalidatePath("/appointments")
        return { success: true }
    } catch (err: any) { return { error: err?.message || "Server error" } }
}

export async function updateConsultationStatus(id: string, status: string) {
    try {
        const auth = await requireClinicStaff()
        if (auth.error || !auth.user) return { error: auth.error }
        const admin = createAdminClient()
        const { error } = await admin.from("consultations").update({ status }).eq("id", id)
        if (error) return { error: error.message }
        await logAuditEvent({ action: "APPOINTMENT_CHANGE", userId: auth.user.id, email: auth.user.email, resource: id, details: { action: "STATUS_UPDATE", status } })
        revalidatePath("/appointments")
        return { success: true }
    } catch (err: any) { return { error: err?.message || "Server error" } }
}

export interface ClearedRecordDTO {
    id: string
    patient_name: string
    student_complaint: string | null
    status: string
    created_at: string
    doctor_name: string | null
    nurse_name: string | null
    clearance_type: string | null
    remarks: string | null
}

/**
 * Server Action: Fetch cleared/completed consultations for the clearances archive.
 * Uses Service Role via createAdminClient() with explicit field selection.
 * Requires clinic staff authentication.
 */
export async function getClearedRecordsAction() {
    try {
        const auth = await requireClinicStaff()
        if (auth.error || !auth.user) {
            return { error: auth.error, records: [] }
        }

        const admin = createAdminClient()
        const { data, error } = await admin
            .from("consultations")
            .select("id, patient_name, student_complaint, status, created_at, doctor_name, nurse_name, clearance_type, remarks")
            .in("status", ["completed", "cancelled", "dismissed"])
            .order("created_at", { ascending: false })

        if (error) {
            console.error("[getClearedRecordsAction DB Error]:", error)
            return { error: error.message, records: [] }
        }

        return { error: null, records: (data || []) as ClearedRecordDTO[] }
    } catch (err: any) {
        console.error("[getClearedRecordsAction Exception]:", err)
        return { error: err?.message || "Failed to fetch cleared records", records: [] }
    }
}

export interface StaffAppointmentDTO {
    id: string
    appointment_date: string
    time_slot: string
    reason: string | null
    status: string
    patient_name: string | null
    student_number: string | null
    employee_number: string | null
    department: string | null
}

/**
 * Server Action: Fetch staff-facing appointments with joined student info.
 * Uses Service Role via createAdminClient() with explicit field selection.
 * Requires clinic staff authentication.
 */
export async function getStaffAppointmentsAction() {
    try {
        const auth = await requireClinicStaff()
        if (auth.error || !auth.user) {
            return { error: auth.error, appointments: [] }
        }

        const admin = createAdminClient()

        // Fetch appointments and student profiles separately to avoid exposing student_accounts via join
        const { data: appointments, error: apptError } = await admin
            .from("student_appointments")
            .select("id, appointment_date, time_slot, reason, status, student_user_id, student_account_id")
            .order("appointment_date", { ascending: true })

        if (apptError) {
            console.error("[getStaffAppointmentsAction DB Error]:", apptError)
            return { error: apptError.message, appointments: [] }
        }

        // Resolve student names via student_account_id
        const accountIds = [...new Set((appointments || []).map((a) => a.student_account_id).filter(Boolean))]
        let studentMap: Record<string, { first_name: string | null; last_name: string | null; student_number: string | null; employee_number: string | null; department: string | null }> = {}

        if (accountIds.length > 0) {
            const { data: students } = await admin
                .from("student_accounts")
                .select("id, first_name, last_name, student_number, employee_number, department")
                .in("id", accountIds)

            if (students) {
                studentMap = Object.fromEntries(
                    students.map((s) => [s.id, { first_name: s.first_name, last_name: s.last_name, student_number: s.student_number, employee_number: s.employee_number, department: s.department }])
                )
            }
        }

        const dto: StaffAppointmentDTO[] = (appointments || []).map((a) => {
            const student = a.student_account_id ? studentMap[a.student_account_id] : null
            const fullName = student ? `${student.first_name || ""} ${student.last_name || ""}`.trim() : null
            return {
                id: a.id,
                appointment_date: a.appointment_date,
                time_slot: a.time_slot,
                reason: a.reason || null,
                status: a.status,
                patient_name: fullName,
                student_number: student?.student_number ?? null,
                employee_number: student?.employee_number ?? null,
                department: student?.department ?? null,
            }
        })

        return { error: null, appointments: dto }
    } catch (err: any) {
        console.error("[getStaffAppointmentsAction Exception]:", err)
        return { error: err?.message || "Failed to fetch appointments", appointments: [] }
    }
}
