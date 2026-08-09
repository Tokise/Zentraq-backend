"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, BarChart3 } from "lucide-react"
import { toast } from "sonner"
import { getAnalyticsOverview, getDailyConsultations, getComplaintFrequency } from "@/actions/reports/analytics"
import { ConsultationChart } from "@/components/analytics/consultation-chart"
import { ComplaintChart } from "@/components/analytics/complaint-chart"
import { StatCard } from "@/components/common/stat-card"

export default function AdminReportsGeneratePage() {
  const [overview, setOverview] = useState<any>(null)
  const [consultations, setConsultations] = useState<any[]>([])
  const [complaints, setComplaints] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [ov, cons, comps] = await Promise.all([
        getAnalyticsOverview(),
        getDailyConsultations(),
        getComplaintFrequency(),
      ])
      if (ov.error) toast.error(ov.error)
      else setOverview(ov.overview)
      if (cons.error) toast.error(cons.error)
      else setConsultations(cons.data)
      if (comps.error) toast.error(comps.error)
      else setComplaints(comps.data)
    } catch (err: any) {
      toast.error(err.message || "Failed to load reports")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reports & Analytics" description="Clinic performance and activity reports." />
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!overview) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reports & Analytics" description="Clinic performance and activity reports." />
        <Card>
          <CardContent className="py-16 text-center">
            <BarChart3 className="size-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No report data available.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description="Clinic performance and activity reports."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Consultations" value={overview.total_consultations ?? 0} />
        <StatCard label="Active Incidents" value={overview.active_incidents ?? 0} />
        <StatCard label="Pending Clearances" value={overview.pending_clearances ?? 0} />
        <StatCard label="Low Stock Medicines" value={overview.low_stock_medicines ?? 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ConsultationChart data={consultations} />
        <ComplaintChart data={complaints} />
      </div>

      <Card className="shadow-sm">
        <CardContent className="pt-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-4 text-zinc-400" />
            <span className="text-sm text-zinc-600">
              Reporting period: {overview.period_start} to {overview.period_end}
            </span>
          </div>
          <span className="text-xs text-zinc-400">
            {overview.student_consultations ?? 0} student · {overview.faculty_consultations ?? 0} faculty consultations
          </span>
        </CardContent>
      </Card>
    </div>
  )
}