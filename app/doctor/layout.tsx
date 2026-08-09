import { DashboardShell } from "@/components/layout/dashboard-shell"
import { createClient } from "@/utils/supabase/server"
import { getUserRole } from "@/lib/auth/get-user-role"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { isDoctor } from "@/lib/auth/roles"
import { getOwnPatientProfileAction } from "@/actions/clinical/compliance-records"

export default async function DoctorLayout({
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

    if (!isDoctor(userRole)) {
        redirect("/unauthorized")
    }

    const ownProfile = await getOwnPatientProfileAction()

    return (
        <DashboardShell
            hasPatientProfile={Boolean(ownProfile.profile)}
            userEmail={user?.email}
            userRole={userRole ?? undefined}
        >
            {children}
        </DashboardShell>
    )
}
