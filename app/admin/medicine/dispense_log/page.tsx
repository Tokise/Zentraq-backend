"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { DataTablePagination, useTablePagination } from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { History } from "lucide-react"
import { toast } from "sonner"
import { getDispensingLogsAction, type DispensingLogRow } from "@/actions/admin/medicine/operations"

export default function AdminDispenseLogPage() {
  const [logs, setLogs] = useState<DispensingLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const pagination = useTablePagination(logs)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getDispensingLogsAction()
      if (res.error) {
        toast.error(res.error)
        setLogs([])
      } else {
        setLogs(res.logs)
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load dispensing log")
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
        title="Dispensing Log"
        description="History of all medicine dispensed from the clinic."
      />

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton className="h-10 w-full" key={index} />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center">
              <History className="size-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No dispensing records yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medicine</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Dispensed At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.paginatedItems.map((log) => (
                    <TableRow key={log.id} className="hover:bg-zinc-50/50">
                      <TableCell className="font-medium">{log.medicine_name || "—"}</TableCell>
                      <TableCell className="text-sm text-zinc-600">{log.patient_name || "—"}</TableCell>
                      <TableCell className="text-sm font-semibold">{log.quantity}</TableCell>
                      <TableCell className="text-sm text-zinc-500">
                        {new Date(log.dispensed_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
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
