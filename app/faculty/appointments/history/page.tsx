"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getMyAppointments } from "@/app/actions/appointments"
import type { AppointmentDTO } from "@/types"
import { History, CalendarDays, Clock } from "lucide-react"
import { toast } from "sonner"

export default function FacultyAppointmentHistoryPage() {
  const [appointments, setAppointments] = useState<AppointmentDTO[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadHistory() {
      setLoading(true)
      try {
        const res = await getMyAppointments()
        if (res.error) {
          toast.error(res.error)
        } else {
          setAppointments(res.appointments)
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to load appointment history")
      } finally {
        setLoading(false)
      }
    }
    loadHistory()
  }, [])

  const historyAppointments = appointments.filter(
    (a) => ["completed", "cancelled", "rejected", "no_show"].includes(a.status)
  )

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
      cancelled: "bg-red-50 text-red-700 border-red-200",
      rejected: "bg-amber-50 text-amber-700 border-amber-200",
      no_show: "bg-zinc-100 text-zinc-700 border-zinc-300",
    }
    return (
      <Badge variant="outline" className={`text-[10px] capitalize ${map[status] || "bg-zinc-50 text-zinc-700 border-zinc-200"}`}>
        {status.replace("_", " ")}
      </Badge>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto mt-[-25px] px-4 py-4">
      <PageHeader
        title="Appointment History"
        description="View records of your completed, cancelled, or past faculty appointments."
      />

      <Card className="border-zinc-200/80 shadow-sm bg-white overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 bg-zinc-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : historyAppointments.length === 0 ? (
            <div className="py-14 px-6 text-center space-y-2">
              <History className="size-8 text-zinc-300 mx-auto" />
              <p className="text-sm font-medium text-zinc-600">No past appointment history found</p>
              <p className="text-xs text-zinc-400">Completed or past appointments will be listed here.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {historyAppointments.map((apt) => (
                <div key={apt.id} className="p-4 sm:p-5 hover:bg-zinc-50/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-900 text-sm">{apt.reason}</span>
                      {statusBadge(apt.status)}
                    </div>
                    {apt.symptoms && (
                      <p className="text-xs text-zinc-500">
                        <span className="font-semibold text-zinc-600">Notes/Symptoms:</span> {apt.symptoms}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400">
                      {apt.scheduled_date && (
                        <span className="flex items-center gap-1">
                          <CalendarDays className="size-3.5 text-zinc-400" />
                          {apt.scheduled_date}
                        </span>
                      )}
                      {apt.scheduled_time && (
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5 text-zinc-400" />
                          {apt.scheduled_time}
                        </span>
                      )}
                      <span>Booked: {new Date(apt.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}