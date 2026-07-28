import type { SupabaseClient } from "@supabase/supabase-js"

export interface AnnouncementWithPoster {
    id: string
    title: string
    content: string
    image_url: string | null
    posted_by: string | null
    created_at: string
    updated_at: string
    poster: { email: string | null; full_name: string | null } | null
}

/**
 * announcements.posted_by is a foreign key to auth.users, not to any public
 * table — so PostgREST embedding (e.g. `profiles:posted_by(...)`) can't
 * resolve it and silently returns nothing. Instead, fetch announcements and
 * poster names as two separate queries and merge them here.
 */
export async function fetchAnnouncementsWithPosters(
    supabase: SupabaseClient,
    options?: { limit?: number }
): Promise<AnnouncementWithPoster[]> {
    let query = supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false })

    if (options?.limit) {
        query = query.limit(options.limit)
    }

    const { data: announcements, error } = await query

    if (error || !announcements) {
        console.error("Failed to load announcements:", error)
        return []
    }

    const posterIds = [...new Set(announcements.map((a) => a.posted_by).filter(Boolean))]

    let postersById: Record<string, { email: string | null; full_name: string | null }> = {}

    if (posterIds.length > 0) {
        const { data: posters } = await supabase
            .from("clinic_accounts")
            .select("id, email, full_name")
            .in("id", posterIds)

        postersById = Object.fromEntries(
            (posters || []).map((p) => [p.id, { email: p.email, full_name: p.full_name }])
        )
    }

    return announcements.map((a) => ({
        ...a,
        poster: a.posted_by ? postersById[a.posted_by] || null : null,
    }))
}