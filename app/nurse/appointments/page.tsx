"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Calendar } from "lucide-react"
import { toast } from "sonner"
import { getAppointmentsOverviewAction, type AppointmentOverviewRow } from "@/actions/appointments/queries"

export default function NurseAppointmentsPage() {
  const [appointments, setAppointments] = useState<AppointmentOverviewRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAppointmentsOverviewAction()
      if (res.error) {
        toast.error(res.error)
        setAppointments([])
      } else {
        setAppointments(res.appointments.filter((a) => ["approved", "scheduled", "recommended"].includes(a.status)))
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
      <PageHeader title="Appointments" description="Upcoming patient appointments." />

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : appointments.length === 0 ? (
            <div className="py-16 text-center">
              <Calendar className="size-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No upcoming appointments.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Patient</th>
                    <th className="px-4 py-3 font-medium">Reason</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {appointments.map((a) => (
                    <tr key={a.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 font-medium">{a.patient_name || "—"}</td>
                      <td className="px-4 py-3 max-w-[250px] truncate">{a.reason || "—"}</td>
                      <td className="px-4 py-3 text-zinc-600">
                        {a.scheduled_date ? new Date(a.scheduled_date + "T00:00:00").toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{a.scheduled_time ? a.scheduled_time.slice(0, 5) : "—"}</td>
                      <td className="px-4 py-3">{statusBadge(a.status)}</td>
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