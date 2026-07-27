import { createClient } from "@/utils/supabase/server"
import { getUserRole } from "@/lib/auth/get-user-role"
import { isAdmin } from "@/lib/auth/roles"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export default async function RfidRegistrationLayout({
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

    if (!isAdmin(userRole)) {
        redirect("/")
    }

    return children
}