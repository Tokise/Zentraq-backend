"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, FileCheck } from "lucide-react"
import { toast } from "sonner"
import { getClearanceQueue } from "@/actions/inventory/workflow-queries"
import { getClearanceDetail, approveClearance, rejectClearance } from "@/actions/clinical/clearances"

export default function DoctorClearanceIssuePage() {
  const [clearances, setClearances] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [expiresAt, setExpiresAt] = useState("")
  const [rejectReason, setRejectReason] = useState("")
  const [processing, setProcessing] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getClearanceQueue()
      if (res.error) {
        toast.error(res.error)
        setClearances([])
      } else {
        setClearances(res.clearances.filter((c: any) => c.status === "pending" || c.status === "evaluating"))
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load clearance requests")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const openDetail = async (id: string) => {
    const res = await getClearanceDetail(id)
    if (res.error) {
      toast.error(res.error)
      return
    }
    setSelected(res.clearance)
    setExpiresAt("")
    setRejectReason("")
  }

  const handleApprove = async () => {
    if (!selected) return
    setProcessing(true)
    try {
      const res = await approveClearance(selected.id, { expires_at: expiresAt || undefined })
      if (res.error) toast.error(res.error)
      else {
        toast.success("Clearance approved")
        setSelected(null)
        fetchData()
      }
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selected || !rejectReason.trim()) {
      toast.error("Please provide a rejection reason")
      return
    }
    setProcessing(true)
    try {
      const res = await rejectClearance(selected.id, rejectReason)
      if (res.error) toast.error(res.error)
      else {
        toast.success("Clearance rejected")
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
      evaluating: "bg-blue-50 text-blue-700 border-blue-200",
      approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
      rejected: "bg-red-50 text-red-700 border-red-200",
    }
    return <Badge variant="outline" className={`text-[10px] capitalize ${styles[status] || "bg-zinc-50 text-zinc-700 border-zinc-200"}`}>{status}</Badge>
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Issue Clearance" description="Review and approve or reject clearance requests." />

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : clearances.length === 0 ? (
            <div className="py-16 text-center">
              <FileCheck className="size-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No pending clearance requests.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Patient</th>
                    <th className="px-4 py-3 font-medium">Purpose</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {clearances.map((c) => (
                    <tr key={c.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 font-medium">{c.patient_name || "—"}</td>
                      <td className="px-4 py-3 max-w-[250px] truncate">{c.purpose || "—"}</td>
                      <td className="px-4 py-3">{statusBadge(c.status)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openDetail(c.id)}>
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Review Clearance</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="rounded-lg border border-zinc-200 p-4">
                <p className="text-sm font-medium">{selected.patient_name || "Patient"}</p>
                <p className="text-xs text-zinc-500 mt-1">{selected.purpose || "No purpose"}</p>
                <div className="mt-2">{statusBadge(selected.status)}</div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Expiry Date (Optional)</Label>
                <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Rejection Reason (if rejecting)</Label>
                <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Required to reject" className="h-9" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={processing || !rejectReason.trim()}>
              Reject
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