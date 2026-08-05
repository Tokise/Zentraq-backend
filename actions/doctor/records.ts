"use server"

import { cookies } from "next/headers"
import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"
import { getUserRole } from "@/lib/auth/get-user-role"
import type { Faculty, Student } from "@/types"

export type DoctorRecordSearchResult = Pick<Student, "id" | "student_number" | "first_name" | "last_name" | "department" | "status"> | Pick<Faculty, "id" | "employee_number" | "first_name" | "last_name" | "department" | "status">

async function requireDoctor() {
  const supabase = createClient(await cookies())
  const { data: { user } } = await supabase.auth.getUser()
  return user && await getUserRole(user.id) === "doctor" ? user : null
}

export async function searchDoctorRecordsAction(query = ""): Promise<{ error: string | null; results: DoctorRecordSearchResult[] }> {
  if (!await requireDoctor()) return { error: "Access denied", results: [] }
  const term = query.trim().replace(/[%_,]/g, "")
  const admin = createAdminClient()
  let students = admin.from("students").select("id, student_number, first_name, last_name, department, status").limit(25)
  let faculty = admin.from("faculty").select("id, employee_number, first_name, last_name, department, status").limit(25)
  if (term) {
    students = students.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,student_number.ilike.%${term}%`)
    faculty = faculty.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,employee_number.ilike.%${term}%`)
  }
  const [{ data: studentRows, error: studentError }, { data: facultyRows, error: facultyError }] = await Promise.all([students.order("last_name"), faculty.order("last_name")])
  return { error: studentError?.message ?? facultyError?.message ?? null, results: [...(studentRows ?? []), ...(facultyRows ?? [])] }
}
