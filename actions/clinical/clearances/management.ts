"use server"

import { getActionActor, hasAnyRole } from "@/lib/security/action-guard"
import { createAdminClient } from "@/utils/supabase/admin"
import { logAuditEvent } from "@/lib/audit-logger"

type StaffRole = "admin" | "doctor" | "nurse"

async function staff(roles: readonly StaffRole[]) {
  const actor = await getActionActor()
  return actor && hasAnyRole(actor, roles) ? actor : null
}

export interface Clearance {
  id: string
  requester_type: "student" | "faculty"
  student_id: string | null
  faculty_id: string | null
  purpose: string | null
  status: "pending" | "evaluating" | "approved" | "rejected"
  expires_at: string | null
  created_at: string
  updated_at: string
}

export interface ClearanceEvaluation {
  id: string
  clearance_id: string
  doctor_id: string | null
  result: "fit" | "unfit" | "conditional"
  medical_notes: string | null
  evaluated_at: string
}

export async function submitClearanceRequestAction(data: {
  requester_type: "student" | "faculty"
  requester_id: string
  purpose: string
}) {
  const actor = await getActionActor()
  if (!actor) return { error: "Access denied", clearance: null }

  const tableName = data.requester_type === "student" ? "students" : "faculty"
  const idColumn = data.requester_type === "student" ? "student_id" : "faculty_id"

  // Verify requester exists
  const { data: requester, error: requesterError } = await createAdminClient()
    .from(tableName)
    .select("id")
    .eq("id", data.requester_id)
    .single()

  if (requesterError || !requester) {
    return { error: "Requester not found", clearance: null }
  }

  const { data: clearance, error } = await createAdminClient()
    .from("health_clearances")
    .insert({
      requester_type: data.requester_type,
      [idColumn]: data.requester_id,
      purpose: data.purpose,
      status: "pending"
    })
    .select()
    .single()

  if (error) return { error: error.message, clearance: null }

  await logAuditEvent({
    userId: actor.id,
    action: "MEDICAL_RECORD_MODIFY",
    resource: clearance.id,
    details: {
      action: "submit_clearance_request",
      requester_type: data.requester_type,
      requester_id: data.requester_id
    }
  })

  return { error: null, clearance }
}

export async function getClearanceQueueAction() {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", clearances: [] as Clearance[] }

  const { data, error } = await createAdminClient()
    .from("health_clearances")
    .select(`
      *,
      students(id, student_number, first_name, last_name),
      faculty(id, employee_number, first_name, last_name)
    `)
    .in("status", ["pending", "evaluating"])
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) return { error: error.message, clearances: [] as Clearance[] }

  return { error: null, clearances: data as Clearance[] }
}

export async function getClearanceStatusAction(requesterId: string, requesterType: "student" | "faculty") {
  const actor = await getActionActor()
  if (!actor) return { error: "Access denied", clearances: [] as Clearance[] }

  const idColumn = requesterType === "student" ? "student_id" : "faculty_id"

  const { data, error } = await createAdminClient()
    .from("health_clearances")
    .select("*")
    .eq(idColumn, requesterId)
    .eq("requester_type", requesterType)
    .order("created_at", { ascending: false })
    .limit(10)

  if (error) return { error: error.message, clearances: [] as Clearance[] }

  return { error: null, clearances: data as Clearance[] }
}

export async function getMyClearancesAction() {
  const actor = await getActionActor()
  if (!actor || !hasAnyRole(actor, ["student", "faculty"])) return { error: "Not authenticated", clearances: [] as Clearance[] }

  const tableName = actor.role === "student" ? "students" : "faculty"

  const { data: profile } = await createAdminClient()
    .from(tableName)
    .select("id")
    .eq("user_id", actor.id)
    .maybeSingle()

  if (!profile) return { error: "Profile not found", clearances: [] as Clearance[] }

  return getClearanceStatusAction(profile.id, actor.role as "student" | "faculty")
}

export async function recordClearanceEvaluationAction(
  clearanceId: string,
  data: {
    result: "fit" | "unfit" | "conditional"
    medical_notes?: string
  }
) {
  const actor = await staff(["admin", "doctor"])
  if (!actor) return { error: "Access denied - only doctors can evaluate", evaluation: null }

  // Verify clearance exists and is in evaluating status
  const { data: clearance, error: clearanceError } = await createAdminClient()
    .from("health_clearances")
    .select("id, status")
    .eq("id", clearanceId)
    .single()

  if (clearanceError || !clearance) {
    return { error: "Clearance not found", evaluation: null }
  }

  // Update clearance status to evaluating if not already
  if (clearance.status === "pending") {
    await createAdminClient()
      .from("health_clearances")
      .update({ status: "evaluating" })
      .eq("id", clearanceId)
  }

  const { data: evaluation, error } = await createAdminClient()
    .from("clearance_evaluations")
    .insert({
      clearance_id: clearanceId,
      doctor_id: actor.id,
      result: data.result,
      medical_notes: data.medical_notes || null
    })
    .select()
    .single()

  if (error) return { error: error.message, evaluation: null }

  await logAuditEvent({
    userId: actor.id,
    action: "MEDICAL_RECORD_MODIFY",
    resource: clearanceId,
    details: {
      action: "record_clearance_evaluation",
      result: data.result,
      evaluation_id: evaluation.id
    }
  })

  return { error: null, evaluation }
}

export async function approveClearanceAction(
  clearanceId: string,
  data: {
    expires_at?: string
  }
) {
  const actor = await staff(["admin"])
  if (!actor) return { error: "Access denied - only admins can approve", clearance: null }

  // Verify clearance exists and has evaluation
  const { data: clearance, error: clearanceError } = await createAdminClient()
    .from("health_clearances")
    .select("id, status")
    .eq("id", clearanceId)
    .single()

  if (clearanceError || !clearance) {
    return { error: "Clearance not found", clearance: null }
  }

  if (clearance.status === "approved") {
    return { error: "Clearance already approved", clearance: null }
  }

  const { data: updated, error } = await createAdminClient()
    .from("health_clearances")
    .update({
      status: "approved",
      expires_at: data.expires_at || null
    })
    .eq("id", clearanceId)
    .select()
    .single()

  if (error) return { error: error.message, clearance: null }

  // Generate certificate
  const certificateNumber = `CLR-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

  await createAdminClient()
    .from("clearance_certificates")
    .insert({
      clearance_id: clearanceId,
      certificate_number: certificateNumber,
      issued_by: actor.id
    })

  await logAuditEvent({
    userId: actor.id,
    action: "MEDICAL_RECORD_MODIFY",
    resource: clearanceId,
    details: {
      action: "approve_clearance",
      certificate_number: certificateNumber,
      expires_at: data.expires_at
    }
  })

  return { error: null, clearance: updated }
}

export async function rejectClearanceAction(clearanceId: string, reason: string) {
  const actor = await staff(["admin"])
  if (!actor) return { error: "Access denied - only admins can reject", clearance: null }

  const { data: clearance, error } = await createAdminClient()
    .from("health_clearances")
    .update({
      status: "rejected"
    })
    .eq("id", clearanceId)
    .select()
    .single()

  if (error) return { error: error.message, clearance: null }

  await logAuditEvent({
    userId: actor.id,
    action: "MEDICAL_RECORD_MODIFY",
    resource: clearanceId,
    details: {
      action: "reject_clearance",
      reason
    }
  })

  return { error: null, clearance }
}

export async function getClearanceDetailAction(clearanceId: string) {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", clearance: null as any }

  const { data, error } = await createAdminClient()
    .from("health_clearances")
    .select(`
      *,
      students(id, student_number, first_name, last_name, department, course),
      faculty(id, employee_number, first_name, last_name, department, position),
      clearance_evaluations(*),
      clearance_certificates(*)
    `)
    .eq("id", clearanceId)
    .single()

  if (error) return { error: error.message, clearance: null }

  return { error: null, clearance: data }
}
