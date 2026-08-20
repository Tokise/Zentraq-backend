"use server"

import { getActionActor, hasAnyRole } from "@/lib/security/action-guard"
import { createAdminClient } from "@/utils/supabase/admin"

export type DashboardActivityScope = "admin" | "doctor" | "nurse"

export interface DashboardConsultationDTO {
  id: string
  patient_name: string
  patient_complaint: string
  status: string
  created_at: string
  handled_at: string | null
  notes: string | null
}

export interface DashboardActivityPoint {
  [key: string]: number | string
  date: string
}

export interface AdminDashboardActivityDTO extends DashboardActivityPoint {
  assigned_consultations: number
  completed_consultations: number
  scheduled_appointments: number
  prescriptions_written: number
  clearance_evaluations: number
}

export interface DoctorDashboardActivityDTO extends DashboardActivityPoint {
  assigned_consultations: number
  completed_consultations: number
  scheduled_appointments: number
  prescriptions_written: number
  clearance_evaluations: number
}

export interface NurseDashboardActivityDTO extends DashboardActivityPoint {
  assigned_consultations: number
  completed_consultations: number
  triage_assessments: number
  patient_check_ins: number
}

export type DashboardActivityDTO =
  | AdminDashboardActivityDTO
  | DoctorDashboardActivityDTO
  | NurseDashboardActivityDTO

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
  totalPatients: number
  patientsToday: number
  consultations: number
  emergencyCases: number
}

export interface DashboardDataDTO {
  activity: DashboardActivityDTO[]
  activityScope: DashboardActivityScope
  appointments: DashboardAppointmentDTO[]
  consultations: DashboardConsultationDTO[]
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

interface ClinicianConsultationActivityRow {
  completed_at: string | null
  created_at: string
}

interface TimestampRow {
  created_at: string
}

interface ClearanceActivityRow {
  evaluated_at: string
}

interface AppointmentActivityRow {
  scheduled_date: string | null
}

interface CheckInActivityRow {
  check_in_time: string
}

interface AppointmentQueryRow {
  id: string
  patient_first_name: string | null
  patient_last_name: string | null
  scheduled_date: string | null
  scheduled_time: string | null
  status: string
}

interface ActivityLoadResult {
  data: DashboardActivityDTO[]
  error: string | null
}

import { unstable_cache } from "next/cache"

// Returns the minimized dashboard dataset authorized for the current clinic role.
export async function getDashboardDataAction() {
  const actor = await getActionActor()
  if (!actor || !hasAnyRole(actor, ["admin", "doctor", "nurse"])) {
    return { error: "Access denied", data: null }
  }

  return fetchCachedDashboardData(actor.id, actor.role as DashboardActivityScope)
}

const fetchCachedDashboardData = (userId: string, activityScope: DashboardActivityScope) =>
  unstable_cache(
    async () => {
      const admin = createAdminClient()
      const dayStart = new Date()
      dayStart.setHours(0, 0, 0, 0)
      const activityStart = new Date(dayStart)
      activityStart.setDate(activityStart.getDate() - 89)
      const { data: account, error: accountError } = await admin
        .from("clinic_accounts")
        .select("id")
        .eq("user_id", userId)
        .eq("role", activityScope)
        .eq("is_active", true)
        .maybeSingle()

      if (accountError || !account) {
        return {
          error: accountError?.message ?? "Active clinic account not found",
          data: null,
        }
      }
      const clinicAccountId = account.id

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
      const assignmentColumn =
        activityScope === "nurse" ? "nurse_id" : "doctor_id"
      consultationQuery = consultationQuery.eq(
        assignmentColumn,
        clinicAccountId,
      )

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
      appointmentQuery = appointmentQuery.eq("doctor_id", clinicAccountId)

      const activityPromise = loadDashboardActivity({
        actorId: userId,
        activityScope,
        clinicAccountId,
        endDate: dayStart,
        startDate: activityStart,
      })

      const [consultationResult, appointmentResult, activityResult] =
        await Promise.all([
          consultationQuery,
          appointmentQuery,
          activityPromise,
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
            activityResult.error ??
            "Unable to load dashboard",
          data: null,
        }
      }

      const { data: rpcStats } = await admin.rpc(
        "get_clinician_workload_stats",
        {
          p_user_id: userId,
          p_role: activityScope,
        },
      )

      const typedRpcStats = rpcStats as
        | {
            totalPatients?: number
            patientsToday?: number
            consultations?: number
            appointments?: number
            pendingRequests?: number
          }
        | null
        | undefined

      const manilaToday = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Manila",
      })

      const consultationRows = (consultationResult.data ?? []) as unknown as
        ConsultationQueryRow[]
      const appointmentRows = (appointmentResult.data ?? []) as unknown as
        AppointmentQueryRow[]
      const consultations = consultationRows.map(toConsultationDTO)
      const appointments = appointmentRows.map(toAppointmentDTO)

      const fallbackTodayCount = consultationRows.filter((row) => {
        const visit = firstRelation(row.clinic_visits)
        const checkInLocal = visit?.check_in_time
          ? new Date(visit.check_in_time).toLocaleDateString("en-CA", {
              timeZone: "Asia/Manila",
            })
          : ""
        const createdLocal = row.created_at
          ? new Date(row.created_at).toLocaleDateString("en-CA", {
              timeZone: "Asia/Manila",
            })
          : ""
        return checkInLocal === manilaToday || createdLocal === manilaToday
      }).length

      const totalDistinctPatients = new Set(
        consultations.map((c) => c.patient_name).filter(Boolean),
      ).size

      const stats: DashboardStatsDTO = {
        totalPatients: typedRpcStats?.totalPatients ?? totalDistinctPatients,
        patientsToday: typedRpcStats?.patientsToday ?? fallbackTodayCount,
        consultations: typedRpcStats?.consultations ?? consultations.length,
        emergencyCases: 0,
      }

      return {
        error: null,
        data: {
          activity: activityResult.data,
          activityScope,
          appointments,
          consultations,
          stats,
        } satisfies DashboardDataDTO,
      }
    },
    [`dashboard-data-${userId}`],
    { revalidate: 15, tags: [`dashboard-${userId}`] },
  )()

// Loads a role-owned chart dataset instead of reusing clinic-wide activity.
async function loadDashboardActivity(input: {
  actorId: string
  activityScope: DashboardActivityScope
  clinicAccountId: string | null
  endDate: Date
  startDate: Date
}): Promise<ActivityLoadResult> {
  if (!input.clinicAccountId) {
    return { data: [], error: "Active clinic account not found" }
  }
  if (input.activityScope !== "nurse") {
    return loadDoctorActivity(
      input.clinicAccountId,
      input.actorId,
      input.startDate,
      input.endDate,
    )
  }
  return loadNurseActivity(
    input.actorId,
    input.clinicAccountId,
    input.startDate,
  )
}

// Aggregates Admin- or Doctor-owned clinical workflow activity.
async function loadDoctorActivity(
  doctorId: string,
  actorId: string,
  startDate: Date,
  endDate: Date,
): Promise<ActivityLoadResult> {
  const admin = createAdminClient()
  const startIso = startDate.toISOString()
  const endDay = endDate.toISOString().slice(0, 10)
  const [consultations, appointments, prescriptions, evaluations] =
    await Promise.all([
      admin
        .from("consultations")
        .select("created_at, completed_at")
        .eq("doctor_id", doctorId)
        .or(`created_at.gte.${startIso},completed_at.gte.${startIso}`)
        .limit(2000),
      admin
        .from("appointments")
        .select("scheduled_date")
        .eq("doctor_id", doctorId)
        .gte("scheduled_date", startIso.slice(0, 10))
        .lte("scheduled_date", endDay)
        .limit(2000),
      admin
        .from("prescriptions")
        .select("created_at")
        .eq("prescribed_by", actorId)
        .gte("created_at", startIso)
        .limit(2000),
      admin
        .from("clearance_evaluations")
        .select("evaluated_at")
        .eq("doctor_id", doctorId)
        .gte("evaluated_at", startIso)
        .limit(2000),
    ])

  const error =
    consultations.error ??
    appointments.error ??
    prescriptions.error ??
    evaluations.error
  if (error) return { data: [], error: error.message }

  return {
    data: buildDoctorActivityDTOs({
      appointments: (appointments.data ?? []) as AppointmentActivityRow[],
      consultations: (consultations.data ?? []) as ClinicianConsultationActivityRow[],
      evaluations: (evaluations.data ?? []) as ClearanceActivityRow[],
      prescriptions: (prescriptions.data ?? []) as TimestampRow[],
    }),
    error: null,
  }
}

// Aggregates Nurse-owned consultations, triage, and check-in workflow events.
async function loadNurseActivity(
  actorId: string,
  nurseId: string,
  startDate: Date,
): Promise<ActivityLoadResult> {
  const admin = createAdminClient()
  const startIso = startDate.toISOString()
  const [consultations, triage, checkIns] = await Promise.all([
    admin
      .from("consultations")
      .select("created_at, completed_at")
      .eq("nurse_id", nurseId)
      .or(`created_at.gte.${startIso},completed_at.gte.${startIso}`)
      .limit(2000),
    admin
      .from("triage_assessments")
      .select("created_at")
      .eq("nurse_id", nurseId)
      .gte("created_at", startIso)
      .limit(2000),
    admin
      .from("clinic_visits")
      .select("check_in_time")
      .eq("created_by", actorId)
      .gte("check_in_time", startIso)
      .limit(2000),
  ])

  const error = consultations.error ?? triage.error ?? checkIns.error
  if (error) return { data: [], error: error.message }

  return {
    data: buildNurseActivityDTOs({
      checkIns: (checkIns.data ?? []) as CheckInActivityRow[],
      consultations: (consultations.data ?? []) as ClinicianConsultationActivityRow[],
      triage: (triage.data ?? []) as TimestampRow[],
    }),
    error: null,
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

// Aggregates Doctor workflow events by their meaningful event dates.
function buildDoctorActivityDTOs(input: {
  appointments: AppointmentActivityRow[]
  consultations: ClinicianConsultationActivityRow[]
  evaluations: ClearanceActivityRow[]
  prescriptions: TimestampRow[]
}): DoctorDashboardActivityDTO[] {
  const days = new Map<string, DoctorDashboardActivityDTO>()
  const pointFor = (value: string | null) => {
    const date = toDateKey(value)
    if (!date) return null
    const point = days.get(date) ?? createDoctorActivityPoint(date)
    days.set(date, point)
    return point
  }

  input.consultations.forEach((row) => {
    const assignedPoint = pointFor(row.created_at)
    if (assignedPoint) assignedPoint.assigned_consultations += 1
    const completedPoint = pointFor(row.completed_at)
    if (completedPoint) completedPoint.completed_consultations += 1
  })
  input.appointments.forEach((row) => {
    const point = pointFor(row.scheduled_date)
    if (point) point.scheduled_appointments += 1
  })
  input.prescriptions.forEach((row) => {
    const point = pointFor(row.created_at)
    if (point) point.prescriptions_written += 1
  })
  input.evaluations.forEach((row) => {
    const point = pointFor(row.evaluated_at)
    if (point) point.clearance_evaluations += 1
  })

  return sortActivityDays(days)
}

// Aggregates Nurse workflow events by their meaningful event dates.
function buildNurseActivityDTOs(input: {
  checkIns: CheckInActivityRow[]
  consultations: ClinicianConsultationActivityRow[]
  triage: TimestampRow[]
}): NurseDashboardActivityDTO[] {
  const days = new Map<string, NurseDashboardActivityDTO>()
  const pointFor = (value: string | null) => {
    const date = toDateKey(value)
    if (!date) return null
    const point = days.get(date) ?? createNurseActivityPoint(date)
    days.set(date, point)
    return point
  }

  input.consultations.forEach((row) => {
    const assignedPoint = pointFor(row.created_at)
    if (assignedPoint) assignedPoint.assigned_consultations += 1
    const completedPoint = pointFor(row.completed_at)
    if (completedPoint) completedPoint.completed_consultations += 1
  })
  input.triage.forEach((row) => {
    const point = pointFor(row.created_at)
    if (point) point.triage_assessments += 1
  })
  input.checkIns.forEach((row) => {
    const point = pointFor(row.check_in_time)
    if (point) point.patient_check_ins += 1
  })

  return sortActivityDays(days)
}

// Creates an empty Doctor workflow point for one day.
function createDoctorActivityPoint(date: string): DoctorDashboardActivityDTO {
  return {
    date,
    assigned_consultations: 0,
    completed_consultations: 0,
    scheduled_appointments: 0,
    prescriptions_written: 0,
    clearance_evaluations: 0,
  }
}

// Creates an empty Nurse workflow point for one day.
function createNurseActivityPoint(date: string): NurseDashboardActivityDTO {
  return {
    date,
    assigned_consultations: 0,
    completed_consultations: 0,
    triage_assessments: 0,
    patient_check_ins: 0,
  }
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

// Converts a timestamp or date into the chart's ISO date key.
function toDateKey(value: string | null | undefined): string | null {
  if (!value || value.length < 10) return null
  return value.slice(0, 10)
}

// Sorts a daily activity map in ascending chronological order.
function sortActivityDays<T extends DashboardActivityPoint>(
  days: Map<string, T>,
): T[] {
  return Array.from(days.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  )
}

// Normalizes Supabase to-one relationships returned as an object or array.
function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}
