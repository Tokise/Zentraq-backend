"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, CalendarDays } from "lucide-react"
import { MonthCalendar } from "@/components/month-calendar"
import { getAppointmentsOverviewAction, type AppointmentOverviewRow } from "@/actions/admin/appointments-admin"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

const STATUS_CHIP: Record<string, string> = {
  pending: "pending",
  ai_evaluated: "pending",
  recommended: "confirmed",
  approved: "confirmed",
  scheduled: "confirmed",
  reminded: "confirmed",
  checked_in: "confirmed",
  in_consultation: "confirmed",
  completed: "completed",
  cancelled: "cancelled",
  rejected: "cancelled",
  no_show: "cancelled",
}

export default function AdminAppointmentsCalendarPage() {
  const [appointments, setAppointments] = useState<AppointmentOverviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | undefined>(() => new Date().toISOString().split("T")[0])
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleSelectDate = useCallback((dateKey: string) => {
    setSelectedDate(dateKey)
    setIsModalOpen(true)
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAppointmentsOverviewAction()
      if (res.error) {
        toast.error(res.error)
        setAppointments([])
      } else {
        setAppointments(res.appointments)
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

  const markersByDate = useMemo(() => {
    const map: Record<string, Array<{ status: string; label?: string }>> = {}
    for (const a of appointments) {
      const date = a.scheduled_date || a.created_at.split("T")[0]
      if (!date) continue
      if (!map[date]) map[date] = []
      const time = a.scheduled_time ? a.scheduled_time.slice(0, 5) : ""
      map[date].push({
        status: STATUS_CHIP[a.status] || "pending",
        label: `${time ? time + " " : ""}${a.patient_name || "Patient"}`.trim(),
      })
    }
    return map
  }, [appointments])

  const dayAppointments = useMemo(() => {
    if (!selectedDate) return appointments
    return appointments.filter((a) => {
      const date = a.scheduled_date || a.created_at.split("T")[0]
      return date === selectedDate
    })
  }, [appointments, selectedDate])

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-amber-50 text-amber-700 border-amber-200",
      ai_evaluated: "bg-amber-50 text-amber-700 border-amber-200",
      recommended: "bg-blue-50 text-blue-700 border-blue-200",
      approved: "bg-blue-50 text-blue-700 border-blue-200",
      scheduled: "bg-blue-50 text-blue-700 border-blue-200",
      reminded: "bg-blue-50 text-blue-700 border-blue-200",
      checked_in: "bg-purple-50 text-purple-700 border-purple-200",
      in_consultation: "bg-purple-50 text-purple-700 border-purple-200",
      completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
      cancelled: "bg-zinc-50 text-zinc-500 border-zinc-200",
      rejected: "bg-red-50 text-red-700 border-red-200",
      no_show: "bg-zinc-50 text-zinc-500 border-zinc-200",
    }
    return (
      <Badge variant="outline" className={`text-[10px] ${styles[status] || "bg-zinc-50 text-zinc-700 border-zinc-200"}`}>
        {status.replace(/_/g, " ")}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointment Calendar"
        description="View and manage clinic appointment schedules."
      />

      <div className="w-full">
        <MonthCalendar
          selectedDate={selectedDate}
          onSelectDate={handleSelectDate}
          markersByDate={markersByDate}
          size="full"
        />
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {selectedDate ? new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "All Appointments"}
            </DialogTitle>
            <DialogDescription>
              {dayAppointments.length} appointment(s)
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2 pb-2">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : dayAppointments.length === 0 ? (
              <div className="py-10 text-center">
                <CalendarDays className="size-6 text-zinc-300 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No appointments for this day.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {dayAppointments.map((a) => (
                  <div key={a.id} className="rounded-lg border border-zinc-200 p-3 bg-white hover:bg-zinc-50/50 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{a.patient_name || "—"}</p>
                      {statusBadge(a.status)}
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                      {a.scheduled_time ? a.scheduled_time.slice(0, 5) : "Unscheduled"} · {a.reason || "No reason"}
                    </p>
                    {a.doctor_name && (
                      <p className="text-xs text-zinc-400 mt-0.5">Dr. {a.doctor_name}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}