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

// Confirms that the caller has an authenticated clinic portal session.
async function requireAuthenticatedUser() {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { error: "Not authenticated", user: null }
    return { error: null, user }
}

// ─────────────────────────────────────────────────────────────────────────────
// DTOs
// ─────────────────────────────────────────────────────────────────────────────

export interface AnnouncementDTO {
    id: string
    title: string
    content: string
    image_url: string | null
    created_at: string
    updated_at: string
    poster_name: string | null
}

// Converts an unknown server exception into a safe client-facing message.
function errorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all announcements with the poster's display name.
 * Returns DTOs only — never exposes internal columns.
 */
export async function getAnnouncementsAction(): Promise<{ error: string | null; announcements: AnnouncementDTO[] }> {
    try {
        const auth = await requireAuthenticatedUser()
        if (auth.error || !auth.user) return { error: auth.error, announcements: [] }

        const admin = createAdminClient()
        const loginRole = await getUserRole(auth.user.id)
        let patientRole: "student" | "faculty" | "staff" | null =
            loginRole === "student" || loginRole === "faculty" || loginRole === "staff"
                ? loginRole
                : null
        if (!patientRole && loginRole !== "admin") {
            const [student, faculty, staff] = await Promise.all([
                admin.from("students").select("id").eq("user_id", auth.user.id).maybeSingle(),
                admin.from("faculty").select("id").eq("user_id", auth.user.id).maybeSingle(),
                admin.from("staff").select("id").eq("user_id", auth.user.id).maybeSingle(),
            ])
            patientRole = student.data
                ? "student"
                : faculty.data
                    ? "faculty"
                    : staff.data
                        ? "staff"
                        : null
        }
        let query = admin
            .from("announcements")
            .select("id, title, content, image_url, posted_by, created_at, updated_at")
            .order("created_at", { ascending: false })
        if (patientRole) query = query.contains("target_audience", [patientRole])
        const { data, error } = await query

        if (error) {
            console.error("[getAnnouncementsAction DB Error]:", error)
            return { error: error.message, announcements: [] }
        }

        // Resolve poster names from clinic_accounts (posted_by references auth.users,
        // but display names live in clinic_accounts.user_id).
        const posterIds = [...new Set((data || []).map((a) => a.posted_by).filter(Boolean))]
        let posterMap: Record<string, string> = {}

        if (posterIds.length > 0) {
            const { data: posters } = await admin
                .from("clinic_accounts")
                .select("user_id, display_name")
                .in("user_id", posterIds)

            if (posters) {
                posterMap = Object.fromEntries(posters.map((p) => [p.user_id, p.display_name || "Clinic Staff"]))
            }
        }

        const announcements: AnnouncementDTO[] = (data || []).map((a) => ({
            id: a.id,
            title: a.title,
            content: a.content,
            image_url: a.image_url || null,
            created_at: a.created_at,
            updated_at: a.updated_at,
            poster_name: a.posted_by ? posterMap[a.posted_by] || null : null,
        }))

        return { error: null, announcements }
    } catch (err: unknown) {
        console.error("[getAnnouncementsAction Exception]:", err)
        return {
            error: errorMessage(err, "Failed to fetch announcements"),
            announcements: [],
        }
    }
}

export async function createAnnouncementAction(title: string, content: string, imageUrl?: string | null) {
    try {
        const auth = await requireAdmin()
        if (auth.error || !auth.user) return { error: auth.error }

        if (!title.trim() || !content.trim()) {
            return { error: "Title and content are required" }
        }

        const admin = createAdminClient()
        const { data, error } = await admin
            .from("announcements")
            .insert({
                title: title.trim(),
                content: content.trim(),
                image_url: imageUrl || null,
                posted_by: auth.user.id,
            })
            .select("id")
            .single()

        if (error) return { error: error.message }

        await logAuditEvent({ action: "INVENTORY_MODIFICATION", userId: auth.user.id, email: auth.user.email, resource: data?.id, details: { action: "ANNOUNCEMENT_CREATED", title } })
        revalidatePath("/admin/announcement")
        return { success: true }
    } catch (err: unknown) {
        return { error: errorMessage(err, "Server error") }
    }
}

export async function updateAnnouncementAction(id: string, title: string, content: string, imageUrl?: string | null) {
    try {
        const auth = await requireAdmin()
        if (auth.error || !auth.user) return { error: auth.error }

        if (!id) return { error: "Announcement ID is required" }
        if (!title.trim() || !content.trim()) {
            return { error: "Title and content are required" }
        }

        const admin = createAdminClient()
        const { error } = await admin
            .from("announcements")
            .update({
                title: title.trim(),
                content: content.trim(),
                image_url: imageUrl || null,
            })
            .eq("id", id)

        if (error) return { error: error.message }

        await logAuditEvent({ action: "INVENTORY_MODIFICATION", userId: auth.user.id, email: auth.user.email, resource: id, details: { action: "ANNOUNCEMENT_UPDATED", title } })
        revalidatePath("/admin/announcement")
        return { success: true }
    } catch (err: unknown) {
        return { error: errorMessage(err, "Server error") }
    }
}

/**
 * Upload an announcement image to Supabase Storage using the service role.
 * Returns the public URL. The page passes the File as base64/data URL.
 */
export async function uploadAnnouncementImageAction(base64DataUrl: string): Promise<{ error?: string; url?: string }> {
    try {
        const auth = await requireAdmin()
        if (auth.error || !auth.user) return { error: auth.error }

        if (!base64DataUrl || !base64DataUrl.startsWith("data:image/")) {
            return { error: "Invalid image data" }
        }

        // Parse the data URL
        const match = base64DataUrl.match(/^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/)
        if (!match) return { error: "Unsupported image format" }

        const ext = match[1] === "jpeg" ? "jpg" : match[1]
        const base64 = match[2]
        const buffer = Buffer.from(base64, "base64")

        // 5MB limit
        if (buffer.length > 5 * 1024 * 1024) {
            return { error: "Image must be under 5MB" }
        }

        const admin = createAdminClient()
        const path = `${crypto.randomUUID()}.${ext}`

        const { error: uploadError } = await admin.storage
            .from("announcement-images")
            .upload(path, buffer, {
                contentType: `image/${ext}`,
                cacheControl: "3600",
                upsert: false,
            })

        if (uploadError) {
            console.error("[uploadAnnouncementImageAction Upload Error]:", uploadError)
            return { error: `Image upload failed: ${uploadError.message}` }
        }

        const { data } = admin.storage.from("announcement-images").getPublicUrl(path)
        return { url: data.publicUrl }
    } catch (err: unknown) {
        console.error("[uploadAnnouncementImageAction Exception]:", err)
        return { error: errorMessage(err, "Image upload failed") }
    }
}

export async function deleteAnnouncementAction(id: string) {
    try {
        const auth = await requireAdmin()
        if (auth.error || !auth.user) return { error: auth.error }
        const admin = createAdminClient()
        const { error } = await admin.from("announcements").delete().eq("id", id)
        if (error) return { error: error.message }
        await logAuditEvent({ action: "INVENTORY_MODIFICATION", userId: auth.user.id, email: auth.user.email, resource: id, details: { action: "ANNOUNCEMENT_DELETED" } })
        revalidatePath("/admin/announcement")
        return { success: true }
    } catch (err: unknown) {
        return { error: errorMessage(err, "Server error") }
    }
}
