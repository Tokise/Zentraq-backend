"use server"

import { getActionActor, hasAnyRole } from "@/lib/security/action-guard"
import { createAdminClient } from "@/utils/supabase/admin"

type StaffRole = "admin" | "doctor" | "nurse"

// Resolves an authenticated clinic actor with one of the requested roles.
async function staff(roles: readonly StaffRole[]) {
  const actor = await getActionActor()
  return actor && hasAnyRole(actor, roles) ? actor : null
}

// Returns the signed-in clinic user's active account identifier.
export async function getDoctorClinicAccountIdAction(): Promise<{ error: string | null; clinicAccountId: string | null }> {
  const actor = await getActionActor()
  if (!actor || !hasAnyRole(actor, ["doctor", "nurse", "admin"])) {
    return { error: "Access denied", clinicAccountId: null }
  }

  const { data, error } = await createAdminClient()
    .from("clinic_accounts")
    .select("id")
    .eq("user_id", actor.id)
    .maybeSingle()

  if (error) {
    console.error("[getDoctorClinicAccountIdAction DB Error]:", error)
    return { error: error.message, clinicAccountId: null }
  }

  return { error: null, clinicAccountId: data?.id ?? null }
}

export interface DailyConsultation {
  consultation_date: string
  total_consultations: number
  student_consultations: number
  faculty_consultations: number
  walk_in_visits: number
  appointment_visits: number
  rfid_visits: number
}

export interface ComplaintFrequency {
  complaint: string
  frequency: number
}

export interface DispensingSummary {
  medicine_id: string
  generic_name: string
  brand_name: string | null
  category: string | null
  total_dispensed: number
  total_quantity_dispensed: number
  first_dispensed: string | null
  last_dispensed: string | null
}

export interface ClearanceCompletion {
  requester_type: string
  total_requests: number
  approved: number
  rejected: number
  pending: number
  evaluating: number
  approval_rate: number
}

// Returns bounded daily aggregate consultation counts for clinic reports.
export async function getDailyConsultations(params?: {
  start_date?: string
  end_date?: string
}) {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", data: [] as DailyConsultation[] }

  let query = createAdminClient()
    .from("v_daily_consultations")
    .select(`
      consultation_date,
      total_consultations,
      student_consultations,
      faculty_consultations,
      walk_in_visits,
      appointment_visits,
      rfid_visits
    `)
    .order("consultation_date", { ascending: false })

  if (params?.start_date) {
    query = query.gte("consultation_date", params.start_date)
  }

  if (params?.end_date) {
    query = query.lte("consultation_date", params.end_date)
  }

  const { data, error } = await query.limit(365)

  if (error) return { error: error.message, data: [] as DailyConsultation[] }

  return { error: null, data: data as DailyConsultation[] }
}

// Returns bounded aggregate complaint frequencies without patient identifiers.
export async function getComplaintFrequency(params?: {
  start_date?: string
  end_date?: string
}) {
  void params
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", data: [] as ComplaintFrequency[] }

  const { data, error } = await createAdminClient()
    .from("v_complaint_frequency")
    .select("complaint, frequency")
    .order("frequency", { ascending: false })
    .limit(20)

  if (error) return { error: error.message, data: [] as ComplaintFrequency[] }

  return { error: null, data: data as ComplaintFrequency[] }
}

// Returns bounded aggregate medicine dispensing totals for clinic reports.
export async function getDispensingSummary(params?: {
  start_date?: string
  end_date?: string
}) {
  void params
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", data: [] as DispensingSummary[] }

  const { data, error } = await createAdminClient()
    .from("v_dispensing_summary")
    .select(`
      medicine_id,
      generic_name,
      brand_name,
      category,
      total_dispensed,
      total_quantity_dispensed,
      first_dispensed,
      last_dispensed
    `)
    .order("total_quantity_dispensed", { ascending: false })
    .limit(20)

  if (error) return { error: error.message, data: [] as DispensingSummary[] }

  return { error: null, data: data as DispensingSummary[] }
}

// Returns aggregate clearance outcomes for Admin reporting.
export async function getClearanceCompletion() {
  const actor = await staff(["admin"])
  if (!actor) return { error: "Access denied", data: [] as ClearanceCompletion[] }

  const { data, error } = await createAdminClient()
    .from("v_clearance_completion")
    .select(`
      requester_type,
      total_requests,
      approved,
      rejected,
      pending,
      evaluating,
      approval_rate
    `)

  if (error) return { error: error.message, data: [] as ClearanceCompletion[] }

  return { error: null, data: data as ClearanceCompletion[] }
}

// Returns minimized clinic-wide report summary totals.
export async function getAnalyticsOverview(params?: {
  start_date?: string
  end_date?: string
}) {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", overview: null }

  const startDate =
    params?.start_date ||
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0]
  const endDate = params?.end_date || new Date().toISOString().split("T")[0]
  const admin = createAdminClient()
  const [consultationResult, incidentResult, clearanceResult, stockResult] =
    await Promise.all([
      admin
        .from("v_daily_consultations")
        .select(
          "total_consultations, student_consultations, faculty_consultations",
        )
        .gte("consultation_date", startDate)
        .lte("consultation_date", endDate),
      admin
        .from("incidents")
        .select("id", { count: "exact", head: true })
        .in("status", ["open", "in-progress"]),
      admin
        .from("health_clearances")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "evaluating"]),
      admin
        .from("v_medicine_stock_summary")
        .select("total_quantity, min_stock_level"),
    ])

  const reportError =
    consultationResult.error ??
    incidentResult.error ??
    clearanceResult.error ??
    stockResult.error
  if (reportError) return { error: reportError.message, overview: null }

  const consultations = consultationResult.data

  const totalConsultations = consultations?.reduce((sum, c) => sum + c.total_consultations, 0) || 0
  const totalStudentConsultations = consultations?.reduce((sum, c) => sum + c.student_consultations, 0) || 0
  const totalFacultyConsultations = consultations?.reduce((sum, c) => sum + c.faculty_consultations, 0) || 0

  const lowStockCount = (stockResult.data ?? []).filter(
    (item) => Number(item.total_quantity) <= Number(item.min_stock_level),
  ).length

  return {
    error: null,
    overview: {
      total_consultations: totalConsultations,
      student_consultations: totalStudentConsultations,
      faculty_consultations: totalFacultyConsultations,
      active_incidents: incidentResult.count ?? 0,
      pending_clearances: clearanceResult.count ?? 0,
      low_stock_medicines: lowStockCount,
      period_start: startDate,
      period_end: endDate
    }
  }
}

// Returns one authorized Doctor's aggregate performance totals.
export async function getDoctorStats(doctorId: string, params?: {
  start_date?: string
  end_date?: string
}) {
  const actor = await staff(["admin", "doctor"])
  if (!actor) return { error: "Access denied", stats: null }

  if (actor.role === "doctor") {
    const { data: account } = await createAdminClient()
      .from("clinic_accounts")
      .select("id")
      .eq("user_id", actor.id)
      .eq("is_active", true)
      .maybeSingle()
    if (!account || account.id !== doctorId) {
      return { error: "Access denied", stats: null }
    }
  }

  const startDate = params?.start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const endDate = params?.end_date || new Date().toISOString().split('T')[0]

  // Get consultations completed by this doctor
  const { data: consultations } = await createAdminClient()
    .from("consultations")
    .select("id, completed_at")
    .eq("doctor_id", doctorId)
    .eq("status", "completed")
    .gte("completed_at", startDate)
    .lte("completed_at", endDate)

  // Get prescriptions written by this doctor
  const { data: prescriptions } = await createAdminClient()
    .from("prescriptions")
    .select("id, created_at")
    .eq("prescribed_by", doctorId)
    .gte("created_at", startDate)
    .lte("created_at", endDate)

  // Get clearance evaluations by this doctor
  const { data: evaluations } = await createAdminClient()
    .from("clearance_evaluations")
    .select("id, result")
    .eq("doctor_id", doctorId)
    .gte("evaluated_at", startDate)
    .lte("evaluated_at", endDate)

  return {
    error: null,
    stats: {
      consultations_completed: consultations?.length || 0,
      prescriptions_written: prescriptions?.length || 0,
      clearances_evaluated: evaluations?.length || 0,
      clearance_fit_rate: evaluations ? (evaluations.filter(e => e.result === "fit").length / evaluations.length * 100) : 0,
      period_start: startDate,
      period_end: endDate
    }
  }
}
