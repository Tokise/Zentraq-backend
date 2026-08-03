"use server"

import { getActionActor } from "@/lib/security/action-guard"
import { getMyNotifications, markMyNotificationRead } from "@/services/notifications/notification-service"
import type { ActionResult, NotificationDTO } from "@/types"

export async function getNotifications(): Promise<ActionResult<NotificationDTO[]>> {
  const actor = await getActionActor()
  if (!actor) return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" }
  return getMyNotifications(actor)
}

export async function markNotificationRead(input: unknown): Promise<ActionResult<null>> {
  const actor = await getActionActor()
  if (!actor) return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" }
  return markMyNotificationRead(actor, input)
}
