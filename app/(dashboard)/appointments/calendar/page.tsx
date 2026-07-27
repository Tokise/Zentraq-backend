"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Search,
  Calendar as CalendarIcon,
  Clock,
  User,
  Filter,
  ArrowUpDown,
  List,
  Grid,
  ChevronLeft,
  ChevronRight,
  FileText,
  X,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { SectionHeader } from "@/components/section-header"
import { StatusBadge } from "@/components/status-badge"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

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

import { Pagination } from "@/components/pagination"

type Appointment = {
  id: string
  student_number: string
  patient_name: string
  appointment_date: string // YYYY-MM-DD
  appointment_time: string
  purpose: string
  attending_staff: string
  status: "Scheduled" | "Cleared"
  notes?: string
}

const PAGE_SIZE = 8

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: "apt-001",
    student_number: "2023-00124",
    patient_name: "John Doe",
    appointment_date: "2026-07-27",
    appointment_time: "09:00 AM",
    purpose: "Annual Physical Exam",
    attending_staff: "Dr. Sarah Jenkins",
    status: "Scheduled",
    notes: "Patient requested morning slot.",
  },
  {
    id: "apt-002",
    student_number: "2022-00582",
    patient_name: "Jane Smith",
    appointment_date: "2026-07-27",
    appointment_time: "10:30 AM",
    purpose: "Dental Checkup",
    attending_staff: "Dr. Mark Rivera",
    status: "Scheduled",
  },
  {
    id: "apt-003",
    student_number: "2023-01103",
    patient_name: "Michael Brown",
    appointment_date: "2026-07-26",
    appointment_time: "01:00 PM",
    purpose: "Follow-up Consultation",
    attending_staff: "Dr. Sarah Jenkins",
    status: "Scheduled",
    notes: "Blood pressure stabilized.",
  },
  {
    id: "apt-004",
    student_number: "2021-00891",
    patient_name: "Emily Davis",
    appointment_date: "2026-07-26",
    appointment_time: "02:30 PM",
    purpose: "Vaccination / Booster",
    attending_staff: "Nurse Anna Cruz",
    status: "Scheduled",
  },
  {
    id: "apt-005",
    student_number: "2024-00045",
    patient_name: "David Wilson",
    appointment_date: "2026-07-28",
    appointment_time: "11:00 AM",
    purpose: "Injury Evaluation",
    attending_staff: "Dr. Mark Rivera",
    status: "Scheduled",
  },
  {
    id: "apt-006",
    student_number: "2022-01450",
    patient_name: "Sophia Martinez",
    appointment_date: "2026-07-25",
    appointment_time: "09:30 AM",
    purpose: "Medical Certificate Issuance",
    attending_staff: "Dr. Sarah Jenkins",
    status: "Scheduled",
    notes: "Rescheduled by student.",
  },
  {
    id: "apt-007",
    student_number: "2023-00912",
    patient_name: "Daniel Taylor",
    appointment_date: "2026-07-29",
    appointment_time: "03:00 PM",
    purpose: "Eye Strain & Vision Check",
    attending_staff: "Dr. Mark Rivera",
    status: "Scheduled",
  },
  {
    id: "apt-008",
    student_number: "2021-00334",
    patient_name: "Olivia Anderson",
    appointment_date: "2026-07-25",
    appointment_time: "01:30 PM",
    purpose: "General Checkup",
    attending_staff: "Nurse Anna Cruz",
    status: "Scheduled",
  },
]

export default function CalendarPage() {
  const [appointments, setAppointments] = useState<Appointment[]>(MOCK_APPOINTMENTS)
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedDate, setSelectedDate] = useState<string>("")
  const [dateRangeFilter, setDateRangeFilter] = useState<"all" | "today" | "upcoming" | "past">("all")
  const [timeSortOrder, setTimeSortOrder] = useState<"asc" | "desc">("asc")

  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date(2026, 6, 1))

  const [hoveredAppointment, setHoveredAppointment] = useState<Appointment | null>(null)
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [page, setPage] = useState(1)

  const currentDateFormatted = useMemo(() => {
    return new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }, [])

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], [])

  // Dynamic Year Options (-10 years to +10 years from active view)
  const availableYears = useMemo(() => {
    const activeYear = currentMonthDate.getFullYear()
    const years: number[] = []
    for (let y = activeYear - 10; y <= activeYear + 10; y++) {
      years.push(y)
    }
    return years
  }, [currentMonthDate])

  // Sync state with local storage
  useEffect(() => {
    const savedApts = localStorage.getItem("clinic_appointments_list")
    if (savedApts) {
      try {
        const parsed = JSON.parse(savedApts)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAppointments((prev) => {
            const existingIds = new Set(prev.map((a) => a.id))
            const newApts = parsed.filter((a: Appointment) => !existingIds.has(a.id))
            return [...newApts, ...prev]
          })
        }
      } catch (e) {
        console.error("Failed to parse appointments state", e)
      }
    }
  }, [])

  // Filter out any "Cleared" status from the Calendar view
  const activeAppointments = useMemo(() => {
    return appointments.filter((apt) => apt.status !== "Cleared")
  }, [appointments])

  // Single Source of Truth for Appointments Filtering (Grid & List View)
  const filteredAndSortedAppointments = useMemo(() => {
    let result = [...activeAppointments]

    // 1. Text Search
    const keyword = searchQuery.toLowerCase().trim()
    if (keyword) {
      result = result.filter((apt) => {
        const name = apt.patient_name?.toLowerCase() ?? ""
        const studentNum = apt.student_number?.toLowerCase() ?? ""
        const purpose = apt.purpose?.toLowerCase() ?? ""
        const staff = apt.attending_staff?.toLowerCase() ?? ""

        return (
          name.includes(keyword) ||
          studentNum.includes(keyword) ||
          purpose.includes(keyword) ||
          staff.includes(keyword)
        )
      })
    }

    // 2. Date Filtering
    if (selectedDate) {
      result = result.filter((apt) => apt.appointment_date === selectedDate)
    } else {
      if (dateRangeFilter === "today") {
        result = result.filter((apt) => apt.appointment_date === todayStr)
      } else if (dateRangeFilter === "upcoming") {
        result = result.filter((apt) => apt.appointment_date >= todayStr)
      } else if (dateRangeFilter === "past") {
        result = result.filter((apt) => apt.appointment_date < todayStr)
      }
    }

    // 3. Sorting
    result.sort((a, b) => {
      const dateTimeA = new Date(`${a.appointment_date} ${a.appointment_time}`).getTime()
      const dateTimeB = new Date(`${b.appointment_date} ${b.appointment_time}`).getTime()

      return timeSortOrder === "asc" ? dateTimeA - dateTimeB : dateTimeB - dateTimeA
    })

    return result
  }, [activeAppointments, searchQuery, selectedDate, dateRangeFilter, timeSortOrder, todayStr])

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedAppointments.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  const paginatedAppointments = useMemo(() => {
    return filteredAndSortedAppointments.slice(
      (safePage - 1) * PAGE_SIZE,
      safePage * PAGE_SIZE
    )
  }, [filteredAndSortedAppointments, safePage])

  // Google Calendar Month Days
  const calendarGridDays = useMemo(() => {
    const year = currentMonthDate.getFullYear()
    const month = currentMonthDate.getMonth()

    const firstDayIndex = new Date(year, month, 1).getDay()
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate()

    const days = []

    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null)
    }

    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dayStr = String(day).padStart(2, "0")
      const monthStr = String(month + 1).padStart(2, "0")
      const fullDateStr = `${year}-${monthStr}-${dayStr}`

      const dayAppointments = filteredAndSortedAppointments.filter(
        (apt) => apt.appointment_date === fullDateStr
      )

      days.push({
        dayNumber: day,
        dateStr: fullDateStr,
        appointments: dayAppointments,
        isToday: fullDateStr === todayStr,
      })
    }

    return days
  }, [currentMonthDate, filteredAndSortedAppointments, todayStr])

  const getStatusVariant = (status: Appointment["status"]) => {
    switch (status) {
      case "Scheduled":
        return "default"
      default:
        return "default"
    }
  }

  const getStatusColorClass = (status: Appointment["status"]) => {
    switch (status) {
      case "Scheduled":
        return "bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200"
      default:
        return "bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200"
    }
  }

  const handleResetFilters = () => {
    setSearchQuery("")
    setSelectedDate("")
    setDateRangeFilter("all")
    setTimeSortOrder("asc")
    setPage(1)
  }

  const handlePrevMonth = () => {
    setCurrentMonthDate(
      new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1)
    )
  }

  const handleNextMonth = () => {
    setCurrentMonthDate(
      new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1)
    )
  }

  const handleMonthSelect = (monthIndex: number) => {
    setCurrentMonthDate(
      new Date(currentMonthDate.getFullYear(), monthIndex, 1)
    )
  }

  const handleYearSelect = (year: number) => {
    setCurrentMonthDate(
      new Date(year, currentMonthDate.getMonth(), 1)
    )
  }

  const handleJumpToToday = () => {
    const now = new Date()
    setCurrentMonthDate(new Date(now.getFullYear(), now.getMonth(), 1))
  }

  const handleDateCellClick = (dateStr: string) => {
    setSelectedDate(dateStr)
    setPage(1)
    setViewMode("list")
  }

  const handleMouseEnterChip = (
    e: React.MouseEvent<HTMLButtonElement>,
    apt: Appointment
  ) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setHoverPos({
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY - 10,
    })
    setHoveredAppointment(apt)
  }

  return (
    <div className="space-y-8 relative">
      {hoveredAppointment && (
        <div
          style={{
            left: `${hoverPos.x}px`,
            top: `${hoverPos.y}px`,
            transform: "translate(-50%, -100%)",
          }}
          className="fixed z-50 w-72 p-3 bg-popover text-popover-foreground border shadow-xl rounded-lg pointer-events-none transition-all duration-150 animate-in fade-in-0 zoom-in-95"
        >
          <div className="flex items-start justify-between border-b pb-2 mb-2">
            <div>
              <p className="font-bold text-sm text-foreground flex items-center gap-1.5">
                <User className="size-3.5 text-primary" />
                {hoveredAppointment.patient_name}
              </p>
              <p className="text-[11px] text-muted-foreground">
                No: {hoveredAppointment.student_number}
              </p>
            </div>
            <StatusBadge status={getStatusVariant(hoveredAppointment.status)}>
              {hoveredAppointment.status}
            </StatusBadge>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="size-3.5 text-primary" />
              <span>
                {hoveredAppointment.appointment_date} at{" "}
                <strong className="text-foreground">{hoveredAppointment.appointment_time}</strong>
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-muted-foreground">
              <FileText className="size-3.5 text-primary" />
              <span className="line-clamp-1">{hoveredAppointment.purpose}</span>
            </div>

            <div className="pt-1 border-t text-[11px] text-muted-foreground flex justify-between">
              <span>Staff:</span>
              <span className="font-semibold text-foreground">
                {hoveredAppointment.attending_staff}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Top Today's Date Banner */}
      <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider bg-primary/10 px-3.5 py-1.5 rounded-md w-fit">
        <CalendarIcon className="size-3.5" />
        <span>Today: {currentDateFormatted}</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Calendar & Appointments"
          description="View and manage patient appointment schedules and clinic bookings."
        />

        {/* View Toggle Buttons */}
        <div className="flex items-center rounded-lg border p-1 bg-muted/40 w-fit">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${viewMode === "list"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
              }`}
          >
            <List className="size-3.5" />
            <span>List View</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${viewMode === "grid"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
              }`}
          >
            <Grid className="size-3.5" />
            <span>Calendar View</span>
          </button>
        </div>
      </div>

      {/* Active Date Filter Alert Tag */}
      {selectedDate && (
        <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg text-xs font-medium">
          <div className="flex items-center gap-2">
            <CalendarIcon className="size-4 text-indigo-600" />
            <span>
              Showing appointments for selected date: <strong>{selectedDate}</strong> ({filteredAndSortedAppointments.length} item(s))
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedDate("")}
            className="flex items-center gap-1 hover:underline text-indigo-700 font-semibold"
          >
            <span>Show All Dates</span>
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <Card className="shadow-sm">
        <CardHeader>
          <SectionHeader
            title="Appointment Schedule"
            description={`${filteredAndSortedAppointments.length} total active appointment(s)`}
          />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1 sm:flex-none sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search patient, staff, or purpose..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
                className="pl-9 h-9 text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value)
                  setPage(1)
                }}
                className="h-9 w-auto text-sm"
              />
            </div>

            {!selectedDate && (
              <div className="flex items-center gap-1 rounded-md border p-1 text-xs">
                <Filter className="size-3 text-muted-foreground ml-1 mr-0.5" />
                <button
                  type="button"
                  onClick={() => { setDateRangeFilter("all"); setPage(1); }}
                  className={`px-2 py-1 rounded-sm font-medium transition-colors ${dateRangeFilter === "all" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => { setDateRangeFilter("today"); setPage(1); }}
                  className={`px-2 py-1 rounded-sm font-medium transition-colors ${dateRangeFilter === "today" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => { setDateRangeFilter("upcoming"); setPage(1); }}
                  className={`px-2 py-1 rounded-sm font-medium transition-colors ${dateRangeFilter === "upcoming" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                >
                  Upcoming
                </button>
                <button
                  type="button"
                  onClick={() => { setDateRangeFilter("past"); setPage(1); }}
                  className={`px-2 py-1 rounded-sm font-medium transition-colors ${dateRangeFilter === "past" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                >
                  Past
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setTimeSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
              className="flex items-center gap-1.5 h-9 px-3 rounded-md border text-xs font-medium hover:bg-muted transition-colors"
            >
              <ArrowUpDown className="size-3.5 text-muted-foreground" />
              <span>{timeSortOrder === "asc" ? "Earliest First" : "Latest First"}</span>
            </button>

            {(selectedDate || searchQuery || dateRangeFilter !== "all") && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-muted-foreground underline hover:text-foreground ml-auto"
              >
                Reset filters
              </button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {viewMode === "list" ? (
            /* Synchronized List View */
            filteredAndSortedAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CalendarIcon className="mb-4 size-12 text-muted-foreground" />
                <h3 className="text-lg font-semibold">No active appointments found</h3>
                <p className="text-sm text-muted-foreground">
                  No appointment matches your search or date criteria.
                </p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Student No.</TableHead>
                      <TableHead>Patient Name</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Attending Staff</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedAppointments.map((apt) => (
                      <TableRow
                        key={apt.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedAppointment(apt)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{apt.appointment_date}</span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="size-3 inline" />
                              {apt.appointment_time}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{apt.student_number}</TableCell>
                        <TableCell className="font-medium">
                          {apt.patient_name}
                        </TableCell>
                        <TableCell>{apt.purpose}</TableCell>
                        <TableCell>{apt.attending_staff}</TableCell>
                        <TableCell>
                          <StatusBadge status={getStatusVariant(apt.status)}>
                            {apt.status}
                          </StatusBadge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="mt-4">
                  <Pagination
                    currentPage={safePage}
                    totalPages={totalPages}
                    totalItems={filteredAndSortedAppointments.length}
                    pageSize={PAGE_SIZE}
                    onPageChange={setPage}
                  />
                </div>
              </>
            )
          ) : (
            /* Synchronized Calendar Grid View */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b">
                <div className="flex items-center gap-2">
                  {/* Interactive Month Picker */}
                  <select
                    value={currentMonthDate.getMonth()}
                    onChange={(e) => handleMonthSelect(Number(e.target.value))}
                    className="h-9 px-2.5 py-1 text-sm font-bold bg-background border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                  >
                    {MONTH_NAMES.map((month, idx) => (
                      <option key={month} value={idx}>
                        {month}
                      </option>
                    ))}
                  </select>

                  {/* Interactive Year Picker */}
                  <select
                    value={currentMonthDate.getFullYear()}
                    onChange={(e) => handleYearSelect(Number(e.target.value))}
                    className="h-9 px-2.5 py-1 text-sm font-bold bg-background border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                  >
                    {availableYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>

                  {/* Jump to Today Quick Action */}
                  <button
                    type="button"
                    onClick={handleJumpToToday}
                    className="h-9 px-3 text-xs font-semibold rounded-md border hover:bg-muted transition-colors"
                  >
                    Today
                  </button>
                </div>

                {/* Step Month Buttons */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    aria-label="Previous Month"
                    className="p-1.5 rounded-md border hover:bg-muted transition-colors"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    aria-label="Next Month"
                    className="p-1.5 rounded-md border hover:bg-muted transition-colors"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 text-center font-bold text-xs uppercase tracking-wider text-muted-foreground py-1">
                <div>Sun</div>
                <div>Mon</div>
                <div>Tue</div>
                <div>Wed</div>
                <div>Thu</div>
                <div>Fri</div>
                <div>Sat</div>
              </div>

              <div className="grid grid-cols-7 border-t border-l rounded-lg overflow-hidden bg-background">
                {calendarGridDays.map((dayItem, index) => {
                  if (!dayItem) {
                    return (
                      <div
                        key={`empty-${index}`}
                        className="min-h-[110px] border-r border-b bg-muted/20 p-1"
                      />
                    )
                  }

                  return (
                    <div
                      key={dayItem.dateStr}
                      onClick={() => handleDateCellClick(dayItem.dateStr)}
                      className={`min-h-[110px] border-r border-b p-1.5 flex flex-col justify-start transition-colors cursor-pointer group hover:bg-muted/40 ${dayItem.isToday ? "bg-primary/5" : "bg-background"
                        }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs font-semibold px-1.5 py-0.5 rounded-full transition-transform group-hover:scale-110 ${dayItem.isToday
                            ? "bg-primary text-primary-foreground font-bold"
                            : "text-muted-foreground group-hover:text-primary"
                            }`}
                        >
                          {dayItem.dayNumber}
                        </span>

                        {dayItem.appointments.length > 0 && (
                          <span className="text-[10px] bg-primary/10 text-primary font-bold px-1 rounded">
                            {dayItem.appointments.length}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 overflow-y-auto max-h-[85px] text-left">
                        {dayItem.appointments.map((apt) => (
                          <button
                            key={apt.id}
                            type="button"
                            onMouseEnter={(e) => {
                              e.stopPropagation()
                              handleMouseEnterChip(e, apt)
                            }}
                            onMouseLeave={() => setHoveredAppointment(null)}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedAppointment(apt)
                            }}
                            className={`w-full text-left p-1 rounded border text-[10px] leading-tight truncate block transition-all hover:scale-[1.02] ${getStatusColorClass(
                              apt.status
                            )}`}
                          >
                            <span className="font-semibold">{apt.appointment_time}</span>
                            <span className="ml-1 truncate font-medium">
                              {apt.patient_name}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={selectedAppointment !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAppointment(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
          </DialogHeader>

          {selectedAppointment && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Student Number</p>
                  <p className="font-medium">{selectedAppointment.student_number}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <div className="mt-1">
                    <StatusBadge status={getStatusVariant(selectedAppointment.status)}>
                      {selectedAppointment.status}
                    </StatusBadge>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Patient Name</p>
                <p className="font-medium text-lg flex items-center gap-2">
                  <User className="size-4 text-muted-foreground" />
                  {selectedAppointment.patient_name}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="font-medium">{selectedAppointment.appointment_date}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Time</p>
                  <p className="font-medium">{selectedAppointment.appointment_time}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Purpose of Visit</p>
                <p className="font-medium">{selectedAppointment.purpose}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Attending Staff</p>
                <p className="font-medium">{selectedAppointment.attending_staff}</p>
              </div>

              {selectedAppointment.notes && (
                <div>
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="text-sm bg-muted/40 p-3 rounded-md mt-1">
                    {selectedAppointment.notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}