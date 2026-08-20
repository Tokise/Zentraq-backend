"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, CalendarClock } from "lucide-react"
import { toast } from "sonner"
import { getMyAppointmentsAction, cancelAppointmentAction } from "@/actions/appointments/requests"

export default function StudentAppointmentsReschedulePage() {
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getMyAppointmentsAction()
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

  const handleCancel = async (id: string) => {
    setProcessing(id)
    try {
      const res = await cancelAppointmentAction(id)
      if (res.error) {
        toast.error(res.error || "Failed to cancel appointment")
      } else {
        toast.success("Appointment cancelled")
        fetchData()
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel appointment")
    } finally {
      setProcessing(null)
    }
  }

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-amber-50 text-amber-700 border-amber-200",
      ai_evaluated: "bg-amber-50 text-amber-700 border-amber-200",
      recommended: "bg-blue-50 text-blue-700 border-blue-200",
      approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
      scheduled: "bg-blue-50 text-blue-700 border-blue-200",
      reminded: "bg-blue-50 text-blue-700 border-blue-200",
      checked_in: "bg-blue-50 text-blue-700 border-blue-200",
      in_consultation: "bg-blue-50 text-blue-700 border-blue-200",
      completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
      cancelled: "bg-red-50 text-red-700 border-red-200",
      rejected: "bg-red-50 text-red-700 border-red-200",
      no_show: "bg-red-50 text-red-700 border-red-200",
    }
    return <Badge variant="outline" className={`text-[10px] capitalize ${styles[status] || "bg-zinc-50 text-zinc-700 border-zinc-200"}`}>{status.replace(/_/g, " ")}</Badge>
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Appointments" description="Your appointment requests and scheduled visits." />

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : appointments.length === 0 ? (
            <div className="py-16 text-center">
              <CalendarClock className="size-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No appointments found.</p>
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
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {appointments.map((a) => (
                    <tr key={a.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 font-medium">
                        {a.scheduled_date ? new Date(a.scheduled_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{a.scheduled_time ? a.scheduled_time.slice(0, 5) : "—"}</td>
                      <td className="px-4 py-3 max-w-[250px] truncate">{a.reason || "—"}</td>
                      <td className="px-4 py-3">{statusBadge(a.status)}</td>
                      <td className="px-4 py-3 text-right">
                        {["pending", "ai_evaluated", "recommended", "approved", "scheduled", "reminded"].includes(a.status) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs text-red-600"
                            onClick={() => handleCancel(a.id)}
                            disabled={processing === a.id}
                          >
                            {processing === a.id ? "..." : "Cancel"}
                          </Button>
                        )}
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