"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { logAuditEvent } from "@/lib/audit-logger";

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
  const {
    data: { user },
  } = await createClient(store).auth.getUser();
  return user;
}

export async function getNotifications(options?: { limit?: number }) {
  const user = await currentUser();
  if (!user)
    return {
      error: "Not authenticated",
      notifications: [] as NotificationDTO[],
    };
  const { data, error } = await createAdminClient()
    .from("notifications")
    .select(
      "id, title, message, type, entity_type, entity_id, read_at, created_at",
    )
    .eq("receiver_id", user.id)
    .order("created_at", { ascending: false })
    .limit(Math.min(options?.limit ?? 20, 30));
  return {
    error: error?.message ?? null,
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

export async function getUnreadNotificationCount() {
  const user = await currentUser();
  if (!user) return { error: "Not authenticated", count: 0 };
  const { count, error } = await createAdminClient()
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("receiver_id", user.id)
    .is("read_at", null);
  return { error: error?.message ?? null, count: count ?? 0 };
}

export async function markNotificationAsRead(id: string, isRead: boolean) {
  const user = await currentUser();
  if (!user) return { error: "Not authenticated" };
  const { error } = await createAdminClient()
    .from("notifications")
    .update({ read_at: isRead ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("receiver_id", user.id);
  if (!error)
    await logAuditEvent({
      action: isRead ? "NOTIFICATION_READ" : "NOTIFICATION_UNREAD",
      userId: user.id,
      email: user.email,
      resource: id,
    });
  return error ? { error: error.message } : { success: true };
}

export async function markAllNotificationsAsRead() {
  const user = await currentUser();
  if (!user) return { error: "Not authenticated" };
  const { data, error } = await createAdminClient()
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("receiver_id", user.id)
    .is("read_at", null)
    .select("id");
  return error
    ? { error: error.message }
    : { success: true, updatedCount: data?.length ?? 0 };
}

// Notifications are immutable audit-relevant records in the SAD schema.
// Dismissal maps to read rather than deleting a record.
export async function deleteNotification(id: string) {
  return markNotificationAsRead(id, true);
}

export async function createNotificationAction(params: {
  receiverId: string;
  title: string;
  message: string;
  type: NotificationType;
  relatedResource?: string;
  relatedResourceId?: string;
}) {
  const user = await currentUser();
  if (!user) return { error: "Not authenticated" };
  if (!params.receiverId || !params.title.trim() || !params.message.trim())
    return { error: "Receiver, title, and message are required" };
  const { error } = await createAdminClient()
    .from("notifications")
    .insert({
      sender_id: user.id,
      receiver_id: params.receiverId,
      title: params.title.trim(),
      message: params.message.trim(),
      type: params.type,
      entity_type: params.relatedResource ?? null,
      entity_id: params.relatedResourceId ?? null,
    });
  if (!error)
    await logAuditEvent({
      action: "NOTIFICATION_SENT",
      userId: user.id,
      email: user.email,
      details: { type: params.type },
    });
  return error ? { error: error.message } : { success: true };
}

export async function searchUsersForNotificationAction(query: string) {
  const user = await currentUser();
  if (!user || query.trim().length < 2)
    return {
      error: user ? null : "Not authenticated",
      users: [] as Array<{
        id: string;
        email: string | null;
        role: string | null;
      }>,
    };
  const admin = createAdminClient();
  const term = query.trim();
  const { data, error } = await admin
    .from("users")
    .select("id, email, user_roles(role:roles(name))")
    .ilike("email", `%${term}%`)
    .limit(10);
  if (error)
    return {
      error: error.message,
      users: [] as Array<{
        id: string;
        email: string | null;
        role: string | null;
      }>,
    };
  return {
    error: null,
    users: (data ?? []).map((item) => {
      const relations =
        (item as { user_roles?: Array<{ role?: unknown }> }).user_roles ?? [];
      const relation = relations[0]?.role;
      const entry = Array.isArray(relation) ? relation[0] : relation;
      const role =
        typeof entry === "object" && entry !== null && "name" in entry
          ? (entry as { name?: string }).name
          : null;
      return { id: item.id, email: item.email, role };
    }),
  };
}
