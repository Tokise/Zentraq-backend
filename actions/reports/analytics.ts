"use server"

import { getActionActor, hasAnyRole } from "@/lib/security/action-guard"
import { createAdminClient } from "@/utils/supabase/admin"

type StaffRole = "admin" | "doctor" | "nurse"

async function staff(roles: readonly StaffRole[]) {
  const actor = await getActionActor()
  return actor && hasAnyRole(actor, roles) ? actor : null
}

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

export async function getDailyConsultations(params?: {
  start_date?: string
  end_date?: string
}) {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", data: [] as DailyConsultation[] }

  let query = createAdminClient()
    .from("v_daily_consultations")
    .select("*")
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

export async function getComplaintFrequency(params?: {
  start_date?: string
  end_date?: string
}) {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", data: [] as ComplaintFrequency[] }

  const { data, error } = await createAdminClient()
    .from("v_complaint_frequency")
    .select("*")
    .order("frequency", { ascending: false })
    .limit(20)

  if (error) return { error: error.message, data: [] as ComplaintFrequency[] }

  return { error: null, data: data as ComplaintFrequency[] }
}

export async function getDispensingSummary(params?: {
  start_date?: string
  end_date?: string
}) {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", data: [] as DispensingSummary[] }

  const { data, error } = await createAdminClient()
    .from("v_dispensing_summary")
    .select("*")
    .order("total_quantity_dispensed", { ascending: false })
    .limit(20)

  if (error) return { error: error.message, data: [] as DispensingSummary[] }

  return { error: null, data: data as DispensingSummary[] }
}

export async function getClearanceCompletion() {
  const actor = await staff(["admin"])
  if (!actor) return { error: "Access denied", data: [] as ClearanceCompletion[] }

  const { data, error } = await createAdminClient()
    .from("v_clearance_completion")
    .select("*")

  if (error) return { error: error.message, data: [] as ClearanceCompletion[] }

  return { error: null, data: data as ClearanceCompletion[] }
}

export async function getAnalyticsOverview(params?: {
  start_date?: string
  end_date?: string
}) {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", overview: null }

  const startDate = params?.start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const endDate = params?.end_date || new Date().toISOString().split('T')[0]

  // Get consultation stats
  const { data: consultations } = await createAdminClient()
    .from("v_daily_consultations")
    .select("total_consultations, student_consultations, faculty_consultations")
    .gte("consultation_date", startDate)
    .lte("consultation_date", endDate)

  const totalConsultations = consultations?.reduce((sum, c) => sum + c.total_consultations, 0) || 0
  const totalStudentConsultations = consultations?.reduce((sum, c) => sum + c.student_consultations, 0) || 0
  const totalFacultyConsultations = consultations?.reduce((sum, c) => sum + c.faculty_consultations, 0) || 0

  // Get active incidents
  const { count: activeIncidents } = await createAdminClient()
    .from("incidents")
    .select("*", { count: "exact", head: true })
    .in("status", ["open", "in-progress"])

  // Get pending clearances
  const { count: pendingClearances } = await createAdminClient()
    .from("health_clearances")
    .select("*", { count: "exact", head: true })
    .in("status", ["pending", "evaluating"])

  // Get low stock medicines
  const { count: lowStockCount } = await createAdminClient()
    .from("v_medicine_stock_summary")
    .select("*", { count: "exact", head: true })
    .lte("total_quantity", "min_stock_level")

  return {
    error: null,
    overview: {
      total_consultations: totalConsultations,
      student_consultations: totalStudentConsultations,
      faculty_consultations: totalFacultyConsultations,
      active_incidents: activeIncidents || 0,
      pending_clearances: pendingClearances || 0,
      low_stock_medicines: lowStockCount || 0,
      period_start: startDate,
      period_end: endDate
    }
  }
}

export async function getDoctorStats(doctorId: string, params?: {
  start_date?: string
  end_date?: string
}) {
  const actor = await staff(["admin", "doctor"])
  if (!actor) return { error: "Access denied", stats: null }

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
