"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { CalendarDays, Loader2, Check, X, Undo2 } from "lucide-react"
import { MonthCalendar, CalendarMarker } from "@/components/month-calendar"

function todayDateKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function statusVariant(status: string) {
  switch (status) {
    case "confirmed": return "info" as const
    case "completed": return "success" as const
    case "cancelled": return "danger" as const
    default: return "warning" as const
  }
}

export default function AppointmentsCalendarPage() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const dateParam = searchParams.get("date")

  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<string>(dateParam || todayDateKey())
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchAppointments = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("student_appointments")
        .select("*, student_accounts(first_name, last_name, student_number, employee_number, department)")
        .order("appointment_date", { ascending: true })

      setAppointments(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchAppointments()

    const channel = supabase
      .channel("appointments-calendar-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "student_appointments" },
        () => fetchAppointments()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, fetchAppointments])

  async function updateStatus(id: string, status: string) {
    setUpdatingId(id)
    try {
      const { error } = await supabase
        .from("student_appointments")
        .update({ status })
        .eq("id", id)

      if (error) throw error

      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)))
      toast.success(`Marked as ${status}`)
    } catch (err: any) {
      toast.error(err.message || "Failed to update appointment")
    } finally {
      setUpdatingId(null)
    }
  }

  const markersByDate = useMemo(() => {
    const map: Record<string, CalendarMarker[]> = {}
    for (const apt of appointments) {
      const key = apt.appointment_date
      if (!map[key]) map[key] = []
      map[key].push({ status: apt.status })
    }
    return map
  }, [appointments])

  const appointmentsOnSelectedDay = appointments
    .filter((a) => a.appointment_date === selectedDay)
    .sort((a, b) => a.time_slot.localeCompare(b.time_slot))

  const selectedDayLabel = new Date(selectedDay + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  })

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader title="Appointments Calendar" description="All student appointments, organized by date" />

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Calendar is the main view */}
          <Card className="shadow-sm border-zinc-200/80">
            <CardContent className="p-4">
              <MonthCalendar
                selectedDate={selectedDay}
                onSelectDate={setSelectedDay}
                markersByDate={markersByDate}
              />
              <div className="flex items-center gap-3 pt-3 flex-wrap px-1">
                {Object.entries({
                  pending: "bg-amber-400",
                  confirmed: "bg-blue-500",
                  completed: "bg-emerald-500",
                  cancelled: "bg-zinc-300",
                }).map(([status, dot]) => (
                  <span key={status} className="flex items-center gap-1 text-[11px] text-zinc-500 capitalize">
                    <span className={`size-1.5 rounded-full ${dot}`} /> {status}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Selected day panel */}
          <Card className="shadow-sm border-zinc-200/80 h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{selectedDayLabel}</CardTitle>
              <CardDescription className="text-xs">
                {appointmentsOnSelectedDay.length} appointment{appointmentsOnSelectedDay.length === 1 ? "" : "s"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {appointmentsOnSelectedDay.length === 0 ? (
                <div className="py-8 text-center">
                  <CalendarDays className="size-6 text-zinc-300 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nothing scheduled</p>
                </div>
              ) : (
                appointmentsOnSelectedDay.map((apt) => {
                  const sa = apt.student_accounts
                  const name = sa ? `${sa.first_name} ${sa.last_name}` : "Unknown"
                  const isUpdating = updatingId === apt.id

                  return (
                    <div key={apt.id} className="rounded-lg border border-zinc-200/80 p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{name}</p>
                          <p className="text-xs text-zinc-400">
                            {apt.time_slot}
                            {sa?.student_number || sa?.employee_number ? ` • ${sa.student_number || sa.employee_number}` : ""}
                          </p>
                        </div>
                        <StatusBadge status={statusVariant(apt.status)} className="shrink-0">
                          {apt.status}
                        </StatusBadge>
                      </div>

                      {apt.reason && (
                        <p className="text-xs text-zinc-500 line-clamp-2">{apt.reason}</p>
                      )}

                      <div className="flex gap-1.5 pt-1">
                        {apt.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isUpdating}
                            onClick={() => updateStatus(apt.id, "confirmed")}
                            className="h-7 text-xs px-2 cursor-pointer"
                          >
                            <Check className="size-3 mr-1" /> Confirm
                          </Button>
                        )}
                        {(apt.status === "pending" || apt.status === "confirmed") && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isUpdating}
                            onClick={() => updateStatus(apt.id, "completed")}
                            className="h-7 text-xs px-2 cursor-pointer"
                          >
                            <Check className="size-3 mr-1" /> Complete
                          </Button>
                        )}
                        {apt.status !== "cancelled" && apt.status !== "completed" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isUpdating}
                            onClick={() => updateStatus(apt.id, "cancelled")}
                            className="h-7 text-xs px-2 text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                          >
                            <X className="size-3 mr-1" /> Cancel
                          </Button>
                        )}
                        {apt.status === "cancelled" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isUpdating}
                            onClick={() => updateStatus(apt.id, "pending")}
                            className="h-7 text-xs px-2 text-zinc-500 cursor-pointer"
                          >
                            <Undo2 className="size-3 mr-1" /> Reopen
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}