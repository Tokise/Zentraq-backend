"use server"

import { createAdminClient } from "@/utils/supabase/admin"
import { cookies } from "next/headers"
import { createClient } from "@/utils/supabase/server"
import { getUserRole } from "@/lib/auth/get-user-role"
import { isAdmin } from "@/lib/auth/roles"

export interface AuditLogDTO {
  id: string
  action: string
  user_id: string | null
  email: string | null
  resource: string | null
  details: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  timestamp: string
  clinician_name: string | null
  clinician_role: string | null
  consultation_href: string | null
}

export interface GetAuditTrailParams {
  page?: number
  pageSize?: number
  actionFilter?: string
  searchQuery?: string
  dateFrom?: string
  dateTo?: string
}

async function requireAdmin() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", user: null }
  }

  const role = await getUserRole(user.id)

  if (!isAdmin(role)) {
    return {
      error: "Access Denied: Only administrators can access system audit logs.",
      user: null,
    }
  }

  return { error: null, user }
}

export async function getAuditTrailAction(params: GetAuditTrailParams) {
  try {
    const auth = await requireAdmin()
    if (auth.error || !auth.user) {
      return { error: auth.error ?? "Unauthorized", logs: [], totalCount: 0 }
    }

    const page = params.page && params.page > 0 ? params.page : 1
    const pageSize = params.pageSize && params.pageSize > 0 ? params.pageSize : 10
    const fromIndex = (page - 1) * pageSize
    const toIndex = page * pageSize - 1

    const admin = createAdminClient()

    let query = admin
      .from("audit_logs")
      .select("id, action, user_id, entity_id, metadata, ip_address, user_agent, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(fromIndex, toIndex)

    if (params.actionFilter) {
      query = query.eq("action", params.actionFilter)
    }

    if (params.searchQuery && params.searchQuery.trim()) {
      const q = params.searchQuery.trim()
      query = query.or(`user_id.ilike.%${q}%,ip_address.ilike.%${q}%`)
    }

    if (params.dateFrom) {
      query = query.gte("created_at", new Date(params.dateFrom).toISOString())
    }

    if (params.dateTo) {
      const endDate = new Date(params.dateTo)
      endDate.setDate(endDate.getDate() + 1)
      query = query.lt("created_at", endDate.toISOString())
    }

    const { data, error, count } = await query

    if (error) {
      console.error("[getAuditTrailAction DB Error]:", error)
      return { error: error.message, logs: [], totalCount: 0 }
    }

    const actorIds = [
      ...new Set(
        (data || [])
          .map((entry) => entry.user_id)
          .filter((userId): userId is string => Boolean(userId)),
      ),
    ]
    const { data: clinicAccounts } = actorIds.length
      ? await admin
          .from("clinic_accounts")
          .select("user_id,display_name,role")
          .in("user_id", actorIds)
      : { data: [] }
    const clinicianByUserId = new Map(
      (clinicAccounts || []).map((account) => [
        account.user_id,
        {
          name: account.display_name,
          role: account.role,
        },
      ]),
    )

    return {
      error: null,
      logs: (data || []).map((entry) => {
        const clinician = entry.user_id
          ? clinicianByUserId.get(entry.user_id)
          : undefined
        const isConsultation = entry.action.startsWith("consultation.")
        return {
          id: entry.id,
          action: entry.action,
          user_id: entry.user_id,
          email:
            typeof entry.metadata?.actor_email === "string"
              ? entry.metadata.actor_email
              : null,
          resource: entry.entity_id,
          details: entry.metadata ?? {},
          ip_address: entry.ip_address,
          user_agent: entry.user_agent,
          timestamp: entry.created_at,
          clinician_name: clinician?.name ?? null,
          clinician_role:
            clinician?.role ??
            (typeof entry.metadata?.clinician_role === "string"
              ? entry.metadata.clinician_role
              : null),
          consultation_href:
            isConsultation && entry.entity_id
              ? `/admin/visits/history?id=${entry.entity_id}`
              : null,
        }
      }) as AuditLogDTO[],
      totalCount: count || 0,
    }
  } catch (err: unknown) {
    console.error("[getAuditTrailAction Exception]:", err)
    return {
      error: err instanceof Error ? err.message : "Failed to fetch audit logs",
      logs: [],
      totalCount: 0,
    }
  }
}
