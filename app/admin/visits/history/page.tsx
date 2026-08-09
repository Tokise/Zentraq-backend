"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/common/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { EmptyState } from "@/components/common/empty-state"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Loader2, Stethoscope } from "lucide-react"
import { toast } from "sonner"
import { getClinicVisitsAction } from "@/actions/admin/visits/overview"

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

export default function AdminVisitHistoryPage() {
  const router = useRouter()
  const [visits, setVisits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getClinicVisitsAction()
      if (res.error) {
        toast.error(res.error)
        setVisits([])
      } else {
        setVisits(res.visits)
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load visits")
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
        title="Visit History"
        description="All clinic visits and their status."
      />

      <div className="border border-border bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : visits.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No clinic visits recorded"
              description="Clinic visit records will appear here."
              icon={Stethoscope}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Visit Type</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead>Consultations</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                  {visits.map((v) => (
                    <TableRow key={v.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/admin/visits/history/${v.id}`)}>
                    <TableCell className="font-medium">{v.patient_name || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground capitalize">{v.patient_type}</TableCell>
                    <TableCell className="text-sm text-muted-foreground capitalize">{v.visit_type}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(v.check_in_time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {v.check_out_time ? new Date(v.check_out_time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{v.consultation_count}</TableCell>
                    <TableCell>
                      <StatusBadge status={getStatusVariant(v.status)}>{formatStatus(v.status)}</StatusBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}