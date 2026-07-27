import { DashboardShell } from "@/components/layout/dashboard-shell"
import { createClient } from "@/utils/supabase/server"
import { getUserRole } from "@/lib/auth/get-user-role"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { isStudent } from "@/lib/auth/roles"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  const userRole = user ? await getUserRole(user.id) : "nurse"

  // If student, redirect to student portal
  if (isStudent(userRole)) {
    redirect("/student")
  }

  // If admin, redirect to /admin (must be authenticated)
  if (userRole !== "admin" && userRole !== "nurse" && userRole !== "doctor") {
    redirect("/login")
  }

  return (
    <DashboardShell userEmail={user?.email} userRole={userRole}>
      {children}
    </DashboardShell>
  )
}
