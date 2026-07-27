"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { CalendarDays, Loader2, X } from "lucide-react"

const TIME_SLOTS = [
    "8:00 AM", "8:30 AM", "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM",
    "11:00 AM", "11:30 AM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM",
    "3:00 PM", "3:30 PM", "4:00 PM",
]

export default function StudentAppointmentsPage() {
    const supabase = createClient()
    const [appointments, setAppointments] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState({ date: "", time_slot: "", reason: "" })
    const [studentAccountId, setStudentAccountId] = useState<string | null>(null)
    const [userId, setUserId] = useState<string | null>(null)

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
            setForm({ date: "", time_slot: "", reason: "" })

            // Refresh
            const { data } = await supabase
                .from("student_appointments")
                .select("*")
                .eq("student_user_id", userId)
                .order("appointment_date", { ascending: true })

            setAppointments(data || [])
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

    const statusColor: Record<string, string> = {
        pending: "bg-amber-50 text-amber-700 border-amber-200",
        confirmed: "bg-blue-50 text-blue-700 border-blue-200",
        completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
        cancelled: "bg-zinc-50 text-zinc-500 border-zinc-200",
    }

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <PageHeader title="Appointments" description="Book and manage your clinic appointments">
                <Button size="sm" onClick={() => setShowForm(!showForm)} className="cursor-pointer">
                    {showForm ? "Cancel" : "Book Appointment"}
                </Button>
            </PageHeader>

            {showForm && (
                <Card className="shadow-sm border-zinc-200/80">
                    <CardHeader>
                        <CardTitle className="text-base">New Appointment</CardTitle>
                        <CardDescription>Select a date and time for your visit</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleBook} className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Date</Label>
                                <Input
                                    type="date"
                                    value={form.date}
                                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                                    min={new Date().toISOString().split("T")[0]}
                                    required
                                    className="h-9"
                                />
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
                <div className="space-y-3">
                    {[1, 2].map((i) => (
                        <Card key={i} className="animate-pulse">
                            <CardContent className="p-5">
                                <div className="h-4 w-40 bg-zinc-100 rounded mb-2" />
                                <div className="h-3 w-24 bg-zinc-100 rounded" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : appointments.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <CalendarDays className="size-8 text-zinc-300 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No appointments yet</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {appointments.map((apt) => (
                        <Card key={apt.id} className="shadow-sm">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium">
                                            {apt.appointment_date} — {apt.time_slot}
                                        </p>
                                        <Badge
                                            variant="outline"
                                            className={`text-[10px] capitalize ${statusColor[apt.status] || ""}`}
                                        >
                                            {apt.status}
                                        </Badge>
                                    </div>
                                    {apt.reason && (
                                        <p className="text-xs text-muted-foreground">{apt.reason}</p>
                                    )}
                                </div>
                                {apt.status === "pending" && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleCancel(apt.id)}
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                                    >
                                        <X className="size-3.5" />
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}