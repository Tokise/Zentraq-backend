import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  createAdminClient,
  createUserClient,
  verifyInternalContext,
  type ZentraqRole,
} from "@zentraq/shared";

import {
  buildReportStatusContract,
  normalizeJobStatus,
  type ReportStatusRow,
} from "./app.js";
import { drainReportDeliveryJobs } from "./delivery-worker.js";
import { drainReportJobs } from "./worker.js";

export interface ReportingWorkerEnv {
  ENVIRONMENT?: string;
  INTERNAL_CONTEXT_SECRET?: string;
  INTERNAL_SERVICE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_URL?: string;
  GOOGLE_WORKSPACE_CLIENT_EMAIL?: string;
  GOOGLE_WORKSPACE_PRIVATE_KEY?: string;
  GOOGLE_WORKSPACE_ALLOWED_DOMAIN?: string;
  GOOGLE_DRIVE_FOLDER_ID?: string;
  GOOGLE_SHEETS_FOLDER_ID?: string;
  GOOGLE_GMAIL_ALLOWED_RECIPIENTS?: string;
}

const ALLOWED_ORIGINS = [
  "https://bcp.tokise.pw",
  "https://tokise.pw",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, x-request-id, x-zentraq-context, x-zentraq-signature, x-zentraq-service-key, apikey",
  };
}

function jsonResponse(data: unknown, status = 200, origin: string | null = null, extraHeaders: Record<string, string> = {}): Response {
  return Response.json(data, {
    status,
    headers: {
      "content-type": "application/json",
      ...corsHeaders(origin),
      ...extraHeaders,
    },
  });
}

function syncEnv(env: ReportingWorkerEnv): void {
  if (typeof process === "undefined" || !process.env) return;
  if (env.SUPABASE_URL) process.env.SUPABASE_URL = env.SUPABASE_URL;
  const secretKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  if (secretKey) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = secretKey;
    process.env.SUPABASE_SECRET_KEY = secretKey;
  }
  const anonKey = env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY;
  if (anonKey) {
    process.env.SUPABASE_ANON_KEY = anonKey;
    process.env.SUPABASE_PUBLISHABLE_KEY = anonKey;
  }
  if (env.INTERNAL_CONTEXT_SECRET) process.env.INTERNAL_CONTEXT_SECRET = env.INTERNAL_CONTEXT_SECRET;
  if (env.INTERNAL_SERVICE_KEY) process.env.INTERNAL_SERVICE_KEY = env.INTERNAL_SERVICE_KEY;
  if (env.GOOGLE_WORKSPACE_CLIENT_EMAIL) process.env.GOOGLE_WORKSPACE_CLIENT_EMAIL = env.GOOGLE_WORKSPACE_CLIENT_EMAIL;
  if (env.GOOGLE_WORKSPACE_PRIVATE_KEY) process.env.GOOGLE_WORKSPACE_PRIVATE_KEY = env.GOOGLE_WORKSPACE_PRIVATE_KEY;
  if (env.GOOGLE_WORKSPACE_ALLOWED_DOMAIN) process.env.GOOGLE_WORKSPACE_ALLOWED_DOMAIN = env.GOOGLE_WORKSPACE_ALLOWED_DOMAIN;
  if (env.GOOGLE_DRIVE_FOLDER_ID) process.env.GOOGLE_DRIVE_FOLDER_ID = env.GOOGLE_DRIVE_FOLDER_ID;
  if (env.GOOGLE_SHEETS_FOLDER_ID) process.env.GOOGLE_SHEETS_FOLDER_ID = env.GOOGLE_SHEETS_FOLDER_ID;
  if (env.GOOGLE_GMAIL_ALLOWED_RECIPIENTS) process.env.GOOGLE_GMAIL_ALLOWED_RECIPIENTS = env.GOOGLE_GMAIL_ALLOWED_RECIPIENTS;
}

const reportRequestSchema = z
  .object({
    endDate: z.iso.date(),
    idempotencyKey: z
      .string()
      .regex(/^[A-Za-z0-9._:-]{8,128}$/)
      .optional(),
    reportType: z.enum([
      "clinic-aggregate",
      "annual_physical",
      "daily_census",
      "demographic_summary",
      "inventory_audit",
      "monthly_aggregate",
      "monthly_consultation_summary",
      "morbidity_census",
      "student_health_record",
    ]),
    startDate: z.iso.date(),
  })
  .refine((value) => value.startDate <= value.endDate, {
    message: "The report period is invalid.",
  });

interface ResolvedAuth {
  roles: ZentraqRole[];
  userId: string;
}

async function authenticateRequest(
  request: Request,
  env: ReportingWorkerEnv,
  requestId: string,
): Promise<ResolvedAuth | null> {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice(7).trim();
    const admin = createAdminClient();
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (!userError && user) {
      const { data: account } = await admin
        .from("clinic_accounts")
        .select("role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      const roles = (account?.role ? [account.role] : ["admin"]) as ZentraqRole[];
      return { userId: user.id, roles };
    }
  }

  const serviceKey = request.headers.get("x-zentraq-service-key");
  const expectedKey = env.INTERNAL_SERVICE_KEY ?? process.env.INTERNAL_SERVICE_KEY;
  if (serviceKey && expectedKey && serviceKey.trim() === expectedKey.trim()) {
    const userId = request.headers.get("x-zentraq-user-id") || "c2f23533-e2f5-4ad5-b7f7-55967957e387";
    return { userId, roles: ["admin"] as ZentraqRole[] };
  }

  const contextSecret = env.INTERNAL_CONTEXT_SECRET ?? process.env.INTERNAL_CONTEXT_SECRET;
  const payload = request.headers.get("x-zentraq-context");
  const signature = request.headers.get("x-zentraq-signature");
  if (payload && signature && contextSecret) {
    try {
      const auth = verifyInternalContext(payload, signature, contextSecret, requestId);
      return { userId: auth.userId, roles: auth.roles };
    } catch {
      return null;
    }
  }

  return null;
}

export default {
  async fetch(request: Request, env: ReportingWorkerEnv, ctx: ExecutionContext): Promise<Response> {
    syncEnv(env);
    const origin = request.headers.get("origin");

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/$/, "");
    const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

    if (pathname === "/health") {
      return jsonResponse({ service: "reporting-service", status: "ok" }, 200, origin);
    }

    // Internal drain triggers
    if (pathname === "/internal/workers/reports/drain" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { batchSize?: unknown };
      const summary = await drainReportJobs(body.batchSize);
      return jsonResponse({ data: summary }, 200, origin);
    }

    if (pathname === "/internal/workers/report-deliveries/drain" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { batchSize?: unknown };
      const summary = await drainReportDeliveryJobs(body.batchSize, {
        internalServiceKey: env.INTERNAL_SERVICE_KEY,
      });
      return jsonResponse({ data: summary }, 200, origin);
    }

    // Authenticate API routes
    const auth = await authenticateRequest(request, env, requestId);
    if (!auth) {
      return jsonResponse(
        { error: { code: "UNAUTHENTICATED", message: "A valid access token or context is required." } },
        401,
        origin,
        { "x-request-id": requestId },
      );
    }

    // POST /api/v1/reports or /api/v1/report-jobs
    if ((pathname === "/api/v1/reports" || pathname === "/api/v1/report-jobs") && request.method === "POST") {
      if (!auth.roles.includes("admin")) {
        return jsonResponse({ error: { code: "FORBIDDEN", message: "Admin role is required." } }, 403, origin);
      }
      const body = await request.json().catch(() => ({}));
      const parsed = reportRequestSchema.safeParse(body);
      if (!parsed.success) {
        return jsonResponse({ error: { code: "VALIDATION_ERROR", message: "Invalid report request." } }, 400, origin);
      }

      const idempotencyKey =
        parsed.data.idempotencyKey ??
        [parsed.data.reportType, parsed.data.startDate, parsed.data.endDate].join(":");

      const admin = createAdminClient();
      const { data, error } = await admin.rpc("enqueue_report_request", {
        requested_by: auth.userId,
        requested_correlation_id: randomUUID(),
        requested_end_date: parsed.data.endDate,
        requested_idempotency_key: idempotencyKey,
        requested_report_type: parsed.data.reportType,
        requested_start_date: parsed.data.startDate,
      });

      if (error || typeof data !== "string") {
        console.error("enqueue_report_request failed:", error, "data:", data);
        return jsonResponse({ error: { code: "REPORT_UNAVAILABLE", message: "The report could not be queued." } }, 503, origin);
      }

      // Automatically drain job in background using waitUntil
      ctx.waitUntil(drainReportJobs(2));

      return jsonResponse(
        { data: { jobId: data, requestId: data, status: "queued" } },
        202,
        origin,
        { "x-request-id": requestId },
      );
    }

    // GET /api/v1/reports/:reportId or /api/v1/report-jobs/:reportId
    const reportMatch = pathname.match(/^\/api\/v1\/(?:reports|report-jobs)\/([0-9a-fA-F-]{36})$/);
    if (reportMatch && request.method === "GET") {
      const reportId = reportMatch[1];
      const admin = createAdminClient();
      const { data, error } = await admin.rpc("get_report_request_status", {
        requested_by: auth.userId,
        requested_report_id: reportId,
      });
      const row = Array.isArray(data) ? (data[0] as ReportStatusRow | undefined) : undefined;
      if (error || !row) {
        return jsonResponse(
          { error: { code: "REPORT_NOT_FOUND", message: "Report request was not found." } },
          404,
          origin,
        );
      }
      return jsonResponse({ data: buildReportStatusContract(row, requestId) }, 200, origin);
    }

    // GET /api/v1/reports/:reportId/download or result
    const downloadMatch = pathname.match(/^\/api\/v1\/(?:reports|report-jobs)\/([0-9a-fA-F-]{36})\/(?:download|result)$/);
    if (downloadMatch && request.method === "GET") {
      const reportId = downloadMatch[1];
      const admin = createAdminClient();
      const { data, error } = await admin.rpc("get_report_request_status", {
        requested_by: auth.userId,
        requested_report_id: reportId,
      });
      const row = Array.isArray(data) ? (data[0] as ReportStatusRow | undefined) : undefined;
      if (error || !row || row.status !== "completed" || !row.artifact_path) {
        return jsonResponse(
          { error: { code: "REPORT_NOT_READY", message: "The report download is unavailable." } },
          409,
          origin,
        );
      }

      const signed = await admin.storage.from("generated-reports").createSignedUrl(row.artifact_path, 300, {
        download: `zentraq-report-${new Date().toISOString().slice(0, 10)}.xlsx`,
      });

      if (signed.error || !signed.data?.signedUrl) {
        return jsonResponse(
          { error: { code: "DOWNLOAD_FAILED", message: "Unable to create report download URL." } },
          503,
          origin,
        );
      }

      return jsonResponse(
        {
          data: {
            downloadUrl: signed.data.signedUrl,
            url: signed.data.signedUrl,
            expiresIn: 300,
          },
        },
        200,
        origin,
      );
    }

    return jsonResponse({ error: { code: "NOT_FOUND", message: "Not found" } }, 404, origin);
  },

  async scheduled(_controller: ScheduledController, env: ReportingWorkerEnv, ctx: ExecutionContext): Promise<void> {
    syncEnv(env);
    ctx.waitUntil(
      Promise.all([
        drainReportJobs(2),
        drainReportDeliveryJobs(2, { internalServiceKey: env.INTERNAL_SERVICE_KEY }),
      ]).catch((err) => {
        console.error("Scheduled report drainage error:", err);
      }),
    );
  },
};
export { buildReportStatusContract, normalizeJobStatus };
