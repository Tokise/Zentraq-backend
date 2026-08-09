"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DataTablePagination, useTablePagination } from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Stethoscope } from "lucide-react"
import { toast } from "sonner"
import { getClinicVisitsAction } from "@/actions/admin/visits/overview"

export default function DoctorVisitHistoryPage() {
  const [visits, setVisits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const pagination = useTablePagination(visits)

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

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      "in-progress": "bg-amber-50 text-amber-700 border-amber-200",
      completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
      cancelled: "bg-zinc-50 text-zinc-500 border-zinc-200",
    }
    return <Badge variant="outline" className={`text-[10px] ${styles[status] || "bg-zinc-50 text-zinc-700 border-zinc-200"}`}>{status}</Badge>
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visit History"
        description="All clinic visits and their status."
      />

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton className="h-10 w-full" key={index} />
              ))}
            </div>
          ) : visits.length === 0 ? (
            <div className="py-16 text-center">
              <Stethoscope className="size-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No clinic visits recorded.</p>
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
                  {pagination.paginatedItems.map((v) => (
                    <TableRow key={v.id} className="hover:bg-zinc-50/50">
                      <TableCell className="font-medium">{v.patient_name || "—"}</TableCell>
                      <TableCell className="text-sm text-zinc-600 capitalize">{v.patient_type}</TableCell>
                      <TableCell className="text-sm text-zinc-600 capitalize">{v.visit_type}</TableCell>
                      <TableCell className="text-sm text-zinc-500">
                        {new Date(v.check_in_time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
                      <TableCell className="text-sm text-zinc-500">
                        {v.check_out_time ? new Date(v.check_out_time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-zinc-600">{v.consultation_count}</TableCell>
                      <TableCell>{statusBadge(v.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <DataTablePagination
        currentPage={pagination.currentPage}
        onPageChange={pagination.setCurrentPage}
        pageSize={pagination.pageSize}
        totalItems={pagination.totalItems}
        totalPages={pagination.totalPages}
      />
    </div>
  )
}
