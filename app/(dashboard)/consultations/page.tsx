"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  HeartPulse,
  Loader2,
  Plus,
  Save,
  Search,
  Stethoscope,
} from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { PageHeader } from "@/components/page-header"
import { SectionHeader } from "@/components/section-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/empty-state"
import { Pagination } from "@/components/pagination"
import { ConsultationWizard, type CompletionReport } from "@/components/consultation-wizard"
import { toast } from "sonner"

type ConsultationRecord = {
  id: string
  profile_id: string | null
  patient_name: string
  chief_complaint: string
  status: "waiting" | "in_progress" | "completed" | "dismissed" | "emergency"
  created_at: string
  handled_at: string | null
  notes: string | null
}

const PAGE_SIZE = 5

const COMPLAINT_TYPES = [
  "General Checkup",
  "Fever",
  "Headache",
  "Cough / Colds",
  "Sore Throat",
  "Stomach Ache",
  "Injury / Cuts",
  "Skin Problem",
  "Eye Problem",
  "Allergic Reaction",
  "Dental",
  "Other",
]

function statusVariant(status: string) {
  switch (status) {
    case "emergency":
      return "danger" as const
    case "in_progress":
      return "info" as const
    case "waiting":
      return "warning" as const
    case "completed":
      return "success" as const
    default:
      return "default" as const
  }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function ConsultationsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [consultations, setConsultations] = useState<ConsultationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  // New consultation dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newPatientName, setNewPatientName] = useState("")
  const [newComplaintType, setNewComplaintType] = useState("")
  const [newComplaintDetail, setNewComplaintDetail] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Detail modal
  const [selectedConsult, setSelectedConsult] = useState<ConsultationRecord | null>(null)

  // Editable complaint
  const [editingComplaint, setEditingComplaint] = useState(false)
  const [editedComplaint, setEditedComplaint] = useState("")

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardConsult, setWizardConsult] = useState<ConsultationRecord | null>(null)

  // Pagination
  const [page, setPage] = useState(1)

  const fetchConsultations = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("consultations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50)

      if (error) throw error

      if (data) {
        setConsultations(data as ConsultationRecord[])
      }
    } catch (err) {
      console.error("Error fetching consultations:", err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchConsultations()

    const channel = supabase
      .channel("consultations-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "consultations" },
        () => {
          fetchConsultations()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchConsultations, supabase])

  async function handleNewConsultation(e: React.FormEvent) {
    e.preventDefault()
    if (!newPatientName.trim() || submitting) return

    let complaintText = newComplaintType
    if (newComplaintDetail.trim()) {
      complaintText += ` — ${newComplaintDetail.trim()}`
    }
    if (!complaintText) return

    setSubmitting(true)
    try {
      const { error } = await supabase.from("consultations").insert({
        patient_name: newPatientName.trim(),
        chief_complaint: complaintText,
        status: "waiting",
      })

      if (error) throw error

      toast.success("Consultation started")
      setDialogOpen(false)
      setNewPatientName("")
      setNewComplaintType("")
      setNewComplaintDetail("")
      fetchConsultations()
    } catch (err: any) {
      toast.error(err.message || "Failed to create consultation")
    } finally {
      setSubmitting(false)
    }
  }

  // Emergency: update status and redirect to emergency page
  async function handleEmergencyRedirect(id: string) {
    try {
      await supabase.from("consultations").update({ status: "emergency" }).eq("id", id)
      router.push(`/consultations/emergency?id=${id}`)
    } catch (err: any) {
      toast.error(err.message || "Failed to escalate")
    }
  }

  async function handleStatusChange(
    id: string,
    newStatus: ConsultationRecord["status"]
  ) {
    try {
      const updates: Partial<ConsultationRecord> = { status: newStatus }
      if (newStatus === "in_progress") {
        updates.handled_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from("consultations")
        .update(updates)
        .eq("id", id)

      if (error) throw error

      toast.success(`Consultation ${newStatus.replace("_", " ")}`)
      setSelectedConsult(null)
      setEditingComplaint(false)
      fetchConsultations()
    } catch (err: any) {
      toast.error(err.message || "Failed to update status")
    }
  }

  async function handleSaveComplaint() {
    if (!selectedConsult || !editedComplaint.trim()) return

    try {
      const { error } = await supabase
        .from("consultations")
        .update({ chief_complaint: editedComplaint.trim() })
        .eq("id", selectedConsult.id)

      if (error) throw error

      toast.success("Complaint updated")
      setEditingComplaint(false)
      setSelectedConsult({ ...selectedConsult, chief_complaint: editedComplaint.trim() })
      fetchConsultations()
    } catch (err: any) {
      toast.error(err.message || "Failed to update complaint")
    }
  }

  // Open wizard for a consultation
  function openWizard(consult: ConsultationRecord) {
    setWizardConsult(consult)
    setWizardOpen(true)
  }

  async function handleWizardComplete(complaint: string, report: CompletionReport) {
    if (!wizardConsult) return

    const notesJson = JSON.stringify(report)

    const { error } = await supabase
      .from("consultations")
      .update({
        status: "completed",
        chief_complaint: complaint,
        handled_at: new Date().toISOString(),
        notes: notesJson,
      })
      .eq("id", wizardConsult.id)

    if (error) throw error

    toast.success("Consultation completed and logged")
    setWizardOpen(false)
    setWizardConsult(null)
    setSelectedConsult(null)
    setEditingComplaint(false)
    fetchConsultations()
  }

  // Filter active consultations (waiting + in_progress) + apply search
  const activeConsultations = consultations.filter(
    (c) => c.status === "waiting" || c.status === "in_progress"
  )

  const filteredActive = activeConsultations.filter(
    (c) =>
      c.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.chief_complaint.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalPages = Math.max(1, Math.ceil(filteredActive.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginatedActive = filteredActive.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  )

  // Parse notes JSON for display
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
        title="Consultations"
        description="Record and manage patient consultations in real-time."
      >
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button>
                <Plus className="size-4" />
                New Consultation
              </Button>
            }
          />
          <DialogContent>
            <form onSubmit={handleNewConsultation}>
              <DialogHeader>
                <DialogTitle>Start New Consultation</DialogTitle>
                <DialogDescription>
                  Enter the patient details to begin a consultation.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Patient Name</label>
                  <Input
                    value={newPatientName}
                    onChange={(e) => setNewPatientName(e.target.value)}
                    placeholder="Enter patient name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Complaint Type</label>
                  <select
                    value={newComplaintType}
                    onChange={(e) => setNewComplaintType(e.target.value)}
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="" disabled>Select complaint type</option>
                    {COMPLAINT_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Details (optional)</label>
                  <Input
                    value={newComplaintDetail}
                    onChange={(e) => setNewComplaintDetail(e.target.value)}
                    placeholder="e.g. since last night, with fever of 38°C"
                  />
                </div>
              </div>

              <DialogFooter showCloseButton>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Start Consultation"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {/* Active Queue */}
      <Card className="shadow-sm">
        <CardHeader>
          <SectionHeader
            title="Active Queue"
            description={
              activeConsultations.length > 0
                ? `${activeConsultations.length} patient(s) waiting or in progress`
                : "No active consultations"
            }
          >
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or complaint..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
                className="pl-9"
              />
            </div>
          </SectionHeader>
        </CardHeader>

        <CardContent>
          {paginatedActive.length === 0 ? (
            <EmptyState
              title="No consultations in queue"
              description="Active consultations will appear here. Start a new consultation to begin."
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
                    <TableHead className="w-[220px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedActive.map((consult) => (
                    <TableRow
                      key={consult.id}
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedConsult(consult)
                        setEditingComplaint(false)
                      }}
                    >
                      <TableCell className="font-medium">
                        {consult.patient_name}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {consult.chief_complaint}
                      </TableCell>
                      <TableCell>{formatTime(consult.created_at)}</TableCell>
                      <TableCell>
                        <StatusBadge status={statusVariant(consult.status)}>
                          {consult.status.replace("_", " ")}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {consult.status === "waiting" && (
                            <>
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() =>
                                  handleStatusChange(consult.id, "in_progress")
                                }
                              >
                                <Stethoscope className="size-3" />
                                Start
                              </Button>
                              <Button
                                variant="destructive"
                                size="xs"
                                onClick={() =>
                                  handleEmergencyRedirect(consult.id)
                                }
                              >
                                <HeartPulse className="size-3" />
                                Emergency
                              </Button>
                            </>
                          )}
                          {consult.status === "in_progress" && (
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => openWizard(consult)}
                            >
                              Complete
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Pagination
                currentPage={safePage}
                totalPages={totalPages}
                totalItems={filteredActive.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog
        open={selectedConsult !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedConsult(null)
            setEditingComplaint(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Consultation Details</DialogTitle>
          </DialogHeader>

          {selectedConsult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Patient</p>
                  <p className="text-sm font-medium">
                    {selectedConsult.patient_name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <StatusBadge
                    status={statusVariant(selectedConsult.status)}
                    className="mt-0.5"
                  >
                    {selectedConsult.status.replace("_", " ")}
                  </StatusBadge>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Chief Complaint</p>
                {(selectedConsult.status === "waiting" || selectedConsult.status === "in_progress") && editingComplaint ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={editedComplaint}
                      onChange={(e) => setEditedComplaint(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={handleSaveComplaint}
                    >
                      <Save className="size-3" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm mt-1">{selectedConsult.chief_complaint}</p>
                )}
                {(selectedConsult.status === "waiting" || selectedConsult.status === "in_progress") && !editingComplaint && (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="mt-1 h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setEditedComplaint(selectedConsult.chief_complaint)
                      setEditingComplaint(true)
                    }}
                  >
                    Edit complaint
                  </Button>
                )}
              </div>

              {selectedConsult.status === "completed" && selectedConsult.notes && (
                <div className="space-y-3 rounded-md border border-border p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Consultation Report</p>
                  {(() => {
                    const r = parsedReport(selectedConsult.notes)
                    if (!r) {
                      return <p className="text-sm">{selectedConsult.notes}</p>
                    }
                    return (
                      <>
                        <div>
                          <p className="text-xs text-muted-foreground">Diagnosis / Findings</p>
                          <p className="text-sm">{r.diagnosis}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Treatment Given</p>
                          <p className="text-sm">{r.treatment}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Recommendations</p>
                          <p className="text-sm">{r.recommendations}</p>
                        </div>
                      </>
                    )
                  })()}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-sm">
                    {new Date(
                      selectedConsult.created_at
                    ).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                {selectedConsult.handled_at && (
                  <div>
                    <p className="text-xs text-muted-foreground">Handled At</p>
                    <p className="text-sm">
                      {new Date(
                        selectedConsult.handled_at
                      ).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter className="border-t border-border pt-4">
                <div
                  className="flex w-full flex-wrap gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  {selectedConsult.status === "waiting" && (
                    <>
                      <Button
                        className="flex-1"
                        onClick={() =>
                          handleStatusChange(selectedConsult.id, "in_progress")
                        }
                      >
                        <Stethoscope className="size-4" />
                        Start Consultation
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() =>
                          handleEmergencyRedirect(selectedConsult.id)
                        }
                      >
                        <HeartPulse className="size-4" />
                        Emergency
                      </Button>
                    </>
                  )}
                  {selectedConsult.status === "in_progress" && (
                    <Button
                      className="flex-1"
                      onClick={() => openWizard(selectedConsult)}
                    >
                      Complete with Report
                    </Button>
                  )}
                  {(selectedConsult.status === "waiting" ||
                    selectedConsult.status === "in_progress") && (
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() =>
                          handleStatusChange(selectedConsult.id, "dismissed")
                        }
                      >
                        Dismiss
                      </Button>
                    )}
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Consultation Wizard (3-step: Complaint → Report → Review) */}
      {wizardConsult && (
        <ConsultationWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          patientName={wizardConsult.patient_name}
          initialComplaint={wizardConsult.chief_complaint}
          onComplete={handleWizardComplete}
          mode="consultation"
        />
      )}
    </div>
  )
}