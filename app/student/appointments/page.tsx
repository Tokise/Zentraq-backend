"use client"

import { useState, useEffect, useMemo } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { StatusBadge } from "@/components/status-badge"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { CalendarDays, Loader2, X } from "lucide-react"
import { MonthCalendar, CalendarMarker } from "@/components/month-calendar"

const TIME_SLOTS = [
    "8:00 AM", "8:30 AM", "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM",
    "11:00 AM", "11:30 AM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM",
    "3:00 PM", "3:30 PM", "4:00 PM",
]

function todayKey() {
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

export default function StudentAppointmentsPage() {
    const supabase = createClient()
    const [appointments, setAppointments] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState({ date: "", time_slot: "", reason: "" })
    const [studentAccountId, setStudentAccountId] = useState<string | null>(null)
    const [userId, setUserId] = useState<string | null>(null)
    const [selectedDay, setSelectedDay] = useState<string>(todayKey())

    useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            setUserId(user.id)

            // Get student account
            const { data: studentData } = await supabase
                .from("student_accounts")
                .select("id")
                .eq("user_id", user.id)
                .maybeSingle()

            if (studentData) {
                setStudentAccountId(studentData.id)
            }

            // Load appointments
            const { data } = await supabase
                .from("student_appointments")
                .select("*")
                .eq("student_user_id", user.id)
                .order("appointment_date", { ascending: true })

            setAppointments(data || [])
            setLoading(false)
        }
        load()
    }, [supabase])

    async function refreshAppointments() {
        if (!userId) return
        const { data } = await supabase
            .from("student_appointments")
            .select("*")
            .eq("student_user_id", userId)
            .order("appointment_date", { ascending: true })
        setAppointments(data || [])
    }

    async function handleBook(e: React.FormEvent) {
        e.preventDefault()
        if (!form.date || !form.time_slot) {
            toast.error("Please select a date and time slot")
            return
        }
        if (!userId) return

        setSubmitting(true)
        try {
            const { error } = await supabase.from("student_appointments").insert({
                student_user_id: userId,
                student_account_id: studentAccountId,
                appointment_date: form.date,
                time_slot: form.time_slot,
                reason: form.reason || null,
                status: "pending",
            })

            if (error) throw error

            toast.success("Appointment booked!")
            setShowForm(false)
            setSelectedDay(form.date)
            setForm({ date: "", time_slot: "", reason: "" })

            await refreshAppointments()
        } catch (err: any) {
            toast.error(err.message || "Failed to book appointment")
        } finally {
            setSubmitting(false)
        }
    }

    async function handleCancel(id: string) {
        try {
            const { error } = await supabase
                .from("student_appointments")
                .update({ status: "cancelled" })
                .eq("id", id)

            if (error) throw error

            toast.success("Appointment cancelled")
            setAppointments((prev) =>
                prev.map((a) => (a.id === id ? { ...a, status: "cancelled" } : a))
            )
        } catch (err: any) {
            toast.error(err.message || "Failed to cancel")
        }
    }

    // Group appointments by date for the calendar chips
    const markersByDate = useMemo(() => {
        const map: Record<string, CalendarMarker[]> = {}
        for (const apt of appointments) {
            const key = apt.appointment_date
            if (!map[key]) map[key] = []
            map[key].push({ status: apt.status, label: apt.time_slot })
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
            <PageHeader title="Appointments" description="Book and manage your clinic appointments">
                <Button size="sm" onClick={() => setShowForm(!showForm)} className="cursor-pointer">
                    {showForm ? "Cancel" : "Book Appointment"}
                </Button>
            </PageHeader>

            {showForm && (
                <Card className="shadow-sm border-zinc-200/80">
                    <CardHeader>
                        <CardTitle className="text-base">New Appointment</CardTitle>
                        <CardDescription>Pick a date on the calendar, then choose a time slot</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleBook} className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Date</Label>
                                <MonthCalendar
                                    selectedDate={form.date}
                                    onSelectDate={(dateKey) => setForm((f) => ({ ...f, date: dateKey }))}
                                    disablePast
                                    size="compact"
                                />
                                {form.date && (
                                    <p className="text-xs text-zinc-500 pt-1">
                                        Selected: <span className="font-medium text-zinc-700">
                                            {new Date(form.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                                        </span>
                                    </p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs">Time Slot</Label>
                                <div className="grid grid-cols-5 gap-1.5">
                                    {TIME_SLOTS.map((slot) => (
                                        <button
                                            key={slot}
                                            type="button"
                                            onClick={() => setForm((f) => ({ ...f, time_slot: slot }))}
                                            className={`text-xs py-1.5 px-2 rounded border transition-colors cursor-pointer ${form.time_slot === slot
                                                ? "bg-zinc-900 text-white border-zinc-900"
                                                : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                                                }`}
                                        >
                                            {slot}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs">Reason (optional)</Label>
                                <textarea
                                    value={form.reason}
                                    onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                                    placeholder="Brief description of your concern..."
                                    rows={3}
                                    className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 resize-none"
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={submitting}
                                className="bg-zinc-900 text-white hover:bg-zinc-800 cursor-pointer"
                            >
                                {submitting ? (
                                    <><Loader2 className="size-3.5 animate-spin mr-1" /> Booking...</>
                                ) : (
                                    "Confirm Booking"
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

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
                                appointmentsOnSelectedDay.map((apt) => (
                                    <div key={apt.id} className="rounded-lg border border-zinc-200/80 p-3 space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="text-sm font-medium">{apt.time_slot}</p>
                                            <StatusBadge status={statusVariant(apt.status)} className="shrink-0">
                                                {apt.status}
                                            </StatusBadge>
                                        </div>

                                        {apt.reason && (
                                            <p className="text-xs text-zinc-500 line-clamp-2">{apt.reason}</p>
                                        )}

                                        {apt.status === "pending" && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleCancel(apt.id)}
                                                className="h-7 text-xs px-2 -ml-2 text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                                            >
                                                <X className="size-3 mr-1" /> Cancel
                                            </Button>
                                        )}
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}