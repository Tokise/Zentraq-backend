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
  serviceRequest,
  type AuthContext,
} from "@zentraq/shared";

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
  identityServiceUrl?: string;
  internalServiceKey?: string;
  timeoutMs?: number;
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
  const identityServiceUrl =
    dependencies.identityServiceUrl ??
    process.env.IDENTITY_SERVICE_URL ??
    "http://localhost:4001";
  const timeoutMs = dependencies.timeoutMs ?? Number(process.env.SERVICE_TIMEOUT_MS ?? 8_000);

  app.post(
    "/internal/audit",
    requireInternalServiceKey(internalServiceKey),
    asyncRoute(async (request, response) => {
      const parsed = auditSchema.safeParse(request.body);
      if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid audit event.");
      sendData(response, await recordAuditEvent(parsed.data), 201);
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
          : await serviceRequest<ClinicAccountReference>(
              `${identityServiceUrl}/internal/users/${auth.userId}/clinic-account`,
              { requestId: request.requestId, serviceKey: internalServiceKey, timeoutMs },
            );
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
