import "server-only"

import { CreateNotificationSchema, MarkNotificationReadSchema } from "@/lib/validation/schemas"
import { createAdminClient } from "@/utils/supabase/admin"
import type { ActionActor } from "@/lib/security/action-guard"
import { writeAuditLog } from "@/services/audit/audit-service"
import type { ActionResult, NotificationDTO } from "@/types"

export async function sendNotification(
  actor: ActionActor | null,
  input: unknown,
): Promise<ActionResult<NotificationDTO>> {
  const parsed = CreateNotificationSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: "Invalid notification", code: "VALIDATION" }

  const value = parsed.data
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("notifications")
    .insert({ ...value, sender_id: actor?.id ?? null })
    .select("id, title, message, type, entity_type, entity_id, read_at, created_at")
    .single()

  if (error || !data) return { success: false, error: "Unable to send notification", code: "DATABASE" }

  if (actor) await writeAuditLog(actor, "notification.sent", "notification", data.id, { receiver_id: value.receiver_id, type: value.type })
  return { success: true, data: data as NotificationDTO }
}

export async function getMyNotifications(actor: ActionActor, limit = 20): Promise<ActionResult<NotificationDTO[]>> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("notifications")
    .select("id, title, message, type, entity_type, entity_id, read_at, created_at")
    .eq("receiver_id", actor.id)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100))

  if (error) return { success: false, error: "Unable to load notifications", code: "DATABASE" }
  return { success: true, data: (data ?? []) as NotificationDTO[] }
}

export async function markMyNotificationRead(actor: ActionActor, input: unknown): Promise<ActionResult<null>> {
  const parsed = MarkNotificationReadSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: "Invalid notification", code: "VALIDATION" }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", parsed.data.notification_id)
    .eq("receiver_id", actor.id)
    .select("id")
    .maybeSingle()

  if (error) return { success: false, error: "Unable to update notification", code: "DATABASE" }
  if (!data) return { success: false, error: "Notification not found", code: "NOT_FOUND" }
  await writeAuditLog(actor, "notification.read", "notification", data.id)
  return { success: true, data: null }
}
