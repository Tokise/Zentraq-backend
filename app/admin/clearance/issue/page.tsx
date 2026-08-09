"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DataTablePagination, useTablePagination } from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Award, FileCheck, X } from "lucide-react"
import { toast } from "sonner"
import { getClearanceQueue } from "@/actions/inventory/workflow-queries"
import { getClearanceDetail, approveClearance, rejectClearance } from "@/actions/clinical/clearances"
import { getClearanceCertificatesAction } from "@/actions/admin/clearances/overview"

export default function AdminClearanceIssuePage() {
  const [clearances, setClearances] = useState<any[]>([])
  const [certificates, setCertificates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<"issue" | "issued">("issue")
  const [selected, setSelected] = useState<any>(null)
  const [expiresAt, setExpiresAt] = useState("")
  const [rejectReason, setRejectReason] = useState("")
  const [processing, setProcessing] = useState(false)
  const clearancePagination = useTablePagination(clearances)
  const certificatePagination = useTablePagination(certificates)
  const activePagination =
    viewMode === "issue" ? clearancePagination : certificatePagination

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      if (viewMode === "issue") {
        const res = await getClearanceQueue()
        if (res.error) toast.error(res.error)
        else setClearances(res.clearances)
      } else {
        const res = await getClearanceCertificatesAction()
        if (res.error) toast.error(res.error)
        else setCertificates(res.certificates)
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load clearances")
    } finally {
      setLoading(false)
    }
  }, [viewMode])

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
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success("Clearance approved and certificate issued")
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
      if (res.error) {
        toast.error(res.error)
      } else {
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
    return (
      <Badge variant="outline" className={`text-[10px] capitalize ${styles[status] || "bg-zinc-50 text-zinc-700 border-zinc-200"}`}>
        {status}
      </Badge>
    )
  }

  const displayName = (c: any) => {
    if (c.students && c.students[0]) {
      const s = c.students[0]
      return `${s.first_name} ${s.last_name}`
    }
    if (c.faculty && c.faculty[0]) {
      const f = c.faculty[0]
      return `${f.first_name} ${f.last_name}`
    }
    if (c.requester_name) return c.requester_name
    return "—"
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Issue Clearance"
        description="Approve pending clearances and issue certificates."
      />

      <div className="flex rounded-lg border border-zinc-200 overflow-hidden w-fit">
        {(["issue", "issued"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => {
              setViewMode(mode)
              clearancePagination.setCurrentPage(1)
              certificatePagination.setCurrentPage(1)
            }}
            className={`px-4 py-2 text-sm font-medium cursor-pointer transition-colors ${
              viewMode === mode
                ? "bg-zinc-900 text-white"
                : "bg-white text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {mode === "issue" ? "Ready to issue" : "Issued"}
          </button>
        ))}
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton className="h-10 w-full" key={index} />
              ))}
            </div>
          ) : viewMode === "issue" ? (
            clearances.length === 0 ? (
              <div className="py-16 text-center">
                <FileCheck className="size-8 text-zinc-300 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No pending clearances to issue.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Requester</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clearancePagination.paginatedItems.map((c: any) => (
                      <TableRow key={c.id} className="hover:bg-zinc-50/50">
                        <TableCell className="font-medium">{displayName(c)}</TableCell>
                        <TableCell className="text-sm text-zinc-600 capitalize">{c.requester_type}</TableCell>
                        <TableCell className="text-sm text-zinc-600 max-w-[280px] truncate">{c.purpose || "—"}</TableCell>
                        <TableCell>{statusBadge(c.status)}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openDetail(c.id)}>
                            <Award className="size-3.5 mr-1" /> Process
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          ) : certificates.length === 0 ? (
            <div className="py-16 text-center">
              <FileCheck className="size-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No certificates issued yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Certificate No.</TableHead>
                    <TableHead>Requester</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Issued</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {certificatePagination.paginatedItems.map((c: any) => (
                    <TableRow key={c.id} className="hover:bg-zinc-50/50">
                      <TableCell className="font-mono text-sm">{c.certificate_number}</TableCell>
                      <TableCell className="font-medium">{c.requester_name || "—"}</TableCell>
                      <TableCell className="text-sm text-zinc-600 capitalize">{c.requester_type}</TableCell>
                      <TableCell className="text-sm text-zinc-600 max-w-[280px] truncate">{c.purpose || "—"}</TableCell>
                      <TableCell className="text-sm text-zinc-500">
                        {new Date(c.issued_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <DataTablePagination
        currentPage={activePagination.currentPage}
        onPageChange={activePagination.setCurrentPage}
        pageSize={activePagination.pageSize}
        totalItems={activePagination.totalItems}
        totalPages={activePagination.totalPages}
      />

      {/* Process Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Process Clearance</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="rounded-lg border border-zinc-200 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{displayName(selected)}</p>
                  {statusBadge(selected.status)}
                </div>
                <p className="text-xs text-zinc-500">{selected.purpose || "No purpose provided"}</p>
                <p className="text-xs text-zinc-500 capitalize">{selected.requester_type} clearance</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Expiry Date (Optional)</Label>
                <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="h-9" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Rejection Reason (if rejecting)</Label>
                <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="h-9" placeholder="Required to reject" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={processing || !rejectReason.trim()}>
              <X className="size-3.5 mr-1" /> Reject
            </Button>
            <Button onClick={handleApprove} disabled={processing}>
              <Award className="size-3.5 mr-1" /> {processing ? "Processing..." : "Approve & Issue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
