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
import { createAdminClient } from "@/utils/supabase/admin"

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

    // Insert rich notification for the user when downloading a report
    const now = new Date()
    const timeString = now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })
    void createAdminClient()
      .from("notifications")
      .insert({
        receiver_id: actor.id,
        sender_id: actor.id,
        title: "Clinic Report Export Downloaded",
        message: `Your requested aggregate report (Ref: ${parsedRequestId.data.slice(0, 8)}) was generated and downloaded successfully at ${timeString}.`,
        type: "system",
        related_resource: "report",
        related_resource_id: parsedRequestId.data,
      })

    return { error: null, url: data.url }
  } catch {
    return {
      error: "The report download is unavailable.",
      url: null,
    }
  }
}

// Dispatches the 5:00 PM Clinic Out-Time Summary notification to all active clinic staff.
export async function dispatchDaily5pmReportNotificationAction() {
  const actor = await getActionActor()
  if (!actor || !hasAnyRole(actor, ["admin", "doctor", "nurse"])) {
    return { error: "Unauthorized" }
  }
  const admin = createAdminClient()

  const { data: staffAccounts } = await admin
    .from("clinic_accounts")
    .select("user_id")
    .eq("is_active", true)

  const staffUserIds = Array.from(
    new Set(
      (staffAccounts ?? [])
        .map((account) => account.user_id)
        .filter(Boolean),
    ),
  )

  const now = new Date()
  const timeString = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })

  const notifications = staffUserIds.map((userId) => ({
    receiver_id: userId,
    sender_id: actor.id,
    title: "5:00 PM Daily Clinic Summary Report Ready",
    message: `Clinic service hours have concluded for today (5:00 PM Out-Time). Your daily operational summary report (compiled at ${timeString}) is ready to review and download.`,
    type: "system",
    related_resource: "report",
  }))

  if (notifications.length > 0) {
    await admin.from("notifications").insert(notifications)
  }

  return { success: true, count: notifications.length }
}
