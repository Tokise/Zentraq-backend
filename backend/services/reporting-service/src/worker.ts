import { Buffer } from "node:buffer";

import { AppError, createAdminClient } from "@zentraq/shared";
import ExcelJS from "exceljs";
import { PNG } from "pngjs";

const REPORT_BUCKET = "generated-reports"
const VISIBILITY_TIMEOUT_SECONDS = 300
const REPORT_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

type ClaimedReport = {
  correlation_id: string
  message_id: number | string
  read_count: number
  report_id: string
}

type DailyRow = {
  appointment_visits: number
  consultation_date: string
  faculty_consultations: number
  rfid_visits: number
  student_consultations: number
  total_consultations: number
}

type ComplaintRow = { complaint: string; frequency: number }

type DispensingRow = {
  brand_name: string | null
  category: string | null
  first_dispensed: string | null
  generic_name: string
  last_dispensed: string | null
  medicine_id: string
  total_dispensed: number
  total_quantity_dispensed: number
}

type Overview = {
  active_incidents: number
  faculty_consultations: number
  low_stock_medicines: number
  pending_clearances: number
  period_end: string
  period_start: string
  student_consultations: number
  total_consultations: number
}

type ReportPayload = {
  complaints: ComplaintRow[]
  daily: DailyRow[]
  dispensing: DispensingRow[]
  overview: Overview
  reportId: string
  requestedBy: string
}

// Applies the shared report table style without creating invalid empty tables.
function addTable(
  sheet: ExcelJS.Worksheet,
  name: string,
  headers: string[],
  rows: Array<Array<string | number>>,
): void {
  if (rows.length > 0) {
    sheet.addTable({
      columns: headers.map((header) => ({ name: header })),
      headerRow: true,
      name,
      ref: "A1",
      rows,
      style: { showRowStripes: true, theme: "TableStyleMedium4" },
    })
    return
  }

  sheet.addRow(headers)
  const header = sheet.getRow(1)
  header.font = { bold: true, color: { argb: "FFFFFFFF" } }
  header.fill = {
    fgColor: { argb: "FF15803D" },
    pattern: "solid",
    type: "pattern",
  }
  sheet.mergeCells(2, 1, 2, headers.length)
  sheet.getCell(2, 1).value = "No aggregate data is available for this period."
}

// Draws one dependency-light PNG trend for embedding in desktop Excel.
function createTrendPng(daily: DailyRow[]): Uint8Array {
  const width = 1200
  const height = 480
  const image = new PNG({ height, width })

  for (let index = 0; index < image.data.length; index += 4) {
    image.data[index] = 255
    image.data[index + 1] = 255
    image.data[index + 2] = 255
    image.data[index + 3] = 255
  }

  const points = daily
    .slice()
    .sort((left, right) => left.consultation_date.localeCompare(right.consultation_date))
    .slice(-30)
  const plot = { left: 60, top: 35, width: 1080, height: 380 }
  const maximum = Math.max(
    1,
    ...points.map((item) => Number(item.total_consultations) || 0),
  )

  for (let line = 0; line <= 4; line += 1) {
    const y = Math.round(plot.top + (line / 4) * plot.height)
    drawLine(image, plot.left, y, plot.left + plot.width, y, [215, 226, 220])
  }

  points.forEach((point, index) => {
    if (index === 0) return
    const previous = points[index - 1]!
    const x1 = pointX(index - 1, points.length, plot)
    const x2 = pointX(index, points.length, plot)
    const y1 = pointY(previous.total_consultations, maximum, plot)
    const y2 = pointY(point.total_consultations, maximum, plot)
    drawLine(image, x1, y1, x2, y2, [21, 128, 61], 4)
  })

  return PNG.sync.write(image)
}

// Resolves one chart point's horizontal position.
function pointX(
  index: number,
  count: number,
  plot: { left: number; width: number },
): number {
  return count <= 1
    ? Math.round(plot.left + plot.width / 2)
    : Math.round(plot.left + (index / (count - 1)) * plot.width)
}

// Resolves one chart point's vertical position.
function pointY(
  value: number,
  maximum: number,
  plot: { height: number; top: number },
): number {
  return Math.round(
    plot.top + plot.height - (Number(value || 0) / maximum) * plot.height,
  )
}

// Draws a solid line into an RGBA PNG buffer.
function drawLine(
  image: PNG,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  color: [number, number, number],
  thickness = 1,
): void {
  const steps = Math.max(Math.abs(endX - startX), Math.abs(endY - startY), 1)
  for (let step = 0; step <= steps; step += 1) {
    const x = Math.round(startX + ((endX - startX) * step) / steps)
    const y = Math.round(startY + ((endY - startY) * step) / steps)
    for (let offsetX = -Math.floor(thickness / 2); offsetX <= Math.floor(thickness / 2); offsetX += 1) {
      for (let offsetY = -Math.floor(thickness / 2); offsetY <= Math.floor(thickness / 2); offsetY += 1) {
        setPixel(image, x + offsetX, y + offsetY, color)
      }
    }
  }
}

// Writes one bounded RGB pixel while preserving full opacity.
function setPixel(
  image: PNG,
  x: number,
  y: number,
  color: [number, number, number],
): void {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return
  const index = (image.width * y + x) * 4
  image.data[index] = color[0]
  image.data[index + 1] = color[1]
  image.data[index + 2] = color[2]
  image.data[index + 3] = 255
}

// Builds a bounded aggregate workbook with an embedded PNG trend.
async function buildWorkbook(payload: ReportPayload): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Zentraq Clinic Management System"
  workbook.created = new Date()
  workbook.modified = new Date()
  workbook.subject = "Aggregate clinic analytics"

  const summary = workbook.addWorksheet("Report Summary", {
    views: [{ showGridLines: false }],
  })
  summary.columns = Array.from({ length: 8 }, () => ({ width: 18 }))
  summary.mergeCells("A1:H2")
  const title = summary.getCell("A1")
  title.value = "Zentraq Clinic Analytics Report"
  title.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 20 }
  title.fill = {
    fgColor: { argb: "FF14532D" },
    pattern: "solid",
    type: "pattern",
  }
  title.alignment = { vertical: "middle" }
  summary.mergeCells("A3:H3")
  summary.getCell("A3").value =
    `Reporting period: ${payload.overview.period_start} to ${payload.overview.period_end}`

  const metrics: Array<[string, number, string]> = [
    ["Total consultations", payload.overview.total_consultations, "A5"],
    ["Active incidents", payload.overview.active_incidents, "D5"],
    ["Pending clearances", payload.overview.pending_clearances, "A8"],
    ["Low-stock medicines", payload.overview.low_stock_medicines, "D8"],
  ]
  for (const [label, value, cell] of metrics) {
    const column = cell[0]
    const row = Number(cell.slice(1))
    const endColumn = column === "A" ? "B" : "E"
    summary.mergeCells(`${column}${row}:${endColumn}${row}`)
    summary.mergeCells(`${column}${row + 1}:${endColumn}${row + 1}`)
    summary.getCell(cell).value = label
    summary.getCell(cell).font = { bold: true, color: { argb: "FF64748B" } }
    summary.getCell(`${column}${row + 1}`).value = value
    summary.getCell(`${column}${row + 1}`).font = {
      bold: true,
      color: { argb: "FF14532D" },
      size: 18,
    }
  }

  if (payload.daily.length > 0) {
    summary.mergeCells("A11:H11")
    summary.getCell("A11").value = "Daily consultation activity"
    summary.getCell("A11").font = { bold: true, size: 12 }
    const imageId = workbook.addImage({
      base64: `data:image/png;base64,${Buffer.from(
        createTrendPng(payload.daily),
      ).toString("base64")}`,
      extension: "png",
    })
    summary.addImage(imageId, "A12:H31")
  }

  const dailySheet = workbook.addWorksheet("Daily Activity", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
  })
  addTable(
    dailySheet,
    "DailyClinicActivity",
    [
      "Date",
      "Total",
      "Students",
      "Faculty",
      "Appointments",
      "RFID Walk-ins",
    ],
    payload.daily.map((item) => [
      item.consultation_date,
      item.total_consultations,
      item.student_consultations,
      item.faculty_consultations,
      item.appointment_visits,
      item.rfid_visits,
    ]),
  )
  dailySheet.columns.forEach((column) => { column.width = 18 })

  const complaintSheet = workbook.addWorksheet("Visit Reasons", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
  })
  addTable(
    complaintSheet,
    "VisitReasonFrequency",
    ["Visit Reason", "Frequency"],
    payload.complaints.map((item) => [item.complaint, item.frequency]),
  )
  complaintSheet.getColumn(1).width = 42
  complaintSheet.getColumn(2).width = 18

  const dispensingSheet = workbook.addWorksheet("Medicine Dispensing", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
  })
  addTable(
    dispensingSheet,
    "MedicineDispensingSummary",
    ["Generic Name", "Brand Name", "Category", "Events", "Quantity", "First", "Last"],
    payload.dispensing.map((item) => [
      item.generic_name,
      item.brand_name ?? "",
      item.category ?? "",
      item.total_dispensed,
      item.total_quantity_dispensed,
      item.first_dispensed ?? "",
      item.last_dispensed ?? "",
    ]),
  )
  dispensingSheet.columns.forEach((column) => { column.width = 22 })

  const output = await workbook.xlsx.writeBuffer()
  return new Uint8Array(output)
}

// Hashes an artifact for integrity metadata without logging its bytes.
async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes.slice().buffer as ArrayBuffer,
  )
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
}

// Removes expired private artifacts before claiming new work.
async function cleanupExpired(
  context: { supabaseAdmin: ReturnType<typeof createAdminClient> },
): Promise<void> {
  const expired = await context.supabaseAdmin.rpc(
    "list_expired_report_artifacts",
  )
  if (expired.error || !Array.isArray(expired.data)) return

  for (const item of expired.data as Array<{ artifact_path: string; id: string }>) {
    const removed = await context.supabaseAdmin.storage
      .from(REPORT_BUCKET)
      .remove([item.artifact_path])
    if (!removed.error) {
      await context.supabaseAdmin.rpc("mark_report_artifact_expired", {
        requested_report_id: item.id,
      })
    }
  }
}

export interface WorkerSummary {
  claimed: number;
  completed: number;
  failed: number;
}

// Bounds the expensive report generator to at most two jobs per wake.
export function reportBatchSize(value: unknown): number {
  if (!Number.isInteger(value)) return 2
  return Math.max(1, Math.min(Number(value), 2))
}

// Claims, generates, stores, and resolves one bounded report queue batch.
export async function drainReportJobs(
  requestedBatchSize: unknown,
): Promise<WorkerSummary> {
  const admin = createAdminClient()
  await cleanupExpired({ supabaseAdmin: admin })
  const claimed = await admin.rpc("claim_report_requests", {
    requested_batch_size: reportBatchSize(requestedBatchSize),
    requested_visibility_timeout: VISIBILITY_TIMEOUT_SECONDS,
  })
  if (claimed.error) {
    console.error(JSON.stringify({
      code: claimed.error.code ?? "DATABASE_ERROR",
      event: "report_claim_failed",
    }))
    throw new AppError(
      503,
      "REPORT_QUEUE_UNAVAILABLE",
      "Report jobs are temporarily unavailable.",
    )
  }

  const jobs = Array.isArray(claimed.data)
    ? claimed.data as ClaimedReport[]
    : []
  let completed = 0
  let failed = 0

  for (const job of jobs) {
    let artifactPath: string | null = null
    let requestedBy: string | null = null
    try {
      const payloadResult = await admin.rpc(
        "get_report_request_payload",
        { requested_report_id: job.report_id },
      )
      if (payloadResult.error || !payloadResult.data) {
        throw new Error("REPORT_PAYLOAD_UNAVAILABLE")
      }

      const payload = payloadResult.data as ReportPayload
      requestedBy = payload.requestedBy
      const bytes = await buildWorkbook(payload)
      artifactPath = `${payload.requestedBy}/${job.report_id}/report.xlsx`
      const uploaded = await admin.storage
        .from(REPORT_BUCKET)
        .upload(artifactPath, bytes, {
          contentType: REPORT_MIME,
          upsert: true,
        })
      if (uploaded.error) throw new Error("REPORT_UPLOAD_FAILED")

      const completion = await admin.rpc(
        "complete_report_request",
        {
          requested_artifact_path: artifactPath,
          requested_artifact_sha256: await sha256Hex(bytes),
          requested_artifact_size: bytes.byteLength,
          requested_message_id: job.message_id,
          requested_report_id: job.report_id,
        },
      )
      if (completion.error || completion.data !== true) {
        throw new Error("REPORT_COMPLETION_FAILED")
      }
      const notification = await admin
        .from("notifications")
        .insert({
          entity_id: job.report_id,
          entity_type: "report_request",
          message: "Your aggregate clinic report is ready to download.",
          receiver_id: payload.requestedBy,
          title: "Report ready",
          type: "system",
        })
      if (notification.error) {
        console.error(JSON.stringify({
          code: notification.error.code ?? "REPORT_NOTIFICATION_FAILED",
          correlationId: job.correlation_id,
          event: "report_notification_failed",
        }))
      }
      completed += 1
    } catch (error) {
      if (requestedBy) {
        const status = await admin.rpc(
          "get_report_request_status",
          {
            requested_by: requestedBy,
            requested_report_id: job.report_id,
          },
        )
        const row = Array.isArray(status.data) ? status.data[0] : null
        if (!status.error && row?.status === "completed") {
          completed += 1
          continue
        }
      }

      failed += 1
      if (artifactPath) {
        await admin.storage
          .from(REPORT_BUCKET)
          .remove([artifactPath])
      }
      const errorCode = error instanceof Error
        ? error.message.replace(/[^A-Z0-9_]/g, "_").slice(0, 64)
        : "REPORT_GENERATION_FAILED"
      await admin.rpc("fail_report_request", {
        requested_error_code: errorCode || "REPORT_GENERATION_FAILED",
        requested_message_id: job.message_id,
        requested_report_id: job.report_id,
      })
      console.error(JSON.stringify({
        code: errorCode || "REPORT_GENERATION_FAILED",
        correlationId: job.correlation_id,
        event: "report_generation_failed",
      }))
    }
  }

  return { claimed: jobs.length, completed, failed }
}


