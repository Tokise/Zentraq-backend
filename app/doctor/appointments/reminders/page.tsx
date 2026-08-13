"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Bell } from "lucide-react"
import { toast } from "sonner"
import { getAppointmentRemindersAction } from "@/actions/appointments/queries"

export default function DoctorAppointmentRemindersPage() {
  const [reminders, setReminders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="space-y-6">
      <PageHeader title="Appointment Reminders" description="Upcoming appointment reminders." />

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : reminders.length === 0 ? (
            <div className="py-16 text-center">
              <Bell className="size-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No reminders scheduled.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Patient</th>
                    <th className="px-4 py-3 font-medium">Appointment</th>
                    <th className="px-4 py-3 font-medium">Remind At</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reminders.map((r) => (
                    <tr key={r.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 font-medium">{r.patient_name || "—"}</td>
                      <td className="px-4 py-3 text-zinc-600">
                        {r.scheduled_date ? new Date(r.scheduled_date + "T00:00:00").toLocaleDateString() : "—"}
                        {r.scheduled_time ? ` · ${r.scheduled_time.slice(0, 5)}` : ""}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {new Date(r.remind_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-[10px] ${r.status === "sent" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                          {r.status}
                        </Badge>
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