"use server"

import { getActionActor, hasAnyRole } from "@/lib/security/action-guard"
import { createAdminClient } from "@/utils/supabase/admin"

type StaffRole = "admin" | "doctor" | "nurse"

async function staff(roles: readonly StaffRole[]) {
  const actor = await getActionActor()
  return actor && hasAnyRole(actor, roles) ? actor : null
}

export interface ClearanceRow {
  id: string
  requester_type: "student" | "faculty"
  requester_name: string | null
  requester_id: string | null
  purpose: string | null
  status: string
  expires_at: string | null
  created_at: string
  updated_at: string
}

export async function getClearanceHistoryAction(params?: {
  status?: string
  searchQuery?: string
}): Promise<{ error: string | null; clearances: ClearanceRow[] }> {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", clearances: [] as ClearanceRow[] }

  const admin = createAdminClient()
  let query = admin
    .from("health_clearances")
    .select(`
      id, requester_type, student_id, faculty_id, purpose, status, expires_at, created_at, updated_at,
      students(id, student_number, first_name, last_name),
      faculty(id, employee_number, first_name, last_name)
    `)
    .order("created_at", { ascending: false })
    .limit(100)

  if (params?.status && params.status !== "all") {
    query = query.eq("status", params.status)
  }

  if (params?.searchQuery && params.searchQuery.trim()) {
    const q = params.searchQuery.trim().replace(/[%_,]/g, "")
    query = query.or(`purpose.ilike.%${q}%`)
  }

  const { data, error } = await query
  if (error) return { error: error.message, clearances: [] as ClearanceRow[] }

  const clearances: ClearanceRow[] = (data ?? []).map((row: any) => {
    const student = Array.isArray(row.students) ? row.students[0] : row.students
    const faculty = Array.isArray(row.faculty) ? row.faculty[0] : row.faculty
    const requesterName = row.requester_type === "student"
      ? student ? `${student.first_name} ${student.last_name}` : null
      : faculty ? `${faculty.first_name} ${faculty.last_name}` : null
    const requesterId = row.requester_type === "student" ? row.student_id : row.faculty_id
    return {
      id: row.id,
      requester_type: row.requester_type,
      requester_name: requesterName,
      requester_id: requesterId,
      purpose: row.purpose,
      status: row.status,
      expires_at: row.expires_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  })

  return { error: null, clearances }
}

export async function getClearanceCertificatesAction(): Promise<{
  error: string | null
  certificates: Array<{
    id: string
    certificate_number: string
    clearance_id: string
    issued_at: string
    requester_name: string | null
    requester_type: string
    purpose: string | null
    status: string
  }>
}> {
  const actor = await staff(["admin", "doctor", "nurse"])
  if (!actor) return { error: "Access denied", certificates: [] }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("clearance_certificates")
    .select(`
      id, certificate_number, clearance_id, issued_at,
      health_clearances(
        id, requester_type, purpose, status,
        students(id, first_name, last_name),
        faculty(id, first_name, last_name)
      )
    `)
    .order("issued_at", { ascending: false })
    .limit(100)

  if (error) return { error: error.message, certificates: [] }

  const certificates = (data ?? []).map((row: any) => {
    const clearance = Array.isArray(row.health_clearances) ? row.health_clearances[0] : row.health_clearances
    const student = clearance && Array.isArray(clearance.students) ? clearance.students[0] : clearance?.students
    const faculty = clearance && Array.isArray(clearance.faculty) ? clearance.faculty[0] : clearance?.faculty
    const requesterName = clearance?.requester_type === "student"
      ? student ? `${student.first_name} ${student.last_name}` : null
      : faculty ? `${faculty.first_name} ${faculty.last_name}` : null
    return {
      id: row.id,
      certificate_number: row.certificate_number,
      clearance_id: row.clearance_id,
      issued_at: row.issued_at,
      requester_name: requesterName,
      requester_type: clearance?.requester_type ?? "",
      purpose: clearance?.purpose ?? null,
      status: clearance?.status ?? "approved",
    }
  })

  return { error: null, certificates }
}