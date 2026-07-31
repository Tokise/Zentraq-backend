"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { cookies } from "next/headers"
import { getUserRole } from "@/lib/auth/get-user-role"
import { isAdmin } from "@/lib/auth/roles"

/**
 * Require the caller to be authenticated.
 * Returns the current user or throws an error.
 */
export async function requireAuth() {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
        throw new Error("Not authenticated")
    }

    return user
}

/**
 * Require the caller to have one of the specified roles.
 * Returns the current user and their role.
 */
export async function requireRole(allowedRoles: string[]) {
    const user = await requireAuth()
    const role = await getUserRole(user.id)

    if (!allowedRoles.includes(role)) {
        throw new Error(
            `Access Denied: Required role(s): ${allowedRoles.join(", ")}. Your role: ${role}`
        )
    }

    return { user, role }
}

/**
 * Require the caller to be an admin.
 * Returns the current user.
 */
export async function requireAdmin() {
    const user = await requireAuth()
    const role = await getUserRole(user.id)

    if (!isAdmin(role)) {
        throw new Error("Access Denied: Only administrators can perform this action")
    }

    return user
}

/**
 * Require the caller to be a clinic staff member (admin, doctor, or nurse).
 * Returns the current user and their role.
 */
export async function requireClinicStaff() {
    return requireRole(["admin", "doctor", "nurse"])
}

/**
 * Require the caller to be a student.
 * Returns the current user.
 */
export async function requireStudent() {
    const user = await requireAuth()
    const role = await getUserRole(user.id)

    if (role !== "student") {
        throw new Error("Access Denied: Only students can perform this action")
    }

    return user
}

/**
 * Get the admin Supabase client (Service Role).
 * Must only be called after authorization checks.
 */
export function getAdminClient() {
    return createAdminClient()
}