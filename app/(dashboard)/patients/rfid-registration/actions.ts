"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { cookies } from "next/headers"

export async function createStudentAccount(formData: FormData) {
    try {
        const email = (formData.get("email") as string)?.trim()
        const password = formData.get("password") as string
        const studentAccountId = formData.get("studentAccountId") as string

        if (!email || !password || !studentAccountId) {
            return { error: "Missing required fields" }
        }

        if (password.length < 8) {
            return { error: "Password must be at least 8 characters" }
        }

        const cookieStore = await cookies()
        const supabase = createClient(cookieStore)

        // Verify current user is authenticated
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser()

        if (authError || !user) {
            return { error: "Not authenticated" }
        }

        // Use admin client to create the auth user
        const admin = createAdminClient()

        const { data: created, error: createError } = await admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        })

        if (createError) {
            return { error: createError.message }
        }

        if (!created.user) {
            return { error: "Failed to create user" }
        }

        // Link user_id to student_accounts
        const { error: linkError } = await supabase
            .from("student_accounts")
            .update({ user_id: created.user.id })
            .eq("id", studentAccountId)

        if (linkError) {
            // Clean up the created user if linking fails
            await admin.auth.admin.deleteUser(created.user.id)
            return { error: linkError.message }
        }

        return {
            success: true,
            email,
            password,
        }
    } catch {
        return { error: "Server error" }
    }
}