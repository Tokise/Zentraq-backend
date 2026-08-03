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
  details: Record<string, any> | null
  ip_address: string | null
  user_agent: string | null
  timestamp: string
}

export interface GetAuditLogsParams {
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

export async function getAuditLogsAction(params: GetAuditLogsParams) {
  try {
    const auth = await requireAdmin()
    if (auth.error || !auth.user) {
      return { error: auth.error ?? "Unauthorized", logs: [], totalCount: 0 }
    }

    const page = params.page && params.page > 0 ? params.page : 1
    const pageSize = params.pageSize && params.pageSize > 0 ? params.pageSize : 20
    const fromIndex = (page - 1) * pageSize
    const toIndex = page * pageSize - 1

    const admin = createAdminClient()

    let query = admin
      .from("audit_logs")
      .select("id, action, user_id, email, resource, details, ip_address, user_agent, timestamp", { count: "exact" })
      .order("timestamp", { ascending: false })
      .range(fromIndex, toIndex)

    if (params.actionFilter) {
      query = query.eq("action", params.actionFilter)
    }

    if (params.searchQuery && params.searchQuery.trim()) {
      const q = params.searchQuery.trim()
      query = query.or(`email.ilike.%${q}%,user_id.ilike.%${q}%,ip_address.ilike.%${q}%`)
    }

    if (params.dateFrom) {
      query = query.gte("timestamp", new Date(params.dateFrom).toISOString())
    }

    if (params.dateTo) {
      const endDate = new Date(params.dateTo)
      endDate.setDate(endDate.getDate() + 1)
      query = query.lt("timestamp", endDate.toISOString())
    }

    const { data, error, count } = await query

    if (error) {
      console.error("[getAuditLogsAction DB Error]:", error)
      return { error: error.message, logs: [], totalCount: 0 }
    }

    return {
      error: null,
      logs: (data || []) as AuditLogDTO[],
      totalCount: count || 0,
    }
  } catch (err: any) {
    console.error("[getAuditLogsAction Exception]:", err)
    return { error: err?.message || "Failed to fetch audit logs", logs: [], totalCount: 0 }
  }
}
