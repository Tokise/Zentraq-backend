"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { cookies } from "next/headers"

const MIN_PASSWORD_LENGTH = 12

function getErrorMessage(err: unknown, fallback: string): string {
    if (!err) return fallback
    if (typeof err === "string") return err.trim() || fallback
    if (typeof err === "object") {
        const obj = err as Record<string, any>
        if (typeof obj.message === "string" && obj.message.trim() && obj.message !== "{}") {
            return obj.message.trim()
        }
        if (typeof obj.error_description === "string" && obj.error_description.trim()) {
            return obj.error_description.trim()
        }
        if (typeof obj.msg === "string" && obj.msg.trim()) {
            return obj.msg.trim()
        }
        if (obj.error && typeof obj.error === "string" && obj.error !== "{}") {
            return obj.error.trim()
        }
        if (obj.status === 500 || obj.name === "AuthRetryableFetchError") {
            return "Supabase Database Error (500): Database trigger on auth.users failed. Please drop or fix the trigger on auth.users in Supabase."
        }
        try {
            const str = JSON.stringify(err)
            if (str && str !== "{}" && str !== "[]") return str
        } catch {
            // ignore
        }
    }
    return fallback
}

export type CreateStudentAccountResult =
    | { success: true; userId: string; email: string; password: string; error?: undefined }
    | { success?: false; error: string; userId?: undefined; email?: undefined; password?: undefined }

export type ResetStudentPasswordResult =
    | { success: true; email: string | null; password: string; error?: undefined }
    | { success?: false; error: string; email?: undefined; password?: undefined }

export async function createStudentAccount(formData: FormData): Promise<CreateStudentAccountResult> {
    try {
        console.log("[createStudentAccount] Action invoked")
        const email = (formData.get("email") as string)?.trim()
        const password = formData.get("password") as string
        const studentAccountId = formData.get("studentAccountId") as string

        console.log("[createStudentAccount] Input:", { email, studentAccountId, passwordLen: password?.length })

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

        console.log("[createStudentAccount] Auth user check:", user?.id ?? "None", authError?.message ?? "OK")

        if (authError || !user) {
            return { error: getErrorMessage(authError, "Not authenticated") }
        }

        // Use admin client to create the auth user & update DB (bypassing RLS)
        const admin = createAdminClient()

        // Check if student profile exists and whether it already has a user account linked
        const { data: studentAccount, error: fetchError } = await admin
            .from("student_accounts")
            .select("id, user_id, email")
            .eq("id", studentAccountId)
            .maybeSingle()

        console.log("[createStudentAccount] Query result:", { studentAccount, fetchError })

        if (fetchError) {
            return { error: getErrorMessage(fetchError, "Error checking student record") }
        }

        if (!studentAccount) {
            return { error: "Student record not found" }
        }

        if (studentAccount.user_id) {
            return { error: "This student profile already has an active portal account linked." }
        }

        // Create user in Supabase Auth
        console.log("[createStudentAccount] Calling admin.auth.admin.createUser for:", email)
        const { data: created, error: createError } = await admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        })

        console.log("[createStudentAccount] createUser result:", { createdUser: created?.user?.id, createError })

        if (createError) {
            return { error: getErrorMessage(createError, "Failed to create authentication user") }
        }

        if (!created.user) {
            return { error: "Failed to create user" }
        }

        // Link user_id and update email in student_accounts using admin client (bypassing RLS)
        console.log("[createStudentAccount] Updating student_accounts for ID:", studentAccountId)
        const { error: linkError } = await admin
            .from("student_accounts")
            .update({
                user_id: created.user.id,
                email: email,
            })
            .eq("id", studentAccountId)

        console.log("[createStudentAccount] linkError:", linkError)

        if (linkError) {
            // Clean up the created user if linking fails
            await admin.auth.admin.deleteUser(created.user.id)
            return { error: getErrorMessage(linkError, "Failed to link account to student record") }
        }

        console.log("[createStudentAccount] SUCCESS!")
        return {
            success: true,
            userId: created.user.id,
            email,
            password,
        }
    } catch (err: unknown) {
        console.error("[createStudentAccount] Caught exception:", err)
        return { error: getErrorMessage(err, "Server error occurred during account creation") }
    }
}

export async function resetStudentPassword(formData: FormData): Promise<ResetStudentPasswordResult> {
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

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser()

        if (authError || !user) {
            return { error: getErrorMessage(authError, "Not authenticated") }
        }

        const admin = createAdminClient()

        const { data: studentAccount, error: fetchError } = await admin
            .from("student_accounts")
            .select("user_id, email")
            .eq("id", studentAccountId)
            .maybeSingle()

        if (fetchError || !studentAccount) {
            return { error: getErrorMessage(fetchError, "Student account not found") }
        }

        if (!studentAccount.user_id) {
            return { error: "This student account has no linked login yet" }
        }

        const { error: updateError } = await admin.auth.admin.updateUserById(
            studentAccount.user_id,
            { password: newPassword }
        )

        if (updateError) {
            return { error: getErrorMessage(updateError, "Failed to update password") }
        }

        await admin
            .from("student_accounts")
            .update({ current_session_token: null })
            .eq("id", studentAccountId)

        return {
            success: true,
            email: studentAccount.email,
            password: newPassword,
        }
    } catch (err: unknown) {
        console.error("[resetStudentPassword] Exception:", err)
        return { error: getErrorMessage(err, "Server error occurred during password reset") }
    }
}