"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, CalendarPlus } from "lucide-react"
import { toast } from "sonner"
import { getAppointmentsOverviewAction } from "@/actions/admin/appointments-admin"
import { submitAppointmentRequest } from "@/actions/scheduling/appointments"

export default function StaffAppointmentsBookPage() {
  const [slots, setSlots] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    reason: "",
    symptoms: "",
    scheduledDate: "",
    scheduledTime: "",
  })

  const fetchSlots = useCallback(async () => {
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
    fetchSlots()
  }, [fetchSlots])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.reason.trim()) {
      toast.error("Reason is required")
      return
    }
    setSubmitting(true)
    try {
      const res = await submitAppointmentRequest({
        reason: form.reason,
        symptoms: form.symptoms || undefined,
        scheduled_date: form.scheduledDate || undefined,
        scheduled_time: form.scheduledTime ? `${form.scheduledTime}:00` : undefined,
      })
      if (res.success) {
        toast.success("Appointment request submitted")
        setForm({ reason: "", symptoms: "", scheduledDate: "", scheduledTime: "" })
      } else {
        toast.error(res.error || "Failed to submit appointment request")
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to submit appointment")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Book Appointment" description="Request a clinic appointment." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardContent className="p-5 space-y-4">
            <h3 className="font-semibold">Request an Appointment</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Reason <span className="text-red-500">*</span></Label>
                <Input
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="e.g. Annual physical, headache"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Symptoms</Label>
                <textarea
                  value={form.symptoms}
                  onChange={(e) => setForm({ ...form, symptoms: e.target.value })}
                  rows={3}
                  placeholder="Describe symptoms (optional)"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
              <div className="grid gap-3 grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Preferred Date</Label>
                  <Input type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Preferred Time</Label>
                  <Input type="time" value={form.scheduledTime} onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })} />
                </div>
              </div>
              <Button type="submit" disabled={submitting} className="cursor-pointer">
                {submitting ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <CalendarPlus className="size-3.5 mr-1" />}
                Submit Request
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-0">
            <div className="border-b border-border px-5 py-4">
              <h3 className="font-semibold">Available Slots</h3>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : slots.length === 0 ? (
              <div className="py-16 text-center">
                <CalendarPlus className="size-8 text-zinc-300 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No available slots at the moment.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {slots.map((slot) => (
                  <div key={slot.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div>
                      <p className="font-medium">
                        {new Date(slot.scheduled_date || slot.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                      <p className="text-xs text-muted-foreground">{slot.scheduled_time || slot.time || "Flexible"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {slot.doctor_name && (
                        <span className="text-xs text-muted-foreground">Dr. {slot.doctor_name}</span>
                      )}
                      <Badge variant="outline" className="text-[10px]">Available</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}