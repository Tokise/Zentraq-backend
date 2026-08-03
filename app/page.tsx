import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { getUserRole } from "@/lib/auth/get-user-role"
import { cookies } from "next/headers"

export default async function RootPage() {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    const role = await getUserRole(user.id)

    switch (role) {
        case "admin":
            redirect("/admin")
        case "doctor":
            redirect("/doctor")
        case "nurse":
            redirect("/nurse")
        case "student":
            redirect("/student")
        case "faculty":
            redirect("/faculty")
        default:
            redirect("/login")
    }
}