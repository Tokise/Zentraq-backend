"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { DataTablePagination, useTablePagination } from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Search, History } from "lucide-react"
import { toast } from "sonner"
import { getClearanceHistoryAction } from "@/actions/admin/clearances/overview"

export default function AdminClearanceHistoryPage() {
  const [clearances, setClearances] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")
  const [search, setSearch] = useState("")
  const pagination = useTablePagination(clearances)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getClearanceHistoryAction({
        status: statusFilter,
        searchQuery: search || undefined,
      })
      if (res.error) {
        toast.error(res.error)
        setClearances([])
      } else {
        setClearances(res.clearances)
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load clearance history")
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clearance History"
        description="Review all issued, pending, and expired health clearances."
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-zinc-200 overflow-hidden">
          {["all", "pending", "evaluating", "approved", "rejected"].map((status) => (
            <button
              key={status}
                  onClick={() => {
                    setStatusFilter(status)
                    pagination.setCurrentPage(1)
                  }}
              className={`px-3 py-2 text-sm font-medium cursor-pointer transition-colors capitalize ${
                statusFilter === status
                  ? "bg-primary text-primary-foreground"
                  : "bg-white text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
          <Input
            value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                pagination.setCurrentPage(1)
              }}
            onKeyDown={(e) => e.key === "Enter" && fetchData()}
            placeholder="Search by purpose..."
            className="h-9 pl-8 text-sm"
          />
        </div>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton className="h-10 w-full" key={index} />
              ))}
            </div>
          ) : clearances.length === 0 ? (
            <div className="py-16 text-center">
              <History className="size-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No clearance records found.</p>
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
                    <TableHead>Expires</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.paginatedItems.map((c: any) => (
                    <TableRow key={c.id} className="hover:bg-zinc-50/50">
                      <TableCell className="font-medium">{c.requester_name || "—"}</TableCell>
                      <TableCell className="text-sm text-zinc-600 capitalize">{c.requester_type}</TableCell>
                      <TableCell className="text-sm text-zinc-600 max-w-[280px] truncate">{c.purpose || "—"}</TableCell>
                      <TableCell>{statusBadge(c.status)}</TableCell>
                      <TableCell className="text-sm text-zinc-500">
                        {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-zinc-500">
                        {new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
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
        currentPage={pagination.currentPage}
        onPageChange={pagination.setCurrentPage}
        pageSize={pagination.pageSize}
        totalItems={pagination.totalItems}
        totalPages={pagination.totalPages}
      />
    </div>
  )
}
