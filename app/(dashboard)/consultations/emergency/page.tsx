"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, HeartPulse, Loader2, Search } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/empty-state"
import { Pagination } from "@/components/pagination"
import { ConsultationWizard, type CompletionReport, type DispositionStatus } from "@/components/consultation-wizard"
import { toast } from "sonner"
import { updateEmergencyComplaint, updateEmergencyStatus, completeEmergencyCase, getEmergencyCasesAction } from "./actions"
import { addComplaintType, getComplaintsAction } from "../actions"

type ConsultationRecord = {
  id: string
  profile_id: string | null
  patient_name: string
  student_complaint: string
  status: "waiting" | "in_consultation" | "completed" | "dismissed" | "in_emergency"
  created_at: string
  handled_at: string | null
  notes: string | null
}

const PAGE_SIZE = 10

function statusVariant(status: string) {
  switch (status) {
    case "in_emergency":
      return "danger" as const
    case "in_consultation":
      return "info" as const
    case "completed":
      return "success" as const
    default:
      return "default" as const
  }
}

export default function EmergencyCasesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [records, setRecords] = useState<ConsultationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRecord, setSelectedRecord] = useState<ConsultationRecord | null>(null)
  const [page, setPage] = useState(1)

  const [handlingDialogOpen, setHandlingDialogOpen] = useState(false)
  const [handlingRecord, setHandlingRecord] = useState<ConsultationRecord | null>(null)
  const [editingEmergencyComplaint, setEditingEmergencyComplaint] = useState(false)
  const [editedEmergencyComplaint, setEditedEmergencyComplaint] = useState("")

  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardRecord, setWizardRecord] = useState<ConsultationRecord | null>(null)
  const [complaintTypes, setComplaintTypes] = useState<string[]>([])

  const fetchRecords = useCallback(async () => {
    try {
      // Authorized server action handles the privileged query
      const result = await getEmergencyCasesAction()
      if (result.error) throw new Error(result.error)
      if (result.records) setRecords(result.records as ConsultationRecord[])
    } catch (err) {
      console.error("Error fetching emergency cases:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchComplaints = useCallback(async () => {
    try {
      const result = await getComplaintsAction()
      if (result.error) throw new Error(result.error)
      if (result.complaints) {
        setComplaintTypes(result.complaints)
      }
    } catch (err) {
      console.error("Error fetching complaints:", err)
    }
  }, [])

  useEffect(() => {
    fetchRecords()

    // Lightweight polling — server actions replace realtime subscriptions
    const pollInterval = setInterval(fetchRecords, 30000)

    return () => {
      clearInterval(pollInterval)
    }
  }, [fetchRecords])

  const targetId = searchParams.get("id")

  // Auto-pop up targeted emergency case detail dialog when ?id= parameter is present
  useEffect(() => {
    if (targetId && records.length > 0) {
      const match = records.find((r) => r.id === targetId)
      if (match) {
        setSelectedRecord(match)
      }
    }
  }, [targetId, records])

  useEffect(() => {
    fetchComplaints()
  }, [fetchComplaints])

  useEffect(() => {
    const id = searchParams.get("id")
    if (!id) return

    const found = records.find(r => r.id === id)
    if (found && found.status === "in_emergency") {
      setHandlingRecord(found)
      setEditedEmergencyComplaint(found.student_complaint)
      setHandlingDialogOpen(true)
      return
    }

    ; (async () => {
      // Authorized server action handles targeted lookup
      const result = await getEmergencyCasesAction()
      const found = result.records?.find((r) => r.id === id)
      if (found && (found.status === "in_emergency" || found.status === "waiting" || found.status === "in_consultation")) {
        setHandlingRecord(found as ConsultationRecord)
        setEditedEmergencyComplaint(found.student_complaint)
        setHandlingDialogOpen(true)
        router.replace("/consultations/emergency")
      }
    })()
  }, [searchParams, records, router])

  async function handleAddComplaint(complaint: string) {
    const result = await addComplaintType(complaint)
    if (result.error) {
      toast.error(result.error)
      return
    }
    fetchComplaints()
  }

  async function handleSaveEmergencyComplaint() {
    if (!handlingRecord || !editedEmergencyComplaint.trim()) return
    try {
      const result = await updateEmergencyComplaint(handlingRecord.id, editedEmergencyComplaint.trim())
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Complaint updated")
      setEditingEmergencyComplaint(false)
      setHandlingRecord({ ...handlingRecord, student_complaint: editedEmergencyComplaint.trim() })
      fetchRecords()
    } catch (err: any) {
      toast.error(err.message || "Failed to update complaint")
    }
  }

  async function handleStatusChange(id: string, newStatus: ConsultationRecord["status"]) {
    try {
      const result = await updateEmergencyStatus(id, newStatus)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(`Case ${newStatus.replace("_", " ")}`)
      setSelectedRecord(null)
      setHandlingRecord(null)
      setHandlingDialogOpen(false)
      fetchRecords()
    } catch (err: any) {
      toast.error(err.message || "Failed to update status")
    }
  }

  function openWizard(record: ConsultationRecord) {
    setWizardRecord(record)
    setWizardOpen(true)
  }

  async function handleWizardComplete(complaint: string, report: CompletionReport, disposition: DispositionStatus) {
    if (!wizardRecord) return

    const notesJson = JSON.stringify(report)
    const now = new Date().toISOString()

    const result = await completeEmergencyCase(
      wizardRecord.id,
      complaint,
      notesJson,
      disposition,
      wizardRecord.patient_name
    )

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success("Emergency case resolved and logged to visit records")
    setWizardOpen(false)
    setWizardRecord(null)
    setSelectedRecord(null)
    setHandlingRecord(null)
    setHandlingDialogOpen(false)
    fetchRecords()
  }

  const filteredRecords = records.filter(
    (r) =>
      r.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.student_complaint.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginatedRecords = filteredRecords.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  )

  function parsedReport(notes: string | null): CompletionReport | null {
    if (!notes) return null
    try {
      return JSON.parse(notes) as CompletionReport
    } catch {
      return null
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Emergency Cases"
        description="Monitor and manage emergency consultations."
      >
        <Button variant="outline" onClick={() => router.push("/consultations")}>
          <ArrowLeft className="size-4" />
          Back to Queue
        </Button>
      </PageHeader>

      <Card className="shadow-sm border-destructive/30">
        <CardContent className="pt-6">
          <div className="relative mb-4 w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by patient name or complaint..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
              className="pl-9"
            />
          </div>

          {paginatedRecords.length === 0 ? (
            <EmptyState
              title="No emergency cases"
              description="There are currently no emergency cases. Emergency consultations will appear here."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Complaint</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRecords.map((record) => (
                    <TableRow
                      key={record.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedRecord(record)}
                    >
                      <TableCell className="font-medium">
                        {record.patient_name}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {record.student_complaint}
                      </TableCell>
                      <TableCell>
                        {new Date(record.created_at).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={statusVariant(record.status)}>
                          {record.status.replace("_", " ")}
                        </StatusBadge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Pagination
                currentPage={safePage}
                totalPages={totalPages}
                totalItems={filteredRecords.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={handlingDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setHandlingDialogOpen(false)
            setHandlingRecord(null)
            setEditingEmergencyComplaint(false)
            router.push("/consultations/emergency")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HeartPulse className="size-4 text-destructive" />
              Handling Emergency Case
            </DialogTitle>
          </DialogHeader>

          {handlingRecord && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Patient</p>
                  <p className="text-sm font-medium">{handlingRecord.patient_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <StatusBadge status="danger" className="mt-0.5">in emergency</StatusBadge>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Student Complaint</p>
                <p className="text-sm mt-1">{handlingRecord.student_complaint}</p>
              </div>

              <DialogFooter className="border-t border-border pt-4">
                <div className="flex w-full flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button className="flex-1" onClick={() => { setHandlingDialogOpen(false); openWizard(handlingRecord) }}>
                    Emergency Report
                  </Button>
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={selectedRecord !== null}
        onOpenChange={(open) => { if (!open) setSelectedRecord(null) }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HeartPulse className="size-4 text-destructive" />
              Emergency Case Details
            </DialogTitle>
          </DialogHeader>

          {selectedRecord && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Patient</p>
                  <p className="text-sm font-medium">{selectedRecord.patient_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <StatusBadge status={statusVariant(selectedRecord.status)} className="mt-0.5">
                    {selectedRecord.status.replace("_", " ")}
                  </StatusBadge>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Student Complaint</p>
                <p className="text-sm">{selectedRecord.student_complaint}</p>
              </div>

              {selectedRecord.status === "completed" && selectedRecord.notes && (
                <div className="space-y-3 rounded-md border border-border p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resolution Report</p>
                  {(() => {
                    const r = parsedReport(selectedRecord.notes)
                    if (!r) return <p className="text-sm">{selectedRecord.notes}</p>
                    return (
                      <>
                        <div><p className="text-xs text-muted-foreground">Diagnosis / Findings</p><p className="text-sm">{r.diagnosis}</p></div>
                        <div><p className="text-xs text-muted-foreground">Treatment Given</p><p className="text-sm">{r.treatment}</p></div>
                        <div><p className="text-xs text-muted-foreground">Recommendations</p><p className="text-sm">{r.recommendations}</p></div>
                      </>
                    )
                  })()}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Reported At</p>
                  <p className="text-sm">{new Date(selectedRecord.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p>
                </div>
                {selectedRecord.handled_at && (
                  <div>
                    <p className="text-xs text-muted-foreground">Handled At</p>
                    <p className="text-sm">{new Date(selectedRecord.handled_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p>
                  </div>
                )}
              </div>

              <DialogFooter className="border-t border-border pt-4">
                <div className="flex w-full flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                  {selectedRecord.status === "in_emergency" && (
                    <Button className="flex-1" onClick={() => openWizard(selectedRecord)}>Emergency Report</Button>
                  )}
                  {selectedRecord.status === "in_consultation" && (
                    <Button className="flex-1" onClick={() => openWizard(selectedRecord)}>Emergency Report</Button>
                  )}
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {wizardRecord && (
        <ConsultationWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          patientName={wizardRecord.patient_name}
          initialComplaint={wizardRecord.student_complaint}
          onComplete={handleWizardComplete}
          mode="emergency"
          complaintTypes={complaintTypes}
          onAddComplaint={handleAddComplaint}
        />
      )}
    </div>
  )
}
