"use server"

import { randomUUID } from "node:crypto"
import { logAuditEvent } from "@/lib/audit-logger"
import { checkRateLimit } from "@/lib/rate-limit"
import {
  reportRequestSchema,
  reportRequestIdSchema,
  type ReportRequestStatus,
} from "@/lib/serverless/report-contracts"
import {
  assertSameOrigin,
  getActionActor,
  hasAnyRole,
} from "@/lib/security/action-guard"
import { createAdminClient } from "@/utils/supabase/admin"

type ReportStatusRow = {
  artifact_expires_at: string | null
  artifact_path: string | null
  error_code: string | null
  id: string
  status: ReportRequestStatus
}

export interface RequestAggregateReportResult {
  error?: string
  requestId?: string
  success?: boolean
}

// Enqueues one Admin-owned aggregate report for the dedicated report worker.
export async function requestAggregateReportAction(
  input: unknown,
): Promise<RequestAggregateReportResult> {
  const actor = await getActionActor()
  if (!actor || !hasAnyRole(actor, ["admin"])) {
    return { error: "Unauthorized" }
  }
  if (!(await assertSameOrigin())) {
    return { error: "Invalid request origin" }
  }

  const parsed = reportRequestSchema.safeParse(input)
  if (!parsed.success) return { error: "The report request is invalid." }
  const rate = checkRateLimit(`report-request:${actor.id}`, 5, 60 * 1000)
  if (!rate.success) {
    return { error: "Too many report requests. Try again shortly." }
  }

  const idempotencyKey = [
    parsed.data.reportType,
    parsed.data.startDate,
    parsed.data.endDate,
  ].join(":")
  const { data, error } = await createAdminClient().rpc(
    "enqueue_report_request",
    {
      requested_by: actor.id,
      requested_correlation_id: randomUUID(),
      requested_end_date: parsed.data.endDate,
      requested_idempotency_key: idempotencyKey,
      requested_report_type: parsed.data.reportType,
      requested_start_date: parsed.data.startDate,
    },
  )
  if (error || typeof data !== "string") {
    return { error: "The report could not be queued." }
  }

  await logAuditEvent({
    action: "REPORT_REQUESTED",
    userId: actor.id,
    email: actor.email,
    resource: data,
    details: {
      end_date: parsed.data.endDate,
      report_type: parsed.data.reportType,
      start_date: parsed.data.startDate,
    },
  })
  return { requestId: data, success: true }
}

// Returns one Admin-owned report status without exposing its Storage path.
export async function getAggregateReportStatusAction(requestId: string) {
  const actor = await getActionActor()
  if (!actor || !hasAnyRole(actor, ["admin"])) {
    return { error: "Unauthorized", report: null }
  }
  const parsedRequestId = reportRequestIdSchema.safeParse(requestId)
  if (!parsedRequestId.success) {
    return { error: "The report request is unavailable.", report: null }
  }

  const { data, error } = await createAdminClient().rpc(
    "get_report_request_status",
    {
      requested_by: actor.id,
      requested_report_id: parsedRequestId.data,
    },
  )
  const row = Array.isArray(data) ? data[0] as ReportStatusRow | undefined : null
  if (error || !row) {
    return { error: "The report request is unavailable.", report: null }
  }

  return {
    error: null,
    report: {
      errorCode: row.error_code,
      id: row.id,
      status: row.status,
    },
  }
}

// Issues a five-minute signed URL after rechecking Admin ownership and expiry.
export async function getAggregateReportDownloadUrlAction(requestId: string) {
  const actor = await getActionActor()
  if (!actor || !hasAnyRole(actor, ["admin"])) {
    return { error: "Unauthorized", url: null }
  }
  if (!(await assertSameOrigin())) {
    return { error: "Invalid request origin", url: null }
  }
  const parsedRequestId = reportRequestIdSchema.safeParse(requestId)
  if (!parsedRequestId.success) {
    return { error: "The report download is unavailable.", url: null }
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc("get_report_request_status", {
    requested_by: actor.id,
    requested_report_id: parsedRequestId.data,
  })
  const row = Array.isArray(data) ? data[0] as ReportStatusRow | undefined : null
  if (
    error ||
    !row ||
    row.status !== "completed" ||
    !row.artifact_path ||
    !row.artifact_expires_at ||
    new Date(row.artifact_expires_at).getTime() <= Date.now()
  ) {
    return { error: "The report download is unavailable.", url: null }
  }

  const signed = await admin.storage
    .from("generated-reports")
    .createSignedUrl(row.artifact_path, 5 * 60, {
      download: `zentraq-clinic-report-${new Date().toISOString().slice(0, 10)}.xlsx`,
    })
  if (signed.error || !signed.data.signedUrl) {
    return { error: "The report download is unavailable.", url: null }
  }

  await logAuditEvent({
    action: "REPORT_DOWNLOADED",
    userId: actor.id,
    email: actor.email,
    resource: parsedRequestId.data,
  })
  return { error: null, url: signed.data.signedUrl }
}
