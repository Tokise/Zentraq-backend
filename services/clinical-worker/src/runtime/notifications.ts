import { currentContext } from "./context.js";

interface ClinicalNotification {
  receiverId: string;
  title: string;
  message: string;
  type: string;
  entityType?: string | null;
  entityId?: string | null;
}

// Persists notification work through notification-service Edge Function with DB fallback.
export async function createNotificationAction(input: ClinicalNotification) {
  const context = currentContext();

  // Try invoking Supabase Edge Function 'notification-service'
  try {
    const { data: edgeData, error: edgeError } =
      await context.admin.functions.invoke("notification-service", {
        body: {
          receiverId: input.receiverId,
          title: input.title,
          message: input.message,
          type: input.type,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
        },
      });

    const edgeNoticeId =
      (edgeData as { data?: { id?: string }; id?: string })?.data?.id ??
      (edgeData as { data?: { id?: string }; id?: string })?.id;

    if (!edgeError && edgeNoticeId) {
      return { success: true, id: edgeNoticeId };
    }
  } catch {
    // Non-blocking fallback to database queue & direct delivery
  }

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

  // Deliver clinical notices immediately to public.notifications and broadcast
  try {
    await context.admin.rpc("deliver_clinical_notices");
  } catch {
    // Delivery will be picked up by drain
  }

  return { success: true, id: data };
}
