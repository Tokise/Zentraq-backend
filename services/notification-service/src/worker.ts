import { AppError, createAdminClient } from "@zentraq/shared";

const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 20;
const VISIBILITY_TIMEOUT_SECONDS = 60;

interface NotificationJob {
  correlation_id: string;
  job_id: string;
  message_id: number | string;
}

export interface WorkerSummary {
  claimed: number;
  completed: number;
  failed: number;
}

// Bounds a caller-provided notification worker batch size.
export function notificationBatchSize(value: unknown): number {
  if (!Number.isInteger(value)) return DEFAULT_BATCH_SIZE;
  return Math.max(1, Math.min(Number(value), MAX_BATCH_SIZE));
}

// Claims and resolves one bounded notification queue batch atomically.
export async function drainNotificationJobs(
  requestedBatchSize: unknown,
): Promise<WorkerSummary> {
  const batchSize = notificationBatchSize(requestedBatchSize);
  const admin = createAdminClient();
  const notices = await admin.rpc("deliver_clinical_notices");
  if (notices.error) {
    console.error(JSON.stringify({
      event: "clinical_notice_delivery_failed",
      code: notices.error.code ?? "DATABASE_ERROR",
    }));
  }
  const claimed = await admin.rpc("claim_notification_jobs", {
    requested_batch_size: batchSize,
    requested_visibility_timeout: VISIBILITY_TIMEOUT_SECONDS,
  });
  if (claimed.error) {
    console.error(JSON.stringify({
      code: claimed.error.code ?? "DATABASE_ERROR",
      event: "notification_claim_failed",
    }));
    throw new AppError(
      503,
      "NOTIFICATION_QUEUE_UNAVAILABLE",
      "Notification jobs are temporarily unavailable.",
    );
  }

  const jobs = Array.isArray(claimed.data)
    ? claimed.data as NotificationJob[]
    : [];
  let completed = 0;
  let failed = 0;
  for (const job of jobs) {
    const completion = await admin.rpc("complete_notification_job", {
      requested_job_id: job.job_id,
      requested_message_id: job.message_id,
    });
    if (!completion.error && completion.data === true) {
      completed += 1;
      continue;
    }

    failed += 1;
    await admin.rpc("fail_notification_job", {
      requested_error_code: "DELIVERY_FAILED",
      requested_job_id: job.job_id,
      requested_message_id: job.message_id,
    });
    console.error(JSON.stringify({
      code: completion.error?.code ?? "DELIVERY_FAILED",
      correlationId: job.correlation_id,
      event: "notification_delivery_failed",
    }));
  }

  return { claimed: jobs.length, completed, failed };
}
