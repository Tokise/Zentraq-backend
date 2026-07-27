"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { cookies } from "next/headers"

const MIN_PASSWORD_LENGTH = 12

export async function createStudentAccount(formData: FormData) {
    try {
        const email = (formData.get("email") as string)?.trim()
        const password = formData.get("password") as string
        const studentAccountId = formData.get("studentAccountId") as string

        if (!email || !password || !studentAccountId) {
            return { error: "Missing required fields" }
        }

        if (password.length < MIN_PASSWORD_LENGTH) {
            return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }
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

export async function resetStudentPassword(formData: FormData) {
    try {
        const studentAccountId = formData.get("studentAccountId") as string
        const newPassword = formData.get("newPassword") as string

        if (!studentAccountId || !newPassword) {
            return { error: "Missing required fields" }
        }

        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }
        }

        const cookieStore = await cookies()
        const supabase = createClient(cookieStore)

        // Verify the caller is authenticated (add an isAdmin/getUserRole check here too if you want
        // to be extra safe, mirroring the layout.tsx guard on /admin/rfid-registration)
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser()

        if (authError || !user) {
            return { error: "Not authenticated" }
        }

        const admin = createAdminClient()

        // TEMP DEBUG — remove once the "Student account not found" issue is resolved
        console.log("[resetStudentPassword] looking up studentAccountId:", studentAccountId)
        console.log("[resetStudentPassword] admin client URL:", process.env.NEXT_PUBLIC_SUPABASE_URL)

        // Look up the student's auth user_id from student_accounts
        const { data: studentAccount, error: fetchError } = await admin
            .from("student_accounts")
            .select("user_id, email")
            .eq("id", studentAccountId)
            .maybeSingle()

        // TEMP DEBUG — remove once the "Student account not found" issue is resolved
        console.log("[resetStudentPassword] fetchError:", fetchError)
        console.log("[resetStudentPassword] studentAccount:", studentAccount)

        if (fetchError || !studentAccount) {
            return {
                error: "Student account not found",
                // TEMP DEBUG fields — remove once resolved
                debug: {
                    searchedId: studentAccountId,
                    fetchErrorMessage: fetchError?.message ?? null,
                    fetchErrorCode: (fetchError as any)?.code ?? null,
                    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
                },
            }
        }

        if (!studentAccount.user_id) {
            return { error: "This student account has no linked login yet" }
        }

        // Update the password in Supabase Auth
        const { error: updateError } = await admin.auth.admin.updateUserById(
            studentAccount.user_id,
            { password: newPassword }
        )

        if (updateError) {
            return { error: updateError.message }
        }

        // Clear any existing session token so the old session is invalidated
        // (consistent with the one-device-only logic in login/logout)
        await admin
            .from("student_accounts")
            .update({ current_session_token: null })
            .eq("id", studentAccountId)

        return {
            success: true,
            email: studentAccount.email,
            password: newPassword,
        }
    } catch {
        return { error: "Server error" }
    }
}