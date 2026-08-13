"use server"

import { getActionActor, hasAnyRole } from "@/lib/security/action-guard"
import { createAdminClient } from "@/utils/supabase/admin"
import { logAuditEvent } from "@/lib/audit-logger"

type StaffRole = "admin" | "doctor" | "nurse"

async function staff(roles: readonly StaffRole[]) {
  const actor = await getActionActor()
  return actor && hasAnyRole(actor, roles) ? actor : null
}

export interface Incident {
  id: string
  patient_type: "student" | "faculty"
  student_id: string | null
  faculty_id: string | null
  incident_type: "injury" | "illness" | "emergency"
  description: string
  location: string | null
  severity: "minor" | "moderate" | "severe" | "critical"
  status: "open" | "in-progress" | "closed"
  reported_by: string | null
  created_at: string
  updated_at: string
}

export interface IncidentResponse {
  id: string
  incident_id: string
  action_taken: string
  responder_id: string | null
  response_time: string
}

export async function reportIncidentAction(data: {
  patient_type: "student" | "faculty"
  patient_id: string
  incident_type: "injury" | "illness" | "emergency"
  description: string
  location?: string
  severity: "minor" | "moderate" | "severe" | "critical"
}) {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", incident: null }

  const tableName = data.patient_type === "student" ? "students" : "faculty"
  const idColumn = data.patient_type === "student" ? "student_id" : "faculty_id"

  // Verify patient exists
  const { data: patient, error: patientError } = await createAdminClient()
    .from(tableName)
    .select("id")
    .eq("id", data.patient_id)
    .single()

  if (patientError || !patient) {
    return { error: "Patient not found", incident: null }
  }

  const { data: incident, error } = await createAdminClient()
    .from("incidents")
    .insert({
      patient_type: data.patient_type,
      [idColumn]: data.patient_id,
      incident_type: data.incident_type,
      description: data.description,
      location: data.location || null,
      severity: data.severity,
      status: "open",
      reported_by: actor.id
    })
    .select()
    .single()

  if (error) return { error: error.message, incident: null }

  await logAuditEvent({
    userId: actor.id,
    action: "MEDICAL_RECORD_MODIFY",
    resource: incident.id,
    details: {
      action: "report_incident",
      incident_type: data.incident_type,
      severity: data.severity,
      patient_type: data.patient_type,
      patient_id: data.patient_id
    }
  })

  return { error: null, incident }
}

export async function logIncidentResponseAction(
  incidentId: string,
  data: {
    action_taken: string
  }
) {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", response: null }

  // Verify incident exists
  const { data: incident, error: incidentError } = await createAdminClient()
    .from("incidents")
    .select("id, status")
    .eq("id", incidentId)
    .single()

  if (incidentError || !incident) {
    return { error: "Incident not found", response: null }
  }

  // Update incident status to in-progress if still open
  if (incident.status === "open") {
    await createAdminClient()
      .from("incidents")
      .update({ status: "in-progress" })
      .eq("id", incidentId)
  }

  const { data: response, error } = await createAdminClient()
    .from("incident_responses")
    .insert({
      incident_id: incidentId,
      action_taken: data.action_taken,
      responder_id: actor.id
    })
    .select()
    .single()

  if (error) return { error: error.message, response: null }

  await logAuditEvent({
    userId: actor.id,
    action: "MEDICAL_RECORD_MODIFY",
    resource: incidentId,
    details: {
      action: "log_incident_response",
      response_id: response.id
    }
  })

  return { error: null, response }
}

export async function scheduleIncidentFollowUpAction(
  incidentId: string,
  data: {
    follow_up_date: string
    notes?: string
  }
) {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", followUp: null }

  const { data: followUp, error } = await createAdminClient()
    .from("incident_followups")
    .insert({
      incident_id: incidentId,
      follow_up_date: data.follow_up_date,
      notes: data.notes || null
    })
    .select()
    .single()

  if (error) return { error: error.message, followUp: null }

  await logAuditEvent({
    userId: actor.id,
    action: "MEDICAL_RECORD_MODIFY",
    resource: incidentId,
    details: {
      action: "schedule_incident_follow_up",
      follow_up_id: followUp.id,
      follow_up_date: data.follow_up_date
    }
  })

  return { error: null, followUp }
}

export async function closeIncidentAction(incidentId: string) {
  const actor = await staff(["admin", "doctor"])
  if (!actor) return { error: "Access denied - only doctors can close incidents", incident: null }

  const { data: incident, error } = await createAdminClient()
    .from("incidents")
    .update({ status: "closed" })
    .eq("id", incidentId)
    .select()
    .single()

  if (error) return { error: error.message, incident: null }

  await logAuditEvent({
    userId: actor.id,
    action: "MEDICAL_RECORD_MODIFY",
    resource: incidentId,
    details: {
      action: "close_incident"
    }
  })

  return { error: null, incident }
}

export async function getIncidentDetailAction(incidentId: string) {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", incident: null as any }

  const { data, error } = await createAdminClient()
    .from("incidents")
    .select(`
      *,
      students(id, student_number, first_name, last_name, department),
      faculty(id, employee_number, first_name, last_name, department),
      incident_responses(*),
      incident_followups(*)
    `)
    .eq("id", incidentId)
    .single()

  if (error) return { error: error.message, incident: null }

  return { error: null, incident: data }
}

export async function getActiveIncidentsAction() {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", incidents: [] as Incident[] }

  const { data, error } = await createAdminClient()
    .from("incidents")
    .select(`
      *,
      students(id, student_number, first_name, last_name),
      faculty(id, employee_number, first_name, last_name)
    `)
    .in("status", ["open", "in-progress"])
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) return { error: error.message, incidents: [] as Incident[] }

  return { error: null, incidents: data as Incident[] }
}
