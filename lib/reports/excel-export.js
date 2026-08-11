"use client"

const REPORT_COLORS = {
  amber: "#D97706",
  blue: "#2563EB",
  border: "#D7E2DC",
  green: "#15803D",
  greenDark: "#14532D",
  greenSoft: "#DCFCE7",
  muted: "#64748B",
  surface: "#FFFFFF",
  text: "#17201C",
}

// Downloads one aggregate clinic workbook with data tabs and a chart image.
export async function downloadClinicalReportWorkbook({
  overview,
  daily,
  complaints,
  dispensing,
}) {
  const ExcelJS = await loadExcelJs()
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "BCP Clinic Management System"
  workbook.created = new Date()
  workbook.modified = new Date()
  workbook.subject = "Aggregate clinic analytics"

  const summary = workbook.addWorksheet("Report Summary", {
    views: [{ showGridLines: false }],
  })
  const dailySheet = workbook.addWorksheet("Daily Activity", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
  })
  const complaintSheet = workbook.addWorksheet("Visit Reasons", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
  })
  const dispensingSheet = workbook.addWorksheet("Medicine Dispensing", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
  })

  buildSummarySheet(workbook, summary, overview, daily)
  buildDailySheet(dailySheet, daily)
  buildComplaintSheet(complaintSheet, complaints)
  buildDispensingSheet(dispensingSheet, dispensing)

  const output = await workbook.xlsx.writeBuffer()
  const blob = new Blob([output], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  downloadBlob(
    blob,
    `bcp-clinic-report-${new Date().toISOString().slice(0, 10)}.xlsx`,
  )
}

// Loads the operator-installed workbook dependency without a static client import.
async function loadExcelJs() {
  try {
    const excelJsModule = await import("exceljs")
    return excelJsModule.default ?? excelJsModule
  } catch {
    throw new Error(
      "Excel export is not installed. Run: pnpm add exceljs",
    )
  }
}

// Builds the workbook cover sheet and embeds a rendered aggregate activity chart.
function buildSummarySheet(workbook, sheet, overview, daily) {
  sheet.columns = [
    { key: "a", width: 23 },
    { key: "b", width: 18 },
    { key: "c", width: 4 },
    { key: "d", width: 23 },
    { key: "e", width: 18 },
    { key: "f", width: 18 },
    { key: "g", width: 18 },
    { key: "h", width: 18 },
  ]

  sheet.mergeCells("A1:H2")
  const title = sheet.getCell("A1")
  title.value = "Zentraq Clinic Analytics Report"
  title.font = { bold: true, color: "FFFFFFFF", size: 20 }
  title.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF14532D" },
  }
  title.alignment = { horizontal: "left", vertical: "middle" }

  sheet.mergeCells("A3:H3")
  const period = sheet.getCell("A3")
  period.value = overview
    ? `Reporting period: ${overview.period_start} to ${overview.period_end}`
    : "Reporting period: unavailable"
  period.font = { color: "FF64748B", italic: true, size: 10 }
  period.alignment = { vertical: "middle" }

  const metrics = [
    ["Total consultations", overview?.total_consultations ?? 0],
    ["Active incidents", overview?.active_incidents ?? 0],
    ["Pending clearances", overview?.pending_clearances ?? 0],
    ["Low-stock medicines", overview?.low_stock_medicines ?? 0],
  ]
  const metricCells = ["A5", "D5", "A8", "D8"]
  metrics.forEach(([label, value], index) => {
    const start = metricCells[index]
    const column = start.charAt(0)
    const row = Number(start.slice(1))
    const endColumn = column === "A" ? "B" : "E"
    sheet.mergeCells(`${column}${row}:${endColumn}${row}`)
    sheet.mergeCells(`${column}${row + 1}:${endColumn}${row + 1}`)

    const labelCell = sheet.getCell(`${column}${row}`)
    labelCell.value = label
    labelCell.font = { bold: true, color: "FF64748B", size: 10 }
    labelCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF0FDF4" },
    }

    const valueCell = sheet.getCell(`${column}${row + 1}`)
    valueCell.value = value
    valueCell.font = { bold: true, color: "FF14532D", size: 18 }
    valueCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF0FDF4" },
    }
    valueCell.numFmt = "#,##0"
  })

  if (daily.length > 0) {
    const imageId = workbook.addImage({
      base64: createActivityChartImage(daily),
      extension: "png",
    })

    // A cell range emits a valid two-cell anchor that desktop Excel accepts.
    sheet.addImage(imageId, "A12:H31")
  } else {
    sheet.mergeCells("A12:H14")
    const emptyState = sheet.getCell("A12")
    emptyState.value = "No activity data is available for this period."
    emptyState.font = { color: "FF64748B", italic: true, size: 11 }
    emptyState.alignment = { horizontal: "center", vertical: "middle" }
    emptyState.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF8FAF9" },
    }
  }
  sheet.getRow(1).height = 30
  sheet.getRow(2).height = 20
  sheet.getRow(3).height = 24
}

// Adds the daily clinic activity table using typed aggregate values.
function buildDailySheet(sheet, daily) {
  addReportTable(sheet, {
    name: "DailyClinicActivity",
    headers: [
      "Date",
      "Total Consultations",
      "Student Consultations",
      "Faculty Consultations",
      "Appointment Visits",
      "RFID Walk-ins",
    ],
    rows: daily.map((item) => [
      item.consultation_date,
      item.total_consultations,
      item.student_consultations,
      item.faculty_consultations,
      item.appointment_visits,
      item.rfid_visits,
    ]),
    emptyMessage: "No daily activity was recorded for this period.",
  })
  setColumnWidths(sheet, [15, 21, 23, 23, 17, 19, 14])
  formatCountColumns(sheet, 2, 7, daily.length + 1)
}

// Adds the bounded visit-reason frequency table.
function buildComplaintSheet(sheet, complaints) {
  addReportTable(sheet, {
    name: "VisitReasonFrequency",
    headers: ["Visit Reason", "Frequency"],
    rows: complaints.map((item) => [item.complaint, item.frequency]),
    emptyMessage: "No visit reasons were recorded for this period.",
  })
  setColumnWidths(sheet, [42, 16])
  formatCountColumns(sheet, 2, 2, complaints.length + 1)
}

// Adds the bounded aggregate medicine-dispensing table.
function buildDispensingSheet(sheet, dispensing) {
  addReportTable(sheet, {
    name: "MedicineDispensingSummary",
    headers: [
      "Generic Name",
      "Brand Name",
      "Category",
      "Dispensing Events",
      "Quantity Dispensed",
      "First Dispensed",
      "Last Dispensed",
    ],
    rows: dispensing.map((item) => [
      item.generic_name,
      item.brand_name ?? "",
      item.category ?? "",
      item.total_dispensed,
      item.total_quantity_dispensed,
      item.first_dispensed ?? "",
      item.last_dispensed ?? "",
    ]),
    emptyMessage: "No medicines were dispensed for this period.",
  })
  setColumnWidths(sheet, [28, 24, 22, 20, 20, 22, 22])
  formatCountColumns(sheet, 4, 5, dispensing.length + 1)
}

// Adds a filterable table only when at least one data row exists.
function addReportTable(sheet, { name, headers, rows, emptyMessage }) {
  if (rows.length > 0) {
    sheet.addTable({
      name,
      ref: "A1",
      headerRow: true,
      style: { theme: "TableStyleMedium4", showRowStripes: true },
      columns: headers.map((header) => ({ name: header })),
      rows,
    })
    return
  }

  sheet.addRow(headers)
  styleEmptyReportSheet(sheet, headers.length, emptyMessage)
}

// Renders a readable empty state without invalid one-row Excel table metadata.
function styleEmptyReportSheet(sheet, columnCount, emptyMessage) {
  const header = sheet.getRow(1)
  header.height = 24
  header.eachCell((cell) => {
    cell.font = { bold: true, color: "FFFFFFFF" }
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF15803D" },
    }
    cell.alignment = { vertical: "middle" }
  })

  sheet.mergeCells(2, 1, 2, columnCount)
  const emptyState = sheet.getCell(2, 1)
  emptyState.value = emptyMessage
  emptyState.font = { color: "FF64748B", italic: true }
  emptyState.alignment = { horizontal: "center", vertical: "middle" }
  emptyState.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF8FAF9" },
  }
  sheet.getRow(2).height = 32
}

// Applies readable widths without expanding unused worksheet columns.
function setColumnWidths(sheet, widths) {
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width
  })
}

// Applies count formatting and right alignment to numeric report columns.
function formatCountColumns(sheet, startColumn, endColumn, endRow) {
  for (let column = startColumn; column <= endColumn; column += 1) {
    const range = sheet.getColumn(column)
    range.numFmt = "#,##0"
    range.alignment = { horizontal: "right" }
  }
  for (let row = 2; row <= endRow; row += 1) {
    sheet.getRow(row).height = 22
  }
}

// Renders the aggregate daily trend into a PNG for workbook embedding.
function createActivityChartImage(daily) {
  const canvas = document.createElement("canvas")
  canvas.width = 1200
  canvas.height = 500
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Unable to render the report chart")

  context.fillStyle = REPORT_COLORS.surface
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = REPORT_COLORS.text
  context.font = "600 28px Arial, sans-serif"
  context.fillText("Daily Consultation Activity", 56, 54)
  context.fillStyle = REPORT_COLORS.muted
  context.font = "16px Arial, sans-serif"
  context.fillText("Aggregate clinic consultation counts by day", 56, 82)

  const points = [...daily]
    .sort((a, b) => a.consultation_date.localeCompare(b.consultation_date))
    .slice(-30)
  if (points.length === 0) {
    context.fillStyle = REPORT_COLORS.muted
    context.font = "18px Arial, sans-serif"
    context.fillText("No activity data is available for this period.", 56, 160)
    return canvas.toDataURL("image/png")
  }

  const plot = { left: 74, top: 112, width: 1060, height: 300 }
  const maximum = Math.max(
    1,
    ...points.map((item) => Number(item.total_consultations) || 0),
  )
  drawChartGrid(context, plot, maximum)

  context.beginPath()
  points.forEach((item, index) => {
    const x =
      points.length === 1
        ? plot.left + plot.width / 2
        : plot.left + (index / (points.length - 1)) * plot.width
    const y =
      plot.top +
      plot.height -
      ((Number(item.total_consultations) || 0) / maximum) * plot.height
    if (index === 0) context.moveTo(x, y)
    else context.lineTo(x, y)
  })
  context.strokeStyle = REPORT_COLORS.green
  context.lineWidth = 4
  context.lineJoin = "round"
  context.lineCap = "round"
  context.stroke()

  drawChartLabels(context, points, plot)
  return canvas.toDataURL("image/png")
}

// Draws restrained horizontal reference lines and numeric axis labels.
function drawChartGrid(context, plot, maximum) {
  context.font = "13px Arial, sans-serif"
  context.textAlign = "right"
  context.textBaseline = "middle"
  for (let index = 0; index <= 4; index += 1) {
    const y = plot.top + (index / 4) * plot.height
    const value = Math.round(maximum * (1 - index / 4))
    context.beginPath()
    context.moveTo(plot.left, y)
    context.lineTo(plot.left + plot.width, y)
    context.strokeStyle = REPORT_COLORS.border
    context.lineWidth = 1
    context.stroke()
    context.fillStyle = REPORT_COLORS.muted
    context.fillText(String(value), plot.left - 14, y)
  }
}

// Draws a bounded set of date labels so the embedded chart stays legible.
function drawChartLabels(context, points, plot) {
  const interval = Math.max(1, Math.ceil(points.length / 6))
  context.fillStyle = REPORT_COLORS.muted
  context.font = "13px Arial, sans-serif"
  context.textAlign = "center"
  context.textBaseline = "top"
  points.forEach((item, index) => {
    if (index % interval !== 0 && index !== points.length - 1) return
    const x =
      points.length === 1
        ? plot.left + plot.width / 2
        : plot.left + (index / (points.length - 1)) * plot.width
    context.fillText(item.consultation_date, x, plot.top + plot.height + 18)
  })
}

// Triggers a local browser download and promptly releases its object URL.
function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
