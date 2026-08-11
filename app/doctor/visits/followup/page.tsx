"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DataTablePagination,
  useTablePagination,
} from "@/components/ui/pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, CalendarClock } from "lucide-react"
import { toast } from "sonner"
import {
  getConsultationQueue,
  type QueueConsultation,
} from "@/actions/inventory/workflow-queries"
import {
  getConsultationDetailAction,
  type ConsultationDetailRow,
} from "@/actions/admin/visits/overview"

// Renders the doctor's follow-up scheduling workspace.
export default function DoctorVisitFollowupPage() {
  const [consultations, setConsultations] = useState<QueueConsultation[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ConsultationDetailRow | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [followUpDate, setFollowUpDate] = useState("")
  const [followUpNotes, setFollowUpNotes] = useState("")
  const [processing, setProcessing] = useState(false)
  const pagination = useTablePagination(consultations)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getConsultationQueue()
      if (res.error) {
        toast.error(res.error)
        setConsultations([])
      } else {
        setConsultations(res.consultations)
      }
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to load consultations",
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void fetchData(), 0)
    return () => window.clearTimeout(initialLoad)
  }, [fetchData])

  const openDetail = async (id: string) => {
    setLoadingDetail(true)
    try {
      const res = await getConsultationDetailAction(id)
      if (res.error) {
        toast.error(res.error)
      } else {
        setSelected(res.consultation)
        setFollowUpDate("")
        setFollowUpNotes("")
      }
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleScheduleFollowUp = async () => {
    if (!selected || !followUpDate) {
      toast.error("Follow-up date is required")
      return
    }
    setProcessing(true)
    try {
      // In a real implementation, this would call a server action to schedule the follow-up
      toast.success("Follow-up scheduled")
      setSelected(null)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Schedule and manage patient follow-ups."
        title="Follow-up Visits"
      />

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : consultations.length === 0 ? (
            <div className="py-16 text-center">
              <CalendarClock className="size-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No consultations to follow up.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Visit reason</TableHead>
                  <TableHead>Last visit</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.paginatedItems.map((consultation) => (
                  <TableRow key={consultation.id}>
                    <TableCell className="font-medium">
                      {consultation.patient_name}
                    </TableCell>
                    <TableCell className="max-w-[250px] truncate">
                      {consultation.patient_complaint || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(
                        consultation.check_in_time,
                      ).toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        onClick={() => openDetail(consultation.id)}
                        size="sm"
                      >
                        Schedule Follow-up
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <DataTablePagination
            className="px-4 pb-4"
            currentPage={pagination.currentPage}
            onPageChange={pagination.setCurrentPage}
            pageSize={pagination.pageSize}
            totalItems={pagination.totalItems}
            totalPages={pagination.totalPages}
          />
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Follow-up</DialogTitle>
          </DialogHeader>
          {loadingDetail ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : selected && (
            <div className="space-y-4">
              <div className="rounded-lg border border-zinc-200 p-3">
                <p className="text-sm font-medium">{selected.patient_name}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {selected.patient_complaint || "No visit reason"}
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Follow-up Date *</label>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full h-9 rounded-md border border-zinc-200 px-3 text-sm focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Notes</label>
                <textarea
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  rows={3}
                  placeholder="Follow-up instructions..."
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none resize-none"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button onClick={handleScheduleFollowUp} disabled={processing || !followUpDate}>
              {processing ? "Scheduling..." : "Schedule Follow-up"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
