"use server"

import { getActionActor, hasAnyRole } from "@/lib/security/action-guard"
import { createAdminClient } from "@/utils/supabase/admin"
import { logIncidentResponseAction, closeIncidentAction, scheduleIncidentFollowUpAction } from "@/actions/clinical/incidents/management"

type StaffRole = "admin" | "doctor" | "nurse"

async function staff(roles: readonly StaffRole[]) {
  const actor = await getActionActor()
  return actor && hasAnyRole(actor, roles) ? actor : null
}

export interface IncidentDetailRow {
  id: string
  patient_type: "student" | "faculty"
  patient_name: string | null
  incident_type: string
  description: string
  location: string | null
  severity: string | null
  status: string
  reported_at: string
  responses: Array<{ id: string; action_taken: string; response_time: string }>
  followups: Array<{ id: string; follow_up_date: string | null; notes: string | null; completed: boolean }>
}

export async function getIncidentDetailAction(incidentId: string): Promise<{ error: string | null; incident: IncidentDetailRow | null }> {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", incident: null }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("incidents")
    .select(`
      id, incident_type, description, location, severity, status, created_at,
      patient_type,
      students(first_name, last_name, student_number),
      faculty(first_name, last_name, employee_number),
      incident_responses(id, action_taken, response_time),
      incident_followups(id, follow_up_date, notes, completed)
    `)
    .eq("id", incidentId)
    .maybeSingle()

  if (error) return { error: error.message, incident: null }
  if (!data) return { error: null, incident: null }

  const student = Array.isArray(data.students) ? data.students[0] : data.students
  const faculty = Array.isArray(data.faculty) ? data.faculty[0] : data.faculty

  const incident: IncidentDetailRow = {
    id: data.id,
    patient_type: data.patient_type,
    patient_name: student
      ? `${student.first_name} ${student.last_name} (${student.student_number})`
      : faculty ? `${faculty.first_name} ${faculty.last_name} (${faculty.employee_number})` : null,
    incident_type: data.incident_type,
    description: data.description,
    location: data.location,
    severity: data.severity,
    status: data.status,
    reported_at: data.created_at,
    responses: (data.incident_responses ?? []).map((r: any) => ({
      id: r.id,
      action_taken: r.action_taken,
      response_time: r.response_time,
    })),
    followups: (data.incident_followups ?? []).map((f: any) => ({
      id: f.id,
      follow_up_date: f.follow_up_date,
      notes: f.notes,
      completed: f.completed,
    })),
  }

  return { error: null, incident }
}

export { logIncidentResponseAction, closeIncidentAction, scheduleIncidentFollowUpAction }