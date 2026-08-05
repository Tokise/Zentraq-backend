"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, CalendarCheck } from "lucide-react"
import { MonthCalendar } from "@/components/month-calendar"
import { getConsultationQueue } from "@/actions/inventory/workflow-queries"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

export default function AdminCheckupSchedulePage() {
  const [consultations, setConsultations] = useState<any[]>([])
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
      const res = await getConsultationQueue()
      if (res.error) {
        toast.error(res.error)
        setConsultations([])
      } else {
        setConsultations(res.consultations)
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load schedule")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const markersByDate = useMemo(() => {
    const map: Record<string, Array<{ status: string; label?: string }>> = {}
    for (const c of consultations) {
      const date = c.check_in_time?.split("T")[0]
      if (!date) continue
      if (!map[date]) map[date] = []
      map[date].push({
        status: c.status === "completed" ? "completed" : "confirmed",
        label: c.patient_name || "Patient",
      })
    }
    return map
  }, [consultations])

  const dayAppointments = useMemo(() => {
    if (!selectedDate) return consultations
    return consultations.filter((c) => c.check_in_time?.split("T")[0] === selectedDate)
  }, [consultations, selectedDate])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Check-up Schedule"
        description="Calendar of faculty consultations and check-ups."
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
              {selectedDate ? new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "All"}
            </DialogTitle>
            <DialogDescription>
              {dayAppointments.length} visit(s)
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2 pb-2">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : dayAppointments.length === 0 ? (
              <div className="py-10 text-center">
                <CalendarCheck className="size-6 text-zinc-300 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No consultations on this day.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {dayAppointments.map((c) => (
                  <div key={c.id} className="rounded-lg border border-zinc-200 p-3 bg-white">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{c.patient_name}</p>
                      <Badge variant="outline" className={`text-[10px] ${c.status === "completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                        {c.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">{c.complaint || "No complaint"}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {new Date(c.check_in_time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      {c.doctor_name ? ` · Dr. ${c.doctor_name}` : ""}
                    </p>
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