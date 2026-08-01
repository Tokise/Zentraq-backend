"use server"

import { createAdminClient } from "@/utils/supabase/admin"
import { cookies } from "next/headers"
import { createClient } from "@/utils/supabase/server"
import { getUserRole } from "@/lib/auth/get-user-role"
import { revalidatePath } from "next/cache"
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

async function requireStudent() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", user: null }
  }

  const role = await getUserRole(user.id)
  if (role !== "student") {
    return { error: "Access Denied: Only students can access student appointments", user: null }
  }

  return { error: null, user }
}

export async function getStudentAppointmentsAction() {
  try {
    const auth = await requireStudent()
    if (auth.error || !auth.user) {
      return { error: auth.error, appointments: [] }
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from("student_appointments")
      .select("id, appointment_date, time_slot, complaint, status, patient_name, department, created_at")
      .eq("student_user_id", auth.user.id)
      .order("appointment_date", { ascending: true })

    if (error) {
      console.error("[getStudentAppointmentsAction DB Error]:", error)
      return { error: error.message, appointments: [] }
    }

    const appointments: StudentAppointmentDTO[] = (data || []).map((a) => ({
      id: a.id,
      appointment_date: a.appointment_date,
      time_slot: a.time_slot,
      reason: a.complaint || null,
      status: a.status,
      patient_name: a.patient_name || null,
      department: a.department || null,
      created_at: a.created_at,
    }))

    return { error: null, appointments }
  } catch (err: any) {
    console.error("[getStudentAppointmentsAction Exception]:", err)
    return { error: err?.message || "Failed to fetch appointments", appointments: [] }
  }
}

export async function createAppointment(data: {
  appointmentDate: string
  timeSlot: string
  reason?: string
}) {
  try {
    const auth = await requireStudent()
    if (auth.error || !auth.user) return { error: auth.error }

    if (!data.appointmentDate || !data.timeSlot) {
      return { error: "Appointment date and time slot are required." }
    }

    const admin = createAdminClient()

    // Retrieve real student profile details on server side
    const { data: studentData } = await admin
      .from("student_accounts")
      .select("first_name, last_name, department")
      .eq("user_id", auth.user.id)
      .maybeSingle()

    const patientName = studentData
      ? `${studentData.first_name || ""} ${studentData.last_name || ""}`.trim()
      : "Student"
    const department = studentData?.department || "Student"

    const { error } = await admin.from("student_appointments").insert({
      student_user_id: auth.user.id, // Strictly bind to authenticated user session ID (Fixes IDOR)
      appointment_date: data.appointmentDate,
      time_slot: data.timeSlot,
      complaint: data.reason || "Student appointment",
      patient_name: patientName,
      department: department,
      status: "pending",
    })

    if (error) return { error: error.message }

    await logAuditEvent({
      action: "APPOINTMENT_CHANGE",
      userId: auth.user.id,
      email: auth.user.email,
      details: { action: "STUDENT_CREATED", appointmentDate: data.appointmentDate, timeSlot: data.timeSlot },
    })

    revalidatePath("/student/appointments")
    return { success: true }
  } catch (err: any) {
    return { error: err?.message || "Server error" }
  }
}

export async function cancelAppointment(id: string) {
  try {
    const auth = await requireStudent()
    if (auth.error || !auth.user) return { error: auth.error }

    const admin = createAdminClient()

    // Strictly match id AND student_user_id to prevent canceling other users' appointments (Fixes IDOR)
    const { error } = await admin
      .from("student_appointments")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("student_user_id", auth.user.id)

    if (error) return { error: error.message }

    await logAuditEvent({
      action: "APPOINTMENT_CHANGE",
      userId: auth.user.id,
      email: auth.user.email,
      resource: id,
      details: { action: "STUDENT_CANCELLED" },
    })

    revalidatePath("/student/appointments")
    return { success: true }
  } catch (err: any) {
    return { error: err?.message || "Server error" }
  }
}
