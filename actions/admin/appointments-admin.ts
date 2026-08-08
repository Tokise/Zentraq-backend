"use server"

import { getActionActor, hasAnyRole } from "@/lib/security/action-guard"
import { createAdminClient } from "@/utils/supabase/admin"
import { logAuditEvent } from "@/lib/audit-logger"

type StaffRole = "admin" | "doctor" | "nurse"

async function staff(roles: readonly StaffRole[]) {
  const actor = await getActionActor()
  return actor && hasAnyRole(actor, roles) ? actor : null
}

export interface AppointmentOverviewRow {
  id: string
  patient_type: "student" | "faculty" | "staff"
  patient_name: string | null
  patient_identifier: string | null
  reason: string
  priority: number | null
  scheduled_date: string | null
  scheduled_time: string | null
  status: string
  doctor_name: string | null
  assigned_clinician_id: string | null
  created_at: string
}

export async function getAppointmentsOverviewAction(params?: {
  status?: string
  searchQuery?: string
  fromDate?: string
  toDate?: string
}): Promise<{ error: string | null; appointments: AppointmentOverviewRow[] }> {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", appointments: [] as AppointmentOverviewRow[] }

  const admin = createAdminClient()
  let query = admin
    .from("v_appointment_overview")
    .select("id, patient_type, patient_first_name, patient_last_name, scheduled_date, scheduled_time, priority, status, doctor_id, doctor_name, created_at")
    .order("created_at", { ascending: false })
    .limit(200)

  if (params?.status && params.status !== "all") {
    query = query.eq("status", params.status)
  }
  if (params?.fromDate) query = query.gte("scheduled_date", params.fromDate)
  if (params?.toDate) query = query.lte("scheduled_date", params.toDate)

  if (actor.role === "doctor" || actor.role === "nurse") {
    const { data: clinicAccount } = await admin
      .from("clinic_accounts")
      .select("id")
      .eq("user_id", actor.id)
      .eq("is_active", true)
      .maybeSingle()

    if (!clinicAccount) {
      return { error: "Active clinic account not found", appointments: [] }
    }
    query = query.eq("doctor_id", clinicAccount.id)
  }

  const { data, error } = await query
  if (error) return { error: error.message, appointments: [] as AppointmentOverviewRow[] }

  const appointments = (data ?? []).map((item) => ({
    id: item.id,
    patient_type: item.patient_type,
    patient_name: `${item.patient_first_name ?? ""} ${item.patient_last_name ?? ""}`.trim() || null,
    patient_identifier: null,
    reason: "",
    priority: item.priority,
    scheduled_date: item.scheduled_date,
    scheduled_time: item.scheduled_time,
    status: item.status,
    doctor_name: item.doctor_name,
    assigned_clinician_id: item.doctor_id,
    created_at: item.created_at,
  }))

  // Fetch reasons + identifiers in a second pass
  const ids = appointments.map((a) => a.id)
  if (ids.length > 0) {
    const { data: details } = await admin
      .from("appointments")
      .select(`
        id, reason,
        students(student_number),
        faculty(employee_number),
        staff(employee_number)
      `)
      .in("id", ids)

    const detailMap = new Map((details ?? []).map((d: any) => {
      const student = Array.isArray(d.students) ? d.students[0] : d.students
      const faculty = Array.isArray(d.faculty) ? d.faculty[0] : d.faculty
      const staff = Array.isArray(d.staff) ? d.staff[0] : d.staff
      return [
        d.id,
        {
          reason: d.reason ?? "",
          identifier: student?.student_number ?? faculty?.employee_number ?? staff?.employee_number ?? null,
        },
      ]
    }))

    for (const a of appointments) {
      const detail = detailMap.get(a.id)
      if (detail) {
        a.reason = detail.reason
        a.patient_identifier = detail.identifier
      }
    }
  }

  return { error: null, appointments }
}

export async function getAppointmentRemindersAction(): Promise<{
  error: string | null
  reminders: Array<{
    id: string
    appointment_id: string
    remind_at: string
    sent_at: string | null
    status: string
    patient_name: string | null
    scheduled_date: string | null
    scheduled_time: string | null
  }>
}> {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", reminders: [] }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("appointment_reminders")
    .select(`
      id, appointment_id, remind_at, sent_at, status,
      appointments(
        id, scheduled_date, scheduled_time,
        students(first_name, last_name),
        faculty(first_name, last_name)
      )
    `)
    .order("remind_at", { ascending: true })
    .limit(100)

  if (error) return { error: error.message, reminders: [] }

  const reminders = (data ?? []).map((row: any) => {
    const appointment = Array.isArray(row.appointments) ? row.appointments[0] : row.appointments
    const student = appointment && Array.isArray(appointment.students) ? appointment.students[0] : appointment?.students
    const faculty = appointment && Array.isArray(appointment.faculty) ? appointment.faculty[0] : appointment?.faculty
    const patientName = student
      ? `${student.first_name} ${student.last_name}`
      : faculty ? `${faculty.first_name} ${faculty.last_name}` : null
    return {
      id: row.id,
      appointment_id: row.appointment_id,
      remind_at: row.remind_at,
      sent_at: row.sent_at,
      status: row.status,
      patient_name: patientName,
      scheduled_date: appointment?.scheduled_date ?? null,
      scheduled_time: appointment?.scheduled_time ?? null,
    }
  })

  return { error: null, reminders }
}
