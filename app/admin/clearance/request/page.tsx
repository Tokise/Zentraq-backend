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
import { Search, FileText } from "lucide-react"
import { toast } from "sonner"
import { getClearanceQueue } from "@/actions/inventory/workflow-queries"
import { getClearanceHistoryAction } from "@/actions/admin/clearances/overview"

export default function AdminClearanceRequestsPage() {
  const [clearances, setClearances] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<"pending" | "all">("pending")
  const [search, setSearch] = useState("")
  const pagination = useTablePagination(clearances)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      if (viewMode === "pending") {
        const res = await getClearanceQueue()
        if (res.error) {
          toast.error(res.error)
          setClearances([])
        } else {
          setClearances(res.clearances)
        }
      } else {
        const res = await getClearanceHistoryAction({ searchQuery: search || undefined })
        if (res.error) {
          toast.error(res.error)
          setClearances([])
        } else {
          setClearances(res.clearances)
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load clearances")
    } finally {
      setLoading(false)
    }
  }, [viewMode, search])

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
        title="Clearance Requests"
        description="Review incoming health-clearance requests."
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(["pending", "all"] as const).map((mode) => (
            <button
              key={mode}
                  onClick={() => {
                    setViewMode(mode)
                    pagination.setCurrentPage(1)
                  }}
              className={`px-4 py-2 text-sm font-medium cursor-pointer transition-colors ${
                viewMode === mode
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-foreground hover:bg-muted"
              }`}
            >
              {mode === "pending" ? "Pending" : "All"}
            </button>
          ))}
        </div>

        {viewMode === "all" && (
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
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
        )}
      </div>

      <Card className="border-border shadow-sm bg-card">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton className="h-10 w-full" key={index} />
              ))}
            </div>
          ) : clearances.length === 0 ? (
            <div className="py-16 text-center">
              <FileText className="size-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No clearance requests found.</p>
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
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.paginatedItems.map((c: any) => (
                    <TableRow key={c.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium text-foreground">{displayName(c)}</TableCell>
                      <TableCell className="text-sm text-foreground capitalize">{c.requester_type}</TableCell>
                      <TableCell className="text-sm text-foreground max-w-[280px] truncate">{c.purpose || "—"}</TableCell>
                      <TableCell>{statusBadge(c.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
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
