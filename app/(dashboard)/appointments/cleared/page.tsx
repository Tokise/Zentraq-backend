"use client"

import { useState, useMemo, useEffect } from "react"
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
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"

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

export default function ClearedPage() {
    const [clearedRecords, setClearedRecords] = useState<ClearedRecord[]>([])
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedDate, setSelectedDate] = useState<string>("")
    const [clearanceTypeFilter, setClearanceTypeFilter] = useState<string>("all")
    const [statusFilter, setStatusFilter] = useState<string>("all")

    // Sorting controls
    const [sortBy, setSortBy] = useState<"date" | "name" | "status">("date")
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

    const [selectedRecord, setSelectedRecord] = useState<ClearedRecord | null>(null)
    const [page, setPage] = useState(1)

    const [loading, setLoading] = useState(true)

    const currentDateFormatted = useMemo(() => {
        return new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        })
    }, [])

    useEffect(() => {
        async function loadRecords() {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Fetch completed consultations
            const { data: consultations, error } = await supabase
                .from("consultations")
                .select("*")
                .in("status", ["completed", "cancelled"])
                .order("created_at", { ascending: false })

            if (error) {
                toast.error("Failed to load records")
                setLoading(false)
                return
            }

            const records: ClearedRecord[] = (consultations || []).map((c, idx) => ({
                id: c.id,
                clearance_code: `CLR-2026-${String(idx + 1).padStart(3, "0")}`,
                student_number: c.patient_name || "N/A",
                patient_name: c.patient_name || "Unknown",
                department: c.department || "N/A",
                purpose: c.student_complaint || c.consultation_reason || "Consultation",
                cleared_date: c.created_at ? c.created_at.split("T")[0] : "",
                cleared_time: c.created_at ? new Date(c.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "",
                cleared_by: c.doctor_name || c.nurse_name || "Clinic Staff",
                clearance_type: (c.clearance_type as ClearedRecord["clearance_type"]) || "Routine Consultation",
                status: c.status === "cancelled" ? "Cancelled" : "Completed",
                remarks: c.remarks || null,
            }))

            setClearedRecords(records)
            setLoading(false)
        }
        loadRecords()
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
                onOpenChange={(open: boolean) => {
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