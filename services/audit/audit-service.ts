import "server-only"

import { headers } from "next/headers"
import { createAdminClient } from "@/utils/supabase/admin"
import type { ActionActor } from "@/lib/security/action-guard"

export async function writeAuditLog(
  actor: ActionActor,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const requestHeaders = await headers()
  const admin = createAdminClient()
  const { error } = await admin.from("audit_logs").insert({
    user_id: actor.id,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
    ip_address: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: requestHeaders.get("user-agent"),
  })

  if (error) console.error("[audit] failed to persist event", { action, entityType, entityId, error: error.message })
}
