import "server-only"

import { cookies, headers } from "next/headers"
import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import type { UserRole } from "@/types"

export interface ActionActor {
  id: string
  email: string | null
  role: UserRole
}

/**
 * Resolve the caller from the session and the SAD role mapping. This is kept
 * server-only so service-role access is never made available to the browser.
 */
export async function getActionActor(): Promise<ActionActor | null> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const admin = createAdminClient()
  const { data: assignments } = await admin
    .from("user_roles")
    .select("role:roles(name)")
    .eq("user_id", user.id)
    .limit(1)

  const assignment = assignments?.[0] as { role?: { name?: string } | { name?: string }[] } | undefined
  const relatedRole = Array.isArray(assignment?.role) ? assignment.role[0] : assignment?.role
  const role = relatedRole?.name
  if (!isUserRole(role)) return null

  return { id: user.id, email: user.email ?? null, role }
}

export function hasAnyRole(actor: ActionActor, roles: readonly UserRole[]): boolean {
  return roles.includes(actor.role)
}

export async function assertSameOrigin(): Promise<boolean> {
  const requestHeaders = await headers()
  const origin = requestHeaders.get("origin")
  const host = requestHeaders.get("host")
  if (!origin || !host) return true

  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

function isUserRole(value: string | undefined): value is UserRole {
  return value === "admin" || value === "doctor" || value === "nurse" || value === "student" || value === "faculty"
}
