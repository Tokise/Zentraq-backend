"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { SectionHeader } from "@/components/section-header"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/status-badge"
import { Pagination } from "@/components/pagination"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { updateAppointmentStatus, cancelAppointment, rescheduleAppointment } from "../actions"
import { CalendarDays, Loader2, Check, X, Search, List, Users } from "lucide-react"
import { MonthCalendar, CalendarMarker } from "@/components/month-calendar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const PAGE_SIZE = 8

function todayDateKey() {
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

export default function AppointmentsCalendarPage() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const dateParam = searchParams.get("date")
  const targetId = searchParams.get("id")

  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<string>(dateParam || todayDateKey())
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [selectedAptModal, setSelectedAptModal] = useState<any | null>(null)

  // View Mode: Table List (default) vs Full Calendar View
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table")

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState(dateParam || "")
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useState(1)

  const fetchAppointments = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("student_appointments")
        .select("*, student_accounts(first_name, last_name, student_number, employee_number, department)")
        .order("appointment_date", { ascending: false })

      setAppointments(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchAppointments()

    const channel = supabase
      .channel("appointments-calendar-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "student_appointments" },
        () => fetchAppointments()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, fetchAppointments])

  // Auto-pop up targeted appointment when ?id= parameter is present
  useEffect(() => {
    if (targetId && appointments.length > 0) {
      const match = appointments.find((a) => a.id === targetId)
      if (match) {
        setSelectedDay(match.appointment_date)
        setSelectedAptModal(match)
      }
    }
  }, [targetId, appointments])

  async function updateStatus(id: string, status: string) {
    setUpdatingId(id)
    try {
      const result = await updateAppointmentStatus(id, status)
      if (result.error) {
        toast.error(result.error)
        return
      }

      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)))
      toast.success(`Marked as ${status}`)
      if (selectedAptModal?.id === id) {
        setSelectedAptModal((prev: any) => (prev ? { ...prev, status } : null))
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update appointment")
    } finally {
      setUpdatingId(null)
    }
  }

  const markersByDate = useMemo(() => {
    const map: Record<string, CalendarMarker[]> = {}
    for (const apt of appointments) {
      const key = apt.appointment_date
      if (!map[key]) map[key] = []
      map[key].push({ status: apt.status })
    }
    return map
  }, [appointments])

  // Filtered appointments for main table
  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      const sa = apt.student_accounts
      const name = sa ? `${sa.first_name} ${sa.last_name}` : "Unknown"
      const studentNo = sa ? (sa.student_number || sa.employee_number || "") : ""

      const matchesSearch =
        !searchQuery ||
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        studentNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        apt.appointment_date.includes(searchQuery) ||
        (apt.reason && apt.reason.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesStatus = statusFilter === "all" || apt.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [appointments, searchQuery, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredAppointments.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginatedAppointments = filteredAppointments.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  )

  return (
    <div className="space-y-6">
      {/* Header with View Toggle */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <PageHeader title="Appointments Management" description="View and manage all student appointments" />
        <div className="flex items-center gap-2 bg-muted/60 p-1 rounded-lg border border-border/50 shrink-0 self-start md:self-auto">
          <Button
            variant={viewMode === "table" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("table")}
            className="h-8 text-xs gap-1.5 cursor-pointer font-medium"
          >
            <List className="size-4" /> Table List
          </Button>
          <Button
            variant={viewMode === "calendar" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("calendar")}
            className="h-8 text-xs gap-1.5 cursor-pointer font-medium"
          >
            <CalendarDays className="size-4" /> Calendar View
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* MAIN VIEW 1: Table List View (Default) */}
          {viewMode === "table" && (
            <Card className="shadow-sm border-zinc-200/80">
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <SectionHeader title="Appointments Table List" description="Click any row to view full details" />
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-full md:w-64">
                      <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                      <Input
                        placeholder="Search patient or date..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value)
                          setPage(1)
                        }}
                        className="pl-9 h-9 text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1.5 pt-2 flex-wrap border-t border-border/40 mt-3">
                  {["all", "pending", "confirmed", "completed", "cancelled"].map((st) => (
                    <Button
                      key={st}
                      variant={statusFilter === st ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setStatusFilter(st)
                        setPage(1)
                      }}
                      className="h-7 text-xs capitalize cursor-pointer"
                    >
                      {st === "all" ? "All Status" : st}
                    </Button>
                  ))}
                </div>
              </CardHeader>

              <CardContent className="px-0 sm:px-6 pb-4">
                {paginatedAppointments.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <CalendarDays className="size-8 text-zinc-300 mx-auto" />
                    <p className="text-sm font-medium text-muted-foreground">No appointments found</p>
                    <p className="text-xs text-zinc-400">Try adjusting your search query or status filter.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table className="w-full">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student / Patient</TableHead>
                          <TableHead>Date & Time</TableHead>
                          <TableHead>Reason / Notes</TableHead>
                          <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedAppointments.map((apt) => {
                          const sa = apt.student_accounts
                          const name = sa ? `${sa.first_name} ${sa.last_name}` : "Unknown"

                          return (
                            <TableRow
                              key={apt.id}
                              className="cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => setSelectedAptModal(apt)}
                            >
                              <TableCell className="font-medium">
                                <div>
                                  <p className="text-sm font-semibold">{name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {sa?.student_number || sa?.employee_number || "—"} {sa?.department ? `• ${sa.department}` : ""}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                <p className="text-xs font-medium">{apt.appointment_date}</p>
                                <p className="text-xs text-muted-foreground">{apt.time_slot}</p>
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                                {apt.reason || "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                <StatusBadge status={statusVariant(apt.status)}>
                                  {apt.status}
                                </StatusBadge>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>

              {filteredAppointments.length > 0 && (
                <div className="p-4 pt-2 border-t border-border/40">
                  <Pagination
                    currentPage={safePage}
                    totalPages={totalPages}
                    totalItems={filteredAppointments.length}
                    pageSize={PAGE_SIZE}
                    onPageChange={setPage}
                  />
                </div>
              )}
            </Card>
          )}

          {/* VIEW 2: Full-Width Calendar View */}
          {viewMode === "calendar" && (
            <Card className="shadow-sm border-zinc-200/80 w-full">
              <CardHeader>
                <SectionHeader title="Full-Width Calendar View" description="Click on any date to filter appointments in table view" />
              </CardHeader>
              <CardContent className="space-y-4">
                <MonthCalendar
                  selectedDate={selectedDay}
                  onSelectDate={(dateKey) => {
                    setSelectedDay(dateKey)
                    setSearchQuery(dateKey)
                    setViewMode("table")
                  }}
                  markersByDate={markersByDate}
                />
                <div className="flex items-center justify-between gap-3 pt-3 flex-wrap px-1 border-t border-border/50">
                  <div className="flex items-center gap-4 flex-wrap">
                    {Object.entries({
                      pending: "bg-amber-400",
                      confirmed: "bg-blue-500",
                      completed: "bg-emerald-500",
                      cancelled: "bg-zinc-300",
                    }).map(([status, dot]) => (
                      <span key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground capitalize">
                        <span className={`size-2 rounded-full ${dot}`} /> {status}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Appointment Details Pop-up Modal */}
          {selectedAptModal && (
            <Dialog open={!!selectedAptModal} onOpenChange={() => setSelectedAptModal(null)}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-base font-semibold">Appointment Details</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-xs text-muted-foreground">Student / Patient</span>
                    <span className="text-sm font-semibold">
                      {selectedAptModal.student_accounts
                        ? `${selectedAptModal.student_accounts.first_name} ${selectedAptModal.student_accounts.last_name}`
                        : "Unknown"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-xs text-muted-foreground">ID Number</span>
                    <span className="text-sm font-medium">
                      {selectedAptModal.student_accounts?.student_number || selectedAptModal.student_accounts?.employee_number || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-xs text-muted-foreground">Date & Time</span>
                    <span className="text-sm font-medium">
                      {selectedAptModal.appointment_date} at {selectedAptModal.time_slot}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-xs text-muted-foreground">Status</span>
                    <StatusBadge status={statusVariant(selectedAptModal.status)}>
                      {selectedAptModal.status}
                    </StatusBadge>
                  </div>
                  {selectedAptModal.reason && (
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Reason / Purpose</span>
                      <p className="text-xs bg-muted/40 p-2.5 rounded-md leading-relaxed text-foreground">{selectedAptModal.reason}</p>
                    </div>
                  )}

                  {/* Single Redirect Button */}
                  <div className="flex items-center justify-center pt-3 border-t border-border/40">
                    <Button
                      size="sm"
                      onClick={() => {
                        const targetId = selectedAptModal.id
                        setSelectedAptModal(null)
                        router.push(`/appointments/queue?id=${targetId}`)
                      }}
                      className="h-8 text-xs px-4 cursor-pointer gap-1.5"
                    >
                      <Users className="size-3.5" /> View in Live Queue
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </>
      )}
    </div>
  )
}