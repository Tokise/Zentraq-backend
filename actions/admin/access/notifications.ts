"use server"

import { randomUUID } from "node:crypto"
import { logAuditEvent } from "@/lib/audit-logger"
import { checkRateLimit } from "@/lib/rate-limit"
import {
  notificationJobInputSchema,
  notificationTemplates,
} from "@/lib/serverless/notification-contracts"
import { isServerlessFeatureEnabled } from "@/lib/serverless/feature-flags"
import {
  assertSameOrigin,
  getActionActor,
  hasAnyRole,
} from "@/lib/security/action-guard"
import { createAdminClient } from "@/utils/supabase/admin"

export interface EnqueueNotificationResult {
  error?: string
  jobId?: string
  mode?: "queued" | "synchronous"
  success?: boolean
}

// Creates one allowlisted in-app notification through the active rollout path.
export async function enqueueNotificationAction(
  input: unknown,
): Promise<EnqueueNotificationResult> {
  const actor = await getActionActor()
  if (!actor || !hasAnyRole(actor, ["admin"])) {
    return { error: "Unauthorized" }
  }
  if (!(await assertSameOrigin())) {
    return { error: "Invalid request origin" }
  }

  const rate = checkRateLimit(
    `notification-create:${actor.id}`,
    20,
    60 * 1000,
  )
  if (!rate.success) {
    return { error: "Too many notification requests. Try again shortly." }
  }

  const parsed = notificationJobInputSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "The notification request is invalid." }
  }

  const admin = createAdminClient()
  const receiver = await admin.auth.admin.getUserById(parsed.data.receiverId)
  if (receiver.error || !receiver.data.user) {
    return { error: "The notification recipient is unavailable." }
  }

  if (
    isServerlessFeatureEnabled("notifications", parsed.data.receiverId)
  ) {
    const { data, error } = await admin.rpc("enqueue_notification_job", {
      requested_by: actor.id,
      requested_correlation_id: randomUUID(),
      requested_entity_id: parsed.data.entityId ?? null,
      requested_entity_type: parsed.data.entityType ?? null,
      requested_idempotency_key: parsed.data.idempotencyKey,
      requested_receiver_id: parsed.data.receiverId,
      requested_template_key: parsed.data.templateKey,
    })
    if (error || typeof data !== "string") {
      return { error: "The notification could not be queued." }
    }

    await logAuditEvent({
      action: "NOTIFICATION_JOB_ENQUEUED",
      userId: actor.id,
      email: actor.email,
      resource: data,
      details: { template_key: parsed.data.templateKey },
    })
    return { jobId: data, mode: "queued", success: true }
  }

  const template = notificationTemplates[parsed.data.templateKey]
  const { data, error } = await admin
    .from("notifications")
    .insert({
      entity_id: parsed.data.entityId ?? null,
      entity_type: parsed.data.entityType ?? null,
      message: template.message,
      receiver_id: parsed.data.receiverId,
      sender_id: actor.id,
      title: template.title,
      type: template.type,
    })
    .select("id")
    .single()
  if (error || !data) {
    return { error: "The notification could not be created." }
  }

  await logAuditEvent({
    action: "NOTIFICATION_SENT",
    userId: actor.id,
    email: actor.email,
    resource: data.id,
    details: { template_key: parsed.data.templateKey },
  })
  return { mode: "synchronous", success: true }
}
