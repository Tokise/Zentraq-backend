"use server"

import { authenticatedApiRequest } from "@/lib/api/server"
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

interface ReportStatusResponse {
  errorCode: string | null
  id: string
  status: ReportRequestStatus
}

export interface RequestAggregateReportResult {
  error?: string
  requestId?: string
  success?: boolean
}

// Enqueues one Admin-owned aggregate report through reporting-service.
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
  if (!parsed.success) {
    return { error: "The report request is invalid." }
  }
  const rate = checkRateLimit(
    `report-request:${actor.id}`,
    5,
    60 * 1000,
  )
  if (!rate.success) {
    return {
      error: "Too many report requests. Try again shortly.",
    }
  }

  const idempotencyKey = [
    parsed.data.reportType,
    parsed.data.startDate,
    parsed.data.endDate,
  ].join(":")
  try {
    const { data } = await authenticatedApiRequest<{
      jobId: string
      requestId: string
      status: "queued"
    }>("/api/v1/report-jobs", {
      method: "POST",
      body: {
        ...parsed.data,
        idempotencyKey,
      },
    })
    return {
      requestId: data.jobId,
      success: true,
    }
  } catch {
    return { error: "The report could not be queued." }
  }
}

// Returns one Admin-owned normalized report status through the gateway.
export async function getAggregateReportStatusAction(
  requestId: string,
) {
  const actor = await getActionActor()
  if (!actor || !hasAnyRole(actor, ["admin"])) {
    return { error: "Unauthorized", report: null }
  }
  const parsedRequestId =
    reportRequestIdSchema.safeParse(requestId)
  if (!parsedRequestId.success) {
    return {
      error: "The report request is unavailable.",
      report: null,
    }
  }

  try {
    const { data } =
      await authenticatedApiRequest<ReportStatusResponse>(
        `/api/v1/report-jobs/${parsedRequestId.data}`,
      )
    return {
      error: null,
      report: data,
    }
  } catch {
    return {
      error: "The report request is unavailable.",
      report: null,
    }
  }
}

// Requests a short-lived report URL after the backend rechecks ownership.
export async function getAggregateReportDownloadUrlAction(
  requestId: string,
) {
  const actor = await getActionActor()
  if (!actor || !hasAnyRole(actor, ["admin"])) {
    return { error: "Unauthorized", url: null }
  }
  if (!(await assertSameOrigin())) {
    return { error: "Invalid request origin", url: null }
  }
  const parsedRequestId =
    reportRequestIdSchema.safeParse(requestId)
  if (!parsedRequestId.success) {
    return {
      error: "The report download is unavailable.",
      url: null,
    }
  }

  try {
    const { data } = await authenticatedApiRequest<{
      expiresIn: number
      url: string
    }>(
      `/api/v1/report-jobs/${parsedRequestId.data}/result`,
    )
    return { error: null, url: data.url }
  } catch {
    return {
      error: "The report download is unavailable.",
      url: null,
    }
  }
}
