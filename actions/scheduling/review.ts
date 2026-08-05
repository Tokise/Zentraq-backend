"use server"

import { getActionActor, hasAnyRole } from "@/lib/security/action-guard"
import { createAdminClient } from "@/utils/supabase/admin"
import { logAuditEvent } from "@/lib/audit-logger"

type StaffRole = "admin" | "doctor" | "nurse"

async function staff(roles: readonly StaffRole[]) {
  const actor = await getActionActor()
  return actor && hasAnyRole(actor, roles) ? actor : null
}

export async function recommendAppointment(
  appointmentId: string,
  data: {
    recommendation: "approve" | "reject" | "reschedule"
    notes?: string
    recommended_date?: string
    recommended_time?: string
  }
) {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", recommendation: null }

  // Verify appointment exists
  const { data: appointment, error: appointmentError } = await createAdminClient()
    .from("appointments")
    .select("id, status")
    .eq("id", appointmentId)
    .single()

  if (appointmentError || !appointment) {
    return { error: "Appointment not found", recommendation: null }
  }

  if (appointment.status !== "ai_evaluated" && appointment.status !== "recommended") {
    return { error: "Appointment is not ready for recommendation", recommendation: null }
  }

  const { data: recommendation, error } = await createAdminClient()
    .from("appointment_recommendations")
    .insert({
      appointment_id: appointmentId,
      recommended_by: actor.id,
      recommendation: data.recommendation,
      notes: data.notes || null,
      recommended_date: data.recommended_date || null,
      recommended_time: data.recommended_time || null
    })
    .select()
    .single()

  if (error) return { error: error.message, recommendation: null }

  // Update appointment status
  await createAdminClient()
    .from("appointments")
    .update({ status: "recommended" })
    .eq("id", appointmentId)

  await logAuditEvent({
    userId: actor.id,
    action: "APPOINTMENT_CHANGE",
    resource: appointmentId,
    details: {
      action: "recommend_appointment",
      recommendation: data.recommendation
    }
  })

  return { error: null, recommendation }
}

export async function approveAppointment(
  appointmentId: string,
  data?: {
    scheduled_date?: string
    scheduled_time?: string
  }
) {
  const actor = await staff(["admin", "nurse"])
  if (!actor) return { error: "Access denied - only admins and nurses can approve", appointment: null }

  // Verify appointment exists
  const { data: appointment, error: appointmentError } = await createAdminClient()
    .from("appointments")
    .select("id, status")
    .eq("id", appointmentId)
    .single()

  if (appointmentError || !appointment) {
    return { error: "Appointment not found", appointment: null }
  }

  const updateData: any = {
    status: "approved"
  }

  if (data?.scheduled_date) {
    updateData.scheduled_date = data.scheduled_date
  }

  if (data?.scheduled_time) {
    updateData.scheduled_time = data.scheduled_time
  }

  const { data: updated, error } = await createAdminClient()
    .from("appointments")
    .update(updateData)
    .eq("id", appointmentId)
    .select()
    .single()

  if (error) return { error: error.message, appointment: null }

  await logAuditEvent({
    userId: actor.id,
    action: "APPOINTMENT_CHANGE",
    resource: appointmentId,
    details: {
      action: "approve_appointment",
      scheduled_date: data?.scheduled_date,
      scheduled_time: data?.scheduled_time
    }
  })

  return { error: null, appointment: updated }
}

export async function rejectAppointment(
  appointmentId: string,
  reason: string
) {
  const actor = await staff(["admin", "nurse"])
  if (!actor) return { error: "Access denied - only admins and nurses can reject", appointment: null }

  const { data: appointment, error } = await createAdminClient()
    .from("appointments")
    .update({ status: "rejected" })
    .eq("id", appointmentId)
    .select()
    .single()

  if (error) return { error: error.message, appointment: null }

  await logAuditEvent({
    userId: actor.id,
    action: "APPOINTMENT_CHANGE",
    resource: appointmentId,
    details: {
      action: "reject_appointment",
      reason
    }
  })

  return { error: null, appointment }
}

export async function rescheduleAppointment(
  appointmentId: string,
  data: {
    scheduled_date: string
    scheduled_time: string
  }
) {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", appointment: null }

  const { data: appointment, error } = await createAdminClient()
    .from("appointments")
    .update({
      scheduled_date: data.scheduled_date,
      scheduled_time: data.scheduled_time,
      status: "scheduled"
    })
    .eq("id", appointmentId)
    .select()
    .single()

  if (error) return { error: error.message, appointment: null }

  await logAuditEvent({
    userId: actor.id,
    action: "APPOINTMENT_CHANGE",
    resource: appointmentId,
    details: {
      action: "reschedule_appointment",
      scheduled_date: data.scheduled_date,
      scheduled_time: data.scheduled_time
    }
  })

  return { error: null, appointment }
}

export async function getAppointmentDetail(appointmentId: string) {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", appointment: null as any }

  const { data, error } = await createAdminClient()
    .from("appointments")
    .select(`
      *,
      students(id, student_number, first_name, last_name),
      faculty(id, employee_number, first_name, last_name),
      clinic_accounts(id, display_name, role),
      appointment_ai_evaluations(*),
      appointment_recommendations(*)
    `)
    .eq("id", appointmentId)
    .single()

  if (error) return { error: error.message, appointment: null }

  return { error: null, appointment: data }
}
