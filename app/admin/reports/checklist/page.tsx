"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, ClipboardCheck } from "lucide-react"
import { toast } from "sonner"
import { getClearanceCompletion } from "@/actions/reports/analytics"
import { ComplianceDashboard } from "@/components/analytics/compliance-dashboard"

export default function AdminChecklistReportPage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getClearanceCompletion()
      if (res.error) {
        toast.error(res.error)
        setData([])
      } else {
        setData(res.data)
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load compliance report")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clearance Compliance Report"
        description="Clearance completion rates by requester type."
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : data.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ClipboardCheck className="size-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No clearance compliance data available.</p>
          </CardContent>
        </Card>
      ) : (
        <ComplianceDashboard data={data} />
      )}
    </div>
  )
}