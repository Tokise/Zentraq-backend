"use server"

import { getActionActor, hasAnyRole } from "@/lib/security/action-guard"
import { createAdminClient } from "@/utils/supabase/admin"
import { logAuditEvent } from "@/lib/audit-logger"
import { revalidatePath } from "next/cache"

async function requireAdmin() {
  const actor = await getActionActor()
  return actor && hasAnyRole(actor, ["admin", "nurse"]) ? actor : null
}

export async function createAdminAppointmentAction(params: {
  patientType: "student" | "faculty"
  patientId: string
  reason: string
  symptoms?: string
  scheduledDate?: string
  scheduledTime?: string
  priority?: number
}): Promise<{ success?: boolean; error?: string }> {
  const actor = await requireAdmin()
  if (!actor) return { error: "Access denied" }

  if (!params.patientType || !params.patientId || !params.reason?.trim()) {
    return { error: "Patient and reason are required" }
  }

  const admin = createAdminClient()
  const idColumn = params.patientType === "student" ? "student_id" : "faculty_id"

  // Verify patient exists
  const table = params.patientType === "student" ? "students" : "faculty"
  const { data: patient, error: patientError } = await admin
    .from(table)
    .select("id")
    .eq("id", params.patientId)
    .maybeSingle()

  if (patientError || !patient) return { error: "Patient not found" }

  const { error } = await admin.from("appointments").insert({
    patient_type: params.patientType,
    [idColumn]: params.patientId,
    reason: params.reason.trim(),
    symptoms: params.symptoms?.trim() || null,
    scheduled_date: params.scheduledDate || null,
    scheduled_time: params.scheduledTime || null,
    priority: params.priority ?? null,
    status: "pending",
  })

  if (error) return { error: error.message }

  await logAuditEvent({
    userId: actor.id,
    action: "APPOINTMENT_CHANGE",
    resource: params.patientId,
    details: { action: "ADMIN_CREATED", patient_type: params.patientType },
  })

  revalidatePath("/admin/appointments/calendar")
  return { success: true }
}