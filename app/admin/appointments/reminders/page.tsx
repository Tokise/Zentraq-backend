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
import { Bell } from "lucide-react"
import { toast } from "sonner"
import { getAppointmentRemindersAction } from "@/actions/appointments/queries"

export default function AdminAppointmentRemindersPage() {
  const [reminders, setReminders] = useState<Array<{
    id: string
    appointment_id: string
    remind_at: string
    sent_at: string | null
    status: string
    patient_name: string | null
    scheduled_date: string | null
    scheduled_time: string | null
  }>>([])
  const [loading, setLoading] = useState(true)
  const pagination = useTablePagination(reminders)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAppointmentRemindersAction()
      if (res.error) {
        toast.error(res.error)
        setReminders([])
      } else {
        setReminders(res.reminders)
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load reminders")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      scheduled: "bg-amber-50 text-amber-700 border-amber-200",
      sent: "bg-emerald-50 text-emerald-700 border-emerald-200",
      failed: "bg-red-50 text-red-700 border-red-200",
    }
    return (
      <Badge variant="outline" className={`text-[10px] ${styles[status] || "bg-zinc-50 text-zinc-700 border-zinc-200"}`}>
        {status}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointment Reminders"
        description="Scheduled and sent notification reminders for appointments."
      />

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton className="h-10 w-full" key={index} />
              ))}
            </div>
          ) : reminders.length === 0 ? (
            <div className="py-16 text-center">
              <Bell className="size-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No appointment reminders yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Appointment</TableHead>
                    <TableHead>Remind At</TableHead>
                    <TableHead>Sent At</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.paginatedItems.map((r) => (
                    <TableRow key={r.id} className="hover:bg-zinc-50/50">
                      <TableCell className="font-medium">{r.patient_name || "—"}</TableCell>
                      <TableCell className="text-sm text-zinc-600">
                        {r.scheduled_date ? new Date(r.scheduled_date + "T00:00:00").toLocaleDateString() : "—"}
                        {r.scheduled_time ? ` · ${r.scheduled_time.slice(0, 5)}` : ""}
                      </TableCell>
                      <TableCell className="text-sm text-zinc-500">
                        {new Date(r.remind_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
                      <TableCell className="text-sm text-zinc-500">
                        {r.sent_at ? new Date(r.sent_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
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
