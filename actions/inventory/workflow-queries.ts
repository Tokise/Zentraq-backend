"use server"

import { getActionActor, hasAnyRole } from "@/lib/security/action-guard"
import { createAdminClient } from "@/utils/supabase/admin"

type StaffRole = "admin" | "doctor" | "nurse"
async function staff(roles: readonly StaffRole[]) {
  const actor = await getActionActor()
  return actor && hasAnyRole(actor, roles) ? actor : null
}

export interface QueueAppointment { id: string; patient_name: string; reason: string; priority: number | null; scheduled_date: string | null; scheduled_time: string | null; status: string }
export async function getAppointmentQueue(statuses?: string[]) {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", appointments: [] as QueueAppointment[] }
  let query = createAdminClient().from("v_appointment_overview").select("id, patient_first_name, patient_last_name, scheduled_date, scheduled_time, priority, status").order("scheduled_date", { ascending: true }).limit(100)
  if (statuses?.length) query = query.in("status", statuses)
  const { data, error } = await query
  if (error) return { error: error.message, appointments: [] as QueueAppointment[] }
  const ids = (data ?? []).map((item) => item.id)
  const { data: details } = ids.length ? await createAdminClient().from("appointments").select("id, reason").in("id", ids) : { data: [] as Array<{ id: string; reason: string }> }
  const reasons = new Map((details ?? []).map((item) => [item.id, item.reason]))
  return { error: null, appointments: (data ?? []).map((item) => ({ id: item.id, patient_name: `${item.patient_first_name} ${item.patient_last_name}`.trim(), reason: reasons.get(item.id) ?? "", priority: item.priority, scheduled_date: item.scheduled_date, scheduled_time: item.scheduled_time, status: item.status })) }
}

export interface QueueConsultation { id: string; patient_name: string; complaint: string; status: string; check_in_time: string; doctor_name: string | null }

// Returns active consultations while applying clinician assignment on the server.
export async function getConsultationQueue(statuses?: string[]) {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", consultations: [] as QueueConsultation[] }
  const admin = createAdminClient()
  let assignedId: string | null = null
  if (actor.role !== "admin") {
    const { data: account } = await admin
      .from("clinic_accounts")
      .select("id")
      .eq("user_id", actor.id)
      .eq("is_active", true)
      .maybeSingle()
    assignedId = account?.id ?? null
    if (!assignedId) return { error: "Active clinic account not found", consultations: [] as QueueConsultation[] }
  }

  let query = admin
    .from("consultations")
    .select("id, chief_complaint, status, created_at, doctor:clinic_accounts!consultations_doctor_id_fkey(display_name), clinic_visits(patient_type, check_in_time, students(first_name, last_name), faculty(first_name, last_name), staff(first_name, last_name))")
    .order("created_at", { ascending: false })
    .limit(100)
  if (statuses?.length) query = query.in("status", statuses)
  if (assignedId) query = query.or(`doctor_id.eq.${assignedId},nurse_id.eq.${assignedId}`)
  const { data, error } = await query
  return {
    error: error?.message ?? null,
    consultations: (data ?? []).map((item: any) => {
      const visit = Array.isArray(item.clinic_visits) ? item.clinic_visits[0] : item.clinic_visits
      const patient = visit?.patient_type === "student"
        ? (Array.isArray(visit.students) ? visit.students[0] : visit.students)
        : visit?.patient_type === "faculty"
          ? (Array.isArray(visit.faculty) ? visit.faculty[0] : visit.faculty)
          : (Array.isArray(visit.staff) ? visit.staff[0] : visit.staff)
      const doctor = Array.isArray(item.doctor) ? item.doctor[0] : item.doctor
      return {
        id: item.id,
        patient_name: `${patient?.first_name ?? ""} ${patient?.last_name ?? ""}`.trim() || "Unknown patient",
        complaint: item.chief_complaint ?? "",
        status: item.status,
        check_in_time: visit?.check_in_time ?? item.created_at,
        doctor_name: doctor?.display_name ?? null,
      }
    }),
  }
}

// Returns faculty and staff consultations for the dedicated Staff Health module.
export async function getStaffHealthConsultations() {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", consultations: [] as QueueConsultation[] }
  const { data, error } = await createAdminClient()
    .from("v_consultation_summary")
    .select("consultation_id, patient_first_name, patient_last_name, chief_complaint, consultation_status, check_in_time, doctor_name")
    .in("patient_type", ["faculty", "staff"])
    .order("check_in_time", { ascending: false })
    .limit(100)
  return {
    error: error?.message ?? null,
    consultations: (data ?? []).map((item) => ({
      id: item.consultation_id,
      patient_name: `${item.patient_first_name} ${item.patient_last_name}`.trim(),
      complaint: item.chief_complaint ?? "",
      status: item.consultation_status,
      check_in_time: item.check_in_time,
      doctor_name: item.doctor_name,
    })),
  }
}

export async function getInventoryQueue() {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", medicines: [] as Array<{ id: string; name: string; stock: number; minimum: number; expiry: string | null }> }
  const { data, error } = await createAdminClient().from("v_medicine_stock_summary").select("medicine_id, generic_name, total_quantity, min_stock_level, nearest_expiry").order("generic_name").limit(100)
  return { error: error?.message ?? null, medicines: (data ?? []).map((item) => ({ id: item.medicine_id, name: item.generic_name, stock: Number(item.total_quantity), minimum: item.min_stock_level, expiry: item.nearest_expiry })) }
}

export async function getIncidentQueue(includeClosed = false) {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", incidents: [] as Array<{ id: string; description: string; severity: string | null; status: string; created_at: string }> }
  let query = createAdminClient().from("incidents").select("id, description, severity, status, created_at").order("created_at", { ascending: false }).limit(100)
  if (!includeClosed) query = query.neq("status", "closed")
  const { data, error } = await query
  return { error: error?.message ?? null, incidents: data ?? [] }
}

export async function getClearanceQueue() {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", clearances: [] as Array<{ id: string; requester_type: string; purpose: string | null; status: string; created_at: string }> }
  const { data, error } = await createAdminClient().from("health_clearances").select("id, requester_type, purpose, status, created_at").order("created_at", { ascending: false }).limit(100)
  return { error: error?.message ?? null, clearances: data ?? [] }
}
