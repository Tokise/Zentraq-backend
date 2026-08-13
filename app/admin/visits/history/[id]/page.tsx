"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { PageHeader } from "@/components/common/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { getClinicVisitsAction } from "@/actions/clinical/visits/queries"

function getStatusVariant(status: string): "success" | "warning" | "danger" | "info" | "default" {
  const s = status?.toLowerCase() ?? ""
  if (["completed", "approved"].includes(s)) return "success"
  if (["pending", "evaluating"].includes(s)) return "warning"
  if (["cancelled", "rejected"].includes(s)) return "danger"
  if (["in-progress", "in_progress", "active", "checked_in"].includes(s)) return "info"
  return "default"
}

function formatStatus(status: string): string {
  return status?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ?? "—"
}

export default function AdminVisitDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [visit, setVisit] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadVisit() {
      setLoading(true)
      try {
        const res = await getClinicVisitsAction()
        if (res.error) {
          toast.error(res.error)
          return
        }
        const found = res.visits.find((v: any) => v.id === params.id)
        if (found) {
          setVisit(found)
        } else {
          toast.error("Visit not found")
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to load visit")
      } finally {
        setLoading(false)
      }
    }
    loadVisit()
  }, [params.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!visit) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Visit Not Found"
          description="The requested visit could not be found."
          breadcrumb={[{ label: "Visits", href: "/admin/visits/history" }, { label: "Detail" }]}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Visit - ${visit.patient_name || "Patient"}`}
        description="Visit details and consultation information."
        breadcrumb={[{ label: "Visits", href: "/admin/visits/history" }, { label: "Detail" }]}
      >
        <Button variant="outline" size="sm" onClick={() => router.push("/admin/visits/history")} className="cursor-pointer">
          <ArrowLeft className="mr-2 size-4" />
          Back to History
        </Button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-sm font-medium">Patient Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Patient Name</p>
                <p className="text-sm font-medium">{visit.patient_name || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Patient Type</p>
                <p className="text-sm font-medium capitalize">{visit.patient_type}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Visit Type</p>
                <p className="text-sm font-medium capitalize">{visit.visit_type}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <StatusBadge status={getStatusVariant(visit.status)}>{formatStatus(visit.status)}</StatusBadge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-sm font-medium">Visit Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Check-in</p>
                <p className="text-sm font-medium">
                  {visit.check_in_time ? new Date(visit.check_in_time).toLocaleString() : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Check-out</p>
                <p className="text-sm font-medium">
                  {visit.check_out_time ? new Date(visit.check_out_time).toLocaleString() : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Consultations</p>
                <p className="text-sm font-medium">{visit.consultation_count}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}