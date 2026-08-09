"use client"

import { useState, useCallback } from "react"
import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Download, FileSpreadsheet } from "lucide-react"
import { toast } from "sonner"
import { getDailyConsultations, getComplaintFrequency, getDispensingSummary } from "@/actions/reports/analytics"

export default function AdminReportsExportPage() {
  const [exporting, setExporting] = useState<string | null>(null)

  const exportCSV = useCallback(async (type: "consultations" | "complaints" | "dispensing") => {
    setExporting(type)
    try {
      let rows: Array<Record<string, any>> = []
      let headers: string[] = []

      if (type === "consultations") {
        const res = await getDailyConsultations()
        if (res.error) throw new Error(res.error)
        rows = res.data
        headers = ["Date", "Total", "Students", "Faculty", "Walk-ins", "Appointments", "RFID"]
      } else if (type === "complaints") {
        const res = await getComplaintFrequency()
        if (res.error) throw new Error(res.error)
        rows = res.data
        headers = ["Complaint", "Frequency"]
      } else {
        const res = await getDispensingSummary()
        if (res.error) throw new Error(res.error)
        rows = res.data
        headers = ["Medicine", "Category", "Total Dispensed", "Total Quantity"]
      }

      const csvRows = [headers.join(",")]
      for (const row of rows) {
        const values = headers.map((h) => {
          const key = h.toLowerCase().replace(/\s+/g, "_")
          const value = row[key] ?? row[Object.keys(row).find((k) => k.replace(/_/g, " ").toLowerCase() === h.toLowerCase()) ?? ""] ?? ""
          return `"${String(value).replace(/"/g, '""')}"`
        })
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
    } catch (err: any) {
      toast.error(err.message || "Export failed")
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
        description="Download clinic data as CSV files."
      />

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