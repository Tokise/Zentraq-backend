"use client"

import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { MonthCalendar, type CalendarMarker } from "@/components/month-calendar"
import { SensitiveField } from "@/components/sensitive-field"
import { toast } from "sonner"
import { Loader2, CalendarDays, X, LayoutGrid, TableProperties, Clock, Plus, ChevronRight } from "lucide-react"
import { getStudentAppointmentsAction, type StudentAppointmentDTO } from "./actions"
import { cancelAppointment } from "@/app/actions/appointments"
import Link from "next/link"

function todayKey() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function statusVariant(status: string): "success" | "warning" | "danger" | "info" | "default" {
    switch (status) {
        case "confirmed": return "info"
        case "completed": return "success"
        case "cancelled": return "danger"
        case "pending": return "warning"
        default: return "default"
    }
}

const STATUS_COLORS: Record<string, string> = {
    pending: "bg-amber-400",
    confirmed: "bg-blue-500",
    completed: "bg-emerald-500",
    cancelled: "bg-zinc-300",
}

function formatDateReadable(dateStr: string) {
    if (!dateStr) return "—"
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
    })
}

type ViewMode = "calendar" | "table"

export default function StudentAppointmentsPage() {
    const searchParams = useSearchParams()
    const targetId = searchParams.get("id")
    const dateParam = searchParams.get("date")

    const [appointments, setAppointments] = useState<StudentAppointmentDTO[]>([])
    const [loading, setLoading] = useState(true)
    const [viewMode, setViewMode] = useState<ViewMode>("calendar")
    
    // Dialog states
    const [selectedAptModal, setSelectedAptModal] = useState<StudentAppointmentDTO | null>(null)
    const [selectedDayApts, setSelectedDayApts] = useState<StudentAppointmentDTO[] | null>(null)
    const [selectedDayNoApts, setSelectedDayNoApts] = useState<string | null>(null)

    async function refreshAppointments() {
        try {
            const res = await getStudentAppointmentsAction()
            if (res.appointments) {
                setAppointments(res.appointments)
            }
        } catch (err) {
            console.error("Error fetching appointments:", err)
        }
    }

    useEffect(() => {
        async function load() {
            setLoading(true)
            await refreshAppointments()
            setLoading(false)
        }
        load()
    }, [])

    // Auto-pop up targeted appointment details modal when redirected with ?id=
    useEffect(() => {
        if (targetId && appointments.length > 0) {
            const match = appointments.find((a) => a.id === targetId)
            if (match) {
                setSelectedAptModal(match)
            }
        }
    }, [targetId, appointments])

    async function handleCancel(id: string) {
        try {
            const result = await cancelAppointment(id)
            if (result.error) {
                toast.error(result.error)
                return
            }

            toast.success("Appointment cancelled")
            setAppointments((prev) =>
                prev.map((a) => (a.id === id ? { ...a, status: "cancelled" } : a))
            )
            if (selectedAptModal?.id === id) {
                setSelectedAptModal(prev => prev ? { ...prev, status: "cancelled" } : null)
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to cancel")
        }
    }

    // Calendar markers
    const markersByDate = useMemo(() => {
        const map: Record<string, CalendarMarker[]> = {}
        for (const apt of appointments) {
            const key = apt.appointment_date
            if (!key) continue
            if (!map[key]) map[key] = []
            map[key].push({ status: apt.status, label: apt.time_slot })
        }
        return map
    }, [appointments])

    // Sort for table view: upcoming first, then past
    const sortedAppointments = useMemo(() => {
        return [...appointments].sort((a, b) => {
            const aActive = !["completed", "cancelled"].includes(a.status) ? 0 : 1
            const bActive = !["completed", "cancelled"].includes(b.status) ? 0 : 1
            if (aActive !== bActive) return aActive - bActive
            return b.appointment_date.localeCompare(a.appointment_date)
        })
    }, [appointments])

    // Handle clicking a box on the MonthCalendar
    const handleSelectDate = (dateKey: string) => {
        const dayApts = appointments.filter((a) => a.appointment_date === dateKey)
        if (dayApts.length === 1) {
            setSelectedAptModal(dayApts[0])
        } else if (dayApts.length > 1) {
            setSelectedDayApts(dayApts)
        } else {
            setSelectedDayNoApts(dateKey)
        }
    }

    return (
        <div className="space-y-5 max-w-5xl mx-auto">
            {/* ──── Header ──── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <PageHeader title="My Appointments" description="Book and manage your clinic appointments." />
                <div className="flex items-center gap-2">
                    {/* View toggle */}
                    <div className="flex items-center bg-zinc-100 rounded-lg p-0.5">
                        <button
                            onClick={() => setViewMode("calendar")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${viewMode === "calendar"
                                ? "bg-white text-zinc-900 shadow-sm"
                                : "text-zinc-500 hover:text-zinc-700"
                                }`}
                        >
                            <LayoutGrid className="size-3.5" />
                            Calendar
                        </button>
                        <button
                            onClick={() => setViewMode("table")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${viewMode === "table"
                                ? "bg-white text-zinc-900 shadow-sm"
                                : "text-zinc-500 hover:text-zinc-700"
                                }`}
                        >
                            <TableProperties className="size-3.5" />
                            List
                        </button>
                    </div>
                    <Link href="/student/appointments/new">
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-sm cursor-pointer">
                            <Plus className="size-3.5" />
                            Book Appointment
                        </Button>
                    </Link>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
            ) : viewMode === "calendar" ? (
                /* ──────────────── CALENDAR VIEW (FULL WIDTH) ──────────────── */
                <div className="space-y-4">
                    <MonthCalendar
                        selectedDate={dateParam || undefined}
                        onSelectDate={handleSelectDate}
                        markersByDate={markersByDate}
                    />
                    {/* Legend */}
                    <div className="flex items-center gap-4 pt-1 flex-wrap px-1">
                        {Object.entries(STATUS_COLORS).map(([status, dot]) => (
                            <span key={status} className="flex items-center gap-1.5 text-[11px] text-zinc-500 capitalize">
                                <span className={`size-2 rounded-full ${dot}`} /> {status}
                            </span>
                        ))}
                    </div>
                </div>
            ) : (
                /* ──────────────── TABLE / LIST VIEW (COMPACT) ──────────────── */
                <Card className="shadow-sm border-zinc-200/80 bg-white overflow-hidden">
                    <CardHeader className="border-b border-zinc-100 pb-4">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <CalendarDays className="size-4 text-blue-600" />
                            All Appointments
                        </CardTitle>
                        <CardDescription>
                            Complete list of your clinic appointment bookings. Click on any row to see details.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {sortedAppointments.length === 0 ? (
                            <div className="py-14 px-6 text-center space-y-2">
                                <CalendarDays className="size-8 text-zinc-200 mx-auto" />
                                <p className="text-sm font-medium text-zinc-500">No appointments yet</p>
                                <p className="text-xs text-zinc-400">Book an appointment to get started.</p>
                            </div>
                        ) : (
                            <>
                                {/* Table header */}
                                <div className="hidden sm:grid grid-cols-[1fr_130px_100px_100px_80px] gap-3 px-5 py-2.5 bg-zinc-50/80 border-b border-zinc-100 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                                    <span>Reason</span>
                                    <span>Date</span>
                                    <span>Time</span>
                                    <span>Status</span>
                                    <span></span>
                                </div>
                                <div className="divide-y divide-zinc-100">
                                    {sortedAppointments.map((apt) => (
                                        <div
                                            key={apt.id}
                                            onClick={() => setSelectedAptModal(apt)}
                                            className="group grid grid-cols-1 sm:grid-cols-[1fr_130px_100px_100px_80px] gap-2 sm:gap-3 items-center px-5 py-3 hover:bg-zinc-50/70 transition-colors cursor-pointer"
                                        >
                                            {/* Reason (Compact column) */}
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className={`size-2 rounded-full shrink-0 ${STATUS_COLORS[apt.status] || "bg-zinc-300"}`} />
                                                <span className="text-sm font-medium text-zinc-800 truncate max-w-[240px] sm:max-w-[320px]">
                                                    {apt.reason || "Clinic visit"}
                                                </span>
                                            </div>
                                            {/* Date */}
                                            <span className="text-xs text-zinc-500">
                                                {formatDateReadable(apt.appointment_date)}
                                            </span>
                                            {/* Time */}
                                            <span className="text-xs text-zinc-500 flex items-center gap-1">
                                                <Clock className="size-3 text-zinc-400" />
                                                {apt.time_slot}
                                            </span>
                                            {/* Status */}
                                            <StatusBadge status={statusVariant(apt.status)} className="text-[10px] w-fit">
                                                {apt.status}
                                            </StatusBadge>
                                            {/* Actions */}
                                            <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={() => setSelectedAptModal(apt)}
                                                    className="text-xs text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
                                                >
                                                    View
                                                </button>
                                                {apt.status === "pending" && (
                                                    <button
                                                        onClick={() => handleCancel(apt.id)}
                                                        className="text-xs text-red-500 hover:text-red-600 font-medium ml-1 cursor-pointer"
                                                    >
                                                        Cancel
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ──── Dialog: Multiple appointments on selected day ──── */}
            {selectedDayApts && (
                <Dialog open={!!selectedDayApts} onOpenChange={() => setSelectedDayApts(null)}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="text-base font-semibold">Appointments</DialogTitle>
                            <DialogDescription className="text-xs">
                                Multiple appointments scheduled for {selectedDayApts[0] ? formatDateReadable(selectedDayApts[0].appointment_date) : ""}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="divide-y divide-zinc-100 max-h-60 overflow-y-auto">
                            {selectedDayApts.map((apt) => (
                                <button
                                    key={apt.id}
                                    onClick={() => {
                                        setSelectedAptModal(apt)
                                        setSelectedDayApts(null)
                                    }}
                                    className="w-full text-left p-3 hover:bg-zinc-50 transition-colors flex items-center justify-between cursor-pointer"
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={`size-2 rounded-full ${STATUS_COLORS[apt.status] || "bg-zinc-300"}`} />
                                        <div>
                                            <p className="text-sm font-medium text-zinc-800">{apt.time_slot}</p>
                                            <p className="text-xs text-zinc-500 truncate max-w-xs">{apt.reason || "Clinic visit"}</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="size-4 text-zinc-300" />
                                </button>
                            ))}
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* ──── Dialog: No appointments scheduled on selected day ──── */}
            {selectedDayNoApts && (
                <Dialog open={!!selectedDayNoApts} onOpenChange={() => setSelectedDayNoApts(null)}>
                    <DialogContent className="sm:max-w-sm">
                        <DialogHeader>
                            <DialogTitle className="text-sm font-semibold">No Appointments Scheduled</DialogTitle>
                            <DialogDescription className="text-xs">
                                There are no appointments scheduled for {formatDateReadable(selectedDayNoApts)}.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="pt-2 flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => setSelectedDayNoApts(null)}>
                                Close
                            </Button>
                            <Link href={`/student/appointments/new?date=${selectedDayNoApts}`}>
                                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setSelectedDayNoApts(null)}>
                                    Book Appointment
                                </Button>
                            </Link>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* ──── Appointment Detail Modal (with SensitiveField) ──── */}
            {selectedAptModal && (
                <Dialog open={!!selectedAptModal} onOpenChange={() => setSelectedAptModal(null)}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="text-base font-semibold">Appointment Details</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                            <div className="pb-3 border-b border-zinc-100">
                                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">Reason / Purpose</span>
                                <div className="flex items-start gap-2">
                                    <div className={`size-3 rounded-full mt-1 shrink-0 ${STATUS_COLORS[selectedAptModal.status] || "bg-zinc-300"}`} />
                                    <SensitiveField
                                        value={selectedAptModal.reason || "Clinic visit"}
                                        fieldType="medicalNotes"
                                        className="text-sm font-semibold text-zinc-900"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">Status</span>
                                    <StatusBadge status={statusVariant(selectedAptModal.status)}>
                                        {selectedAptModal.status}
                                    </StatusBadge>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">Date</span>
                                    <p className="text-sm text-zinc-700 font-medium">{selectedAptModal.appointment_date}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">Time Slot</span>
                                    <p className="text-sm text-zinc-700 font-medium">{selectedAptModal.time_slot}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">Created</span>
                                    <p className="text-sm text-zinc-700 font-medium">
                                        {new Date(selectedAptModal.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                    </p>
                                </div>
                            </div>

                            {selectedAptModal.status === "pending" && (
                                <div className="pt-2 flex justify-end">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleCancel(selectedAptModal.id)}
                                        className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                                    >
                                        <X className="size-3 mr-1" /> Cancel Appointment
                                    </Button>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    )
}