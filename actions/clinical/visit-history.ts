"use server"

import { getActionActor, hasAnyRole } from "@/lib/security/action-guard"
import { createAdminClient } from "@/utils/supabase/admin"

export interface ClinicalVisitHistoryRow {
  consultation_id: string
  visit_id: string
  patient_type: "student" | "faculty" | "staff"
  patient_name: string
  visit_type: string
  patient_complaint: string
  check_in_time: string
  check_out_time: string | null
  status: string
}

interface NamedPatient {
  first_name: string | null
  last_name: string | null
}

interface HistoryVisitRelation {
  id: string
  patient_type: "student" | "faculty" | "staff"
  visit_type: string
  check_in_time: string
  check_out_time: string | null
  students: NamedPatient | NamedPatient[] | null
  faculty: NamedPatient | NamedPatient[] | null
  staff: NamedPatient | NamedPatient[] | null
}

interface HistoryQueryRow {
  id: string
  patient_complaint: string | null
  status: string
  clinic_visits: HistoryVisitRelation | HistoryVisitRelation[] | null
}

// Returns completed consultations while enforcing clinician assignment server-side.
export async function getClinicalVisitHistory(): Promise<{
  error: string | null
  visits: ClinicalVisitHistoryRow[]
}> {
  const actor = await getActionActor()
  if (!actor || !hasAnyRole(actor, ["admin", "doctor", "nurse"])) {
    return { error: "Access denied", visits: [] }
  }

  const admin = createAdminClient()
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
        visits: [],
      }
    }
    clinicAccountId = account.id
  }

  let query = admin
    .from("consultations")
    .select(`
      id,
      patient_complaint,
      status,
      clinic_visits!inner(
        id,
        patient_type,
        visit_type,
        check_in_time,
        check_out_time,
        students(first_name, last_name),
        faculty(first_name, last_name),
        staff(first_name, last_name)
      )
    `)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(100)

  if (clinicAccountId) {
    query = query.or(
      `doctor_id.eq.${clinicAccountId},nurse_id.eq.${clinicAccountId}`,
    )
  }

  const { data, error } = await query
  if (error) return { error: error.message, visits: [] }

  const rows = (data ?? []) as unknown as HistoryQueryRow[]
  const visits = rows.flatMap((row) => {
    const visit = firstRelation(row.clinic_visits)
    if (!visit) return []

    const patient =
      firstRelation(visit.students) ??
      firstRelation(visit.faculty) ??
      firstRelation(visit.staff)

    return [
      {
        consultation_id: row.id,
        visit_id: visit.id,
        patient_type: visit.patient_type,
        patient_name:
          `${patient?.first_name ?? ""} ${patient?.last_name ?? ""}`.trim() ||
          "Unknown patient",
        visit_type: visit.visit_type,
        patient_complaint: row.patient_complaint ?? "",
        check_in_time: visit.check_in_time,
        check_out_time: visit.check_out_time,
        status: row.status,
      },
    ]
  })

  return { error: null, visits }
}

// Normalizes Supabase to-one relationships returned as an object or array.
function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}
