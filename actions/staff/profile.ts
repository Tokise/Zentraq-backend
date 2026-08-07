"use server"

import { createAdminClient } from "@/utils/supabase/admin"
import { cookies } from "next/headers"
import { createClient } from "@/utils/supabase/server"

export interface StaffProfileDTO {
  firstName: string
  lastName: string
  employeeNumber: string | null
  department: string | null
  position: string | null
  email: string | null
  phone: string | null
}

async function requireStaffUser() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", user: null }
  }

  const admin = createAdminClient()
  const { data: staff } = await admin
    .from("staff")
    .select("id, user_id, first_name, last_name, employee_number, department, position, email, phone")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!staff) {
    return { error: "Staff profile not found", user: null }
  }

  return { error: null, user: { id: user.id, staff } }
}

export async function getStaffProfileAction(): Promise<{ error: string | null; profile: StaffProfileDTO | null }> {
  const result = await requireStaffUser()
  if (result.error || !result.user) {
    return { error: result.error || "Not authenticated", profile: null }
  }

  const staff = result.user.staff as any
  return {
    error: null,
    profile: {
      firstName: staff.first_name,
      lastName: staff.last_name,
      employeeNumber: staff.employee_number,
      department: staff.department,
      position: staff.position,
      email: staff.email,
      phone: staff.phone,
    },
  }
}