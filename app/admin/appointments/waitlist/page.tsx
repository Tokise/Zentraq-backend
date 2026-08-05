"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, ListOrdered } from "lucide-react"
import { toast } from "sonner"
import { getAppointmentsOverviewAction, type AppointmentOverviewRow } from "@/actions/admin/appointments-admin"
import { getAppointmentDetail, approveAppointment, rejectAppointment } from "@/actions/scheduling/review"
import { evaluateAppointmentRequest } from "@/actions/scheduling/appointments"

const WAITLIST_STATUSES = ["pending", "ai_evaluated", "recommended", "approved"]

export default function AdminAppointmentWaitlistPage() {
  const [appointments, setAppointments] = useState<AppointmentOverviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [processing, setProcessing] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAppointmentsOverviewAction()
      if (res.error) {
        toast.error(res.error)
        setAppointments([])
      } else {
        setAppointments(res.appointments.filter((a) => WAITLIST_STATUSES.includes(a.status)))
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load waitlist")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const openDetail = async (id: string) => {
    const res = await getAppointmentDetail(id)
    if (res.error) {
      toast.error(res.error)
      return
    }
    setSelected(res.appointment)
  }

  const handleEvaluate = async () => {
    if (!selected) return
    setProcessing(true)
    try {
      const res = await evaluateAppointmentRequest(selected.id)
      if (res.error && res.code !== "INVALID_STATE") {
        toast.error(res.error)
      } else {
        toast.success("AI evaluation complete")
        setSelected(null)
        fetchData()
      }
    } finally {
      setProcessing(false)
    }
  }

  const handleApprove = async () => {
    if (!selected) return
    setProcessing(true)
    try {
      const res = await approveAppointment(selected.id)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success("Appointment approved")
        setSelected(null)
        fetchData()
      }
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async (reason: string) => {
    if (!selected) return
    setProcessing(true)
    try {
      const res = await rejectAppointment(selected.id, reason)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success("Appointment rejected")
        setSelected(null)
        fetchData()
      }
    } finally {
      setProcessing(false)
    }
  }

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-amber-50 text-amber-700 border-amber-200",
      ai_evaluated: "bg-amber-50 text-amber-700 border-amber-200",
      recommended: "bg-blue-50 text-blue-700 border-blue-200",
      approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    }
    return (
      <Badge variant="outline" className={`text-[10px] ${styles[status] || "bg-zinc-50 text-zinc-700 border-zinc-200"}`}>
        {status.replace(/_/g, " ")}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointment Waitlist"
        description="Review pending appointment requests awaiting scheduling."
      />

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : appointments.length === 0 ? (
            <div className="py-16 text-center">
              <ListOrdered className="size-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">The waitlist is clear. No pending appointments.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointments.map((a) => (
                    <TableRow key={a.id} className="hover:bg-zinc-50/50">
                      <TableCell className="font-medium">{a.patient_name || "—"}</TableCell>
                      <TableCell className="text-sm text-zinc-600 max-w-[240px] truncate">{a.reason || "—"}</TableCell>
                      <TableCell>
                        {a.priority ? (
                          <Badge variant={a.priority >= 4 ? "destructive" : "secondary"} className="text-[10px]">
                            P{a.priority}
                          </Badge>
                        ) : (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>{statusBadge(a.status)}</TableCell>
                      <TableCell className="text-sm text-zinc-500">
                        {new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openDetail(a.id)}>
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Appointment</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="rounded-lg border border-zinc-200 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {selected.students?.[0] ? `${selected.students[0].first_name} ${selected.students[0].last_name}`
                      : selected.faculty?.[0] ? `${selected.faculty[0].first_name} ${selected.faculty[0].last_name}` : "Patient"}
                  </p>
                  {statusBadge(selected.status)}
                </div>
                <p className="text-sm">{selected.reason}</p>
                {selected.symptoms && <p className="text-xs text-zinc-500">{selected.symptoms}</p>}
                {selected.priority && (
                  <p className="text-xs text-zinc-500">Priority: {selected.priority}</p>
                )}
                {selected.appointment_ai_evaluations?.[0] && (
                  <div className="mt-2 bg-blue-50/60 rounded-lg p-3">
                    <p className="text-xs font-medium text-blue-800 mb-1">AI Evaluation</p>
                    <p className="text-xs text-blue-600">
                      Score: {selected.appointment_ai_evaluations[0].priority_score ?? "N/A"} · {selected.appointment_ai_evaluations[0].rationale || "No rationale"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
            <Button variant="destructive" onClick={() => handleReject("Rejected by admin")} disabled={processing}>
              Reject
            </Button>
            <Button onClick={handleEvaluate} disabled={processing || selected?.status !== "pending"}>
              Run AI Evaluation
            </Button>
            <Button onClick={handleApprove} disabled={processing}>
              {processing ? "Processing..." : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}