"use server"

import { createAdminClient } from "@/utils/supabase/admin"
import { cookies } from "next/headers"
import { createClient } from "@/utils/supabase/server"
import { logAuditEvent } from "@/lib/audit-logger"

// ─────────────────────────────────────────────────────────────────────────────
// Authorization: resolve current authenticated user from HttpOnly session
// ─────────────────────────────────────────────────────────────────────────────

async function getCurrentUser() {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return null
    return user
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type NotificationType =
    | "appointment"
    | "consultation"
    | "emergency"
    | "visit_log"
    | "system"
    | "rfid"
    | "clearance"
    | "service"

export interface NotificationDTO {
    id: string
    title: string
    message: string
    type: NotificationType
    is_read: boolean
    created_at: string
    related_resource: string | null
    related_resource_id: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch the authenticated user's latest notifications.
 *
 * Used by the notification-dropdown. Returns only the minimal fields
 * the dropdown needs — never exposes sender_id, receiver_id, is_deleted.
 *
 * Flow: Browser → Server Action → Authorization → createAdminClient() → notifications table
 */
export async function getNotifications(options?: {
    limit?: number
}): Promise<{ error: string | null; notifications: NotificationDTO[] }> {
    try {
        const user = await getCurrentUser()
        if (!user) return { error: "Not authenticated", notifications: [] }

        const limit = Math.min(options?.limit ?? 20, 30) // cap at 30 for dropdown

        const admin = createAdminClient()

        const { data, error } = await admin
            .from("notifications")
            .select("id, title, message, type, is_read, created_at, related_resource, related_resource_id")
            .eq("receiver_id", user.id) // CRITICAL: only the authenticated user's notifications
            .eq("is_deleted", false)
            .order("created_at", { ascending: false })
            .limit(limit)

        if (error) {
            console.error("[getNotifications DB Error]:", error)
            return { error: error.message, notifications: [] }
        }

        return {
            error: null,
            notifications: (data || []) as NotificationDTO[],
        }
    } catch (err: any) {
        console.error("[getNotifications Exception]:", err)
        return { error: err?.message || "Failed to fetch notifications", notifications: [] }
    }
}

/**
 * Get the unread notification count for the current user.
 * Uses a count-only head query for performance.
 */
export async function getUnreadNotificationCount(): Promise<{ error: string | null; count: number }> {
    try {
        const user = await getCurrentUser()
        if (!user) return { error: "Not authenticated", count: 0 }

        const admin = createAdminClient()

        const { count, error } = await admin
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("receiver_id", user.id)
            .eq("is_read", false)
            .eq("is_deleted", false)

        if (error) {
            console.error("[getUnreadNotificationCount DB Error]:", error)
            return { error: error.message, count: 0 }
        }

        return { error: null, count: count || 0 }
    } catch (err: any) {
        console.error("[getUnreadNotificationCount Exception]:", err)
        return { error: err?.message || "Failed to count unread notifications", count: 0 }
    }
}

/**
 * Mark a single notification as read (or unread).
 *
 * The .eq("receiver_id", user.id) clause enforces ownership at the query level —
 * even if a user guesses another user's notification ID, they cannot modify it.
 */
export async function markNotificationAsRead(id: string, isRead: boolean): Promise<{ success?: boolean; error?: string }> {
    try {
        const user = await getCurrentUser()
        if (!user) return { error: "Not authenticated" }

        if (!id || id.trim().length !== 36) {
            return { error: "Invalid notification ID" }
        }

        const admin = createAdminClient()

        const { error } = await admin
            .from("notifications")
            .update({ is_read: isRead })
            .eq("id", id)
            .eq("receiver_id", user.id) // ownership enforcement

        if (error) {
            console.error("[markNotificationAsRead DB Error]:", error)
            return { error: error.message }
        }

        await logAuditEvent({
            action: isRead ? "NOTIFICATION_READ" : "NOTIFICATION_UNREAD",
            userId: user.id,
            email: user.email ?? null,
            resource: id,
            details: { isRead },
        })

        return { success: true }
    } catch (err: any) {
        console.error("[markNotificationAsRead Exception]:", err)
        return { error: err?.message || "Failed to update notification" }
    }
}

/**
 * Mark all of the current user's unread notifications as read.
 */
export async function markAllNotificationsAsRead(): Promise<{ success?: boolean; error?: string; updatedCount?: number }> {
    try {
        const user = await getCurrentUser()
        if (!user) return { error: "Not authenticated" }

        const admin = createAdminClient()

        const { data, error } = await admin
            .from("notifications")
            .update({ is_read: true })
            .eq("receiver_id", user.id)
            .eq("is_read", false)
            .eq("is_deleted", false)
            .select("id")

        if (error) {
            console.error("[markAllNotificationsAsRead DB Error]:", error)
            return { error: error.message }
        }

        await logAuditEvent({
            action: "NOTIFICATION_READ",
            userId: user.id,
            email: user.email ?? null,
            resource: "all-notifications",
            details: { count: data?.length || 0 },
        })

        return { success: true, updatedCount: data?.length || 0 }
    } catch (err: any) {
        console.error("[markAllNotificationsAsRead Exception]:", err)
        return { error: err?.message || "Failed to mark all notifications as read" }
    }
}

/**
 * Soft-delete a notification (set is_deleted = true).
 */
export async function deleteNotification(id: string): Promise<{ success?: boolean; error?: string }> {
    try {
        const user = await getCurrentUser()
        if (!user) return { error: "Not authenticated" }

        if (!id || id.trim().length !== 36) {
            return { error: "Invalid notification ID" }
        }

        const admin = createAdminClient()

        const { error } = await admin
            .from("notifications")
            .update({ is_deleted: true })
            .eq("id", id)
            .eq("receiver_id", user.id) // ownership enforcement

        if (error) {
            console.error("[deleteNotification DB Error]:", error)
            return { error: error.message }
        }

        await logAuditEvent({
            action: "NOTIFICATION_DELETED",
            userId: user.id,
            email: user.email ?? null,
            resource: id,
            details: { action: "SOFT_DELETE" },
        })

        return { success: true }
    } catch (err: any) {
        console.error("[deleteNotification Exception]:", err)
        return { error: err?.message || "Failed to delete notification" }
    }
}

/**
 * Create a single notification for a specific receiver.
 *
 * Used by trusted server actions (Admin→Doctor, Doctor→Student, etc.).
 * The sender is always derived from the authenticated session — never client-supplied.
 */
export async function createNotificationAction(params: {
    receiverId: string
    title: string
    message: string
    type: NotificationType
    relatedResource?: string
    relatedResourceId?: string
}): Promise<{ success?: boolean; error?: string }> {
    try {
        const user = await getCurrentUser()
        if (!user) return { error: "Not authenticated" }

        const { receiverId, title, message, type, relatedResource, relatedResourceId } = params

        // Input validation
        if (!receiverId || receiverId.trim().length !== 36) {
            return { error: "Invalid receiver ID" }
        }
        if (!title || title.trim().length === 0 || title.length > 200) {
            return { error: "Title is required (max 200 characters)" }
        }
        if (!message || message.trim().length === 0 || message.length > 2000) {
            return { error: "Message is required (max 2000 characters)" }
        }

        const validTypes: NotificationType[] = [
            "appointment", "consultation", "emergency", "visit_log",
            "system", "rfid", "clearance", "service",
        ]
        if (!validTypes.includes(type)) {
            return { error: "Invalid notification type" }
        }

        // Prevent self-notification
        if (receiverId === user.id) {
            return { error: "Cannot send a notification to yourself" }
        }

        const admin = createAdminClient()

        const { error } = await admin
            .from("notifications")
            .insert({
                title: title.trim(),
                message: message.trim(),
                type,
                sender_id: user.id,
                receiver_id: receiverId,
                related_resource: relatedResource || null,
                related_resource_id: relatedResourceId || null,
                is_read: false,
                is_deleted: false,
            })

        if (error) {
            console.error("[createNotificationAction DB Error]:", error)
            return { error: error.message }
        }

        await logAuditEvent({
            action: "NOTIFICATION_SENT",
            userId: user.id,
            email: user.email ?? null,
            resource: receiverId,
            details: { title, type },
        })

        return { success: true }
    } catch (err: any) {
        console.error("[createNotificationAction Exception]:", err)
        return { error: err?.message || "Failed to send notification" }
    }
}

/**
 * Look up users by email/name for the notification recipient picker.
 * Returns only minimal fields (id, email, role).
 */
export async function searchUsersForNotificationAction(query: string): Promise<{
    error: string | null
    users: Array<{ id: string; email: string | null; role: string | null }>
}> {
    try {
        const user = await getCurrentUser()
        if (!user) return { error: "Not authenticated", users: [] }

        if (!query || query.trim().length < 2) {
            return { error: null, users: [] }
        }

        const admin = createAdminClient()

        // Search clinic_accounts for staff
        const { data: staffAccounts } = await admin
            .from("clinic_accounts")
            .select("id, email, full_name, role")
            .or(`email.ilike.%${query.trim()}%,full_name.ilike.%${query.trim()}%`)
            .limit(10)

        const staffResults = (staffAccounts || []).map((s) => ({
            id: s.id,
            email: s.email || null,
            role: s.role || null,
        }))

        // Search student_accounts with linked user_id
        const { data: studentAccounts } = await admin
            .from("student_accounts")
            .select("user_id, email, first_name, last_name")
            .not("user_id", "is", null)
            .or(`email.ilike.%${query.trim()}%,first_name.ilike.%${query.trim()}%,last_name.ilike.%${query.trim()}%`)
            .limit(10)

        const studentResults = (studentAccounts || [])
            .filter((s) => s.user_id)
            .map((s) => ({
                id: s.user_id!,
                email: s.email || null,
                role: "student" as const,
            }))

        return { error: null, users: [...staffResults, ...studentResults] }
    } catch (err: any) {
        console.error("[searchUsersForNotificationAction Exception]:", err)
        return { error: err?.message || "Failed to search users", users: [] }
    }
}