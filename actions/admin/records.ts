"use server"

import { createAdminClient } from "@/utils/supabase/admin"
import { getActionActor, hasAnyRole } from "@/lib/security/action-guard"
import type { Faculty, Student } from "@/types"

export type RecordSearchResult = Pick<Student, "id" | "student_number" | "first_name" | "last_name" | "department" | "status"> | Pick<Faculty, "id" | "employee_number" | "first_name" | "last_name" | "department" | "status">

// Allows only clinical roles to search patient records.
async function requireClinicalStaff() {
  const actor = await getActionActor()
  return actor && hasAnyRole(actor, ["admin", "doctor", "nurse"])
}

export async function searchRecordsAction(query = ""): Promise<{ error: string | null; students: Array<Pick<Student, "id" | "student_number" | "first_name" | "last_name" | "department" | "status">>; faculty: Array<Pick<Faculty, "id" | "employee_number" | "first_name" | "last_name" | "department" | "status">>; staff: Array<{ id: string; employee_number: string; first_name: string; last_name: string; department: string | null; status: string }> }> {
  if (!await requireClinicalStaff()) return { error: "Access denied", students: [], faculty: [], staff: [] }
  const admin = createAdminClient()
  const term = query.trim()
  let studentsQuery = admin.from("students").select("id, student_number, first_name, last_name, department, status").limit(20)
  let facultyQuery = admin.from("faculty").select("id, employee_number, first_name, last_name, department, status").limit(20)
  let staffQuery = admin.from("staff").select("id, employee_number, first_name, last_name, department, status").limit(20)
  if (term) {
    const escaped = term.replace(/[%_,]/g, "")
    studentsQuery = studentsQuery.or(`first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,student_number.ilike.%${escaped}%`)
    facultyQuery = facultyQuery.or(`first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,employee_number.ilike.%${escaped}%`)
    staffQuery = staffQuery.or(`first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,employee_number.ilike.%${escaped}%`)
  }
  const [{ data: students, error: studentsError }, { data: faculty, error: facultyError }, { data: staff, error: staffError }] = await Promise.all([studentsQuery.order("last_name"), facultyQuery.order("last_name"), staffQuery.order("last_name")])
  return { error: studentsError?.message ?? facultyError?.message ?? staffError?.message ?? null, students: students ?? [], faculty: faculty ?? [], staff: staff ?? [] }
}
