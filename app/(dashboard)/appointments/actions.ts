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
    handled_at: string | null
    notes: string | null
    handled_by: string | null
    handler_name: string | null
    handler_role: string | null
    origin: string | null
}

/**
 * Server Action: Fetch cleared/completed consultations for the clearances archive.
 * Uses Service Role via createAdminClient() with explicit field selection.
 * Requires clinic staff authentication.
 *
 * Root cause of the original error: the query selected `doctor_name`, `nurse_name`,
 * `clearance_type`, and `remarks` from the `consultations` table — but those columns
 * do not exist. The current schema defines `handled_by` (FK → auth.users) instead.
 * We resolve the handler's display name and role from `clinic_accounts` via the
 * `handled_by` user-id, and surface `notes`/`handled_at`/`origin` which ARE real columns.
 */
export async function getClearedRecordsAction() {
    try {
        const auth = await requireClinicStaff()
        if (auth.error || !auth.user) {
            return { error: auth.error, records: [] }
        }

        const admin = createAdminClient()

        // 1. Fetch cleared consultations using ONLY real columns from the schema.
        //    Status 'cancelled' is NOT a valid consultations status per the CHECK
        //    constraint; the valid cleared states are 'completed' and 'dismissed'.
        const { data: consultations, error: consultError } = await admin
            .from("consultations")
            .select("id, patient_name, student_complaint, status, created_at, handled_at, notes, handled_by, origin")
            .in("status", ["completed", "dismissed"])
            .order("created_at", { ascending: false })

        if (consultError) {
            console.error("[getClearedRecordsAction DB Error]:", consultError)
            return { error: consultError.message, records: [] }
        }

        // 2. Resolve handler names from clinic_accounts via handled_by (user-id).
        //    This replaces the removed doctor_name / nurse_name columns with real data.
        const handlerIds = [...new Set((consultations || [])
            .map((c) => c.handled_by)
            .filter(Boolean))]
        let handlerMap: Record<string, { full_name: string | null; role: string | null }> = {}

        if (handlerIds.length > 0) {
            const { data: accounts, error: handlerError } = await admin
                .from("clinic_accounts")
                .select("id, full_name, role")
                .in("id", handlerIds)

            if (handlerError) {
                console.error("[getClearedRecordsAction handler lookup Error]:", handlerError)
            } else if (accounts) {
                handlerMap = Object.fromEntries(
                    accounts.map((a) => [a.id, { full_name: a.full_name ?? null, role: a.role ?? null }])
                )
            }
        }

        // 3. Assemble DTOs with data minimization — only the fields the page needs.
        const records: ClearedRecordDTO[] = (consultations || []).map((c) => {
            const handler = c.handled_by ? handlerMap[c.handled_by] : null
            return {
                id: c.id,
                patient_name: c.patient_name,
                student_complaint: c.student_complaint || null,
                status: c.status,
                created_at: c.created_at,
                handled_at: c.handled_at || null,
                notes: c.notes || null,
                handled_by: c.handled_by || null,
                handler_name: handler?.full_name || null,
                handler_role: handler?.role || null,
                origin: c.origin || null,
            }
        })

        return { error: null, records }
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
