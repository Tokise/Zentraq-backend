"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DataTablePagination, useTablePagination } from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { CalendarClock } from "lucide-react"
import { toast } from "sonner"
import { getAppointmentsOverviewAction, type AppointmentOverviewRow } from "@/actions/appointments/queries"
import { rescheduleAppointmentAction } from "@/actions/appointments/review"

export default function DoctorAppointmentReschedulePage() {
  const [appointments, setAppointments] = useState<AppointmentOverviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AppointmentOverviewRow | null>(null)
  const [newDate, setNewDate] = useState("")
  const [newTime, setNewTime] = useState("")
  const [processing, setProcessing] = useState(false)
  const pagination = useTablePagination(appointments)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAppointmentsOverviewAction()
      if (res.error) {
        toast.error(res.error)
        setAppointments([])
      } else {
        setAppointments(res.appointments.filter((a) => ["scheduled", "approved", "recommended"].includes(a.status)))
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load appointments")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const openReschedule = (a: AppointmentOverviewRow) => {
    setSelected(a)
    setNewDate(a.scheduled_date || "")
    setNewTime(a.scheduled_time || "")
  }

  const handleReschedule = async () => {
    if (!selected || !newDate || !newTime) {
      toast.error("Date and time are required")
      return
    }
    setProcessing(true)
    try {
      const res = await rescheduleAppointmentAction(selected.id, { scheduled_date: newDate, scheduled_time: newTime })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success("Appointment rescheduled")
        setSelected(null)
        fetchData()
      }
    } finally {
      setProcessing(false)
    }
  }

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      scheduled: "bg-blue-50 text-blue-700 border-blue-200",
      approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
      recommended: "bg-amber-50 text-amber-700 border-amber-200",
    }
    return <Badge variant="outline" className={`text-[10px] ${styles[status] || "bg-zinc-50 text-zinc-700 border-zinc-200"}`}>{status}</Badge>
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Reschedule Appointments" description="Change the date and time of your scheduled appointments." />

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton className="h-10 w-full" key={index} />
              ))}
            </div>
          ) : appointments.length === 0 ? (
            <div className="py-16 text-center">
              <CalendarClock className="size-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No appointments to reschedule.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Current Schedule</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.paginatedItems.map((a) => (
                    <TableRow key={a.id} className="hover:bg-zinc-50/50">
                      <TableCell className="font-medium">{a.patient_name || "—"}</TableCell>
                      <TableCell className="text-sm text-zinc-600 max-w-[240px] truncate">{a.reason || "—"}</TableCell>
                      <TableCell className="text-sm text-zinc-600">
                        {a.scheduled_date ? new Date(a.scheduled_date + "T00:00:00").toLocaleDateString() : "—"}
                        {a.scheduled_time ? ` · ${a.scheduled_time.slice(0, 5)}` : ""}
                      </TableCell>
                      <TableCell>{statusBadge(a.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" className="h-8 text-xs" onClick={() => openReschedule(a)}>
                          Reschedule
                        </Button>
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

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reschedule Appointment</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="rounded-lg border border-zinc-200 p-3">
                <p className="text-sm font-medium">{selected.patient_name || "Patient"}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{selected.reason || "No reason"}</p>
              </div>
              <div className="grid gap-3 grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">New Date</Label>
                  <Calendar
                    className="h-9"
                    onSelect={setNewDate}
                    selected={newDate}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">New Time</Label>
                  <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="h-9" />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button onClick={handleReschedule} disabled={processing}>
              {processing ? "Rescheduling..." : "Confirm Reschedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
