"use server"

import { createAdminClient } from "@/utils/supabase/admin"
import { cookies } from "next/headers"
import { createClient } from "@/utils/supabase/server"
import { getUserRole } from "@/lib/auth/get-user-role"
import { isAdmin } from "@/lib/auth/roles"
import { logAuditEvent } from "@/lib/audit-logger"
import { ROLE_PERMISSIONS } from "@/constants/permissions"

// ─────────────────────────────────────────────────────────────────────────────
// Authorization
// ─────────────────────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<{ userId: string; email: string | null } | { error: string }> {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { error: "Not authenticated" }
    const role = await getUserRole(user.id)
    if (!isAdmin(role)) return { error: "Access Denied: Only administrators can manage roles and permissions" }
    return { userId: user.id, email: user.email ?? null }
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RoleDTO {
    id: string
    name: string
    description: string | null
    is_deletable: boolean
    created_at: string
    updated_at: string
}

export interface PermissionDTO {
    id: string
    name: string
    resource: string
    action: string
    description: string | null
}

export interface RolePermissionDTO {
    role_id: string
    permission_id: string
}

export interface RoleWithPermissionsDTO extends RoleDTO {
    permissions: PermissionDTO[]
}

// ── Server Actions ───────────────────────────────────────────────────────────

/**
 * Fetch all roles with their permissions.
 */
export async function getRolesAction(): Promise<{ error: string | null; roles: RoleWithPermissionsDTO[] }> {
    try {
        const auth = await requireAdmin()
        if ("error" in auth) return { error: auth.error, roles: [] }

        const admin = createAdminClient()

        const { data: roles, error } = await admin
            .from("roles")
            .select("id, name, description, is_deletable, created_at, updated_at")
            .order("name")

        if (error) {
            console.error("[getRolesAction DB Error]:", error)
            return { error: error.message, roles: [] }
        }

        // Fetch role-permissions mapping
        const roleIds = (roles || []).map((r) => r.id)
        let rolePerms: RolePermissionDTO[] = []

        if (roleIds.length > 0) {
            const { data: perms, error: permError } = await admin
                .from("role_permissions")
                .select("role_id, permission_id")
                .in("role_id", roleIds)

            if (!permError && perms) {
                rolePerms = perms
            }
        }

        // Fetch all permissions for the join
        const { data: allPerms, error: allPermsError } = await admin
            .from("permissions")
            .select("id, name, resource, action, description")
            .order("resource, action")

        if (allPermsError) {
            console.error("[getRolesAction permissions Error]:", allPermsError)
        }

        const permMap = new Map<string, PermissionDTO>()
            ; (allPerms || []).forEach((p) => permMap.set(p.id, p))

        const result: RoleWithPermissionsDTO[] = (roles || []).map((r) => ({
            ...r,
            permissions: rolePerms
                .filter((rp) => rp.role_id === r.id)
                .map((rp) => permMap.get(rp.permission_id))
                .filter(Boolean) as PermissionDTO[],
        }))

        return { error: null, roles: result }
    } catch (err: any) {
        console.error("[getRolesAction Exception]:", err)
        return { error: err?.message || "Failed to fetch roles", roles: [] }
    }
}

/**
 * Fetch all available permissions (for the assignment UI).
 */
export async function getPermissionsAction(): Promise<{ error: string | null; permissions: PermissionDTO[] }> {
    try {
        const auth = await requireAdmin()
        if ("error" in auth) return { error: auth.error, permissions: [] }

        const admin = createAdminClient()

        const { data, error } = await admin
            .from("permissions")
            .select("id, name, resource, action, description")
            .order("resource, action")

        if (error) {
            console.error("[getPermissionsAction DB Error]:", error)
            return { error: error.message, permissions: [] }
        }

        return { error: null, permissions: (data || []) as PermissionDTO[] }
    } catch (err: any) {
        console.error("[getPermissionsAction Exception]:", err)
        return { error: err?.message || "Failed to fetch permissions", permissions: [] }
    }
}

/**
 * Create a new role.
 */
export async function createRoleAction(params: {
    name: string
    description?: string
}): Promise<{ success?: boolean; error?: string; role?: RoleDTO }> {
    try {
        const auth = await requireAdmin()
        if ("error" in auth) return { error: auth.error }

        const { name, description } = params

        if (!name || name.trim().length === 0 || name.length > 50) {
            return { error: "Role name is required (max 50 characters)" }
        }

        const admin = createAdminClient()

        const { data, error } = await admin
            .from("roles")
            .insert({
                name: name.trim(),
                description: description ? description.trim() : null,
            })
            .select("id, name, description, is_deletable, created_at, updated_at")
            .single()

        if (error) {
            if (error.code === "23505") {
                return { error: "A role with that name already exists" }
            }
            console.error("[createRoleAction DB Error]:", error)
            return { error: error.message }
        }

        // Auto-assign preset permissions for known roles (SAD §4.7 Global Permission Matrix).
        // This ensures roles like admin/doctor/nurse/student/faculty get their
        // predefined permission set automatically — no manual assignment needed.
        const presetCodes = ROLE_PERMISSIONS[name.trim().toLowerCase()]
        if (presetCodes && presetCodes.length > 0) {
            const { data: permissionRows, error: permFetchError } = await admin
                .from("permissions")
                .select("id, code")
                .in("code", presetCodes)

            if (permFetchError) {
                console.error("[createRoleAction permission fetch Error]:", permFetchError)
            } else if (permissionRows && permissionRows.length > 0) {
                const { error: assignError } = await admin
                    .from("role_permissions")
                    .insert(
                        permissionRows.map((p) => ({
                            role_id: data.id,
                            permission_id: p.id,
                        }))
                    )

                if (assignError) {
                    console.error("[createRoleAction permission assign Error]:", assignError)
                }
            }
        }

        await logAuditEvent({
            action: "ROLE_CREATED",
            userId: auth.userId,
            email: auth.email,
            resource: data.id,
            details: { name: name.trim(), description, presetPermissionsAssigned: presetCodes?.length ?? 0 },
        })

        return { success: true, role: data as RoleDTO }
    } catch (err: any) {
        console.error("[createRoleAction Exception]:", err)
        return { error: err?.message || "Failed to create role" }
    }
}

/**
 * Update an existing role's name/description.
 */
export async function updateRoleAction(params: {
    id: string
    name: string
    description?: string
}): Promise<{ success?: boolean; error?: string }> {
    try {
        const auth = await requireAdmin()
        if ("error" in auth) return { error: auth.error }

        const { id, name, description } = params

        if (!id) return { error: "Role ID is required" }
        if (!name || name.trim().length === 0 || name.length > 50) {
            return { error: "Role name is required (max 50 characters)" }
        }

        const admin = createAdminClient()

        const { error } = await admin
            .from("roles")
            .update({
                name: name.trim(),
                description: description ? description.trim() : null,
            })
            .eq("id", id)

        if (error) {
            if (error.code === "23505") {
                return { error: "A role with that name already exists" }
            }
            console.error("[updateRoleAction DB Error]:", error)
            return { error: error.message }
        }

        await logAuditEvent({
            action: "ROLE_UPDATED",
            userId: auth.userId,
            email: auth.email,
            resource: id,
            details: { name: name.trim(), description },
        })

        return { success: true }
    } catch (err: any) {
        console.error("[updateRoleAction Exception]:", err)
        return { error: err?.message || "Failed to update role" }
    }
}

/**
 * Delete a role (only if it's deletable and not in use).
 */
export async function deleteRoleAction(id: string): Promise<{ success?: boolean; error?: string }> {
    try {
        const auth = await requireAdmin()
        if ("error" in auth) return { error: auth.error }

        if (!id) return { error: "Role ID is required" }

        const admin = createAdminClient()

        // Check if the role is deletable and not linked to a protected role like 'admin'
        const { data: existingRole, error: fetchError } = await admin
            .from("roles")
            .select("name, is_deletable")
            .eq("id", id)
            .single()

        if (fetchError || !existingRole) {
            return { error: fetchError?.message || "Role not found" }
        }

        if (!existingRole.is_deletable) {
            return { error: `The '${existingRole.name}' role is protected and cannot be deleted` }
        }

        // Delete role_permissions first (cascade is handled by FK, but explicit for clarity)
        const { error: permDeleteError } = await admin
            .from("role_permissions")
            .delete()
            .eq("role_id", id)

        if (permDeleteError) {
            console.error("[deleteRoleAction role_permissions cleanup Error]:", permDeleteError)
            return { error: permDeleteError.message }
        }

        // Delete the role itself
        const { error } = await admin
            .from("roles")
            .delete()
            .eq("id", id)

        if (error) {
            console.error("[deleteRoleAction DB Error]:", error)
            return { error: error.message }
        }

        await logAuditEvent({
            action: "ROLE_DELETED",
            userId: auth.userId,
            email: auth.email,
            resource: id,
            details: { roleName: existingRole.name },
        })

        return { success: true }
    } catch (err: any) {
        console.error("[deleteRoleAction Exception]:", err)
        return { error: err?.message || "Failed to delete role" }
    }
}

/**
 * Assign a permission to a role.
 */
export async function assignPermissionAction(params: {
    roleId: string
    permissionId: string
}): Promise<{ success?: boolean; error?: string }> {
    try {
        const auth = await requireAdmin()
        if ("error" in auth) return { error: auth.error }

        const { roleId, permissionId } = params
        if (!roleId || !permissionId) {
            return { error: "Role ID and Permission ID are required" }
        }

        const admin = createAdminClient()

        const { error } = await admin
            .from("role_permissions")
            .insert({ role_id: roleId, permission_id: permissionId })

        if (error) {
            if (error.code === "23505") {
                return { error: "This permission is already assigned to this role" }
            }
            console.error("[assignPermissionAction DB Error]:", error)
            return { error: error.message }
        }

        await logAuditEvent({
            action: "PERMISSION_ASSIGNED",
            userId: auth.userId,
            email: auth.email,
            resource: roleId,
            details: { permissionId, action: "ASSIGNED" },
        })

        return { success: true }
    } catch (err: any) {
        console.error("[assignPermissionAction Exception]:", err)
        return { error: err?.message || "Failed to assign permission" }
    }
}

/**
 * Remove a permission from a role.
 */
export async function removePermissionAction(params: {
    roleId: string
    permissionId: string
}): Promise<{ success?: boolean; error?: string }> {
    try {
        const auth = await requireAdmin()
        if ("error" in auth) return { error: auth.error }

        const { roleId, permissionId } = params
        if (!roleId || !permissionId) {
            return { error: "Role ID and Permission ID are required" }
        }

        const admin = createAdminClient()

        const { error } = await admin
            .from("role_permissions")
            .delete()
            .eq("role_id", roleId)
            .eq("permission_id", permissionId)

        if (error) {
            console.error("[removePermissionAction DB Error]:", error)
            return { error: error.message }
        }

        await logAuditEvent({
            action: "PERMISSION_REMOVED",
            userId: auth.userId,
            email: auth.email,
            resource: roleId,
            details: { permissionId, action: "REMOVED" },
        })

        return { success: true }
    } catch (err: any) {
        console.error("[removePermissionAction Exception]:", err)
        return { error: err?.message || "Failed to remove permission" }
    }
}
