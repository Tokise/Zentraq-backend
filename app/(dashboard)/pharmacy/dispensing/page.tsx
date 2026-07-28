"use client"

import { useState, useMemo } from "react"
import {
  Search,
  Pill,
  Plus,
  FileSpreadsheet,
  Eye,
  Edit,
  X,
  Clock,
  User,
  Calendar,
  CheckCircle2,
  Activity,
  ClipboardList,
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
  DialogFooter,
} from "@/components/ui/dialog"

import { Pagination } from "@/components/pagination"

type DispensingRecord = {
  id: string
  transaction_code: string
  student_number: string
  patient_name: string
  medicine_name: string
  quantity_dispensed: number
  unit: string
  dispensed_date: string // YYYY-MM-DD
  dispensed_time: string
  attending_staff: string
  status: "Completed" | "Pending Review" | "Cancelled"
  notes?: string
}

const PAGE_SIZE = 8

const MOCK_DISPENSING: DispensingRecord[] = [
  {
    id: "disp-001",
    transaction_code: "DISP-501",
    student_number: "2023-00124",
    patient_name: "John Doe",
    medicine_name: "Paracetamol 500 mg",
    quantity_dispensed: 2,
    unit: "tablets",
    dispensed_date: "2026-07-28",
    dispensed_time: "09:15 AM",
    attending_staff: "Nurse Anna Cruz",
    status: "Completed",
    notes: "Given for acute headache and mild fever.",
  },
  {
    id: "disp-002",
    transaction_code: "DISP-502",
    student_number: "2022-00582",
    patient_name: "Jane Smith",
    medicine_name: "Ibuprofen 200 mg",
    quantity_dispensed: 1,
    unit: "tablet",
    dispensed_date: "2026-07-28",
    dispensed_time: "10:40 AM",
    attending_staff: "Dr. Sarah Jenkins",
    status: "Completed",
    notes: "Issued for dysmenorrhea.",
  },
  {
    id: "disp-003",
    transaction_code: "DISP-503",
    student_number: "2023-01103",
    patient_name: "Michael Brown",
    medicine_name: "Cetirizine HCl 10 mg",
    quantity_dispensed: 1,
    unit: "tablet",
    dispensed_date: "2026-07-27",
    dispensed_time: "01:20 PM",
    attending_staff: "Nurse Anna Cruz",
    status: "Completed",
    notes: "Allergic rhinitis symptom relief.",
  },
  {
    id: "disp-004",
    transaction_code: "DISP-504",
    student_number: "2021-00891",
    patient_name: "Emily Davis",
    medicine_name: "Ascorbic Acid (Vitamin C) 500 mg",
    quantity_dispensed: 10,
    unit: "tablets",
    dispensed_date: "2026-07-26",
    dispensed_time: "02:50 PM",
    attending_staff: "Dr. Mark Rivera",
    status: "Completed",
    notes: "Immune supplement pack requested.",
  },
  {
    id: "disp-005",
    transaction_code: "DISP-505",
    student_number: "2024-00045",
    patient_name: "David Wilson",
    medicine_name: "Mefenamic Acid 500 mg",
    quantity_dispensed: 2,
    unit: "capsules",
    dispensed_date: "2026-07-26",
    dispensed_time: "11:05 AM",
    attending_staff: "Dr. Sarah Jenkins",
    status: "Completed",
    notes: "Post sports-injury pain management.",
  },
  {
    id: "disp-006",
    transaction_code: "DISP-506",
    student_number: "2022-01450",
    patient_name: "Sophia Martinez",
    medicine_name: "Antacid Liquid 120ml",
    quantity_dispensed: 1,
    unit: "bottle",
    dispensed_date: "2026-07-25",
    dispensed_time: "09:45 AM",
    attending_staff: "Nurse Anna Cruz",
    status: "Pending Review",
    notes: "Requires physician countersign for inventory log.",
  },
  {
    id: "disp-007",
    transaction_code: "DISP-507",
    student_number: "2023-00912",
    patient_name: "Daniel Taylor",
    medicine_name: "Loperamide 2 mg",
    quantity_dispensed: 2,
    unit: "capsules",
    dispensed_date: "2026-07-25",
    dispensed_time: "03:15 PM",
    attending_staff: "Dr. Mark Rivera",
    status: "Completed",
  },
]

const INITIAL_FORM_STATE: Omit<DispensingRecord, "id" | "transaction_code"> = {
  student_number: "",
  patient_name: "",
  medicine_name: "Paracetamol 500 mg",
  quantity_dispensed: 1,
  unit: "tablets",
  dispensed_date: new Date().toISOString().split("T")[0],
  dispensed_time: "08:30 AM",
  attending_staff: "Nurse Anna Cruz",
  status: "Completed",
  notes: "",
}

export default function DispensingPage() {
  const [records, setRecords] = useState<DispensingRecord[]>(MOCK_DISPENSING)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  // Modal States
  const [selectedRecord, setSelectedRecord] = useState<DispensingRecord | null>(null)
  const [editingRecord, setEditingRecord] = useState<DispensingRecord | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [formData, setFormData] = useState(INITIAL_FORM_STATE)

  const [page, setPage] = useState(1)

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], [])

  // Today's Date Formatted String
  const currentDateFormatted = useMemo(() => {
    return new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }, [])

  // Metric Summaries
  const stats = useMemo(() => {
    const totalTransactions = records.length
    const dispensedToday = records.filter((r) => r.dispensed_date === todayStr).length
    const pendingCount = records.filter((r) => r.status === "Pending Review").length
    const completedCount = records.filter((r) => r.status === "Completed").length

    return { totalTransactions, dispensedToday, pendingCount, completedCount }
  }, [records, todayStr])

  // Search & Filter
  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      const query = searchQuery.toLowerCase().trim()
      const matchesSearch =
        query === "" ||
        rec.patient_name.toLowerCase().includes(query) ||
        rec.student_number.toLowerCase().includes(query) ||
        rec.medicine_name.toLowerCase().includes(query) ||
        rec.transaction_code.toLowerCase().includes(query) ||
        rec.attending_staff.toLowerCase().includes(query)

      const matchesStatus =
        statusFilter === "all" || rec.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [records, searchQuery, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  const paginatedRecords = useMemo(() => {
    return filteredRecords.slice(
      (safePage - 1) * PAGE_SIZE,
      safePage * PAGE_SIZE
    )
  }, [filteredRecords, safePage])

  const getStatusVariant = (status: DispensingRecord["status"]): "success" | "warning" | "danger" | "info" | "default" => {
    switch (status) {
      case "Completed":
        return "success"
      case "Pending Review":
        return "warning"
      case "Cancelled":
        return "danger"
      default:
        return "default"
    }
  }

  const handleResetFilters = () => {
    setSearchQuery("")
    setStatusFilter("all")
    setPage(1)
  }

  // --- ACTIONS --- //

  const handleOpenAdd = () => {
    setFormData({
      ...INITIAL_FORM_STATE,
      dispensed_date: new Date().toISOString().split("T")[0],
    })
    setIsAddOpen(true)
  }

  const handleOpenEdit = (rec: DispensingRecord) => {
    setEditingRecord(rec)
    setFormData({
      student_number: rec.student_number,
      patient_name: rec.patient_name,
      medicine_name: rec.medicine_name,
      quantity_dispensed: rec.quantity_dispensed,
      unit: rec.unit,
      dispensed_date: rec.dispensed_date,
      dispensed_time: rec.dispensed_time,
      attending_staff: rec.attending_staff,
      status: rec.status,
      notes: rec.notes ?? "",
    })
  }

  const handleSaveNew = (e: React.FormEvent) => {
    e.preventDefault()
    const newRecord: DispensingRecord = {
      id: `disp-${Date.now()}`,
      transaction_code: `DISP-${500 + records.length + 1}`,
      ...formData,
    }
    setRecords([newRecord, ...records])
    setIsAddOpen(false)
  }

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingRecord) return

    setRecords((prev) =>
      prev.map((r) =>
        r.id === editingRecord.id ? { ...r, ...formData } : r
      )
    )
    setEditingRecord(null)
  }

  // Export CSV
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) return

    const headers = [
      "Transaction Code",
      "Student No.",
      "Patient Name",
      "Medicine Name",
      "Quantity",
      "Unit",
      "Date",
      "Time",
      "Attending Staff",
      "Status",
      "Notes",
    ]

    const csvRows = [
      headers.join(","),
      ...filteredRecords.map((r) =>
        [
          `"${r.transaction_code}"`,
          `"${r.student_number}"`,
          `"${r.patient_name}"`,
          `"${r.medicine_name}"`,
          r.quantity_dispensed,
          `"${r.unit}"`,
          `"${r.dispensed_date}"`,
          `"${r.dispensed_time}"`,
          `"${r.attending_staff}"`,
          `"${r.status}"`,
          `"${r.notes ?? ""}"`,
        ].join(",")
      ),
    ]

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `dispensing_records_${new Date().toISOString().split("T")[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {/* Top Today's Date Banner */}
      <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider bg-primary/10 px-3.5 py-1.5 rounded-md w-fit">
        <Calendar className="size-3.5" />
        <span>Today: {currentDateFormatted}</span>
      </div>

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Medicine Dispensing"
          description="Record and track medicine dispensing transactions issued to patients."
        />
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2 cursor-pointer"
            onClick={handleExportCSV}
          >
            <FileSpreadsheet className="size-4 text-emerald-600" />
            <span>Export Logs</span>
          </Button>
          <Button size="sm" className="h-9 gap-2 cursor-pointer" onClick={handleOpenAdd}>
            <Plus className="size-4" />
            <span>Record Dispensing</span>
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-100 text-blue-700 rounded-lg shrink-0 flex items-center justify-center">
              <ClipboardList className="size-5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground font-medium">Total Logs</p>
              <p className="text-2xl font-bold leading-none">{stats.totalTransactions}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-lg shrink-0 flex items-center justify-center">
              <Activity className="size-5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground font-medium">Dispensed Today</p>
              <p className="text-2xl font-bold leading-none">{stats.dispensedToday}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-purple-100 text-purple-700 rounded-lg shrink-0 flex items-center justify-center">
              <CheckCircle2 className="size-5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground font-medium">Completed</p>
              <p className="text-2xl font-bold leading-none">{stats.completedCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-amber-100 text-amber-700 rounded-lg shrink-0 flex items-center justify-center">
              <Clock className="size-5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground font-medium">Pending Review</p>
              <p className="text-2xl font-bold leading-none">{stats.pendingCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="shadow-sm">
        <CardHeader className="space-y-4">
          <SectionHeader
            title="Dispensing Transactions"
            description={`${filteredRecords.length} transaction record(s) found`}
          />

          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search patient, code, medicine..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
                className="pl-9 h-9 text-sm"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="h-9 px-3 text-sm bg-background border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer min-w-[150px]"
            >
              <option value="all">All Statuses</option>
              <option value="Completed">Completed</option>
              <option value="Pending Review">Pending Review</option>
              <option value="Cancelled">Cancelled</option>
            </select>

            {(searchQuery || statusFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground ml-auto flex items-center gap-1"
              >
                <X className="size-3.5" />
                <span>Reset filters</span>
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Pill className="mb-4 size-12 text-muted-foreground" />
              <h3 className="text-lg font-semibold">No dispensing records found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                No transactions match your search or filter criteria.
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Code</TableHead>
                    <TableHead>Patient & Student No.</TableHead>
                    <TableHead>Medicine Dispensed</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Staff</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRecords.map((rec) => (
                    <TableRow
                      key={rec.id}
                      onClick={() => setSelectedRecord(rec)}
                      className="hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <TableCell className="font-mono text-xs font-bold text-muted-foreground align-middle">
                        {rec.transaction_code}
                      </TableCell>
                      <TableCell className="align-middle">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground flex items-center gap-1.5">
                            <User className="size-3.5 text-primary" />
                            {rec.patient_name}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            No: {rec.student_number}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium align-middle">
                        {rec.medicine_name}
                      </TableCell>
                      <TableCell className="align-middle">
                        <span className="font-semibold">{rec.quantity_dispensed}</span>{" "}
                        <span className="text-xs text-muted-foreground">{rec.unit}</span>
                      </TableCell>
                      <TableCell className="text-xs align-middle">
                        <div className="flex flex-col whitespace-nowrap">
                          <span>{rec.dispensed_date}</span>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Clock className="size-3 inline" />
                            {rec.dispensed_time}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="align-middle text-xs">{rec.attending_staff}</TableCell>
                      <TableCell className="align-middle">
                        <StatusBadge status={getStatusVariant(rec.status)}>
                          {rec.status}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-right align-middle">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedRecord(rec)
                            }}
                            title="View Details"
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenEdit(rec)
                            }}
                            title="Edit Record"
                          >
                            <Edit className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 pt-2 border-t">
                <Pagination
                  currentPage={safePage}
                  totalPages={totalPages}
                  totalItems={filteredRecords.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Details View Modal */}
      <Dialog
        open={selectedRecord !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedRecord(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="size-5 text-primary" />
              <span>Dispensing Transaction Details</span>
            </DialogTitle>
          </DialogHeader>

          {selectedRecord && (
            <div className="space-y-4 pt-2 text-sm">
              <div className="grid grid-cols-2 gap-4 pb-3 border-b">
                <div>
                  <p className="text-xs text-muted-foreground">Transaction Code</p>
                  <p className="font-mono font-bold text-foreground">{selectedRecord.transaction_code}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <StatusBadge status={getStatusVariant(selectedRecord.status)}>
                    {selectedRecord.status}
                  </StatusBadge>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Patient Information</p>
                <p className="text-base font-bold text-foreground mt-0.5">{selectedRecord.patient_name}</p>
                <p className="text-xs text-muted-foreground">Student Number: {selectedRecord.student_number}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Medicine Dispensed</p>
                  <p className="font-medium text-foreground mt-0.5">{selectedRecord.medicine_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Quantity Issued</p>
                  <p className="font-bold text-base text-foreground mt-0.5">
                    {selectedRecord.quantity_dispensed} {selectedRecord.unit}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Date & Time</p>
                  <p className="font-medium text-foreground mt-0.5">
                    {selectedRecord.dispensed_date} at {selectedRecord.dispensed_time}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Attending Staff</p>
                  <p className="font-medium text-foreground mt-0.5">{selectedRecord.attending_staff}</p>
                </div>
              </div>

              {selectedRecord.notes && (
                <div className="pt-3 border-t">
                  <p className="text-xs text-muted-foreground">Transaction Notes</p>
                  <p className="text-xs bg-muted/40 p-2.5 rounded-md mt-1 text-foreground">
                    {selectedRecord.notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Record / Edit Dispensing Dialog */}
      <Dialog
        open={isAddOpen || editingRecord !== null}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddOpen(false)
            setEditingRecord(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pill className="size-5 text-primary" />
              <span>{editingRecord ? "Edit Dispensing Record" : "Record New Dispensing Transaction"}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={editingRecord ? handleSaveEdit : handleSaveNew} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Student Number</label>
                <Input
                  required
                  value={formData.student_number}
                  onChange={(e) => setFormData({ ...formData, student_number: e.target.value })}
                  placeholder="2023-00124"
                  className="mt-1 h-9 text-sm font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Patient Name</label>
                <Input
                  required
                  value={formData.patient_name}
                  onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
                  placeholder="John Doe"
                  className="mt-1 h-9 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Medicine Name & Strength</label>
                <Input
                  required
                  value={formData.medicine_name}
                  onChange={(e) => setFormData({ ...formData, medicine_name: e.target.value })}
                  placeholder="Paracetamol 500 mg"
                  className="mt-1 h-9 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Quantity</label>
                <Input
                  required
                  type="number"
                  min="1"
                  value={formData.quantity_dispensed}
                  onChange={(e) => setFormData({ ...formData, quantity_dispensed: Number(e.target.value) })}
                  className="mt-1 h-9 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Unit</label>
                <Input
                  required
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  placeholder="tablets / bottle"
                  className="mt-1 h-9 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Date</label>
                <Input
                  required
                  type="date"
                  value={formData.dispensed_date}
                  onChange={(e) => setFormData({ ...formData, dispensed_date: e.target.value })}
                  className="mt-1 h-9 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Time</label>
                <Input
                  required
                  value={formData.dispensed_time}
                  onChange={(e) => setFormData({ ...formData, dispensed_time: e.target.value })}
                  placeholder="09:00 AM"
                  className="mt-1 h-9 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Attending Staff</label>
                <Input
                  required
                  value={formData.attending_staff}
                  onChange={(e) => setFormData({ ...formData, attending_staff: e.target.value })}
                  placeholder="Nurse Anna Cruz"
                  className="mt-1 h-9 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value as DispensingRecord["status"],
                    })
                  }
                  className="w-full mt-1 h-9 px-2 text-sm bg-background border rounded-md"
                >
                  <option value="Completed">Completed</option>
                  <option value="Pending Review">Pending Review</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Notes / Purpose</label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Indication or remarks..."
                className="mt-1 h-9 text-sm"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddOpen(false)
                  setEditingRecord(null)
                }}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingRecord ? "Save Changes" : "Record Transaction"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}