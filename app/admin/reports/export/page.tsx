"use client"

import { useState, useCallback } from "react"
import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Download, FileSpreadsheet } from "lucide-react"
import { toast } from "sonner"
import {
  getAnalyticsOverviewAction,
  getComplaintFrequencyAction,
  getDailyConsultationsAction,
  getDispensingSummaryAction,
} from "@/actions/reports/analytics"
import { downloadAggregateReport } from "@/lib/reports/serverless-download"

export default function AdminReportsExportPage() {
  const [exporting, setExporting] = useState<string | null>(null)

  // Downloads all authorized aggregate reports with an embedded chart image.
  const exportExcel = useCallback(async () => {
    setExporting("excel")
    try {
      const overview = await getAnalyticsOverviewAction()
      if (overview.error || !overview.overview) {
        throw new Error(overview.error ?? "Report summary is unavailable")
      }
      await downloadAggregateReport({
        endDate: overview.overview.period_end,
        startDate: overview.overview.period_start,
      })
      toast.success("Excel workbook downloaded")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Excel export failed",
      )
    } finally {
      setExporting(null)
    }
  }, [])

  const exportCSV = useCallback(async (type: "consultations" | "complaints" | "dispensing") => {
    setExporting(type)
    try {
      let rows: Array<Array<string | number | null>> = []
      let headers: string[] = []

      if (type === "consultations") {
        const res = await getDailyConsultationsAction()
        if (res.error) throw new Error(res.error)
        rows = res.data.map((item) => [
          item.consultation_date,
          item.total_consultations,
          item.student_consultations,
          item.faculty_consultations,
          item.appointment_visits,
          item.rfid_visits,
        ])
        headers = [
          "Date",
          "Total",
          "Students",
          "Faculty",
          "Appointments",
          "RFID Walk-ins",
        ]
      } else if (type === "complaints") {
        const res = await getComplaintFrequencyAction()
        if (res.error) throw new Error(res.error)
        rows = res.data.map((item) => [item.complaint, item.frequency])
        headers = ["Complaint", "Frequency"]
      } else {
        const res = await getDispensingSummaryAction()
        if (res.error) throw new Error(res.error)
        rows = res.data.map((item) => [
          item.generic_name,
          item.category,
          item.total_dispensed,
          item.total_quantity_dispensed,
        ])
        headers = ["Medicine", "Category", "Total Dispensed", "Total Quantity"]
      }

      const csvRows = [headers.join(",")]
      for (const row of rows) {
        const values = row.map(
          (value) => `"${String(value ?? "").replace(/"/g, '""')}"`,
        )
        csvRows.push(values.join(","))
      }

      const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `zentraq-${type}-${new Date().toISOString().split("T")[0]}.csv`
      link.click()
      URL.revokeObjectURL(url)
      toast.success("Report exported")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed")
    } finally {
      setExporting(null)
    }
  }, [])

  const exportTypes = [
    {
      key: "consultations" as const,
      title: "Consultation Report",
      description: "Daily consultation counts by patient type and visit type.",
      icon: FileSpreadsheet,
    },
    {
      key: "complaints" as const,
      title: "Complaint Frequency Report",
      description: "Most common complaints seen in the clinic.",
      icon: FileSpreadsheet,
    },
    {
      key: "dispensing" as const,
      title: "Dispensing Summary Report",
      description: "Medicine dispensing totals by product.",
      icon: FileSpreadsheet,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Export Reports"
        description="Download clinic-wide aggregate reports as Excel or individual CSV files."
      />

      <Card className="border-primary/25 bg-primary-soft/40 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-primary" />
            <CardTitle className="text-base font-semibold">
              Complete Excel Analytics Workbook
            </CardTitle>
          </div>
          <CardDescription>
            Includes summary metrics, separate aggregate data sheets, and an
            embedded image of the daily consultation report.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            disabled={exporting !== null}
            onClick={() => void exportExcel()}
            type="button"
          >
            {exporting === "excel" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {exporting === "excel"
              ? "Preparing workbook..."
              : "Download Excel workbook"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {exportTypes.map((t) => (
          <Card key={t.key} className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <t.icon className="size-5 text-zinc-400" />
                <CardTitle className="text-sm font-semibold">{t.title}</CardTitle>
              </div>
              <CardDescription className="text-xs">{t.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportCSV(t.key)}
                disabled={exporting === t.key}
                className="cursor-pointer"
              >
                {exporting === t.key ? (
                  <><Loader2 className="size-3.5 animate-spin mr-1" /> Exporting...</>
                ) : (
                  <><Download className="size-3.5 mr-1" /> Export CSV</>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
