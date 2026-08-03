import { DashboardShell } from "@/components/layout/dashboard-shell"
import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { getUserRole } from "@/lib/auth/get-user-role"
import { isAdmin } from "@/lib/auth/roles"
import { cookies } from "next/headers"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const role = await getUserRole(user.id)

  if (!isAdmin(role)) {
    redirect("/unauthorized")
  }

  return (
    <DashboardShell userEmail={user?.email} userRole={role ?? undefined}>
      {children}
    </DashboardShell>
  )
}
