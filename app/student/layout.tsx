import { DashboardShell } from "@/components/layout/dashboard-shell"
import { createClient } from "@/utils/supabase/server"
import { getUserRole } from "@/lib/auth/get-user-role"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { isStudent } from "@/lib/auth/roles"

export default async function StudentLayout({
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

    const userRole = await getUserRole(user.id)

    if (!isStudent(userRole)) {
        redirect("/")
    }

    return (
        <DashboardShell userEmail={user?.email} userRole={userRole}>
            {children}
        </DashboardShell>
    )
}
