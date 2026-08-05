"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, CalendarClock } from "lucide-react"
import { toast } from "sonner"
import { getAppointmentsOverviewAction } from "@/actions/admin/appointments-admin"

export default function FacultyAppointmentsReschedulePage() {
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAppointmentsOverviewAction({ status: "approved" })
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

  return (
    <div className="space-y-6">
      <PageHeader title="Reschedule Appointment" description="Your approved appointments." />

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : appointments.length === 0 ? (
            <div className="py-16 text-center">
              <CalendarClock className="size-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No appointments to reschedule.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium">Reason</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {appointments.map((a) => (
                    <tr key={a.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 font-medium">
                        {a.scheduled_date ? new Date(a.scheduled_date + "T00:00:00").toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{a.scheduled_time ? a.scheduled_time.slice(0, 5) : "—"}</td>
                      <td className="px-4 py-3 max-w-[250px] truncate">{a.reason || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-[10px] capitalize">{a.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}