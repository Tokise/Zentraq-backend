import type { Express } from "express";
import { z } from "zod";

import {
  AppError,
  asyncRoute,
  createAdminClient,
  createServiceApp,
  errorHandler,
  notFoundHandler,
  paginationMeta,
  paginationRange,
  paginationSchema,
  requireInternalContext,
  requireInternalServiceKey,
  requireRoles,
  requireStrongSecret,
  sendCollection,
  sendData,
} from "@zentraq/shared";

const notificationSchema = z.object({
  entityId: z.string().uuid().optional().nullable(),
  entityType: z.string().trim().min(1).max(80).optional().nullable(),
  message: z.string().trim().min(1).max(1_000),
  receiverId: z.string().uuid(),
  senderId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1).max(160),
  type: z.enum(["appointment", "clearance", "inventory", "incident", "system"]),
});

const notificationIdSchema = z.string().uuid();
const readStateSchema = z.object({ isRead: z.boolean() });

interface NotificationDependencies {
  contextSecret?: string;
  internalServiceKey?: string;
}

// Creates Notification Service as the owner of notification records and delivery state.
export function createNotificationApp(
  dependencies: NotificationDependencies = {},
): Express {
  const app = createServiceApp("notification-service");
  const contextSecret =
    dependencies.contextSecret ??
    requireStrongSecret(process.env.INTERNAL_CONTEXT_SECRET, "INTERNAL_CONTEXT_SECRET");
  const internalServiceKey =
    dependencies.internalServiceKey ??
    requireStrongSecret(process.env.INTERNAL_SERVICE_KEY, "INTERNAL_SERVICE_KEY");

  app.post(
    "/internal/notifications",
    requireInternalServiceKey(internalServiceKey),
    asyncRoute(async (request, response) => {
      const parsed = notificationSchema.safeParse(request.body);
      if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid notification request.");
      sendData(response, await createNotification(parsed.data), 201);
    }),
  );

  app.use("/api/v1", requireInternalContext(contextSecret));

  app.get(
    "/api/v1/notifications",
    asyncRoute(async (request, response) => {
      const userId = request.auth?.userId;
      if (!userId) throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
      const parsed = paginationSchema.safeParse(request.query);
      if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid pagination.");
      const { from, to } = paginationRange(parsed.data.page, parsed.data.limit);
      const { data, count, error } = await createAdminClient()
        .from("notifications")
        .select("id,title,message,type,entity_type,entity_id,read_at,created_at", {
          count: "exact",
        })
        .eq("receiver_id", userId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw new AppError(503, "DATABASE_UNAVAILABLE", "Unable to load notifications.");
      sendCollection(
        response,
        data ?? [],
        paginationMeta(parsed.data.page, parsed.data.limit, count ?? 0),
      );
    }),
  );

  app.post(
    "/api/v1/notifications",
    requireRoles("admin"),
    asyncRoute(async (request, response) => {
      const parsed = notificationSchema.safeParse({
        ...request.body,
        senderId: request.auth?.userId,
      });
      if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid notification request.");
      sendData(response, await createNotification(parsed.data), 201);
    }),
  );

  app.patch(
    "/api/v1/notifications/:notificationId",
    asyncRoute(async (request, response) => {
      const userId = request.auth?.userId;
      if (!userId) throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
      const notificationId = notificationIdSchema.parse(request.params.notificationId);
      const parsed = readStateSchema.safeParse(request.body);
      if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid notification state.");
      const { data, error } = await createAdminClient()
        .from("notifications")
        .update({ read_at: parsed.data.isRead ? new Date().toISOString() : null })
        .eq("id", notificationId)
        .eq("receiver_id", userId)
        .select("id,read_at")
        .maybeSingle();
      if (error) throw new AppError(503, "DATABASE_UNAVAILABLE", "Unable to update notification.");
      if (!data) throw new AppError(404, "NOTIFICATION_NOT_FOUND", "Notification not found.");
      sendData(response, data);
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

// Inserts one minimized notification without exposing database errors.
async function createNotification(input: z.infer<typeof notificationSchema>) {
  const { data, error } = await createAdminClient()
    .from("notifications")
    .insert({
      entity_id: input.entityId ?? null,
      entity_type: input.entityType ?? null,
      message: input.message,
      receiver_id: input.receiverId,
      sender_id: input.senderId ?? null,
      title: input.title,
      type: input.type,
    })
    .select("id,receiver_id,title,type,entity_type,entity_id,created_at")
    .single();
  if (error || !data) throw new AppError(503, "DATABASE_UNAVAILABLE", "Unable to create notification.");
  return data;
}
