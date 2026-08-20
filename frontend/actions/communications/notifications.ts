"use server";

import { z } from "zod";

import { authenticatedApiRequest } from "@/lib/api/server";
import { assertSameOrigin } from "@/lib/security/action-guard";

export type NotificationType =
  | "appointment"
  | "clearance"
  | "consultation"
  | "emergency"
  | "incident"
  | "inventory"
  | "rfid"
  | "service"
  | "system"
  | "visit_log";

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

interface NotificationApiRow {
  created_at: string;
  entity_id: string | null;
  entity_type: string | null;
  id: string;
  message: string;
  read_at: string | null;
  title: string;
  type: NotificationType;
}

// Maps a minimized gateway row to the existing notification UI contract.
function notificationDto(
  item: NotificationApiRow,
): NotificationDTO {
  return {
    id: item.id,
    title: item.title,
    message: item.message,
    type: item.type,
    is_read: item.read_at !== null,
    created_at: item.created_at,
    related_resource: item.entity_type,
    related_resource_id: item.entity_id,
  };
}

// Loads the current user's notifications through the Render gateway.
export async function getNotificationsAction(
  options?: { limit?: number },
) {
  const limit = Math.max(
    1,
    Math.min(options?.limit ?? 20, 30),
  );
  try {
    const { data } =
      await authenticatedApiRequest<NotificationApiRow[]>(
        `/api/v1/notifications?page=1&limit=${limit}`,
      );
    return {
      error: null,
      notifications: data.map(notificationDto),
    };
  } catch {
    return {
      error: "Unable to load notifications",
      notifications: [] as NotificationDTO[],
    };
  }
}

// Loads the current user's unread count through the Render gateway.
export async function getUnreadNotificationCountAction() {
  try {
    const { data } =
      await authenticatedApiRequest<{ count: number }>(
        "/api/v1/notifications/unread-count",
      );
    return { error: null, count: data.count };
  } catch {
    return {
      error: "Unable to load notification count",
      count: 0,
    };
  }
}

// Changes one owned notification's read state through the gateway.
export async function markNotificationAsReadAction(
  id: string,
  isRead: boolean,
) {
  const parsedId = z.string().uuid().safeParse(id);
  if (
    !parsedId.success ||
    !(await assertSameOrigin())
  ) {
    return { error: "Unable to update notification" };
  }
  try {
    await authenticatedApiRequest(
      `/api/v1/notifications/${parsedId.data}`,
      {
        method: "PATCH",
        body: { isRead },
      },
    );
    return { success: true };
  } catch {
    return { error: "Unable to update notification" };
  }
}

// Marks every unread owned notification through one atomic gateway request.
export async function markAllNotificationsAsReadAction() {
  if (!(await assertSameOrigin())) {
    return { error: "Unable to update notifications" };
  }
  try {
    const { data } =
      await authenticatedApiRequest<{
        updatedCount: number;
      }>("/api/v1/notifications", {
        method: "PATCH",
        body: { allRead: true },
      });
    return {
      success: true,
      updatedCount: data.updatedCount,
    };
  } catch {
    return { error: "Unable to update notifications" };
  }
}

// Maps dismissal to the existing immutable notification read state.
export async function deleteNotificationAction(id: string) {
  return markNotificationAsReadAction(id, true);
}

export interface CreateNotificationInput {
  receiverId: string;
  title: string;
  message: string;
  type: NotificationType;
  entityType?: string | null;
  entityId?: string | null;
}

// Dispatches a notification through notification-service REST API microservice gateway.
export async function createNotificationAction(input: CreateNotificationInput) {
  try {
    const { data } = await authenticatedApiRequest<{ id: string }>(
      "/api/v1/notifications/create",
      {
        method: "POST",
        body: input,
      },
    );
    return { success: true, id: data.id };
  } catch {
    return { error: "Unable to send notification" };
  }
}
