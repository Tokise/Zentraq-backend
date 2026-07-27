"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Search,
  Users,
  Clock,
  ArrowUpDown,
  Filter,
  AlertCircle,
  Sparkles,
  UserPlus,
  Bot,
  Calendar as CalendarIcon,
  CheckCircle2,
  PlusCircle,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { SectionHeader } from "@/components/section-header"
import { StatusBadge } from "@/components/status-badge"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

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

type QueueItem = {
  id: string
  queue_number: string
  student_number: string
  patient_name: string
  department: string
  purpose: string
  arrival_time: string
  status: "Waiting" | "In Consultation" | "Completed" | "Skipped"
  priority: "Normal" | "Urgent"
  notes?: string
  entry_type?: "Walk-in" | "AI Scheduled"
}

type TimeSlot = {
  time: string
  bookedCount: number
  maxCapacity: number
}

const PAGE_SIZE = 8

const DEFAULT_TIME_SLOTS: TimeSlot[] = [
  { time: "08:00 AM", bookedCount: 4, maxCapacity: 4 },
  { time: "09:00 AM", bookedCount: 2, maxCapacity: 4 },
  { time: "10:00 AM", bookedCount: 1, maxCapacity: 4 },
  { time: "11:00 AM", bookedCount: 4, maxCapacity: 4 },
  { time: "01:00 PM", bookedCount: 0, maxCapacity: 4 },
  { time: "02:00 PM", bookedCount: 3, maxCapacity: 4 },
  { time: "03:00 PM", bookedCount: 2, maxCapacity: 4 },
  { time: "04:00 PM", bookedCount: 4, maxCapacity: 4 },
]

const MOCK_QUEUE: QueueItem[] = [
  {
    id: "q-001",
    queue_number: "Q-001",
    student_number: "2023-00124",
    patient_name: "John Doe",
    department: "Computer Studies",
    purpose: "Fever & Cold Consultation",
    arrival_time: "08:15 AM",
    status: "In Consultation",
    priority: "Normal",
    notes: "Patient checked in at front desk.",
    entry_type: "Walk-in",
  },
  {
    id: "q-002",
    queue_number: "Q-002",
    student_number: "2022-00582",
    patient_name: "Jane Smith",
    department: "Engineering",
    purpose: "Blood Pressure Check",
    arrival_time: "08:30 AM",
    status: "Waiting",
    priority: "Normal",
    entry_type: "Walk-in",
  },
  {
    id: "q-003",
    queue_number: "Q-003",
    student_number: "2021-00891",
    patient_name: "Emily Davis",
    department: "Business Administration",
    purpose: "Severe Allergic Reaction",
    arrival_time: "08:42 AM",
    status: "Waiting",
    priority: "Urgent",
    notes: "AI Triage flagged for immediate doctor attention.",
    entry_type: "AI Scheduled",
  },
  {
    id: "q-004",
    queue_number: "Q-004",
    student_number: "2024-00045",
    patient_name: "David Wilson",
    department: "Arts & Sciences",
    purpose: "Medical Certificate Clearance",
    arrival_time: "08:50 AM",
    status: "Waiting",
    priority: "Normal",
    entry_type: "Walk-in",
  },
]

export default function QueuePage() {
  const [queueList, setQueueList] = useState<QueueItem[]>(MOCK_QUEUE)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "Waiting" | "In Consultation" | "Completed" | "Skipped">("all")
  const [timeSortOrder, setTimeSortOrder] = useState<"asc" | "desc">("asc")

  const [selectedQueueItem, setSelectedQueueItem] = useState<QueueItem | null>(null)
  const [page, setPage] = useState(1)

  // AI Intake & Schedule Checker States
  const [isAiModalOpen, setIsAiModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"quick_walkin" | "ai_assistant">("quick_walkin")
  const [aiPrompt, setAiPrompt] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [aiFeedback, setAiFeedback] = useState<string | null>(null)

  // Quick Walk-In Form State
  const [walkInName, setWalkInName] = useState("")
  const [walkInStudentNo, setWalkInStudentNo] = useState("")
  const [walkInDepartment, setWalkInDepartment] = useState("Engineering")
  const [walkInPurpose, setWalkInPurpose] = useState("")
  const [walkInPriority, setWalkInPriority] = useState<"Normal" | "Urgent">("Normal")

  // Schedule Slot Availability States
  const [checkDate, setCheckDate] = useState<string>(new Date().toISOString().split("T")[0])
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [slots] = useState<TimeSlot[]>(DEFAULT_TIME_SLOTS)

  const currentDateFormatted = useMemo(() => {
    return new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }, [])

  useEffect(() => {
    const savedQueue = localStorage.getItem("clinic_queue_list")
    if (savedQueue) {
      try {
        setQueueList(JSON.parse(savedQueue))
      } catch (e) {
        console.error("Failed to parse queue state", e)
      }
    }
  }, [])

  const saveQueueState = (newList: QueueItem[]) => {
    setQueueList(newList)
    localStorage.setItem("clinic_queue_list", JSON.stringify(newList))
  }

  // Rapid Walk-In Manual Registration
  const handleQuickWalkIn = (e: React.FormEvent) => {
    e.preventDefault()
    if (!walkInName.trim()) return

    const nextQueueNo = `Q-00${queueList.length + 1}`
    const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

    const newTicket: QueueItem = {
      id: `q-${Date.now()}`,
      queue_number: nextQueueNo,
      student_number: walkInStudentNo || `2026-${Math.floor(10000 + Math.random() * 90000)}`,
      patient_name: walkInName,
      department: walkInDepartment,
      purpose: walkInPurpose || "General Clinic Checkup",
      arrival_time: timeNow,
      status: "Waiting",
      priority: walkInPriority,
      notes: "Direct Walk-In Check-in",
      entry_type: "Walk-in",
    }

    const updated = [newTicket, ...queueList]
    saveQueueState(updated)

    // Reset Form
    setWalkInName("")
    setWalkInStudentNo("")
    setWalkInPurpose("")
    setWalkInPriority("Normal")
    setIsAiModalOpen(false)
  }

  const handleSelectSlot = (slot: TimeSlot) => {
    if (slot.bookedCount >= slot.maxCapacity) return
    setSelectedSlot(slot.time)

    setAiPrompt(
      (prev) =>
        `Schedule appointment for ${checkDate} at ${slot.time}. ${prev.replace(/Schedule appointment for .*\./, "").trim()}`
    )
  }

  const handleAiProcess = () => {
    if (!aiPrompt.trim()) return

    setIsAnalyzing(true)
    setAiFeedback(null)

    setTimeout(() => {
      const text = aiPrompt.toLowerCase()

      const isAppointment =
        Boolean(selectedSlot) ||
        text.includes("appointment") ||
        text.includes("schedule") ||
        text.includes("tomorrow")

      const isUrgent =
        text.includes("severe") ||
        text.includes("bleeding") ||
        text.includes("fainted") ||
        text.includes("high fever") ||
        text.includes("chest pain")

      const studentMatch = aiPrompt.match(/\b\d{4}-\d{5}\b/)
      const studentNum = studentMatch
        ? studentMatch[0]
        : `2026-${Math.floor(10000 + Math.random() * 90000)}`

      const nameMatch = aiPrompt.match(/(?:patient|student|name is)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/i)
      const patientName = nameMatch ? nameMatch[1] : "Walk-in Patient"

      const deptMatch = aiPrompt.match(/(?:engineering|computer studies|nursing|architecture|business|arts)/i)
      const department = deptMatch ? deptMatch[0].toUpperCase() : "General"

      const slotTime = selectedSlot || "09:00 AM"

      if (isAppointment) {
        const newAppointment = {
          id: `apt-${Date.now()}`,
          student_number: studentNum,
          patient_name: patientName,
          appointment_date: checkDate,
          appointment_time: slotTime,
          purpose: aiPrompt.slice(0, 50) + "...",
          attending_staff: isUrgent ? "Dr. Sarah Jenkins" : "Nurse Anna Cruz",
          status: "Scheduled",
          notes: `Slot reserved via AI Assistant for ${checkDate} ${slotTime}.`,
        }

        const existingApts = JSON.parse(
          localStorage.getItem("clinic_appointments_list") || "[]"
        )
        localStorage.setItem(
          "clinic_appointments_list",
          JSON.stringify([newAppointment, ...existingApts])
        )

        setAiFeedback(
          `Slot Confirmed! Created Appointment for ${patientName} on ${checkDate} at ${slotTime}. Synced to Calendar!`
        )
      } else {
        const nextQueueNo = `Q-00${queueList.length + 1}`
        const newQueueTicket: QueueItem = {
          id: `q-${Date.now()}`,
          queue_number: nextQueueNo,
          student_number: studentNum,
          patient_name: patientName,
          department: department,
          purpose: aiPrompt,
          arrival_time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "Waiting",
          priority: isUrgent ? "Urgent" : "Normal",
          notes: isUrgent ? "AI Urgency Escalation Flag" : "Walk-in Registration",
          entry_type: "AI Scheduled",
        }

        const updatedQueue = [newQueueTicket, ...queueList]
        saveQueueState(updatedQueue)

        setAiFeedback(
          `Generated Queue Ticket #${nextQueueNo} for ${patientName} (${isUrgent ? "URGENT" : "Normal Priority"}). Added to live queue!`
        )
      }

      setIsAnalyzing(false)
      setSelectedSlot(null)
      setAiPrompt("")
    }, 1000)
  }

  const filteredAndSortedQueue = useMemo(() => {
    let result = [...queueList]

    const keyword = searchQuery.toLowerCase().trim()
    if (keyword) {
      result = result.filter((item) => {
        const name = item.patient_name?.toLowerCase() ?? ""
        const studentNum = item.student_number?.toLowerCase() ?? ""
        const queueNum = item.queue_number?.toLowerCase() ?? ""
        const dept = item.department?.toLowerCase() ?? ""
        const purpose = item.purpose?.toLowerCase() ?? ""

        return (
          name.includes(keyword) ||
          studentNum.includes(keyword) ||
          queueNum.includes(keyword) ||
          dept.includes(keyword) ||
          purpose.includes(keyword)
        )
      })
    }

    if (statusFilter !== "all") {
      result = result.filter((item) => item.status === statusFilter)
    }

    result.sort((a, b) => {
      if (a.status === "In Consultation" && b.status !== "In Consultation") return -1
      if (b.status === "In Consultation" && a.status !== "In Consultation") return 1

      if (a.priority === "Urgent" && b.priority !== "Urgent") return -1
      if (b.priority === "Urgent" && a.priority !== "Urgent") return 1

      const parseTime = (tStr: string) => {
        const [time, modifier] = tStr.split(" ")
        let [hours, minutes] = time.split(":").map(Number)
        if (modifier === "PM" && hours < 12) hours += 12
        if (modifier === "AM" && hours === 12) hours = 0
        return hours * 60 + minutes
      }

      const timeA = parseTime(a.arrival_time)
      const timeB = parseTime(b.arrival_time)

      return timeSortOrder === "asc" ? timeA - timeB : timeB - timeA
    })

    return result
  }, [queueList, searchQuery, statusFilter, timeSortOrder])

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedQueue.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  const paginatedQueue = useMemo(() => {
    return filteredAndSortedQueue.slice(
      (safePage - 1) * PAGE_SIZE,
      safePage * PAGE_SIZE
    )
  }, [filteredAndSortedQueue, safePage])

  const getStatusVariant = (status: QueueItem["status"]) => {
    switch (status) {
      case "In Consultation":
        return "success"
      case "Waiting":
        return "warning"
      case "Completed":
        return "default"
      case "Skipped":
        return "danger"
      default:
        return "default"
    }
  }

  const handleResetFilters = () => {
    setSearchQuery("")
    setStatusFilter("all")
    setTimeSortOrder("asc")
    setPage(1)
  }

  return (
    <div className="space-y-8">
      {/* Top Today's Date Banner */}
      <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider bg-primary/10 px-3.5 py-1.5 rounded-md w-fit">
        <CalendarIcon className="size-3.5" />
        <span>Today: {currentDateFormatted}</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Patient Queue"
          description="Monitor live waiting queues and flexibly register walk-ins or scheduled consultations."
        />

        <Button
          onClick={() => setIsAiModalOpen(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow"
        >
          <PlusCircle className="size-4" />
          <span>Add Walk-In / Schedule Intake</span>
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <SectionHeader
            title="Live Waiting Queue"
            description={`${filteredAndSortedQueue.length} patient(s) in queue list`}
          />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1 sm:flex-none sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search queue no, name, purpose..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
                className="pl-9 h-9 text-sm"
              />
            </div>

            <div className="flex items-center gap-1 rounded-md border p-1 text-xs">
              <Filter className="size-3 text-muted-foreground ml-1 mr-0.5" />
              <button
                type="button"
                onClick={() => { setStatusFilter("all"); setPage(1); }}
                className={`px-2 py-1 rounded-sm font-medium transition-colors ${statusFilter === "all" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => { setStatusFilter("Waiting"); setPage(1); }}
                className={`px-2 py-1 rounded-sm font-medium transition-colors ${statusFilter === "Waiting" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
              >
                Waiting
              </button>
              <button
                type="button"
                onClick={() => { setStatusFilter("In Consultation"); setPage(1); }}
                className={`px-2 py-1 rounded-sm font-medium transition-colors ${statusFilter === "In Consultation" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
              >
                In Consultation
              </button>
              <button
                type="button"
                onClick={() => { setStatusFilter("Completed"); setPage(1); }}
                className={`px-2 py-1 rounded-sm font-medium transition-colors ${statusFilter === "Completed" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
              >
                Completed
              </button>
            </div>

            <button
              type="button"
              onClick={() => setTimeSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
              className="flex items-center gap-1.5 h-9 px-3 rounded-md border text-xs font-medium hover:bg-muted transition-colors"
            >
              <ArrowUpDown className="size-3.5 text-muted-foreground" />
              <span>{timeSortOrder === "asc" ? "Earliest Arrival" : "Latest Arrival"}</span>
            </button>

            {(searchQuery || statusFilter !== "all") && (
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
          {paginatedQueue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="mb-4 size-12 text-muted-foreground" />
              <h3 className="text-lg font-semibold">No queue records found</h3>
              <p className="text-sm text-muted-foreground">
                No patient in queue matches your search criteria.
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Queue No.</TableHead>
                    <TableHead>Student No.</TableHead>
                    <TableHead>Patient Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Arrival Time</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedQueue.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedQueueItem(item)}
                    >
                      <TableCell className="font-bold text-primary">
                        <div className="flex items-center gap-1.5">
                          {item.queue_number}
                          {item.entry_type === "AI Scheduled" && (
                            <Sparkles className="size-3 text-purple-600" title="AI Processed Ticket" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{item.student_number}</TableCell>
                      <TableCell className="font-medium">
                        {item.patient_name}
                      </TableCell>
                      <TableCell>{item.department}</TableCell>
                      <TableCell>{item.purpose}</TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="size-3 inline" />
                          {item.arrival_time}
                        </span>
                      </TableCell>
                      <TableCell>
                        {item.priority === "Urgent" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive">
                            <AlertCircle className="size-3.5" />
                            Urgent
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Normal</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={getStatusVariant(item.status)}>
                          {item.status}
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
                  totalItems={filteredAndSortedQueue.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Flexible Walk-In & AI Registration Modal */}
      <Dialog open={isAiModalOpen} onOpenChange={setIsAiModalOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-600">
              <UserPlus className="size-5" />
              <span>Patient Intake & Walk-In Desk</span>
            </DialogTitle>
          </DialogHeader>

          {/* Tab Selection Switcher */}
          <div className="flex border-b border-muted">
            <button
              type="button"
              onClick={() => setActiveTab("quick_walkin")}
              className={`pb-2 px-4 text-xs font-semibold transition-colors border-b-2 ${activeTab === "quick_walkin"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
            >
              Direct Walk-In Check-In
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ai_assistant")}
              className={`pb-2 px-4 text-xs font-semibold transition-colors border-b-2 flex items-center gap-1.5 ${activeTab === "ai_assistant"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
            >
              <Sparkles className="size-3.5" /> AI Triage & Slot Checker
            </button>
          </div>

          {activeTab === "quick_walkin" ? (
            /* Direct Walk-In Form */
            <form onSubmit={handleQuickWalkIn} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Patient Full Name *</label>
                  <Input
                    required
                    placeholder="e.g. John Doe"
                    value={walkInName}
                    onChange={(e) => setWalkInName(e.target.value)}
                    className="h-9 text-sm mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Student Number</label>
                  <Input
                    placeholder="e.g. 2024-00124"
                    value={walkInStudentNo}
                    onChange={(e) => setWalkInStudentNo(e.target.value)}
                    className="h-9 text-sm mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Department</label>
                  <Input
                    placeholder="e.g. Engineering"
                    value={walkInDepartment}
                    onChange={(e) => setWalkInDepartment(e.target.value)}
                    className="h-9 text-sm mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Priority Level</label>
                  <select
                    value={walkInPriority}
                    onChange={(e) => setWalkInPriority(e.target.value as "Normal" | "Urgent")}
                    className="w-full h-9 mt-1 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="Normal">Normal Priority</option>
                    <option value="Urgent">Urgent Priority (Bumps Ahead)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-medium">Reason for Visit / Symptoms</label>
                <Input
                  placeholder="e.g. Headaches, fever, dental checkup..."
                  value={walkInPurpose}
                  onChange={(e) => setWalkInPurpose(e.target.value)}
                  className="h-9 text-sm mt-1"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" type="button" onClick={() => setIsAiModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  Issue Walk-In Ticket
                </Button>
              </div>
            </form>
          ) : (
            /* AI Schedule & Triage Interface */
            <div className="space-y-4 pt-2">
              <div className="rounded-lg border p-3 bg-muted/30 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                    <CalendarIcon className="size-3.5" /> Target Date
                  </label>
                  <Input
                    type="date"
                    value={checkDate}
                    onChange={(e) => setCheckDate(e.target.value)}
                    className="h-8 w-auto text-xs"
                  />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-2">Select open schedule slot:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {slots.map((slot) => {
                      const isFull = slot.bookedCount >= slot.maxCapacity
                      const isSelected = selectedSlot === slot.time

                      return (
                        <button
                          key={slot.time}
                          type="button"
                          disabled={isFull}
                          onClick={() => handleSelectSlot(slot)}
                          className={`p-2 rounded border text-left transition-all text-xs flex flex-col justify-between h-14 ${isFull
                              ? "bg-muted/80 text-muted-foreground border-transparent cursor-not-allowed opacity-60"
                              : isSelected
                                ? "border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-600 text-indigo-950 font-medium"
                                : "bg-background hover:border-indigo-400 cursor-pointer"
                            }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="font-semibold">{slot.time}</span>
                            {isSelected && <CheckCircle2 className="size-3.5 text-indigo-600" />}
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {isFull ? "Fully Booked" : `${slot.maxCapacity - slot.bookedCount} slot(s) open`}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g. Student 2024-00124 John Doe has high fever and severe headache..."
                  className="w-full min-h-[90px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              {aiFeedback && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-md text-sm flex items-start gap-2">
                  <Sparkles className="size-4 text-indigo-600 mt-0.5 shrink-0" />
                  <span>{aiFeedback}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setIsAiModalOpen(false)}>
                  Close
                </Button>
                <Button
                  onClick={handleAiProcess}
                  disabled={isAnalyzing || !aiPrompt.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <Sparkles className="size-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Bot className="size-4" />
                      <span>Confirm via AI</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Queue Ticket Details Modal */}
      <Dialog
        open={selectedQueueItem !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedQueueItem(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Queue Ticket Details</DialogTitle>
          </DialogHeader>

          {selectedQueueItem && (
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <p className="text-xs text-muted-foreground">Queue Number</p>
                  <p className="text-2xl font-black text-primary">{selectedQueueItem.queue_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <StatusBadge status={getStatusVariant(selectedQueueItem.status)}>
                    {selectedQueueItem.status}
                  </StatusBadge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Student Number</p>
                  <p className="font-medium">{selectedQueueItem.student_number}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Arrival Time</p>
                  <p className="font-medium">{selectedQueueItem.arrival_time}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Patient Name</p>
                <p className="font-medium text-lg">{selectedQueueItem.patient_name}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Department</p>
                  <p className="font-medium">{selectedQueueItem.department}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Priority Level</p>
                  <p className={`font-medium ${selectedQueueItem.priority === "Urgent" ? "text-destructive" : ""}`}>
                    {selectedQueueItem.priority}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Reason / Purpose</p>
                <p className="font-medium">{selectedQueueItem.purpose}</p>
              </div>

              {selectedQueueItem.notes && (
                <div>
                  <p className="text-xs text-muted-foreground">Notes / System Flags</p>
                  <p className="text-sm bg-muted/40 p-3 rounded-md mt-1">
                    {selectedQueueItem.notes}
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