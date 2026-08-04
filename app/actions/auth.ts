"use server"

import { cookies } from "next/headers"
import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { logAuditEvent } from "@/lib/audit-logger"
import { redirect } from "next/navigation"

/**
 * Signs out the current user, revokes the one-device session token, and logs the event.
 * Server-side only — the browser never touches the Supabase auth client directly.
 */
export async function signOutAction() {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (user) {
        try {
            const admin = createAdminClient()
            await admin
                .from("user_sessions")
                .update({ revoked_at: new Date().toISOString() })
                .eq("user_id", user.id)
                .is("revoked_at", null)

            await logAuditEvent({
                action: "AUTH_LOGOUT",
                userId: user.id,
                email: user.email,
            })
        } catch (err) {
            console.error("[signOutAction] Failed to revoke session:", err)
        }
    }

    await supabase.auth.signOut()
    redirect("/login")
}

/**
 * Updates the current user's password (authenticated request via the user's session).
 * Server-side only — the browser never calls supabase.auth.updateUser directly.
 */
export async function changePasswordAction(currentPassword: string, newPassword: string): Promise<{ error?: string; success?: boolean }> {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
        return { error: "Not authenticated" }
    }

    if (!newPassword || newPassword.length < 12) {
        return { error: "Password must be at least 12 characters" }
    }

    // Verify the current password first to prevent session hijacking
    const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email || "",
        password: currentPassword,
    })

    if (signInError) {
        return { error: "Current password is incorrect" }
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
        return { error: error.message }
    }

    await logAuditEvent({
        action: "AUTH_PASSWORD_RESET",
        userId: user.id,
        email: user.email,
        details: { method: "self-service" },
    })

    return { success: true }
}