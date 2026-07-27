import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { cookies } from "next/headers"
import type { UserRole } from "@/lib/auth/roles"

export async function getUserRole(userId: string): Promise<UserRole> {
  // 1. Try querying profiles via Admin client (bypasses RLS permission errors)
  try {
    const adminClient = createAdminClient()
    const { data: adminData } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle()

    if (adminData?.role) {
      const roleStr = String(adminData.role).toLowerCase()
      if (roleStr === "admin") return "admin"
      if (roleStr === "doctor") return "doctor"
      if (roleStr === "nurse") return "nurse"
      return "nurse" // fallback
    }
  } catch {
    // Admin client error, continue to standard client
  }

  // 2. Query profiles table with standard client
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle()

    if (data?.role) {
      const roleStr = String(data.role).toLowerCase()
      if (roleStr === "admin") return "admin"
      if (roleStr === "doctor") return "doctor"
      if (roleStr === "nurse") return "nurse"
      return "nurse" // fallback
    }
  } catch {
    // Ignore database error
  }

  // 3. Check if user is a student (has a student_accounts entry)
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: studentData } = await supabase
      .from("student_accounts")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle()

    if (studentData) return "student"
  } catch {
    // Ignore
  }

  // 4. Auth user fallback metadata/email check
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (user && user.id === userId) {
      if (user.app_metadata?.role === "admin" || user.user_metadata?.role === "admin" || user.email?.toLowerCase().includes("admin")) {
        return "admin"
      }
    }
  } catch {
    // Ignore auth fetch error
  }

  return "nurse"
}