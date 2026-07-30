"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/empty-state"
import { Pagination } from "@/components/pagination"
import { ConsultationWizard, type CompletionReport, type DispositionStatus } from "@/components/consultation-wizard"
import { toast } from "sonner"

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

const PAGE_SIZE = 5

function statusVariant(status: string) {
  switch (status) {
    case "in_emergency":
      return "danger" as const
    case "in_consultation":
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

import { useSearchParams } from "next/navigation"

export default function ConsultationsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const targetId = searchParams.get("id")
  const supabase = createClient()

  const [consultations, setConsultations] = useState<ConsultationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [complaintTypes, setComplaintTypes] = useState<string[]>([])

  const [selectedConsult, setSelectedConsult] = useState<ConsultationRecord | null>(null)
  const [page, setPage] = useState(1)

  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardConsult, setWizardConsult] = useState<ConsultationRecord | null>(null)

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
  }, [supabase, fetchConsultations])

  // Auto-pop up the exact consultation detail when ?id= parameter is present
  useEffect(() => {
    if (targetId && consultations.length > 0) {
      const match = consultations.find((c) => c.id === targetId)
      if (match) {
        setSelectedConsult(match)
      }
    }
  }, [targetId, consultations])

  const fetchComplaints = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("complaints")
        .select("name")
        .order("created_at", { ascending: false })

      if (error) throw error

      if (data) {
        setComplaintTypes(data.map((c: { name: string }) => c.name))
      }
    } catch (err) {
      console.error("Error fetching complaints:", err)
    }
  }, [supabase])

  useEffect(() => {
    fetchComplaints()

    const channel = supabase
      .channel("complaints-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "complaints" },
        () => {
          fetchComplaints()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchComplaints, supabase])

  // Open wizard for a consultation
  function openWizard(consult: ConsultationRecord) {
    setWizardConsult(consult)
    setWizardOpen(true)
  }

  async function handleAddComplaint(complaint: string) {
    const { error } = await supabase
      .from("complaints")
      .insert({ name: complaint })
    if (error) throw error
    fetchComplaints()
  }

  async function handleStatusChange(id: string, newStatus: ConsultationRecord["status"]) {
    try {
      const updates: Partial<ConsultationRecord> = { status: newStatus }
      if (newStatus === "in_consultation") {
        updates.handled_at = new Date().toISOString()
      }
      const { error } = await supabase.from("consultations").update(updates).eq("id", id)
      if (error) throw error
      toast.success(`Consultation ${newStatus.replace("_", " ")}`)
      setSelectedConsult(null)
      fetchConsultations()
    } catch (err: any) {
      toast.error(err.message || "Failed to update status")
    }
  }

  async function handleEmergencyRedirect(id: string) {
    try {
      await supabase.from("consultations").update({ status: "in_emergency", origin: "emergency" }).eq("id", id)
      router.push(`/consultations/emergency?id=${id}`)
    } catch (err: any) {
      toast.error(err.message || "Failed to escalate")
    }
  }

  async function handleWizardComplete(complaint: string, report: CompletionReport, disposition: DispositionStatus) {
    if (!wizardConsult) return

    const notesJson = JSON.stringify(report)
    const now = new Date().toISOString()

    const { error } = await supabase
      .from("consultations")
      .update({
        status: "completed",
        student_complaint: complaint,
        handled_at: now,
        notes: notesJson,
      })
      .eq("id", wizardConsult.id)

    if (error) throw error

    const { error: visitError } = await supabase
      .from("visit_logs")
      .insert({
        consultation_id: wizardConsult.id,
        patient_name: wizardConsult.patient_name,
        student_complaint: complaint,
        origin: "consultation",
        diagnosis: report.diagnosis,
        treatment: report.treatment,
        recommendations: report.recommendations,
        handled_at: now,
        status: disposition,
      })

    if (visitError) throw visitError

    toast.success("Consultation completed and logged")
    setWizardOpen(false)
    setWizardConsult(null)
    setSelectedConsult(null)
    fetchConsultations()
  }

  const activeConsultations = consultations.filter(
    (c) => c.status === "waiting" || c.status === "in_consultation"
  )

  const filteredActive = activeConsultations.filter(
    (c) =>
      c.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.student_complaint.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalPages = Math.max(1, Math.ceil(filteredActive.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginatedActive = filteredActive.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  )

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
      />

      <Card className="shadow-sm">
        <CardHeader>
          <SectionHeader
            title="Active Queue"
            description={
              activeConsultations.length > 0
                ? `${activeConsultations.length} patient(s) waiting or in consultation`
                : "No active consultations"
            }
          >
            <div className="relative w-full max-w-xs">
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedActive.map((consult) => (
                    <TableRow
                      key={consult.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedConsult(consult)}
                    >
                      <TableCell className="font-medium">
                        {consult.patient_name}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {consult.student_complaint}
                      </TableCell>
                      <TableCell>{formatTime(consult.created_at)}</TableCell>
                      <TableCell>
                        <StatusBadge status={statusVariant(consult.status)}>
                          {consult.status.replace("_", " ")}
                        </StatusBadge>
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

      <Dialog
        open={selectedConsult !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedConsult(null)
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
                <p className="text-xs text-muted-foreground">Student Complaint</p>
                <p className="text-sm mt-1">{selectedConsult.student_complaint}</p>
              </div>

              {selectedConsult.status === "completed" && selectedConsult.notes && (
                <div className="space-y-3 rounded-md border border-border p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Consultation Report</p>
                  {(() => {
                    try {
                      const r = JSON.parse(selectedConsult.notes) as CompletionReport
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
                    } catch {
                      return <p className="text-sm">{selectedConsult.notes}</p>
                    }
                  })()}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-sm">
                    {new Date(selectedConsult.created_at).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                {selectedConsult.handled_at && (
                  <div>
                    <p className="text-xs text-muted-foreground">Handled At</p>
                    <p className="text-sm">
                      {new Date(selectedConsult.handled_at).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter className="border-t border-border pt-4">
                <div className="flex w-full flex-wrap gap-2">
                  {selectedConsult.status === "waiting" && (
                    <>
                      <Button
                        className="flex-1"
                        onClick={() => {
                          handleStatusChange(selectedConsult.id, "in_consultation")
                        }}
                      >
                        Normal Consultation
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => handleEmergencyRedirect(selectedConsult.id)}
                      >
                        Emergency Consultation
                      </Button>
                    </>
                  )}
                  {selectedConsult.status === "in_consultation" && (
                    <Button
                      className="flex-1"
                      onClick={() => openWizard(selectedConsult)}
                    >
                      Consultation Report
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {
        wizardConsult && (
          <ConsultationWizard
            open={wizardOpen}
            onOpenChange={setWizardOpen}
            patientName={wizardConsult.patient_name}
            initialComplaint={wizardConsult.student_complaint}
            onComplete={handleWizardComplete}
            mode="consultation"
            complaintTypes={complaintTypes}
            onAddComplaint={handleAddComplaint}
          />
        )
      }
    </div >
  )
}