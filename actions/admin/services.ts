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
    if (!isAdmin(role)) return { error: "Access Denied: Only administrators can manage services" }
    return { userId: user.id, email: user.email ?? null }
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ServiceCategory = "health_program" | "medical_clearance" | "consultation_service" | "other"

export interface ServiceDTO {
    id: string
    name: string
    description: string | null
    category: ServiceCategory
    duration_minutes: number | null
    price: number | null
    is_active: boolean
    is_archived: boolean
    archived_at: string | null
    created_at: string
    updated_at: string
}

export interface GetServicesParams {
    page?: number
    pageSize?: number
    searchQuery?: string
    categoryFilter?: string
    includeArchived?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch services with pagination, search, and category filtering.
 */
export async function getServicesAction(params?: GetServicesParams): Promise<{
    error: string | null
    services: ServiceDTO[]
    totalCount: number
}> {
    try {
        const auth = await requireAdmin()
        if ("error" in auth) return { error: auth.error, services: [], totalCount: 0 }

        const page = params?.page && params.page > 0 ? params.page : 1
        const pageSize = params?.pageSize && params.pageSize > 0 ? Math.min(params.pageSize, 100) : 20
        const fromIndex = (page - 1) * pageSize
        const toIndex = page * pageSize - 1

        const admin = createAdminClient()

        let query = admin
            .from("services")
            .select("id, name, description, category, duration_minutes, price, is_active, is_archived, archived_at, created_at, updated_at", { count: "exact" })
            .order("created_at", { ascending: false })
            .range(fromIndex, toIndex)

        if (params?.searchQuery && params.searchQuery.trim()) {
            const q = params.searchQuery.trim()
            query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`)
        }

        if (params?.categoryFilter) {
            query = query.eq("category", params.categoryFilter)
        }

        if (!params?.includeArchived) {
            query = query.eq("is_archived", false)
        }

        const { data, error, count } = await query

        if (error) {
            console.error("[getServicesAction DB Error]:", error)
            return { error: error.message, services: [], totalCount: 0 }
        }

        return {
            error: null,
            services: (data || []) as ServiceDTO[],
            totalCount: count || 0,
        }
    } catch (err: any) {
        console.error("[getServicesAction Exception]:", err)
        return { error: err?.message || "Failed to fetch services", services: [], totalCount: 0 }
    }
}

/**
 * Create a new service.
 */
export async function createServiceAction(params: {
    name: string
    description?: string
    category: ServiceCategory
    durationMinutes?: number
    price?: number
}): Promise<{ success?: boolean; error?: string; service?: ServiceDTO }> {
    try {
        const auth = await requireAdmin()
        if ("error" in auth) return { error: auth.error }

        const { name, description, category, durationMinutes, price } = params

        if (!name || name.trim().length === 0 || name.length > 120) {
            return { error: "Service name is required (max 120 characters)" }
        }

        const validCategories: ServiceCategory[] = ["health_program", "medical_clearance", "consultation_service", "other"]
        if (!validCategories.includes(category)) {
            return { error: "Invalid service category" }
        }

        if (price !== undefined && price < 0) {
            return { error: "Price cannot be negative" }
        }

        const admin = createAdminClient()

        const { data, error } = await admin
            .from("services")
            .insert({
                name: name.trim(),
                description: description ? description.trim() : null,
                category,
                duration_minutes: durationMinutes ?? null,
                price: price ?? null,
                created_by: auth.userId,
                updated_by: auth.userId,
            })
            .select("id, name, description, category, duration_minutes, price, is_active, is_archived, archived_at, created_at, updated_at")
            .single()

        if (error) {
            console.error("[createServiceAction DB Error]:", error)
            return { error: error.message }
        }

        await logAuditEvent({
            action: "SERVICE_CREATED",
            userId: auth.userId,
            email: auth.email,
            resource: data.id,
            details: { name: name.trim(), category },
        })

        return { success: true, service: data as ServiceDTO }
    } catch (err: any) {
        console.error("[createServiceAction Exception]:", err)
        return { error: err?.message || "Failed to create service" }
    }
}

/**
 * Update an existing service.
 */
export async function updateServiceAction(params: {
    id: string
    name: string
    description?: string
    category: ServiceCategory
    durationMinutes?: number
    price?: number
    isActive?: boolean
}): Promise<{ success?: boolean; error?: string }> {
    try {
        const auth = await requireAdmin()
        if ("error" in auth) return { error: auth.error }

        const { id, name, description, category, durationMinutes, price, isActive } = params

        if (!id) return { error: "Service ID is required" }
        if (!name || name.trim().length === 0 || name.length > 120) {
            return { error: "Service name is required (max 120 characters)" }
        }

        const validCategories: ServiceCategory[] = ["health_program", "medical_clearance", "consultation_service", "other"]
        if (!validCategories.includes(category)) {
            return { error: "Invalid service category" }
        }

        const admin = createAdminClient()

        const updatePayload: Record<string, unknown> = {
            name: name.trim(),
            description: description ? description.trim() : null,
            category,
            duration_minutes: durationMinutes ?? null,
            price: price ?? null,
            is_active: isActive ?? true,
            updated_by: auth.userId,
        }

        const { error } = await admin
            .from("services")
            .update(updatePayload)
            .eq("id", id)

        if (error) {
            console.error("[updateServiceAction DB Error]:", error)
            return { error: error.message }
        }

        await logAuditEvent({
            action: "SERVICE_UPDATED",
            userId: auth.userId,
            email: auth.email,
            resource: id,
            details: { name: name.trim(), category, isActive },
        })

        return { success: true }
    } catch (err: any) {
        console.error("[updateServiceAction Exception]:", err)
        return { error: err?.message || "Failed to update service" }
    }
}

/**
 * Archive a service (soft-delete).
 */
export async function archiveServiceAction(id: string): Promise<{ success?: boolean; error?: string }> {
    try {
        const auth = await requireAdmin()
        if ("error" in auth) return { error: auth.error }

        if (!id) return { error: "Service ID is required" }

        const admin = createAdminClient()

        const { error } = await admin
            .from("services")
            .update({
                is_archived: true,
                archived_at: new Date().toISOString(),
                is_active: false,
                updated_by: auth.userId,
            })
            .eq("id", id)

        if (error) {
            console.error("[archiveServiceAction DB Error]:", error)
            return { error: error.message }
        }

        await logAuditEvent({
            action: "SERVICE_ARCHIVED",
            userId: auth.userId,
            email: auth.email,
            resource: id,
            details: { action: "ARCHIVE" },
        })

        return { success: true }
    } catch (err: any) {
        console.error("[archiveServiceAction Exception]:", err)
        return { error: err?.message || "Failed to archive service" }
    }
}

/**
 * Restore an archived service.
 */
export async function restoreServiceAction(id: string): Promise<{ success?: boolean; error?: string }> {
    try {
        const auth = await requireAdmin()
        if ("error" in auth) return { error: auth.error }

        if (!id) return { error: "Service ID is required" }

        const admin = createAdminClient()

        const { error } = await admin
            .from("services")
            .update({
                is_archived: false,
                archived_at: null,
                is_active: true,
                updated_by: auth.userId,
            })
            .eq("id", id)

        if (error) {
            console.error("[restoreServiceAction DB Error]:", error)
            return { error: error.message }
        }

        await logAuditEvent({
            action: "SERVICE_RESTORED",
            userId: auth.userId,
            email: auth.email,
            resource: id,
            details: { action: "RESTORE" },
        })

        return { success: true }
    } catch (err: any) {
        console.error("[restoreServiceAction Exception]:", err)
        return { error: err?.message || "Failed to restore service" }
    }
}