"use server"

import { createAdminClient } from "@/utils/supabase/admin"
import { cookies } from "next/headers"
import { createClient } from "@/utils/supabase/server"
import { getUserRole } from "@/lib/auth/get-user-role"

export interface FacultyProfileDTO {
    firstName: string
    lastName: string
    employeeNumber: string | null
    department: string | null
    position: string | null
    email: string | null
    phone: string | null
}

async function requireFacultyUser() {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
        return { error: "Not authenticated", user: null }
    }

    const role = await getUserRole(user.id)
    if (role !== "faculty") {
        return { error: "Access Denied: Faculty portal only", user: null }
    }

    return { error: null, user }
}

export async function getFacultyProfileIdAction(): Promise<{ error: string | null; facultyId: string | null }> {
    try {
        const auth = await requireFacultyUser()
        if (auth.error || !auth.user) {
            return { error: auth.error, facultyId: null }
        }

        const admin = createAdminClient()
        const { data, error } = await admin
            .from("faculty")
            .select("id")
            .eq("user_id", auth.user.id)
            .maybeSingle()

        if (error) {
            console.error("[getFacultyProfileIdAction DB Error]:", error)
            return { error: error.message, facultyId: null }
        }

        return { error: null, facultyId: data?.id ?? null }
    } catch (err: any) {
        console.error("[getFacultyProfileIdAction Exception]:", err)
        return { error: err?.message || "Failed to load faculty profile", facultyId: null }
    }
}

export async function getFacultyProfileDTO() {
    try {
        const auth = await requireFacultyUser()
        if (auth.error || !auth.user) {
            return { error: auth.error, profile: null }
        }

        const admin = createAdminClient()
        const { data, error } = await admin
            .from("faculty")
            .select("first_name, last_name, employee_number, department, position, email, phone")
            .eq("user_id", auth.user.id)
            .maybeSingle()

        if (error) {
            console.error("[getFacultyProfileDTO DB Error]:", error)
            return { error: error.message, profile: null }
        }

        if (!data) {
            return { error: "Faculty profile record not found", profile: null }
        }

        const profile: FacultyProfileDTO = {
            firstName: data.first_name || "",
            lastName: data.last_name || "",
            employeeNumber: data.employee_number || null,
            department: data.department || null,
            position: data.position || null,
            email: data.email || auth.user.email || null,
            phone: data.phone || null,
        }

        return { error: null, profile }
    } catch (err: any) {
        console.error("[getFacultyProfileDTO Exception]:", err)
        return { error: err?.message || "Failed to load faculty profile", profile: null }
    }
}
