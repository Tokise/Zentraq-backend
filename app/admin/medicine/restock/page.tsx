"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Loader2, PackagePlus } from "lucide-react"
import { toast } from "sonner"
import { getRestockRequestsAction, updateRestockRequestAction } from "@/actions/admin/medicine-admin"

export default function AdminRestockPage() {
  const [requests, setRequests] = useState<Array<{
    id: string
    medicine_id: string
    medicine_name: string | null
    quantity: number
    status: string
    created_at: string
    updated_at: string
  }>>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getRestockRequestsAction()
      if (res.error) {
        toast.error(res.error)
        setRequests([])
      } else {
        setRequests(res.requests)
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load restock requests")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleUpdate = async (id: string, status: "approved" | "rejected" | "fulfilled") => {
    setProcessing(id)
    try {
      const res = await updateRestockRequestAction(id, status)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(`Request ${status}`)
        fetchData()
      }
    } finally {
      setProcessing(null)
    }
  }

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-amber-50 text-amber-700 border-amber-200",
      approved: "bg-blue-50 text-blue-700 border-blue-200",
      rejected: "bg-red-50 text-red-700 border-red-200",
      fulfilled: "bg-emerald-50 text-emerald-700 border-emerald-200",
    }
    return (
      <Badge variant="outline" className={`text-[10px] capitalize ${styles[status] || "bg-zinc-50 text-zinc-700 border-zinc-200"}`}>
        {status}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Restock Requests"
        description="Manage medicine restock requests from the clinic."
      />

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <div className="py-16 text-center">
              <PackagePlus className="size-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No restock requests found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medicine</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((r) => (
                    <TableRow key={r.id} className="hover:bg-zinc-50/50">
                      <TableCell className="font-medium">{r.medicine_name || "—"}</TableCell>
                      <TableCell className="text-sm font-semibold">{r.quantity}</TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell className="text-sm text-zinc-500">
                        {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === "pending" && (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleUpdate(r.id, "approved")} disabled={processing === r.id}>
                              Approve
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 text-xs text-red-600 hover:text-red-700" onClick={() => handleUpdate(r.id, "rejected")} disabled={processing === r.id}>
                              Reject
                            </Button>
                          </div>
                        )}
                        {r.status === "approved" && (
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleUpdate(r.id, "fulfilled")} disabled={processing === r.id}>
                            Mark Fulfilled
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}