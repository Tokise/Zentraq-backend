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

export interface DashboardConsultationDTO {
    id: string
    patient_name: string
    student_complaint: string
    status: string
    created_at: string
    handled_at: string | null
    notes: string | null
}

export interface DashboardAppointmentDTO {
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

export interface DashboardStatsDTO {
    patientsToday: number
    consultations: number
    emergencyCases: number
}

export interface DashboardDataDTO {
    consultations: DashboardConsultationDTO[]
    appointments: DashboardAppointmentDTO[]
    stats: DashboardStatsDTO
}

/**
 * Server Action: Fetch all data needed for the staff dashboard in one call.
 * Uses Service Role via createAdminClient() with explicit field selection.
 * Requires clinic staff authentication.
 */
export async function getDashboardDataAction() {
    try {
        const auth = await requireClinicStaff()
        if (auth.error || !auth.user) {
            return { error: auth.error, data: null }
        }

        const admin = createAdminClient()
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayIso = today.toISOString()

        // Fetch consultations
        const { data: consultations, error: consultError } = await admin
            .from("consultations")
            .select("id, patient_name, student_complaint, status, created_at, handled_at, notes")
            .order("created_at", { ascending: false })
            .limit(50)

        if (consultError) {
            console.error("[getDashboardDataAction Consultations Error]:", consultError)
            return { error: consultError.message, data: null }
        }

        // Fetch appointments
        const { data: appointments, error: apptError } = await admin
            .from("student_appointments")
            .select("id, appointment_date, time_slot, reason, status, student_user_id, student_account_id")
            .order("appointment_date", { ascending: true })
            .limit(50)

        if (apptError) {
            console.error("[getDashboardDataAction Appointments Error]:", apptError)
            return { error: apptError.message, data: null }
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

        // Get stats with head-only counts
        const [patientsTodayRes, emergencyRes, consultCountRes] = await Promise.all([
            admin
                .from("consultations")
                .select("id", { count: "exact", head: true })
                .eq("status", "in_consultation")
                .gte("created_at", todayIso),
            admin
                .from("consultations")
                .select("id", { count: "exact", head: true })
                .eq("status", "in_emergency"),
            admin
                .from("consultations")
                .select("id", { count: "exact", head: true }),
        ])

        const appointmentDTOs: DashboardAppointmentDTO[] = (appointments || []).map((a) => {
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

        const data: DashboardDataDTO = {
            consultations: (consultations || []) as DashboardConsultationDTO[],
            appointments: appointmentDTOs,
            stats: {
                patientsToday: patientsTodayRes.count ?? 0,
                consultations: consultCountRes.count ?? 0,
                emergencyCases: emergencyRes.count ?? 0,
            },
        }

        return { error: null, data }
    } catch (err: any) {
        console.error("[getDashboardDataAction Exception]:", err)
        return { error: err?.message || "Failed to fetch dashboard data", data: null }
    }
}