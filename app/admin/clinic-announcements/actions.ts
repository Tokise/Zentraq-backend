"use server"

import { createAdminClient } from "@/utils/supabase/admin"
import { cookies } from "next/headers"
import { createClient } from "@/utils/supabase/server"
import { getUserRole } from "@/lib/auth/get-user-role"
import { isAdmin } from "@/lib/auth/roles"
import { revalidatePath } from "next/cache"
import { logAuditEvent } from "@/lib/audit-logger"

async function requireAdmin() {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { error: "Not authenticated", user: null }
    const role = await getUserRole(user.id)
    if (!isAdmin(role)) return { error: "Access Denied: Admins only", user: null }
    return { error: null, user }
}

export async function createAnnouncement(title: string, content: string) {
    try {
        const auth = await requireAdmin()
        if (auth.error || !auth.user) return { error: auth.error }
        const admin = createAdminClient()
        const { data, error } = await admin.from("announcements").insert({ title, content, posted_by: auth.user.id }).select("id").single()
        if (error) return { error: error.message }
        await logAuditEvent({ action: "INVENTORY_MODIFICATION", userId: auth.user.id, email: auth.user.email, resource: data?.id, details: { action: "ANNOUNCEMENT_CREATED", title } })
        revalidatePath("/admin/clinic-announcements")
        return { success: true }
    } catch (err: any) { return { error: err?.message || "Server error" } }
}

export async function deleteAnnouncement(id: string) {
    try {
        const auth = await requireAdmin()
        if (auth.error || !auth.user) return { error: auth.error }
        const admin = createAdminClient()
        const { error } = await admin.from("announcements").delete().eq("id", id)
        if (error) return { error: error.message }
        await logAuditEvent({ action: "INVENTORY_MODIFICATION", userId: auth.user.id, email: auth.user.email, resource: id, details: { action: "ANNOUNCEMENT_DELETED" } })
        revalidatePath("/admin/clinic-announcements")
        return { success: true }
    } catch (err: any) { return { error: err?.message || "Server error" } }
}
