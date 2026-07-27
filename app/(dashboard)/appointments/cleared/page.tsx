"use client"

import { useState, useMemo } from "react"
import {
    Search,
    Calendar as CalendarIcon,
    Clock,
    CheckCircle2,
    FileCheck,
    User,
    ArrowUpDown,
    Download,
    XCircle,
    AlertTriangle,
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

type RecordStatus = "Cleared" | "Completed" | "Cancelled" | "No-Show"

type ClearedRecord = {
    id: string
    clearance_code: string
    student_number: string
    patient_name: string
    department: string
    purpose: string
    cleared_date: string // YYYY-MM-DD
    cleared_time: string
    cleared_by: string
    clearance_type: "Medical Certificate" | "Routine Consultation" | "Fit to Return Class" | "Annual Physical"
    status: RecordStatus
    remarks?: string
}

const PAGE_SIZE = 8

const MOCK_CLEARED_RECORDS: ClearedRecord[] = [
    {
        id: "clr-001",
        clearance_code: "CLR-2026-001",
        student_number: "2023-00124",
        patient_name: "John Doe",
        department: "Computer Studies",
        purpose: "Fever & Cold Consultation",
        cleared_date: "2026-07-27",
        cleared_time: "09:45 AM",
        cleared_by: "Dr. Sarah Jenkins",
        clearance_type: "Fit to Return Class",
        status: "Cleared",
        remarks: "Patient fully recovered. Medicated and cleared for attendance.",
    },
    {
        id: "clr-002",
        clearance_code: "CLR-2026-002",
        student_number: "2022-00582",
        patient_name: "Jane Smith",
        department: "Engineering",
        purpose: "Blood Pressure Check",
        cleared_date: "2026-07-27",
        cleared_time: "10:15 AM",
        cleared_by: "Dr. Mark Rivera",
        clearance_type: "Routine Consultation",
        status: "Completed",
        remarks: "Vital signs normal (120/80 mmHg).",
    },
    {
        id: "clr-003",
        clearance_code: "CLR-2026-003",
        student_number: "2021-00891",
        patient_name: "Emily Davis",
        department: "Business Administration",
        purpose: "Severe Allergic Reaction",
        cleared_date: "2026-07-26",
        cleared_time: "03:10 PM",
        cleared_by: "Dr. Sarah Jenkins",
        clearance_type: "Medical Certificate",
        status: "Cleared",
        remarks: "Antihistamine administered. Symptom-free upon discharge.",
    },
    {
        id: "clr-004",
        clearance_code: "CLR-2026-004",
        student_number: "2024-00045",
        patient_name: "David Wilson",
        department: "Arts & Sciences",
        purpose: "Annual Physical Exam",
        cleared_date: "2026-07-26",
        cleared_time: "01:30 PM",
        cleared_by: "Nurse Anna Cruz",
        clearance_type: "Annual Physical",
        status: "Completed",
        remarks: "All physical examination milestones completed and validated.",
    },
    {
        id: "clr-005",
        clearance_code: "CLR-2026-005",
        student_number: "2023-01103",
        patient_name: "Michael Brown",
        department: "Computer Studies",
        purpose: "Sprained Ankle Evaluation",
        cleared_date: "2026-07-25",
        cleared_time: "11:20 AM",
        cleared_by: "Dr. Mark Rivera",
        clearance_type: "Fit to Return Class",
        status: "Cancelled",
        remarks: "Appointment cancelled by patient prior to examination.",
    },
    {
        id: "clr-006",
        clearance_code: "CLR-2026-006",
        student_number: "2021-00334",
        patient_name: "Olivia Anderson",
        department: "Architecture",
        purpose: "Prescription Renewal",
        cleared_date: "2026-07-25",
        cleared_time: "08:30 AM",
        cleared_by: "Nurse Anna Cruz",
        clearance_type: "Routine Consultation",
        status: "No-Show",
        remarks: "Patient failed to arrive during the designated appointment slot.",
    },
]

export default function ClearedPage() {
    const [clearedRecords] = useState<ClearedRecord[]>(MOCK_CLEARED_RECORDS)
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedDate, setSelectedDate] = useState<string>("")
    const [clearanceTypeFilter, setClearanceTypeFilter] = useState<string>("all")
    const [statusFilter, setStatusFilter] = useState<string>("all")

    // Sorting controls
    const [sortBy, setSortBy] = useState<"date" | "name" | "status">("date")
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

    const [selectedRecord, setSelectedRecord] = useState<ClearedRecord | null>(null)
    const [page, setPage] = useState(1)

    const currentDateFormatted = useMemo(() => {
        return new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        })
    }, [])

    const filteredAndSortedRecords = useMemo(() => {
        let result = [...clearedRecords]

        // 1. Search Filter
        const keyword = searchQuery.toLowerCase().trim()
        if (keyword) {
            result = result.filter((item) => {
                const name = item.patient_name?.toLowerCase() ?? ""
                const studentNum = item.student_number?.toLowerCase() ?? ""
                const code = item.clearance_code?.toLowerCase() ?? ""
                const dept = item.department?.toLowerCase() ?? ""
                const staff = item.cleared_by?.toLowerCase() ?? ""
                const purpose = item.purpose?.toLowerCase() ?? ""

                return (
                    name.includes(keyword) ||
                    studentNum.includes(keyword) ||
                    code.includes(keyword) ||
                    dept.includes(keyword) ||
                    staff.includes(keyword) ||
                    purpose.includes(keyword)
                )
            })
        }

        // 2. Date Filter
        if (selectedDate) {
            result = result.filter((item) => item.cleared_date === selectedDate)
        }

        // 3. Clearance Type Filter
        if (clearanceTypeFilter !== "all") {
            result = result.filter((item) => item.clearance_type === clearanceTypeFilter)
        }

        // 4. Status Filter
        if (statusFilter !== "all") {
            result = result.filter((item) => item.status === statusFilter)
        }

        // 5. Multi-column Sorting Logic
        result.sort((a, b) => {
            let comparison = 0

            if (sortBy === "date") {
                const dateTimeA = new Date(`${a.cleared_date} ${a.cleared_time}`).getTime()
                const dateTimeB = new Date(`${b.cleared_date} ${b.cleared_time}`).getTime()
                comparison = dateTimeA - dateTimeB
            } else if (sortBy === "name") {
                comparison = a.patient_name.localeCompare(b.patient_name)
            } else if (sortBy === "status") {
                comparison = a.status.localeCompare(b.status)
            }

            return sortOrder === "asc" ? comparison : -comparison
        })

        return result
    }, [clearedRecords, searchQuery, selectedDate, clearanceTypeFilter, statusFilter, sortBy, sortOrder])

    const totalPages = Math.max(1, Math.ceil(filteredAndSortedRecords.length / PAGE_SIZE))
    const safePage = Math.min(page, totalPages)

    const paginatedRecords = useMemo(() => {
        return filteredAndSortedRecords.slice(
            (safePage - 1) * PAGE_SIZE,
            safePage * PAGE_SIZE
        )
    }, [filteredAndSortedRecords, safePage])

    const handleResetFilters = () => {
        setSearchQuery("")
        setSelectedDate("")
        setClearanceTypeFilter("all")
        setStatusFilter("all")
        setSortBy("date")
        setSortOrder("desc")
        setPage(1)
    }

    // Render Status Badge Helpers
    const renderStatusBadge = (status: RecordStatus) => {
        switch (status) {
            case "Cleared":
            case "Completed":
                return (
                    <StatusBadge status="success">
                        <span className="flex items-center gap-1">
                            <CheckCircle2 className="size-3 inline" />
                            {status}
                        </span>
                    </StatusBadge>
                )
            case "Cancelled":
                return (
                    <StatusBadge status="danger">
                        <span className="flex items-center gap-1">
                            <XCircle className="size-3 inline" />
                            Cancelled
                        </span>
                    </StatusBadge>
                )
            case "No-Show":
                return (
                    <StatusBadge status="warning">
                        <span className="flex items-center gap-1">
                            <AlertTriangle className="size-3 inline" />
                            No-Show
                        </span>
                    </StatusBadge>
                )
            default:
                return <StatusBadge status="default">{status}</StatusBadge>
        }
    }

    return (
        <div className="space-y-8">
            {/* Top Today's Date Banner */}
            <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider bg-primary/10 px-3.5 py-1.5 rounded-md w-fit">
                <CalendarIcon className="size-3.5" />
                <span>Today: {currentDateFormatted}</span>
            </div>

            <PageHeader
                title="Cleared Consultations & Slips"
                description="View archived completed visits, medical clearance certificates, and status logs."
            />

            <Card className="shadow-sm">
                <CardHeader>
                    <SectionHeader
                        title="Cleared Patient Directory"
                        description={`${filteredAndSortedRecords.length} patient record(s)`}
                    />

                    {/* Filter & Sorting Toolbar */}
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        {/* Search Input */}
                        <div className="relative min-w-[220px] flex-1 sm:flex-none sm:w-64">
                            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search code, student, staff..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value)
                                    setPage(1)
                                }}
                                className="pl-9 h-9 text-sm"
                            />
                        </div>

                        {/* Date Picker Filter */}
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

                        {/* Status Filter Dropdown */}
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value)
                                setPage(1)
                            }}
                            className="h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                            <option value="all">All Statuses</option>
                            <option value="Cleared">Cleared</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                            <option value="No-Show">No-Show</option>
                        </select>

                        {/* Clearance Type Dropdown */}
                        <select
                            value={clearanceTypeFilter}
                            onChange={(e) => {
                                setClearanceTypeFilter(e.target.value)
                                setPage(1)
                            }}
                            className="h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                            <option value="all">All Clearance Types</option>
                            <option value="Fit to Return Class">Fit to Return Class</option>
                            <option value="Routine Consultation">Routine Consultation</option>
                            <option value="Medical Certificate">Medical Certificate</option>
                            <option value="Annual Physical">Annual Physical</option>
                        </select>

                        {/* Sort Criteria Selector */}
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as "date" | "name" | "status")}
                            className="h-9 rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                            <option value="date">Sort by Date & Time</option>
                            <option value="name">Sort by Patient Name</option>
                            <option value="status">Sort by Status</option>
                        </select>

                        {/* Order Toggle Button */}
                        <button
                            type="button"
                            onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                            className="flex items-center gap-1.5 h-9 px-3 rounded-md border text-xs font-medium hover:bg-muted transition-colors"
                        >
                            <ArrowUpDown className="size-3.5 text-muted-foreground" />
                            <span>{sortOrder === "desc" ? "Descending" : "Ascending"}</span>
                        </button>

                        {/* Reset Filters Button */}
                        {(selectedDate || searchQuery || clearanceTypeFilter !== "all" || statusFilter !== "all") && (
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
                    {paginatedRecords.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <FileCheck className="mb-4 size-12 text-muted-foreground" />
                            <h3 className="text-lg font-semibold">No records found</h3>
                            <p className="text-sm text-muted-foreground">
                                No patient record matches your current search or filter criteria.
                            </p>
                        </div>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Clearance Code</TableHead>
                                        <TableHead>Student No.</TableHead>
                                        <TableHead>Patient Name</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Date & Time</TableHead>
                                        <TableHead>Cleared By</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedRecords.map((item) => (
                                        <TableRow
                                            key={item.id}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => setSelectedRecord(item)}
                                        >
                                            <TableCell className="font-bold text-emerald-600">
                                                {item.clearance_code}
                                            </TableCell>
                                            <TableCell>{item.student_number}</TableCell>
                                            <TableCell className="font-medium">
                                                {item.patient_name}
                                            </TableCell>
                                            <TableCell>{item.clearance_type}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col text-xs">
                                                    <span>{item.cleared_date}</span>
                                                    <span className="text-muted-foreground flex items-center gap-1">
                                                        <Clock className="size-3 inline" />
                                                        {item.cleared_time}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>{item.cleared_by}</TableCell>
                                            <TableCell>{renderStatusBadge(item.status)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>

                            <div className="mt-4">
                                <Pagination
                                    currentPage={safePage}
                                    totalPages={totalPages}
                                    totalItems={filteredAndSortedRecords.length}
                                    pageSize={PAGE_SIZE}
                                    onPageChange={setPage}
                                />
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Detail Modal */}
            <Dialog
                open={selectedRecord !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedRecord(null)
                    }
                }}
            >
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-primary">
                            <FileCheck className="size-5" />
                            <span>Record Details</span>
                        </DialogTitle>
                    </DialogHeader>

                    {selectedRecord && (
                        <div className="space-y-5">
                            <div className="flex items-center justify-between border-b pb-3">
                                <div>
                                    <p className="text-xs text-muted-foreground">Clearance Code</p>
                                    <p className="text-xl font-bold text-emerald-600">{selectedRecord.clearance_code}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                                    {renderStatusBadge(selectedRecord.status)}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-muted-foreground">Student Number</p>
                                    <p className="font-medium">{selectedRecord.student_number}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Department</p>
                                    <p className="font-medium">{selectedRecord.department}</p>
                                </div>
                            </div>

                            <div>
                                <p className="text-xs text-muted-foreground">Patient Name</p>
                                <p className="font-medium text-lg flex items-center gap-2">
                                    <User className="size-4 text-muted-foreground" />
                                    {selectedRecord.patient_name}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-muted-foreground">Clearance Type</p>
                                    <p className="font-medium">{selectedRecord.clearance_type}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Date & Time</p>
                                    <p className="font-medium">{selectedRecord.cleared_date} at {selectedRecord.cleared_time}</p>
                                </div>
                            </div>

                            <div>
                                <p className="text-xs text-muted-foreground">Purpose of Visit</p>
                                <p className="font-medium">{selectedRecord.purpose}</p>
                            </div>

                            <div>
                                <p className="text-xs text-muted-foreground">Attending Physician / Staff</p>
                                <p className="font-medium">{selectedRecord.cleared_by}</p>
                            </div>

                            {selectedRecord.remarks && (
                                <div>
                                    <p className="text-xs text-muted-foreground">Clinical Remarks</p>
                                    <p className="text-sm bg-muted/40 border p-3 rounded-md mt-1">
                                        {selectedRecord.remarks}
                                    </p>
                                </div>
                            )}

                            <div className="flex justify-end pt-2 border-t">
                                <Button variant="outline" className="flex items-center gap-2 text-xs">
                                    <Download className="size-3.5" />
                                    <span>Download Record (PDF)</span>
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}