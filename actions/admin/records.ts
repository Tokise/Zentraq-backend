"use server"

import { cookies } from "next/headers"
import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"
import { getUserRole } from "@/lib/auth/get-user-role"
import { isAdmin } from "@/lib/auth/roles"
import type { Faculty, Student } from "@/types"

export type RecordSearchResult = Pick<Student, "id" | "student_number" | "first_name" | "last_name" | "department" | "status"> | Pick<Faculty, "id" | "employee_number" | "first_name" | "last_name" | "department" | "status">

async function requireAdmin() {
  const supabase = createClient(await cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(await getUserRole(user.id))) return null
  return user
}

export async function searchRecordsAction(query = ""): Promise<{ error: string | null; students: Array<Pick<Student, "id" | "student_number" | "first_name" | "last_name" | "department" | "status">>; faculty: Array<Pick<Faculty, "id" | "employee_number" | "first_name" | "last_name" | "department" | "status">> }> {
  if (!await requireAdmin()) return { error: "Access denied", students: [], faculty: [] }
  const admin = createAdminClient()
  const term = query.trim()
  let studentsQuery = admin.from("students").select("id, student_number, first_name, last_name, department, status").limit(20)
  let facultyQuery = admin.from("faculty").select("id, employee_number, first_name, last_name, department, status").limit(20)
  if (term) {
    const escaped = term.replace(/[%_,]/g, "")
    studentsQuery = studentsQuery.or(`first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,student_number.ilike.%${escaped}%`)
    facultyQuery = facultyQuery.or(`first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,employee_number.ilike.%${escaped}%`)
  }
  const [{ data: students, error: studentsError }, { data: faculty, error: facultyError }] = await Promise.all([studentsQuery.order("last_name"), facultyQuery.order("last_name")])
  return { error: studentsError?.message ?? facultyError?.message ?? null, students: students ?? [], faculty: faculty ?? [] }
}
