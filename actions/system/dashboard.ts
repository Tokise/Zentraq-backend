"use server"

import { getActionActor, hasAnyRole } from "@/lib/security/action-guard"
import { createAdminClient } from "@/utils/supabase/admin"

export interface DashboardConsultationDTO {
  id: string
  patient_name: string
  patient_complaint: string
  status: string
  created_at: string
  handled_at: string | null
  notes: string | null
}

export interface DashboardActivityDTO {
  [key: string]: number | string
  date: string
  total_consultations: number
  student_consultations: number
  faculty_consultations: number
  walk_in_visits: number
  appointment_visits: number
  rfid_visits: number
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
  activity: DashboardActivityDTO[]
  stats: DashboardStatsDTO
}

interface NamedPatient {
  first_name: string | null
  last_name: string | null
}

interface ConsultationVisitRow {
  check_in_time: string
  patient_type: "student" | "faculty" | "staff"
  visit_type: string
  students: NamedPatient | NamedPatient[] | null
  faculty: NamedPatient | NamedPatient[] | null
  staff: NamedPatient | NamedPatient[] | null
}

interface ConsultationQueryRow {
  id: string
  patient_complaint: string | null
  status: string
  created_at: string
  clinic_visits: ConsultationVisitRow | ConsultationVisitRow[] | null
}

interface ActivityQueryRow {
  created_at: string
  clinic_visits:
    | Pick<ConsultationVisitRow, "check_in_time" | "patient_type" | "visit_type">
    | Array<
        Pick<
          ConsultationVisitRow,
          "check_in_time" | "patient_type" | "visit_type"
        >
      >
    | null
}

interface AppointmentQueryRow {
  id: string
  patient_first_name: string | null
  patient_last_name: string | null
  scheduled_date: string | null
  scheduled_time: string | null
  status: string
}

// Returns the minimized dashboard dataset authorized for the current clinic role.
export async function getDashboardDataAction() {
  const actor = await getActionActor()
  if (!actor || !hasAnyRole(actor, ["admin", "doctor", "nurse"])) {
    return { error: "Access denied", data: null }
  }

  const admin = createAdminClient()
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const activityStart = new Date(dayStart)
  activityStart.setDate(activityStart.getDate() - 89)
  let clinicAccountId: string | null = null

  if (actor.role !== "admin") {
    const { data: account, error: accountError } = await admin
      .from("clinic_accounts")
      .select("id")
      .eq("user_id", actor.id)
      .eq("is_active", true)
      .maybeSingle()

    if (accountError || !account) {
      return {
        error: accountError?.message ?? "Active clinic account not found",
        data: null,
      }
    }
    clinicAccountId = account.id
  }

  let consultationQuery = admin
    .from("consultations")
    .select(`
      id,
      patient_complaint,
      status,
      created_at,
      clinic_visits(
        check_in_time,
        patient_type,
        visit_type,
        students(first_name, last_name),
        faculty(first_name, last_name),
        staff(first_name, last_name)
      )
    `)
    .order("created_at", { ascending: false })
    .limit(50)
  if (clinicAccountId) {
    consultationQuery = consultationQuery.or(
      `doctor_id.eq.${clinicAccountId},nurse_id.eq.${clinicAccountId}`,
    )
  }

  let activityQuery = admin
    .from("consultations")
    .select(`
      created_at,
      clinic_visits!inner(
        check_in_time,
        patient_type,
        visit_type
      )
    `)
    .gte("created_at", activityStart.toISOString())
    .order("created_at", { ascending: true })
    .limit(2000)
  if (clinicAccountId) {
    activityQuery = activityQuery.or(
      `doctor_id.eq.${clinicAccountId},nurse_id.eq.${clinicAccountId}`,
    )
  }

  let appointmentQuery = admin
    .from("v_appointment_overview")
    .select(`
      id,
      patient_first_name,
      patient_last_name,
      scheduled_date,
      scheduled_time,
      status,
      doctor_id
    `)
    .order("scheduled_date", { ascending: true })
    .limit(50)
  if (clinicAccountId) {
    appointmentQuery = appointmentQuery.eq("doctor_id", clinicAccountId)
  }

  const [
    consultationResult,
    appointmentResult,
    activityResult,
    visits,
    incidents,
  ] =
    await Promise.all([
      consultationQuery,
      appointmentQuery,
      activityQuery,
      admin
        .from("clinic_visits")
        .select("id", { count: "exact", head: true })
        .gte("check_in_time", dayStart.toISOString()),
      admin
        .from("incidents")
        .select("id", { count: "exact", head: true })
        .in("status", ["open", "in-progress"]),
    ])

  if (
    consultationResult.error ||
    appointmentResult.error ||
    activityResult.error
  ) {
    return {
      error:
        consultationResult.error?.message ??
        appointmentResult.error?.message ??
        activityResult.error?.message ??
        "Unable to load dashboard",
      data: null,
    }
  }

  const consultationRows = (consultationResult.data ?? []) as unknown as
    ConsultationQueryRow[]
  const appointmentRows = (appointmentResult.data ?? []) as unknown as
    AppointmentQueryRow[]
  const activityRows = (activityResult.data ?? []) as unknown as
    ActivityQueryRow[]
  const consultations = consultationRows.map(toConsultationDTO)
  const appointments = appointmentRows.map(toAppointmentDTO)
  const activity = buildActivityDTOs(activityRows)
  const assignedPatientsToday = consultationRows.filter((row) => {
    const visit = firstRelation(row.clinic_visits)
    return Boolean(visit?.check_in_time?.startsWith(dayStart.toISOString().slice(0, 10)))
  }).length

  return {
    error: null,
    data: {
      consultations,
      appointments,
      activity,
      stats: {
        patientsToday:
          actor.role === "admin" ? (visits.count ?? 0) : assignedPatientsToday,
        consultations: consultations.length,
        emergencyCases: incidents.count ?? 0,
      },
    } satisfies DashboardDataDTO,
  }
}

// Maps one assigned consultation into the minimized dashboard contract.
function toConsultationDTO(
  row: ConsultationQueryRow,
): DashboardConsultationDTO {
  const visit = firstRelation(row.clinic_visits)
  const patient =
    firstRelation(visit?.students) ??
    firstRelation(visit?.faculty) ??
    firstRelation(visit?.staff)

  return {
    id: row.id,
    patient_name:
      `${patient?.first_name ?? ""} ${patient?.last_name ?? ""}`.trim() ||
      "Unknown patient",
    patient_complaint: row.patient_complaint ?? "",
    status: row.status,
    created_at: row.created_at,
    handled_at: null,
    notes: null,
  }
}

// Aggregates role-scoped consultation visits into bounded daily chart totals.
function buildActivityDTOs(rows: ActivityQueryRow[]): DashboardActivityDTO[] {
  const days = new Map<string, DashboardActivityDTO>()

  rows.forEach((row) => {
    const visit = firstRelation(row.clinic_visits)
    const date = (visit?.check_in_time ?? row.created_at).slice(0, 10)
    if (!date) return

    const point = days.get(date) ?? {
      date,
      total_consultations: 0,
      student_consultations: 0,
      faculty_consultations: 0,
      walk_in_visits: 0,
      appointment_visits: 0,
      rfid_visits: 0,
    }

    point.total_consultations += 1
    if (visit?.patient_type === "student") point.student_consultations += 1
    if (visit?.patient_type === "faculty") point.faculty_consultations += 1

    const visitType = visit?.visit_type.toLowerCase().replaceAll("_", "-")
    if (visitType === "walk-in") point.walk_in_visits += 1
    if (visitType === "appointment") point.appointment_visits += 1
    if (visitType === "rfid") point.rfid_visits += 1

    days.set(date, point)
  })

  return Array.from(days.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  )
}

// Maps one assigned appointment into the minimized dashboard contract.
function toAppointmentDTO(row: AppointmentQueryRow): DashboardAppointmentDTO {
  return {
    id: row.id,
    appointment_date: row.scheduled_date ?? "",
    time_slot: row.scheduled_time ?? "",
    reason: null,
    status: row.status,
    patient_name:
      `${row.patient_first_name ?? ""} ${row.patient_last_name ?? ""}`.trim() ||
      null,
    student_number: null,
    employee_number: null,
    department: null,
  }
}

// Normalizes Supabase to-one relationships returned as an object or array.
function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}
