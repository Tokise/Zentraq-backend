import {
  AppError,
  createAdminClient,
  requireStrongSecret,
  serviceRequest,
} from "@zentraq/shared";

import {
  createGoogleWorkspacePublisher,
  GoogleWorkspaceError,
  type GoogleWorkspacePublisher,
  type ReportAnalyticsSnapshot,
} from "./google-workspace.js";

const DELIVERY_VISIBILITY_TIMEOUT_SECONDS = 180;

interface ClaimedDelivery {
  correlation_id: string;
  delivery_job_id: string;
  message_id: number | string;
}

interface DeliveryPayload extends ReportAnalyticsSnapshot {
  artifactPath: string;
  completedEmails: Record<string, string>;
  driveFileId: string | null;
  driveWebViewLink: string | null;
  emailRecipients: string[];
  idempotencyKey: string;
  periodEnd: string;
  periodStart: string;
  publishToSheets: boolean;
  reportId: string;
  reportName: string;
  requestedBy: string;
  sheetsPublishedAt: string | null;
  sheetsSnapshotId: string | null;
  uploadToDrive: boolean;
}

export interface DeliveryWorkerSummary {
  claimed: number;
  completed: number;
  failed: number;
}

interface DeliveryWorkerDependencies {
  internalServiceKey?: string;
  notificationServiceUrl?: string;
  publisher?: GoogleWorkspacePublisher | null;
}

// Bounds external delivery concurrency to protect provider quotas.
export function deliveryBatchSize(value: unknown): number {
  if (!Number.isInteger(value)) return 2;
  return Math.max(1, Math.min(Number(value), 2));
}

// Claims and processes isolated external-delivery jobs.
export async function drainReportDeliveryJobs(
  requestedBatchSize: unknown,
  dependencies: DeliveryWorkerDependencies = {},
): Promise<DeliveryWorkerSummary> {
  const admin = createAdminClient();
  const claimed = await admin.rpc("claim_report_delivery_jobs", {
    requested_batch_size: deliveryBatchSize(requestedBatchSize),
    requested_visibility_timeout: DELIVERY_VISIBILITY_TIMEOUT_SECONDS,
  });
  if (claimed.error) {
    throw new AppError(
      503,
      "REPORT_DELIVERY_QUEUE_UNAVAILABLE",
      "Report delivery jobs are temporarily unavailable.",
    );
  }

  const jobs = Array.isArray(claimed.data)
    ? claimed.data as ClaimedDelivery[]
    : [];
  const publisher = dependencies.publisher ?? createGoogleWorkspacePublisher();
  const notificationServiceUrl = (
    dependencies.notificationServiceUrl ??
    process.env.NOTIFICATION_SERVICE_URL ??
    "http://localhost:4005"
  ).replace(/\/$/, "");
  const internalServiceKey =
    dependencies.internalServiceKey ??
    requireStrongSecret(
      process.env.INTERNAL_SERVICE_KEY,
      "INTERNAL_SERVICE_KEY",
    );
  let completed = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      const payloadResult = await admin.rpc(
        "get_report_delivery_payload",
        { requested_delivery_job_id: job.delivery_job_id },
      );
      if (payloadResult.error || !payloadResult.data) {
        throw new Error("REPORT_DELIVERY_PAYLOAD_UNAVAILABLE");
      }
      const payload = payloadResult.data as DeliveryPayload;
      if (!publisher) {
        throw new Error("GOOGLE_WORKSPACE_DISABLED");
      }

      let driveFileId = payload.driveFileId;
      let driveWebViewLink = payload.driveWebViewLink;
      if (payload.uploadToDrive && !driveFileId) {
        const artifact = await admin.storage
          .from("generated-reports")
          .download(payload.artifactPath);
        if (artifact.error || !artifact.data) {
          throw new Error("REPORT_ARTIFACT_UNAVAILABLE");
        }
        const uploaded = await publisher.uploadWorkbook({
          bytes: new Uint8Array(await artifact.data.arrayBuffer()),
          idempotencyKey: payload.idempotencyKey,
          reportId: payload.reportId,
        });
        driveFileId = uploaded.fileId;
        driveWebViewLink = uploaded.webViewLink;
        await requireRpcSuccess(
          admin.rpc("record_report_delivery_drive", {
            requested_delivery_job_id: job.delivery_job_id,
            requested_drive_file_id: driveFileId,
            requested_drive_web_view_link: driveWebViewLink,
          }),
          "REPORT_DELIVERY_DRIVE_STATE_FAILED",
        );
      }

      const publishedAt = payload.sheetsPublishedAt ?? new Date().toISOString();
      const snapshotId = payload.sheetsSnapshotId ?? job.delivery_job_id;
      if (payload.publishToSheets && !payload.sheetsSnapshotId) {
        await publisher.publishAnalytics(payload, snapshotId, publishedAt);
        await requireRpcSuccess(
          admin.rpc("record_report_delivery_sheets", {
            requested_delivery_job_id: job.delivery_job_id,
            requested_published_at: publishedAt,
            requested_snapshot_id: snapshotId,
          }),
          "REPORT_DELIVERY_SHEETS_STATE_FAILED",
        );
      }

      for (const recipient of payload.emailRecipients) {
        if (payload.completedEmails[recipient.toLowerCase()]) continue;
        if (!driveWebViewLink) {
          throw new Error("REPORT_DELIVERY_LINK_UNAVAILABLE");
        }
        const response = await serviceRequest<{ messageId: string }>(
          `${notificationServiceUrl}/internal/report-email`,
          {
            body: {
              deliveryJobId: job.delivery_job_id,
              generatedAt: publishedAt,
              recipient,
              reportName: payload.reportName,
              reportPeriod: `${payload.periodStart} to ${payload.periodEnd}`,
              restrictedDriveLink: driveWebViewLink,
              supportContact: "Contact the Zentraq clinic administrator.",
              templateKey: "report.ready",
            },
            requestId: job.correlation_id,
            serviceKey: internalServiceKey,
            timeoutMs: 15_000,
          },
        );
        await requireRpcSuccess(
          admin.rpc("record_report_delivery_email", {
            requested_delivery_job_id: job.delivery_job_id,
            requested_gmail_message_id: response.messageId,
            requested_recipient: recipient,
          }),
          "REPORT_DELIVERY_EMAIL_STATE_FAILED",
        );
      }

      await requireRpcSuccess(
        admin.rpc("complete_report_delivery_job", {
          requested_delivery_job_id: job.delivery_job_id,
          requested_message_id: job.message_id,
        }),
        "REPORT_DELIVERY_COMPLETION_FAILED",
      );
      completed += 1;
    } catch (error) {
      failed += 1;
      const errorCode = deliveryErrorCode(error);
      await admin.rpc("fail_report_delivery_job", {
        requested_delivery_job_id: job.delivery_job_id,
        requested_error_code: errorCode,
        requested_message_id: job.message_id,
      });
      console.error(JSON.stringify({
        code: errorCode,
        correlationId: job.correlation_id,
        event: "report_delivery_failed",
      }));
    }
  }

  return { claimed: jobs.length, completed, failed };
}

// Requires a state transition RPC to return a true result.
async function requireRpcSuccess(
  request: PromiseLike<{ data: unknown; error: unknown }>,
  code: string,
): Promise<void> {
  const result = await request;
  if (result.error || result.data !== true) throw new Error(code);
}

// Converts provider and worker errors to bounded, non-sensitive codes.
function deliveryErrorCode(error: unknown): string {
  if (error instanceof GoogleWorkspaceError) return error.code;
  if (error instanceof AppError) {
    return error.code.replace(/[^A-Z0-9_]/g, "_").slice(0, 64);
  }
  if (error instanceof Error) {
    return error.message.replace(/[^A-Z0-9_]/g, "_").slice(0, 64) ||
      "REPORT_DELIVERY_FAILED";
  }
  return "REPORT_DELIVERY_FAILED";
}
