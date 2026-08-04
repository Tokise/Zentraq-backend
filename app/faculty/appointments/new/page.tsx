"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { submitAppointmentRequest } from "@/app/actions/appointments"
import { toast } from "sonner"
import { CalendarDays, Loader2, ArrowLeft } from "lucide-react"
import Link from "next/link"

const TIME_SLOTS = [
  "08:00:00", "08:30:00", "09:00:00", "09:30:00", "10:00:00",
  "10:30:00", "11:00:00", "11:30:00", "13:00:00", "13:30:00",
  "14:00:00", "14:30:00", "15:00:00", "15:30:00", "16:00:00",
]

export default function FacultyNewAppointmentPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [scheduledDate, setScheduledDate] = useState("")
  const [scheduledTime, setScheduledTime] = useState(TIME_SLOTS[0])
  const [reason, setReason] = useState("")
  const [symptoms, setSymptoms] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!scheduledDate) {
      toast.error("Please select a date")
      return
    }
    if (!reason.trim()) {
      toast.error("Please provide a reason for your visit")
      return
    }

    setSubmitting(true)
    try {
      const res = await submitAppointmentRequest({
        reason: reason.trim(),
        symptoms: symptoms.trim() || undefined,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
      })

      if (res.success) {
        toast.success("Appointment request submitted successfully!")
        router.push("/faculty/appointments")
      } else {
        toast.error(res.error || "Failed to submit appointment request")
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred")
    } finally {
      setSubmitting(false)
    }
  }

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minDateStr = tomorrow.toISOString().split("T")[0]

  return (
    <div className="space-y-6 max-w-3xl mx-auto mt-[-25px] px-4 py-4">
      <div className="flex items-center gap-2">
        <Link href="/faculty/appointments" className="text-zinc-500 hover:text-zinc-900 transition-colors">
          <ArrowLeft className="size-4" />
        </Link>
        <PageHeader
          title="Request Faculty Appointment"
          description="Schedule a consultation with the university clinic staff."
        />
      </div>

      <Card className="border-zinc-200/80 shadow-sm bg-white">
        <CardHeader className="border-b border-zinc-100 pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CalendarDays className="size-4 text-blue-600" />
            Appointment Details
          </CardTitle>
          <CardDescription>
            Fill out the details below to submit your appointment booking request.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date" className="text-xs font-semibold text-zinc-700">
                  Preferred Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="date"
                  type="date"
                  min={minDateStr}
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="h-10 text-sm"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="time" className="text-xs font-semibold text-zinc-700">
                  Preferred Time Slot <span className="text-red-500">*</span>
                </Label>
                <select
                  id="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {TIME_SLOTS.map((slot) => {
                    const [h, m] = slot.split(":")
                    const hour = parseInt(h, 10)
                    const ampm = hour >= 12 ? "PM" : "AM"
                    const displayHour = hour % 12 || 12
                    return (
                      <option key={slot} value={slot}>
                        {displayHour}:{m} {ampm}
                      </option>
                    )
                  })}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason" className="text-xs font-semibold text-zinc-700">
                Reason for Visit <span className="text-red-500">*</span>
              </Label>
              <Input
                id="reason"
                placeholder="e.g. Executive Health Consultation, Medical Clearance, Prescription Refill"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="h-10 text-sm"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="symptoms" className="text-xs font-semibold text-zinc-700">
                Additional Symptoms / Notes (Optional)
              </Label>
              <textarea
                id="symptoms"
                rows={3}
                placeholder="Describe any specific symptoms or health concerns..."
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                className="w-full p-3 text-sm rounded-md border border-input bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <Link href="/faculty/appointments">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={submitting} className="bg-zinc-900 hover:bg-zinc-800 text-white gap-2">
                {submitting && <Loader2 className="size-4 animate-spin" />}
                Submit Booking Request
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}