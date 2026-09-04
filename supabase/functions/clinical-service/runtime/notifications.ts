import { currentContext } from "./context.ts";

interface ClinicalNotification {
  receiverId: string;
  title: string;
  message: string;
  type: string;
  entityType?: string | null;
  entityId?: string | null;
}

// Persists notification work without waiting for the notification service.
export async function createNotificationAction(input: ClinicalNotification) {
  const context = currentContext();
  const { data, error } = await context.admin.rpc("enqueue_clinical_notice", {
    p_actor: context.actor.id,
    p_receiver: input.receiverId,
    p_title: input.title,
    p_message: input.message,
    p_type: input.type,
    p_entity_type: input.entityType ?? null,
    p_entity_id: input.entityId ?? null,
    p_key:
      `${input.entityType}:${input.entityId}:${input.receiverId}:${input.title}`,
  });
  if (error) throw new Error("NOTIFICATION_ENQUEUE_FAILED");
  return { success: true, id: data };
}
