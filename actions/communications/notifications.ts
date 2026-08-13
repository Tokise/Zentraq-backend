"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { logAuditEvent } from "@/lib/audit-logger";
import { assertSameOrigin } from "@/lib/security/action-guard";
import { z } from "zod";

export type NotificationType =
  | "appointment"
  | "clearance"
  | "inventory"
  | "incident"
  | "system";
export interface NotificationDTO {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  created_at: string;
  related_resource: string | null;
  related_resource_id: string | null;
}

async function currentUser() {
  const store = await cookies();
  const supabase = createClient(store);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function getNotificationsAction(options?: { limit?: number }) {
  const { supabase, user } = await currentUser();
  if (!user)
    return {
      error: "Not authenticated",
      notifications: [] as NotificationDTO[],
    };
  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, title, message, type, entity_type, entity_id, read_at, created_at",
    )
    .eq("receiver_id", user.id)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(options?.limit ?? 20, 30)));
  return {
    error: error ? "Unable to load notifications" : null,
    notifications: (data ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      message: item.message,
      type: item.type as NotificationType,
      is_read: item.read_at !== null,
      created_at: item.created_at,
      related_resource: item.entity_type,
      related_resource_id: item.entity_id,
    })),
  };
}

export async function getUnreadNotificationCountAction() {
  const { supabase, user } = await currentUser();
  if (!user) return { error: "Not authenticated", count: 0 };
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("receiver_id", user.id)
    .is("read_at", null);
  return {
    error: error ? "Unable to load notification count" : null,
    count: count ?? 0,
  };
}

export async function markNotificationAsReadAction(id: string, isRead: boolean) {
  const { supabase, user } = await currentUser();
  if (!user) return { error: "Not authenticated" };
  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success || !(await assertSameOrigin())) {
    return { error: "Unable to update notification" };
  }
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: isRead ? new Date().toISOString() : null })
    .eq("id", parsedId.data)
    .eq("receiver_id", user.id);
  if (!error)
    await logAuditEvent({
      action: isRead ? "NOTIFICATION_READ" : "NOTIFICATION_UNREAD",
      userId: user.id,
      email: user.email,
      resource: parsedId.data,
    });
  return error ? { error: "Unable to update notification" } : { success: true };
}

export async function markAllNotificationsAsReadAction() {
  const { supabase, user } = await currentUser();
  if (!user) return { error: "Not authenticated" };
  if (!(await assertSameOrigin())) {
    return { error: "Unable to update notifications" };
  }
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("receiver_id", user.id)
    .is("read_at", null)
    .select("id");
  return error
    ? { error: "Unable to update notifications" }
    : { success: true, updatedCount: data?.length ?? 0 };
}

// Notifications are immutable audit-relevant records in the SAD schema.
// Dismissal maps to read rather than deleting a record.
export async function deleteNotificationAction(id: string) {
  return markNotificationAsReadAction(id, true);
}
