"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
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
  notes?: string | null
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

import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { updateAppointmentStatus, cancelAppointment, rescheduleAppointment } from "../actions"
import { useSearchParams } from "next/navigation"

export default function QueuePage() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const targetId = searchParams.get("id") || searchParams.get("queue")

  const [dbConsultations, setDbConsultations] = useState<any[]>([])
  const [localQueueItems, setLocalQueueItems] = useState<QueueItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "Waiting" | "In Consultation" | "Completed" | "Skipped">("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [timeSortOrder, setTimeSortOrder] = useState<"asc" | "desc">("asc")

  const [selectedQueueItem, setSelectedQueueItem] = useState<QueueItem | null>(null)
  const [page, setPage] = useState(1)

  // Reschedule Dialog State
  const [rescheduleItem, setRescheduleItem] = useState<QueueItem | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState("")
  const [rescheduleTime, setRescheduleTime] = useState("")

  const [dbAppointments, setDbAppointments] = useState<any[]>([])

  // Fetch Real Student Appointments from Supabase
  const fetchRealQueue = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("student_appointments")
        .select("*, student_accounts(first_name, last_name, student_number, employee_number, department)")
        .order("appointment_date", { ascending: true })

      if (!error && data) {
        setDbAppointments(data)
      }
    } catch (err) {
      console.error("Error fetching live student appointments queue from Supabase:", err)
    }
  }, [supabase])

  useEffect(() => {
    fetchRealQueue()

    const channel = supabase
      .channel("student-appointments-queue-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "student_appointments" },
        () => fetchRealQueue()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, fetchRealQueue])

  // Load any locally added walk-ins from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("clinic_queue_list")
    if (saved) {
      try {
        setLocalQueueItems(JSON.parse(saved))
      } catch (e) {
        console.error("Failed to parse local queue state", e)
      }
    }
  }, [])

  // Combine Real Student Appointments DB + Local Walk-Ins into unified Queue List
  // EXCLUDES Completed and Cancelled/Skipped appointments (which belong on the Cleared page)
  const queueList = useMemo(() => {
    const mappedDb: QueueItem[] = dbAppointments.map((apt: any, index: number) => {
      const sa = apt.student_accounts
      let status: QueueItem["status"] = "Waiting"
      if (apt.status === "confirmed") status = "In Consultation"
      else if (apt.status === "completed") status = "Completed"
      else if (apt.status === "cancelled") status = "Skipped"

      const name = sa ? `${sa.first_name} ${sa.last_name}` : "Student Patient"
      const studentNum = sa ? (sa.student_number || sa.employee_number || "Walk-In") : "Walk-In"
      const dept = sa?.department || "General"

      return {
        id: apt.id,
        queue_number: `Q-${String(index + 1).padStart(3, "0")}`,
        student_number: studentNum,
        patient_name: name,
        department: dept,
        purpose: apt.reason || "Student Clinic Appointment",
        arrival_time: apt.time_slot || "09:00 AM",
        status,
        priority: "Normal",
        notes: apt.appointment_date ? `Scheduled for ${apt.appointment_date}` : null,
        entry_type: "AI Scheduled",
      }
    })

    // Deduplicate by ID
    const combinedMap = new Map<string, QueueItem>()
    mappedDb.forEach((item) => combinedMap.set(item.id, item))
    localQueueItems.forEach((item) => combinedMap.set(item.id, item))

    // Exclude Completed and Skipped/Cancelled tickets from active live queue
    return Array.from(combinedMap.values()).filter((item) => item.status !== "Completed" && item.status !== "Skipped")
  }, [dbAppointments, localQueueItems])

  const saveLocalQueue = (newList: QueueItem[]) => {
    setLocalQueueItems(newList)
    localStorage.setItem("clinic_queue_list", JSON.stringify(newList))
  }

  // Auto-pop up targeted queue item detail modal when ?id= or ?queue= parameter is present
  useEffect(() => {
    if (targetId && queueList.length > 0) {
      const match = queueList.find(
        (q) => q.id === targetId || q.queue_number === targetId || q.patient_name.toLowerCase().includes(targetId.toLowerCase())
      )
      if (match) {
        setSelectedQueueItem(match)
      }
    }
  }, [targetId, queueList])

  // Queue Item Actions
  const handleConfirmQueue = async (id: string) => {
    const target = queueList.find((q) => q.id === id)
    if (!target) return
    const nextStatus = target.status === "Waiting" ? "In Consultation" : "Completed"

    // Update student_appointments in Supabase via server action
    const dbStatus = nextStatus === "In Consultation" ? "confirmed" : "completed"
    const result = await updateAppointmentStatus(id, dbStatus)
    if (result.error) {
      toast.error(result.error)
      return
    }

    // Update local state
    const updatedLocal = localQueueItems.map((q) => (q.id === id ? { ...q, status: nextStatus as any } : q))
    saveLocalQueue(updatedLocal)
    fetchRealQueue()

    if (nextStatus === "Completed") {
      toast.success(`Student Appointment ${target.queue_number} (${target.patient_name}) completed and moved to Cleared Patients!`)
      setSelectedQueueItem(null)
    } else {
      toast.success(`Student Appointment ${target.queue_number} (${target.patient_name}) updated to "${nextStatus}"`)
      if (selectedQueueItem?.id === id) {
        setSelectedQueueItem((prev) => (prev ? { ...prev, status: nextStatus as any } : null))
      }
    }
  }

  const handleCancelQueue = async (id: string) => {
    const target = queueList.find((q) => q.id === id)
    if (!target) return

    const result = await cancelAppointment(id)
    if (result.error) {
      toast.error(result.error)
      return
    }

    const updatedLocal = localQueueItems.map((q) => (q.id === id ? { ...q, status: "Skipped" as const } : q))
    saveLocalQueue(updatedLocal)
    fetchRealQueue()

    toast.error(`Student Appointment ${target.queue_number} (${target.patient_name}) cancelled`)
    if (selectedQueueItem?.id === id) {
      setSelectedQueueItem((prev) => (prev ? { ...prev, status: "Skipped" } : null))
    }
  }

  const handleOpenReschedule = (item: QueueItem) => {
    setRescheduleItem(item)
    setRescheduleDate(new Date().toISOString().split("T")[0])
    setRescheduleTime(item.arrival_time || "09:00 AM")
  }

  const handleSaveReschedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rescheduleItem) return

    const result = await rescheduleAppointment(rescheduleItem.id, rescheduleDate, rescheduleTime)
    if (result.error) {
      toast.error(result.error)
      return
    }

    const updatedLocal = localQueueItems.map((q) =>
      q.id === rescheduleItem.id
        ? { ...q, arrival_time: rescheduleTime, notes: `Rescheduled to ${rescheduleDate} at ${rescheduleTime}` }
        : q
    )
    saveLocalQueue(updatedLocal)
    fetchRealQueue()

    toast.success(`Rescheduled appointment ${rescheduleItem.queue_number} to ${rescheduleDate} at ${rescheduleTime}`)
    setRescheduleItem(null)
    if (selectedQueueItem?.id === rescheduleItem.id) {
      setSelectedQueueItem((prev) => (prev ? { ...prev, arrival_time: rescheduleTime, notes: `Rescheduled to ${rescheduleDate} at ${rescheduleTime}` } : null))
    }
  }
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

  const saveQueueState = (newList: QueueItem[]) => {
    saveLocalQueue(newList)
  }

  // Rapid Walk-In Manual Registration
  const handleQuickWalkIn = (e: React.FormEvent) => {
    e.preventDefault()
    if (!walkInName.trim()) return

    const nextQueueNo = `Q-${String(queueList.length + 1).padStart(3, "0")}`
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

    const updated = [newTicket, ...localQueueItems]
    saveLocalQueue(updated)

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
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[10%]">Queue No.</TableHead>
                    <TableHead className="w-[15%]">Student No.</TableHead>
                    <TableHead className="w-[20%]">Patient Name</TableHead>
                    <TableHead className="w-[22%]">Department</TableHead>
                    <TableHead className="w-[20%]">Purpose</TableHead>
                    <TableHead className="w-[13%]">Arrival Time</TableHead>
                    <TableHead className="w-[10%] text-right">Priority</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedQueue.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedQueueItem(item)}
                    >
                      <TableCell className="font-bold text-primary whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {item.queue_number}
                          {item.entry_type === "AI Scheduled" && (
                            <Sparkles className="size-3 text-purple-600 shrink-0" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="truncate">{item.student_number}</TableCell>
                      <TableCell className="font-medium truncate">
                        {item.patient_name}
                      </TableCell>
                      <TableCell className="truncate text-muted-foreground">{item.department}</TableCell>
                      <TableCell className="truncate text-muted-foreground">{item.purpose}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="size-3 inline shrink-0" />
                          {item.arrival_time}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {item.priority === "Urgent" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive">
                            <AlertCircle className="size-3.5 shrink-0" />
                            Urgent
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Normal</span>
                        )}
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-5 text-indigo-600" />
              <span>Register Patient Intake Ticket</span>
            </DialogTitle>
          </DialogHeader>

          {/* Tab Selection */}
          <div className="grid grid-cols-2 gap-2 border-b pb-3">
            <button
              type="button"
              onClick={() => setActiveTab("quick_walkin")}
              className={`flex items-center justify-center gap-1.5 py-2 text-xs rounded-md font-medium transition-colors ${activeTab === "quick_walkin"
                ? "bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200"
                : "text-muted-foreground hover:bg-muted"
                }`}
            >
              <UserPlus className="size-3.5" />
              Quick Walk-In Registration
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ai_assistant")}
              className={`flex items-center justify-center gap-1.5 py-2 text-xs rounded-md font-medium transition-colors ${activeTab === "ai_assistant"
                ? "bg-purple-50 text-purple-700 font-semibold border border-purple-200"
                : "text-muted-foreground hover:bg-muted"
                }`}
            >
              <Bot className="size-3.5" />
              Schedule Slot Availability
            </button>
          </div>

          {activeTab === "quick_walkin" ? (
            /* Quick Walk-In Form */
            <form onSubmit={handleQuickWalkIn} className="space-y-3 pt-2">
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
            /* Schedule Slot Availability */
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
                          onClick={() => setSelectedSlot(slot.time)}
                          className={`p-2 rounded-md border text-left transition-all ${isFull
                            ? "bg-muted/50 opacity-60 cursor-not-allowed border-muted"
                            : isSelected
                              ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                              : "bg-background hover:border-purple-300"
                            }`}
                        >
                          <p className="text-xs font-bold">{slot.time}</p>
                          <p className={`text-[10px] ${isSelected ? "text-purple-100" : "text-muted-foreground"}`}>
                            {isFull ? "Full" : `${slot.maxCapacity - slot.bookedCount} slots left`}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {selectedSlot && (
                <div className="rounded-md bg-purple-50 border border-purple-200 p-3 flex items-center justify-between text-xs text-purple-900">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-purple-600" />
                    <span>Slot selected: <strong>{selectedSlot}</strong> on {checkDate}</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setIsAiModalOpen(false)
                    }}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-7"
                  >
                    Confirm Booking
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Queue Ticket Details Modal */}
      <Dialog
        open={selectedQueueItem !== null}
        onOpenChange={(open: boolean) => {
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

              {/* Centered Modal Action Buttons */}
              <div className="flex items-center justify-center gap-2 pt-3 border-t border-border/40 w-full">
                {selectedQueueItem.status !== "Completed" && selectedQueueItem.status !== "Skipped" && (
                  <Button
                    size="sm"
                    onClick={() => handleConfirmQueue(selectedQueueItem.id)}
                    className="h-8 text-xs px-3 cursor-pointer"
                  >
                    Confirm
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenReschedule(selectedQueueItem)}
                  className="h-8 text-xs px-3 cursor-pointer"
                >
                  Reschedule Ticket
                </Button>
                {selectedQueueItem.status !== "Skipped" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCancelQueue(selectedQueueItem.id)}
                    className="h-8 text-xs px-3 text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                  >
                    Cancel Ticket
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dedicated Reschedule Ticket Dialog */}
      {rescheduleItem && (
        <Dialog open={!!rescheduleItem} onOpenChange={() => setRescheduleItem(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">Reschedule Queue Ticket</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveReschedule} className="space-y-4 py-2">
              <div className="rounded-md border p-3 bg-muted/30">
                <p className="text-xs text-muted-foreground">Patient Name</p>
                <p className="text-sm font-semibold">{rescheduleItem.patient_name} ({rescheduleItem.queue_number})</p>
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-medium">New Target Date</label>
                <Input
                  type="date"
                  required
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="h-9 text-xs mt-1"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-medium">New Arrival / Time Slot</label>
                <select
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="w-full h-9 mt-1 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {["08:00 AM", "08:30 AM", "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "01:00 PM", "01:30 PM", "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM", "04:00 PM"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="outline" size="sm" onClick={() => setRescheduleItem(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Save Reschedule
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}