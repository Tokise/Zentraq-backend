import type { Express, Request } from "express";
import { z } from "zod";

import {
  AppError,
  asyncRoute,
  createAdminClient,
  createServiceApp,
  createUserClient,
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

import { drainNotificationJobs } from "./worker.js";

const notificationSchema = z.object({
  entityId: z.string().uuid().optional().nullable(),
  entityType: z.string().trim().min(1).max(80).optional().nullable(),
  message: z.string().trim().min(1).max(1_000),
  receiverId: z.string().uuid(),
  senderId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1).max(160),
  type: z.enum(["appointment", "clearance", "inventory", "incident", "system"]),
});

const notificationJobSchema = z
  .object({
    correlationId: z.string().uuid().optional(),
    entityId: z.string().uuid().optional().nullable(),
    entityType: z
      .enum(["appointment", "clearance", "inventory", "consultation", "system"])
      .optional()
      .nullable(),
    idempotencyKey: z
      .string()
      .regex(/^[A-Za-z0-9._:-]{8,128}$/),
    receiverId: z.string().uuid(),
    templateKey: z.enum([
      "appointment.updated",
      "clearance.updated",
      "inventory.attention",
      "consultation.review_requested",
      "system.notice",
    ]),
  })
  .refine(
    (value) => Boolean(value.entityType) === Boolean(value.entityId),
    "Entity type and ID must be provided together.",
  );

const notificationIdSchema = z.string().uuid();
const readStateSchema = z.object({ isRead: z.boolean() });

interface NotificationJobStatusRow {
  created_at: string;
  error_code: string | null;
  id: string;
  status: string;
  updated_at: string;
}

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
    requireStrongSecret(
      process.env.INTERNAL_CONTEXT_SECRET,
      "INTERNAL_CONTEXT_SECRET",
    );
  const internalServiceKey =
    dependencies.internalServiceKey ??
    requireStrongSecret(
      process.env.INTERNAL_SERVICE_KEY,
      "INTERNAL_SERVICE_KEY",
    );

  app.post(
    "/internal/notifications",
    requireInternalServiceKey(internalServiceKey),
    asyncRoute(async (request, response) => {
      const parsed = notificationSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "Invalid notification request.",
        );
      }
      sendData(response, await createNotification(parsed.data), 201);
    }),
  );

  app.post(
    "/internal/workers/notifications/drain",
    requireInternalServiceKey(internalServiceKey),
    asyncRoute(async (request, response) => {
      const body = request.body as { batchSize?: unknown } | undefined;
      sendData(
        response,
        await drainNotificationJobs(body?.batchSize),
      );
    }),
  );
  app.use("/api/v1", requireInternalContext(contextSecret));

  app.get(
    "/api/v1/notifications",
    asyncRoute(async (request, response) => {
      const userId = requireUserId(request);
      const parsed = paginationSchema.safeParse(request.query);
      if (!parsed.success) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "Invalid pagination.",
        );
      }
      const { from, to } = paginationRange(
        parsed.data.page,
        parsed.data.limit,
      );
      const { data, count, error } = await createUserClient(
        requireAccessToken(request),
      )
        .from("notifications")
        .select(
          "id,title,message,type,entity_type,entity_id,read_at,created_at",
          { count: "exact" },
        )
        .eq("receiver_id", userId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) {
        throw new AppError(
          503,
          "DATABASE_UNAVAILABLE",
          "Unable to load notifications.",
        );
      }
      sendCollection(
        response,
        data ?? [],
        paginationMeta(
          parsed.data.page,
          parsed.data.limit,
          count ?? 0,
        ),
      );
    }),
  );

  app.get(
    "/api/v1/notifications/unread-count",
    asyncRoute(async (request, response) => {
      const userId = requireUserId(request);
      const { count, error } = await createUserClient(
        requireAccessToken(request),
      )
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", userId)
        .eq("is_deleted", false)
        .is("read_at", null);
      if (error) {
        throw new AppError(
          503,
          "DATABASE_UNAVAILABLE",
          "Unable to load the notification count.",
        );
      }
      sendData(response, { count: count ?? 0 });
    }),
  );

  app.post(
    ["/api/v1/notification-jobs", "/api/v1/notifications"],
    requireRoles("admin"),
    asyncRoute(async (request, response) => {
      const userId = requireUserId(request);
      const parsed = notificationJobSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "Invalid notification job request.",
        );
      }
      const { data, error } = await createAdminClient().rpc(
        "enqueue_notification_job",
        {
          requested_by: userId,
          requested_correlation_id:
            parsed.data.correlationId ?? crypto.randomUUID(),
          requested_entity_id: parsed.data.entityId ?? null,
          requested_entity_type: parsed.data.entityType ?? null,
          requested_idempotency_key: parsed.data.idempotencyKey,
          requested_receiver_id: parsed.data.receiverId,
          requested_template_key: parsed.data.templateKey,
        },
      );
      if (error || typeof data !== "string") {
        throw mapNotificationJobError(error?.message);
      }
      scheduleNotificationDrain();
      sendData(
        response,
        {
          jobId: data,
          status: "queued",
        },
        202,
      );
    }),
  );

  app.get(
    "/api/v1/notification-jobs/:jobId",
    requireRoles("admin"),
    asyncRoute(async (request, response) => {
      const userId = requireUserId(request);
      const jobId = notificationIdSchema.parse(request.params.jobId);
      const { data, error } = await createAdminClient().rpc(
        "get_notification_job_status",
        {
          requested_by: userId,
          requested_job_id: jobId,
        },
      );
      const row = Array.isArray(data)
        ? (data[0] as NotificationJobStatusRow | undefined)
        : undefined;
      if (error) {
        throw new AppError(
          503,
          "NOTIFICATION_QUEUE_UNAVAILABLE",
          "The notification job status is temporarily unavailable.",
        );
      }
      if (!row) {
        throw new AppError(
          404,
          "NOTIFICATION_JOB_NOT_FOUND",
          "The notification job is unavailable.",
        );
      }
      sendData(response, {
        createdAt: row.created_at,
        errorCode: row.error_code,
        id: row.id,
        status: normalizeJobStatus(row.status),
        updatedAt: row.updated_at,
      });
    }),
  );

  app.patch(
    "/api/v1/notifications",
    asyncRoute(async (request, response) => {
      const userId = requireUserId(request);
      const parsed = z
        .object({ allRead: z.literal(true) })
        .safeParse(request.body);
      if (!parsed.success) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "Invalid notification state.",
        );
      }
      const { data, error } = await createUserClient(
        requireAccessToken(request),
      )
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("receiver_id", userId)
        .eq("is_deleted", false)
        .is("read_at", null)
        .select("id");
      if (error) {
        throw new AppError(
          503,
          "DATABASE_UNAVAILABLE",
          "Unable to update notifications.",
        );
      }
      sendData(response, {
        updatedCount: data?.length ?? 0,
      });
    }),
  );

  app.patch(
    "/api/v1/notifications/:notificationId",
    asyncRoute(async (request, response) => {
      const userId = requireUserId(request);
      const notificationId = notificationIdSchema.parse(
        request.params.notificationId,
      );
      const parsed = readStateSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "Invalid notification state.",
        );
      }
      const { data, error } = await createUserClient(
        requireAccessToken(request),
      )
        .from("notifications")
        .update({
          read_at: parsed.data.isRead
            ? new Date().toISOString()
            : null,
        })
        .eq("id", notificationId)
        .eq("receiver_id", userId)
        .select("id,read_at")
        .maybeSingle();
      if (error) {
        throw new AppError(
          503,
          "DATABASE_UNAVAILABLE",
          "Unable to update notification.",
        );
      }
      if (!data) {
        throw new AppError(
          404,
          "NOTIFICATION_NOT_FOUND",
          "Notification not found.",
        );
      }
      sendData(response, data);
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

// Drains newly queued notifications while the already-awake web service can work.
function scheduleNotificationDrain(): void {
  setImmediate(() => {
    void drainNotificationJobs(10).catch((error: unknown) => {
      console.error(
        JSON.stringify({
          code: "NOTIFICATION_DRAIN_FAILED",
          event: "notification_drain_failed",
          message: error instanceof Error ? error.message : "unknown",
        }),
      );
    });
  });
}

// Extracts the user identity already verified and signed by the gateway.
function requireUserId(request: Request): string {
  const userId = request.auth?.userId;
  if (!userId) {
    throw new AppError(
      401,
      "UNAUTHENTICATED",
      "Authentication is required.",
    );
  }
  return userId;
}

// Extracts the original user token for request-scoped RLS queries.
function requireAccessToken(request: Request): string {
  const authorization = request.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new AppError(
      401,
      "UNAUTHENTICATED",
      "Authentication is required.",
    );
  }
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) {
    throw new AppError(
      401,
      "UNAUTHENTICATED",
      "Authentication is required.",
    );
  }
  return token;
}

// Maps internal worker states to the stable public job contract.
export function normalizeJobStatus(
  status: string,
): "queued" | "processing" | "succeeded" | "failed" {
  if (status === "completed") return "succeeded";
  if (status === "dead_letter") return "failed";
  return status === "processing" ? "processing" : "queued";
}

// Converts protected queue failures into controlled public errors.
function mapNotificationJobError(message?: string): AppError {
  if (message?.includes("RECIPIENT_UNAVAILABLE")) {
    return new AppError(
      404,
      "RECIPIENT_UNAVAILABLE",
      "The notification recipient is unavailable.",
    );
  }
  if (message?.includes("ADMIN_AUTHORIZATION_REQUIRED")) {
    return new AppError(
      403,
      "FORBIDDEN",
      "Notification job submission is not permitted.",
    );
  }
  return new AppError(
    503,
    "NOTIFICATION_QUEUE_UNAVAILABLE",
    "The notification could not be queued.",
  );
}

// Inserts one compatibility notification for existing internal service calls.
async function createNotification(
  input: z.infer<typeof notificationSchema>,
) {
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
    .select(
      "id,receiver_id,title,type,entity_type,entity_id,created_at",
    )
    .single();
  if (error || !data) {
    throw new AppError(
      503,
      "DATABASE_UNAVAILABLE",
      "Unable to create notification.",
    );
  }
  return data;
}
