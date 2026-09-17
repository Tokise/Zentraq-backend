import { currentContext } from "./context.js";

interface ClinicalNotification {
  receiverId: string;
  title: string;
  message: string;
  type: string;
  entityType?: string | null;
  entityId?: string | null;
}

/**
 * Dispatches a notification via the Supabase Edge Function `notification-service`.
 *
 * The edge function handles insert, dedup, and Realtime broadcast.
 * This is the ONLY notification path — no Cloudflare queue fallback.
 */
export async function createNotificationAction(input: ClinicalNotification) {
  const context = currentContext();

  const { data, error } = await context.admin.functions.invoke(
    "notification-service",
    {
      body: {
        receiverId: input.receiverId,
        senderId: context.actor.id,
        title: input.title,
        message: input.message,
        type: input.type,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
      },
    },
  );

  if (error) {
    console.error("[createNotificationAction] Edge function error:", error);
    throw new Error("NOTIFICATION_DISPATCH_FAILED");
  }

  const noticeId =
    (data as { data?: { id?: string }; id?: string })?.data?.id ??
    (data as { data?: { id?: string }; id?: string })?.id;

  return { success: true, id: noticeId ?? null };
}
