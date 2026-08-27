import { randomUUID } from "node:crypto";

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
  primaryRole,
  requireInternalContext,
  requireInternalServiceKey,
  requireRoles,
  requireStrongSecret,
  sendCollection,
  sendData,
  type AuthContext,
} from "@zentraq/shared";

import { drainReportJobs } from "./worker.js";
import { drainReportDeliveryJobs } from "./delivery-worker.js";
import { loadGoogleWorkspaceConfig } from "./google-workspace.js";

const auditSchema = z.object({
  action: z.string().trim().min(1).max(120),
  entityId: z.string().uuid().optional().nullable(),
  entityType: z.string().trim().min(1).max(120).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  userId: z.string().uuid().optional().nullable(),
});

const dashboardRoleSchema = z.enum(["admin", "doctor", "nurse"]);
const reportRequestSchema = z
  .object({
    endDate: z.iso.date(),
    idempotencyKey: z
      .string()
      .regex(/^[A-Za-z0-9._:-]{8,128}$/)
      .optional(),
    reportType: z.literal("clinic-aggregate"),
    startDate: z.iso.date(),
  })
  .refine((value) => value.startDate <= value.endDate, {
    message: "The report period is invalid.",
  });
const idSchema = z.string().uuid();
const reportDeliverySchema = z
  .object({
    emailRecipients: z.array(z.string().email()).max(10),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9._:-]{8,128}$/),
    publishToSheets: z.boolean(),
    uploadToDrive: z.boolean(),
  })
  .refine(
    (value) =>
      value.uploadToDrive ||
      value.publishToSheets ||
      value.emailRecipients.length > 0,
    "At least one delivery destination is required.",
  )
  .refine(
    (value) => value.emailRecipients.length === 0 || value.uploadToDrive,
    "Email delivery requires a restricted Drive upload.",
  );

interface ClinicAccountReference {
  id: string;
  role: "admin" | "doctor" | "nurse";
  user_id: string;
}

interface ReportStatusRow {
  artifact_expires_at: string | null;
  artifact_path: string | null;
  error_code: string | null;
  id: string;
  status: string;
}

interface ReportingDependencies {
  contextSecret?: string;
  internalServiceKey?: string;
}

interface ReportDeliveryStatusRow {
  created_at: string;
  drive_file_id: string | null;
  drive_status: string;
  drive_web_view_link: string | null;
  error_code: string | null;
  gmail_status: string;
  id: string;
  report_id: string;
  retry_count: number;
  sheets_published_at: string | null;
  sheets_snapshot_id: string | null;
  sheets_status: string;
  status: string;
  updated_at: string;
}

// Creates Reporting Service for sanitized audits, aggregates, and report artifacts.
export function createReportingApp(
  dependencies: ReportingDependencies = {},
): Express {
  const app = createServiceApp("reporting-service");
  const contextSecret =
    dependencies.contextSecret ??
    requireStrongSecret(process.env.INTERNAL_CONTEXT_SECRET, "INTERNAL_CONTEXT_SECRET");
  const internalServiceKey =
    dependencies.internalServiceKey ??
    requireStrongSecret(process.env.INTERNAL_SERVICE_KEY, "INTERNAL_SERVICE_KEY");
  const googleConfig = loadGoogleWorkspaceConfig();

  app.post(
    "/internal/audit",
    requireInternalServiceKey(internalServiceKey),
    asyncRoute(async (request, response) => {
      const parsed = auditSchema.safeParse(request.body);
      if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid audit event.");
      sendData(response, await recordAuditEvent(parsed.data), 201);
    }),
  );

  app.post(
    "/internal/workers/reports/drain",
    requireInternalServiceKey(internalServiceKey),
    asyncRoute(async (request, response) => {
      const body = request.body as { batchSize?: unknown } | undefined;
      sendData(
        response,
        await drainReportJobs(body?.batchSize),
      );
    }),
  );
  app.post(
    "/internal/workers/report-deliveries/drain",
    requireInternalServiceKey(internalServiceKey),
    asyncRoute(async (request, response) => {
      const body = request.body as { batchSize?: unknown } | undefined;
      sendData(
        response,
        await drainReportDeliveryJobs(body?.batchSize, {
          internalServiceKey,
        }),
      );
    }),
  );
  app.use("/api/v1", requireInternalContext(contextSecret));

  app.get(
    "/api/v1/audit",
    requireRoles("admin"),
    asyncRoute(async (request, response) => {
      const parsed = paginationSchema.safeParse(request.query);
      if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid pagination.");
      const { from, to } = paginationRange(parsed.data.page, parsed.data.limit);
      const { data, count, error } = await createAdminClient()
        .from("audit_logs")
        .select("id,user_id,action,entity_type,entity_id,metadata,created_at", {
          count: "exact",
        })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw new AppError(503, "DATABASE_UNAVAILABLE", "Unable to load audit events.");
      sendCollection(
        response,
        data ?? [],
        paginationMeta(parsed.data.page, parsed.data.limit, count ?? 0),
      );
    }),
  );

  app.post(
    "/api/v1/report-jobs/:reportId/deliver",
    requireRoles("admin"),
    asyncRoute(async (request, response) => {
      const auth = authenticated(request.auth);
      const reportId = idSchema.parse(request.params.reportId);
      const parsed = reportDeliverySchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "Invalid report delivery request.",
        );
      }
      if (!googleConfig) {
        throw new AppError(
          503,
          "GOOGLE_WORKSPACE_DISABLED",
          "Google Workspace delivery is not enabled.",
        );
      }

      const status = await reportStatus(reportId, auth.userId);
      if (status.status !== "completed") {
        throw new AppError(
          409,
          "REPORT_NOT_READY",
          "The report must be completed before delivery.",
        );
      }
      const recipients = await resolveApprovedRecipients(
        parsed.data.emailRecipients,
        googleConfig.allowedDomain,
      );
      const { data, error } = await createAdminClient().rpc(
        "enqueue_report_delivery_job",
        {
          requested_by: auth.userId,
          requested_correlation_id: randomUUID(),
          requested_email_recipients: recipients,
          requested_idempotency_key: parsed.data.idempotencyKey,
          requested_publish_to_sheets: parsed.data.publishToSheets,
          requested_report_id: reportId,
          requested_upload_to_drive: parsed.data.uploadToDrive,
        },
      );
      if (error || typeof data !== "string") {
        throw new AppError(
          503,
          "REPORT_DELIVERY_UNAVAILABLE",
          "The report delivery could not be queued.",
        );
      }
      scheduleReportDeliveryDrain(internalServiceKey);
      publishAuditEvent({
        action: "REPORT_DELIVERY_REQUESTED",
        entityId: data,
        entityType: "report_delivery_job",
        metadata: {
          emailRecipientCount: recipients.length,
          publishToSheets: parsed.data.publishToSheets,
          uploadToDrive: parsed.data.uploadToDrive,
        },
        userId: auth.userId,
      });
      sendData(response, {
        deliveryJobId: data,
        status: "queued",
      }, 202);
    }),
  );

  app.get(
    "/api/v1/report-delivery-jobs/:deliveryJobId",
    requireRoles("admin"),
    asyncRoute(async (request, response) => {
      const auth = authenticated(request.auth);
      const deliveryJobId = idSchema.parse(request.params.deliveryJobId);
      const { data, error } = await createAdminClient().rpc(
        "get_report_delivery_job_status",
        {
          requested_by: auth.userId,
          requested_delivery_job_id: deliveryJobId,
        },
      );
      const row = Array.isArray(data)
        ? data[0] as ReportDeliveryStatusRow | undefined
        : undefined;
      if (error) {
        throw new AppError(
          503,
          "REPORT_DELIVERY_UNAVAILABLE",
          "The report delivery status is unavailable.",
        );
      }
      if (!row) {
        throw new AppError(
          404,
          "REPORT_DELIVERY_NOT_FOUND",
          "The report delivery job was not found.",
        );
      }
      sendData(response, {
        createdAt: row.created_at,
        driveFileId: row.drive_file_id,
        driveStatus: row.drive_status,
        driveWebViewLink: row.drive_web_view_link,
        errorCode: row.error_code,
        gmailStatus: row.gmail_status,
        id: row.id,
        reportId: row.report_id,
        retryCount: row.retry_count,
        sheetsPublishedAt: row.sheets_published_at,
        sheetsSnapshotId: row.sheets_snapshot_id,
        sheetsStatus: row.sheets_status,
        status: row.status,
        updatedAt: row.updated_at,
      });
    }),
  );

  app.get(
    "/api/v1/dashboard/:role",
    asyncRoute(async (request, response) => {
      const auth = authenticated(request.auth);
      const requestedRole = dashboardRoleSchema.parse(request.params.role);
      const actorRole = primaryRole(auth, ["admin", "doctor", "nurse"]);
      if (actorRole !== "admin" && actorRole !== requestedRole) {
        throw new AppError(403, "FORBIDDEN", "You cannot access another role dashboard.");
      }
      const clinicAccount =
        actorRole === "admin"
          ? null
          : await clinicAccountReference(auth.userId);
      sendData(response, await dashboardAggregate(requestedRole, clinicAccount?.id ?? null));
    }),
  );

  app.post(
    ["/api/v1/reports", "/api/v1/report-jobs"],
    requireRoles("admin"),
    asyncRoute(async (request, response) => {
      const auth = authenticated(request.auth);
      const parsed = reportRequestSchema.safeParse(request.body);
      if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid report request.");
      const idempotencyKey =
        parsed.data.idempotencyKey ??
        [
          parsed.data.reportType,
          parsed.data.startDate,
          parsed.data.endDate,
        ].join(":");
      const { data, error } = await createAdminClient().rpc("enqueue_report_request", {
        requested_by: auth.userId,
        requested_correlation_id: randomUUID(),
        requested_end_date: parsed.data.endDate,
        requested_idempotency_key: idempotencyKey,
        requested_report_type: parsed.data.reportType,
        requested_start_date: parsed.data.startDate,
      });
      if (error || typeof data !== "string") {
        throw new AppError(503, "REPORT_UNAVAILABLE", "The report could not be queued.");
      }
      scheduleReportDrain();
      publishAuditEvent({
        action: "REPORT_REQUESTED",
        entityId: data,
        entityType: "report_request",
        metadata: {
          reportType: parsed.data.reportType,
        },
        userId: auth.userId,
      });
      sendData(
        response,
        {
          jobId: data,
          requestId: data,
          status: "queued",
        },
        202,
      );
    }),
  );

  app.get(
    ["/api/v1/reports/:reportId", "/api/v1/report-jobs/:reportId"],
    requireRoles("admin"),
    asyncRoute(async (request, response) => {
      const auth = authenticated(request.auth);
      const reportId = idSchema.parse(request.params.reportId);
      const status = await reportStatus(reportId, auth.userId);
      sendData(response, {
        errorCode: status.error_code,
        id: status.id,
        status: normalizeJobStatus(status.status),
      });
    }),
  );

  app.get(
    [
      "/api/v1/reports/:reportId/download",
      "/api/v1/report-jobs/:reportId/result",
    ],
    requireRoles("admin"),
    asyncRoute(async (request, response) => {
      const auth = authenticated(request.auth);
      const reportId = idSchema.parse(request.params.reportId);
      const status = await reportStatus(reportId, auth.userId);
      if (
        status.status !== "completed" ||
        !status.artifact_path ||
        !status.artifact_expires_at ||
        new Date(status.artifact_expires_at).getTime() <= Date.now()
      ) {
        throw new AppError(409, "REPORT_NOT_READY", "The report download is unavailable.");
      }
      const signed = await createAdminClient()
        .storage.from("generated-reports")
        .createSignedUrl(status.artifact_path, 5 * 60, {
          download: `zentraq-report-${new Date().toISOString().slice(0, 10)}.xlsx`,
        });
      if (signed.error || !signed.data.signedUrl) {
        throw new AppError(503, "REPORT_UNAVAILABLE", "The report download is unavailable.");
      }
      publishAuditEvent({
        action: "REPORT_DOWNLOADED",
        entityId: reportId,
        entityType: "report_request",
        metadata: {},
        userId: auth.userId,
      });
      sendData(response, { expiresIn: 300, url: signed.data.signedUrl });
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

// Drains a new report while the already-awake web service can process it.
function scheduleReportDrain(): void {
  setImmediate(() => {
    void drainReportJobs(1).catch((error: unknown) => {
      console.error(
        JSON.stringify({
          code: "REPORT_DRAIN_FAILED",
          event: "report_drain_failed",
          message: error instanceof Error ? error.message : "unknown",
        }),
      );
    });
  });
}

// Drains one newly queued external delivery without blocking its API response.
function scheduleReportDeliveryDrain(internalServiceKey: string): void {
  setImmediate(() => {
    void drainReportDeliveryJobs(1, { internalServiceKey }).catch(() => {
      console.error(JSON.stringify({
        code: "REPORT_DELIVERY_DRAIN_FAILED",
        event: "report_delivery_drain_failed",
      }));
    });
  });
}

// Persists one sanitized audit event owned by Reporting Service.
async function recordAuditEvent(
  input: z.infer<typeof auditSchema>,
): Promise<{ id: string }> {
  const { data, error } = await createAdminClient()
    .from("audit_logs")
    .insert({
      action: input.action,
      entity_id: input.entityId ?? null,
      entity_type: input.entityType ?? null,
      metadata: input.metadata,
      user_id: input.userId ?? null,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new AppError(
      503,
      "AUDIT_UNAVAILABLE",
      "Unable to record audit event.",
    );
  }
  return data;
}

// Publishes a best-effort audit event without delaying the domain response.
function publishAuditEvent(
  input: z.infer<typeof auditSchema>,
): void {
  void recordAuditEvent(input).catch(() => {
    console.error(
      JSON.stringify({
        code: "AUDIT_WRITE_FAILED",
        event: "audit_write_failed",
        service: "reporting-service",
      }),
    );
  });
}

// Requires a signed gateway context for reporting data.
function authenticated(context: AuthContext | undefined): AuthContext {
  if (!context) throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
  return context;
}

// Resolves one active clinic account for role-scoped aggregates.
async function clinicAccountReference(
  userId: string,
): Promise<ClinicAccountReference> {
  const { data, error } = await createAdminClient()
    .from("clinic_accounts")
    .select("id,user_id,role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("role", ["admin", "doctor", "nurse"])
    .maybeSingle();
  if (error) {
    throw new AppError(
      503,
      "DATABASE_UNAVAILABLE",
      "Unable to resolve the clinic account.",
    );
  }
  if (!data) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "An active clinic account is required.",
    );
  }
  return data as ClinicAccountReference;
}
// Loads minimized role-scoped dashboard counts without returning source rows.
async function dashboardAggregate(
  role: "admin" | "doctor" | "nurse",
  clinicAccountId: string | null,
): Promise<unknown> {
  const admin = createAdminClient();
  let appointments = admin
    .from("appointments")
    .select("id", { count: "exact", head: true });
  let consultations = admin
    .from("consultations")
    .select("id", { count: "exact", head: true });
  let completed = admin
    .from("consultations")
    .select("id", { count: "exact", head: true })
    .eq("status", "completed");
  if (clinicAccountId) {
    appointments = appointments.eq("doctor_id", clinicAccountId);
    const assignmentColumn = role === "nurse" ? "nurse_id" : "doctor_id";
    consultations = consultations.eq(assignmentColumn, clinicAccountId);
    completed = completed.eq(assignmentColumn, clinicAccountId);
  }
  const [appointmentResult, consultationResult, completedResult, incidentResult, stockResult] =
    await Promise.all([
      appointments,
      consultations,
      completed,
      admin.from("incidents").select("id", { count: "exact", head: true }),
      admin
        .from("medicine_stock")
        .select("id", { count: "exact", head: true })
        .lte("quantity", 0),
    ]);
  const error =
    appointmentResult.error ??
    consultationResult.error ??
    completedResult.error ??
    incidentResult.error ??
    stockResult.error;
  if (error) throw new AppError(503, "DATABASE_UNAVAILABLE", "Unable to load dashboard.");
  return {
    appointments: appointmentResult.count ?? 0,
    completedConsultations: completedResult.count ?? 0,
    consultations: consultationResult.count ?? 0,
    incidents: incidentResult.count ?? 0,
    zeroStockBatches: stockResult.count ?? 0,
  };
}

// Maps worker-specific states to the stable public job contract.
export function normalizeJobStatus(
  status: string,
): "queued" | "processing" | "succeeded" | "failed" {
  if (status === "completed") return "succeeded";
  if (status === "dead_letter" || status === "expired") return "failed";
  return status === "processing" ? "processing" : "queued";
}

// Retrieves one report status after the protected RPC rechecks Admin ownership.
async function reportStatus(reportId: string, userId: string): Promise<ReportStatusRow> {
  const { data, error } = await createAdminClient().rpc("get_report_request_status", {
    requested_by: userId,
    requested_report_id: reportId,
  });
  const row = Array.isArray(data) ? (data[0] as ReportStatusRow | undefined) : undefined;
  if (error) {
    throw new AppError(
      503,
      "REPORT_UNAVAILABLE",
      "The report status is temporarily unavailable.",
    );
  }
  if (!row) {
    throw new AppError(
      404,
      "REPORT_NOT_FOUND",
      "The report request was not found.",
    );
  }
  return row;
}

// Resolves active Zentraq users or explicit recipients in the allowed domain.
async function resolveApprovedRecipients(
  requestedRecipients: string[],
  allowedDomain: string,
): Promise<string[]> {
  const recipients = Array.from(new Set(
    requestedRecipients.map((value) => value.trim().toLowerCase()),
  ));
  if (recipients.length === 0) return [];

  const explicitAllowlist = new Set(
    (process.env.GOOGLE_GMAIL_ALLOWED_RECIPIENTS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
  for (const recipient of recipients) {
    if (
      !recipient.endsWith(`@${allowedDomain}`) &&
      !explicitAllowlist.has(recipient)
    ) {
      throw new AppError(
        400,
        "REPORT_RECIPIENT_NOT_ALLOWED",
        "A report recipient is not approved.",
      );
    }
  }

  const { data, error } = await createAdminClient()
    .from("users")
    .select("email,is_active")
    .in("email", recipients)
    .eq("is_active", true);
  if (error) {
    throw new AppError(
      503,
      "REPORT_RECIPIENT_LOOKUP_FAILED",
      "Report recipients could not be verified.",
    );
  }
  const active = new Set(
    (data ?? []).map((row) => String(row.email).toLowerCase()),
  );
  if (
    recipients.some((recipient) =>
      !active.has(recipient) && !explicitAllowlist.has(recipient),
    )
  ) {
    throw new AppError(
      400,
      "REPORT_RECIPIENT_NOT_ALLOWED",
      "A report recipient is not an active approved account.",
    );
  }
  return recipients;
}
