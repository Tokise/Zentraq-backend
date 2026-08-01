"use server"

import { createAdminClient } from "@/utils/supabase/admin"
import { cookies } from "next/headers"
import { createClient } from "@/utils/supabase/server"
import { getUserRole } from "@/lib/auth/get-user-role"
import { isAdmin } from "@/lib/auth/roles"
import { logAuditEvent } from "@/lib/audit-logger"

// ─────────────────────────────────────────────────────────────────────────────
// Authorization
// ─────────────────────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<{ userId: string; email: string | null } | { error: string }> {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { error: "Not authenticated" }
    const role = await getUserRole(user.id)
    if (!isAdmin(role)) return { error: "Access Denied: Only administrators can manage settings" }
    return { userId: user.id, email: user.email ?? null }
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type SettingCategory =
    | "clinic_info"
    | "school_info"
    | "operating_hours"
    | "notification_prefs"
    | "rfid"
    | "password_policy"
    | "security"
    | "system"

export interface SettingDTO {
    key: string
    value: Record<string, any>
    category: SettingCategory
    description: string | null
    is_public: boolean
    updated_at: string
    updated_by: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all settings grouped by category.
 */
export async function getSettingsAction(): Promise<{ error: string | null; settings: SettingDTO[] }> {
    try {
        const auth = await requireAdmin()
        if ("error" in auth) return { error: auth.error, settings: [] }

        const admin = createAdminClient()

        const { data, error } = await admin
            .from("settings")
            .select("key, value, category, description, is_public, updated_at, updated_by")
            .order("category")
            .order("key")

        if (error) {
            console.error("[getSettingsAction DB Error]:", error)
            return { error: error.message, settings: [] }
        }

        return { error: null, settings: (data || []) as SettingDTO[] }
    } catch (err: any) {
        console.error("[getSettingsAction Exception]:", err)
        return { error: err?.message || "Failed to fetch settings", settings: [] }
    }
}

/**
 * Update a single setting by key.
 */
export async function updateSettingAction(params: {
    key: string
    value: Record<string, any>
}): Promise<{ success?: boolean; error?: string }> {
    try {
        const auth = await requireAdmin()
        if ("error" in auth) return { error: auth.error }

        const { key, value } = params

        if (!key || key.trim().length === 0) {
            return { error: "Setting key is required" }
        }

        if (value === undefined || value === null) {
            return { error: "Setting value is required" }
        }

        const admin = createAdminClient()

        const { error } = await admin
            .from("settings")
            .update({
                value,
                updated_by: auth.userId,
            })
            .eq("key", key)

        if (error) {
            console.error("[updateSettingAction DB Error]:", error)
            return { error: error.message }
        }

        await logAuditEvent({
            action: "SETTING_UPDATED",
            userId: auth.userId,
            email: auth.email,
            resource: key,
            details: { key },
        })

        return { success: true }
    } catch (err: any) {
        console.error("[updateSettingAction Exception]:", err)
        return { error: err?.message || "Failed to update setting" }
    }
}

/**
 * Batch update multiple settings at once.
 */
export async function updateSettingsBatchAction(
    entries: Array<{ key: string; value: Record<string, any> }>
): Promise<{ success?: boolean; error?: string; updatedCount?: number }> {
    try {
        const auth = await requireAdmin()
        if ("error" in auth) return { error: auth.error }

        if (!entries || entries.length === 0) {
            return { error: "No settings provided to update" }
        }

        const admin = createAdminClient()

        let updatedCount = 0
        for (const entry of entries) {
            const { key, value } = entry
            if (!key || value === undefined) continue

            const { error } = await admin
                .from("settings")
                .update({ value, updated_by: auth.userId })
                .eq("key", key)

            if (error) {
                console.error(`[updateSettingsBatchAction DB Error for key=${key}]:`, error)
                return { error: error.message, updatedCount }
            }
            updatedCount++
        }

        await logAuditEvent({
            action: "SETTING_UPDATED",
            userId: auth.userId,
            email: auth.email,
            resource: "batch",
            details: { count: updatedCount, keys: entries.map((e) => e.key) },
        })

        return { success: true, updatedCount }
    } catch (err: any) {
        console.error("[updateSettingsBatchAction Exception]:", err)
        return { error: err?.message || "Failed to update settings" }
    }
}