"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { getUserRole } from "@/lib/auth/get-user-role"
import { logAuditEvent } from "@/lib/audit-logger"

export interface StudentAppointmentDTO {
  id: string
  appointment_date: string
  time_slot: string
  reason: string | null
  status: string
  patient_name: string | null
  department: string | null
  created_at: string
}

async function requireStudentProfile() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user || await getUserRole(user.id) !== "student") return { error: "Access denied", user: null, profile: null }
  const { data: profile } = await createAdminClient().from("students").select("id, first_name, last_name, department").eq("user_id", user.id).maybeSingle()
  if (!profile) return { error: "Student profile not found", user: null, profile: null }
  return { error: null, user, profile }
}

export async function getStudentAppointmentsAction() {
  const auth = await requireStudentProfile()
  if (auth.error || !auth.profile) return { error: auth.error, appointments: [] as StudentAppointmentDTO[] }
  const { data, error } = await createAdminClient().from("appointments")
    .select("id, scheduled_date, scheduled_time, reason, status, created_at")
    .eq("student_id", auth.profile.id).order("scheduled_date", { ascending: true })
  if (error) return { error: error.message, appointments: [] as StudentAppointmentDTO[] }
  const patientName = `${auth.profile.first_name} ${auth.profile.last_name}`
  return { error: null, appointments: (data ?? []).map((item) => ({ id: item.id, appointment_date: item.scheduled_date ?? "", time_slot: item.scheduled_time ?? "", reason: item.reason, status: item.status, patient_name: patientName, department: auth.profile.department, created_at: item.created_at })) }
}

export async function createAppointment(data: { appointmentDate: string; timeSlot: string; reason?: string }) {
  const auth = await requireStudentProfile()
  if (auth.error || !auth.user || !auth.profile) return { error: auth.error }
  if (!data.appointmentDate || !data.timeSlot || !data.reason?.trim()) return { error: "Date, time, and reason are required." }
  const { error } = await createAdminClient().from("appointments").insert({ patient_type: "student", student_id: auth.profile.id, reason: data.reason.trim(), scheduled_date: data.appointmentDate, scheduled_time: data.timeSlot, status: "pending" })
  if (error) return { error: error.message }
  await logAuditEvent({ action: "APPOINTMENT_CHANGE", userId: auth.user.id, email: auth.user.email, details: { action: "STUDENT_REQUESTED" } })
  revalidatePath("/student/appointments")
  return { success: true }
}

export async function cancelAppointment(id: string) {
  const auth = await requireStudentProfile()
  if (auth.error || !auth.user || !auth.profile) return { error: auth.error }
  const { data, error } = await createAdminClient().from("appointments").update({ status: "cancelled" }).eq("id", id).eq("student_id", auth.profile.id).in("status", ["pending", "ai_evaluated", "recommended", "scheduled"]).select("id").maybeSingle()
  if (error) return { error: error.message }
  if (!data) return { error: "Appointment cannot be cancelled" }
  await logAuditEvent({ action: "APPOINTMENT_CHANGE", userId: auth.user.id, email: auth.user.email, resource: id, details: { action: "STUDENT_CANCELLED" } })
  revalidatePath("/student/appointments")
  return { success: true }
}
