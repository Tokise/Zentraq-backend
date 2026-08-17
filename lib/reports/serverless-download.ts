"use client"

import {
  getAggregateReportDownloadUrlAction,
  getAggregateReportStatusAction,
  requestAggregateReportAction,
} from "@/actions/reports/exports"

const POLL_INTERVAL_MS = 1500
const REPORT_TIMEOUT_MS = 2 * 60 * 1000

interface DownloadReportInput {
  endDate: string
  startDate: string
}

// Downloads an aggregate workbook produced by the dedicated report worker.
export async function downloadAggregateReport(
  input: DownloadReportInput,
): Promise<void> {
  const request = await requestAggregateReportAction({
    endDate: input.endDate,
    reportType: "clinic-aggregate",
    startDate: input.startDate,
  })
  if (request.error) throw new Error(request.error)
  if (!request.requestId) {
    throw new Error(
      "The report request was not created.",
    )
  }

  const startedAt = Date.now()
  while (
    Date.now() - startedAt <
    REPORT_TIMEOUT_MS
  ) {
    await new Promise((resolve) =>
      window.setTimeout(resolve, POLL_INTERVAL_MS),
    )
    const status =
      await getAggregateReportStatusAction(
        request.requestId,
      )
    if (status.error || !status.report) {
      throw new Error(
        status.error ??
          "The report status is unavailable.",
      )
    }
    if (status.report.status === "failed") {
      throw new Error(
        "The report could not be generated.",
      )
    }
    if (status.report.status !== "succeeded") {
      continue
    }

    const download =
      await getAggregateReportDownloadUrlAction(
        request.requestId,
      )
    if (download.error || !download.url) {
      throw new Error(
        download.error ??
          "The report download is unavailable.",
      )
    }
    window.location.assign(download.url)
    return
  }

  throw new Error(
    "The report is still processing. Try again shortly.",
  )
}
