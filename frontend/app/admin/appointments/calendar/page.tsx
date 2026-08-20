"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/common/status-badge"
import { Loader2, CalendarDays } from "lucide-react"
import { MonthCalendar } from "@/components/scheduling/month-calendar"
import { getAppointmentsOverviewAction, type AppointmentOverviewRow } from "@/actions/appointments/queries"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { EmptyState } from "@/components/common/empty-state"

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

function getStatusVariant(status: string): "success" | "warning" | "danger" | "info" | "default" {
  const s = status?.toLowerCase() ?? ""
  if (["completed", "approved", "healthy", "in stock", "fit"].includes(s)) return "success"
  if (["pending", "evaluating", "low stock", "ai_evaluated", "recommended", "reminded", "scheduled"].includes(s)) return "warning"
  if (["cancelled", "rejected", "no_show", "out of stock", "critical"].includes(s)) return "danger"
  if (["checked_in", "in_consultation", "active", "in-progress"].includes(s)) return "info"
  return "default"
}

function formatStatus(status: string): string {
  return status?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ?? "—"
}

// Renders the role-filtered appointment calendar used by every clinical portal.
export function AppointmentsCalendarPage() {
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
              <EmptyState
                title="No appointments for this day"
                description="This date has no scheduled appointments."
                icon={CalendarDays}
              />
            ) : (
              <div className="space-y-2">
                {dayAppointments.map((a) => (
                  <div key={a.id} className="border border-border p-3 bg-card hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{a.patient_name || "—"}</p>
                      <StatusBadge status={getStatusVariant(a.status)}>{formatStatus(a.status)}</StatusBadge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {a.scheduled_time ? a.scheduled_time.slice(0, 5) : "Unscheduled"} · {a.reason || "No reason"}
                    </p>
                    {a.doctor_name && (
                      <p className="text-xs text-muted-foreground mt-0.5">Dr. {a.doctor_name}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AppointmentsCalendarPage
