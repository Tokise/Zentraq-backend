import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { getUserRole } from "@/lib/auth/get-user-role"
import { getDefaultRouteForRole } from "@/lib/auth/role-routes"
import { cookies } from "next/headers"

// Redirects an authenticated user to the root of their assigned role tree.
export default async function RootPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const role = await getUserRole(user.id)
  if (!role) {
    redirect("/login")
  }

  redirect(getDefaultRouteForRole(role))
}
