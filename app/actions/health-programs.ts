"use server"

import { getActionActor, hasAnyRole } from "@/lib/security/action-guard"
import { createAdminClient } from "@/utils/supabase/admin"
import { logAuditEvent } from "@/lib/audit-logger"

type StaffRole = "admin" | "doctor" | "nurse"

async function staff(roles: readonly StaffRole[]) {
  const actor = await getActionActor()
  return actor && hasAnyRole(actor, roles) ? actor : null
}

export interface HealthProgram {
  id: string
  name: string
  description: string | null
  program_type: "immunization" | "screening" | "wellness"
  start_date: string | null
  end_date: string | null
  is_active: boolean
  managed_by: string | null
  created_at: string
  updated_at: string
}

export async function createHealthProgram(data: {
  name: string
  description?: string
  program_type: "immunization" | "screening" | "wellness"
  start_date?: string
  end_date?: string
}) {
  const actor = await staff(["admin"])
  if (!actor) return { error: "Access denied - only admins can create programs", program: null }

  const { data: program, error } = await createAdminClient()
    .from("health_programs")
    .insert({
      name: data.name,
      description: data.description || null,
      program_type: data.program_type,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      is_active: true,
      managed_by: actor.id
    })
    .select()
    .single()

  if (error) return { error: error.message, program: null }

  await logAuditEvent({
    userId: actor.id,
    action: "SERVICE_CREATED",
    resource: program.id,
    details: {
      action: "create_health_program",
      program_name: data.name,
      program_type: data.program_type
    }
  })

  return { error: null, program }
}

export async function updateHealthProgram(
  programId: string,
  data: {
    name?: string
    description?: string
    program_type?: "immunization" | "screening" | "wellness"
    start_date?: string
    end_date?: string
    is_active?: boolean
  }
) {
  const actor = await staff(["admin"])
  if (!actor) return { error: "Access denied - only admins can update programs", program: null }

  const { data: program, error } = await createAdminClient()
    .from("health_programs")
    .update({
      ...data,
      updated_at: new Date().toISOString()
    })
    .eq("id", programId)
    .select()
    .single()

  if (error) return { error: error.message, program: null }

  await logAuditEvent({
    userId: actor.id,
    action: "SERVICE_UPDATED",
    resource: programId,
    details: {
      action: "update_health_program",
      updates: data
    }
  })

  return { error: null, program }
}

export async function enrollParticipants(
  programId: string,
  data: {
    participants: Array<{
      patient_type: "student" | "faculty"
      patient_id: string
    }>
  }
) {
  const actor = await staff(["admin", "nurse"])
  if (!actor) return { error: "Access denied", enrollments: null }

  const enrollments = data.participants.map((p) => ({
    program_id: programId,
    patient_type: p.patient_type,
    student_id: p.patient_type === "student" ? p.patient_id : null,
    faculty_id: p.patient_type === "faculty" ? p.patient_id : null
  }))

  const { data: result, error } = await createAdminClient()
    .from("program_participants")
    .insert(enrollments)
    .select()

  if (error) return { error: error.message, enrollments: null }

  await logAuditEvent({
    userId: actor.id,
    action: "SERVICE_UPDATED",
    resource: programId,
    details: {
      action: "enroll_participants",
      count: enrollments.length
    }
  })

  return { error: null, enrollments: result }
}

export async function recordScreening(
  participantId: string,
  data: {
    screening_type: string
    result?: string
    notes?: string
  }
) {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", screening: null }

  const { data: screening, error } = await createAdminClient()
    .from("program_screenings")
    .insert({
      participant_id: participantId,
      screening_type: data.screening_type,
      result: data.result || null,
      performed_by: actor.id,
      notes: data.notes || null
    })
    .select()
    .single()

  if (error) return { error: error.message, screening: null }

  await logAuditEvent({
    userId: actor.id,
    action: "MEDICAL_RECORD_MODIFY",
    resource: participantId,
    details: {
      action: "record_screening",
      screening_type: data.screening_type
    }
  })

  return { error: null, screening }
}

export async function recordImmunization(
  participantId: string,
  data: {
    vaccine_name: string
    dose_number?: number
    administered_date?: string
    lot_number?: string
    notes?: string
  }
) {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", immunization: null }

  const { data: immunization, error } = await createAdminClient()
    .from("program_immunizations")
    .insert({
      participant_id: participantId,
      vaccine_name: data.vaccine_name,
      dose_number: data.dose_number || null,
      administered_date: data.administered_date || null,
      administered_by: actor.id,
      lot_number: data.lot_number || null,
      notes: data.notes || null
    })
    .select()
    .single()

  if (error) return { error: error.message, immunization: null }

  await logAuditEvent({
    userId: actor.id,
    action: "MEDICAL_RECORD_MODIFY",
    resource: participantId,
    details: {
      action: "record_program_immunization",
      vaccine_name: data.vaccine_name
    }
  })

  return { error: null, immunization }
}

export async function getHealthPrograms() {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", programs: [] as HealthProgram[] }

  const { data, error } = await createAdminClient()
    .from("health_programs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) return { error: error.message, programs: [] as HealthProgram[] }

  return { error: null, programs: data as HealthProgram[] }
}

export async function getProgramDetail(programId: string) {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", program: null as any }

  const { data, error } = await createAdminClient()
    .from("health_programs")
    .select(`
      *,
      program_participants(
        id,
        patient_type,
        students(id, student_number, first_name, last_name),
        faculty(id, employee_number, first_name, last_name)
      ),
      program_screenings(*),
      program_immunizations(*)
    `)
    .eq("id", programId)
    .single()

  if (error) return { error: error.message, program: null }

  return { error: null, program: data }
}

export async function getProgramAnalytics(programId: string) {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", analytics: null }

  const { data, error } = await createAdminClient()
    .from("program_analytics")
    .select("*")
    .eq("program_id", programId)
    .order("metric_date", { ascending: false })
    .limit(100)

  if (error) return { error: error.message, analytics: null }

  return { error: null, analytics: data }
}
