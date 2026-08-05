"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, CalendarPlus } from "lucide-react"
import { toast } from "sonner"
import { getAppointmentsOverviewAction } from "@/actions/admin/appointments-admin"

export default function FacultyAppointmentsBookPage() {
  const [slots, setSlots] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAppointmentsOverviewAction({ status: "recommended" })
      if (res.error) {
        toast.error(res.error)
        setSlots([])
      } else {
        setSlots(res.appointments)
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load available slots")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className="space-y-6">
      <PageHeader title="Book Appointment" description="Available appointment slots." />

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : slots.length === 0 ? (
            <div className="py-16 text-center">
              <CalendarPlus className="size-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No available slots at the moment.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium">Doctor</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {slots.map((slot) => (
                    <tr key={slot.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 font-medium">{new Date(slot.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                      <td className="px-4 py-3 text-zinc-600">{slot.time}</td>
                      <td className="px-4 py-3 text-zinc-600">{slot.doctor_name || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">Available</Badge>
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