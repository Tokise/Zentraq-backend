"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import {
  getAuditTrailAction,
  type AuditLogDTO,
} from "@/actions/access/audit-trail"
import { DataTablePagination } from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/common/page-header"
import { Badge } from "@/components/ui/badge"
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

const PAGE_SIZE = 10
const ACTION_LABELS: Record<string, string> = {
  AUTH_LOGIN_SUCCESS: "Login Success",
  AUTH_LOGIN_FAILED: "Login Failed",
  AUTH_LOGOUT: "Logout",
  AUTH_PASSWORD_RESET: "Password Reset",
  MEDICAL_RECORD_ACCESS: "Record Accessed",
  MEDICAL_RECORD_MODIFY: "Record Modified",
  INVENTORY_MODIFICATION: "Inventory Modified",
  RFID_SCAN: "RFID Scan",
  APPOINTMENT_CHANGE: "Appointment Change",
  "consultation.claimed": "Consultation Claimed",
  "consultation.claimed_for_review": "Doctor Review Claimed",
  "consultation.submitted_for_review": "Submitted for Doctor Review",
  "consultation.completed": "Consultation Completed",
}

// Renders the paginated, identity-enriched Admin audit trail.
export default function AdminAuditTrailPage() {
  const [logs, setLogs] = useState<AuditLogDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [actionFilter, setActionFilter] = useState("")
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Loads one authorized page of minimized audit entries.
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getAuditTrailAction({
        page,
        pageSize: PAGE_SIZE,
        actionFilter: actionFilter || undefined,
        searchQuery: search || undefined,
      })
      if (result.error) {
        toast.error(result.error)
        setLogs([])
        setTotalCount(0)
      } else {
        setLogs(result.logs)
        setTotalCount(result.totalCount)
      }
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load audit trail",
      )
    } finally {
      setLoading(false)
    }
  }, [actionFilter, page, search])

  // Defers loading so the effect only schedules external synchronization.
  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void fetchData()
    }, 0)
    return () => window.clearTimeout(loadTimer)
  }, [fetchData])

  // Converts a stored audit action key into a readable label.
  function actionLabel(action: string) {
    return ACTION_LABELS[action] || action
      .replace(/_/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase())
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Trail Report"
        description="Read-only system activity with clinician attribution."
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Search by user or IP..."
            className="h-9 pl-3 text-sm"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(event) => {
            setActionFilter(event.target.value)
            setPage(1)
          }}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none"
        >
          <option value="">All Actions</option>
          {Object.entries(ACTION_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton className="h-10 w-full" key={index} />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center">
              <ShieldCheck className="mx-auto mb-2 size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No audit records found.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Timestamp</TableHead>
                    <TableHead className="w-[180px]">Action</TableHead>
                    <TableHead>Clinician</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead className="w-[120px]">IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="text-xs hover:bg-muted/50">
                      <TableCell className="whitespace-nowrap font-mono">
                        {new Date(log.timestamp).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="whitespace-nowrap text-[10px]"
                        >
                          {actionLabel(log.action)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <p className="truncate font-medium">
                          {log.clinician_name || log.email || "System"}
                        </p>
                        {log.clinician_role && (
                          <p className="capitalize text-muted-foreground">
                            {log.clinician_role}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[150px] font-mono">
                        {log.consultation_href ? (
                          <Link
                            href={log.consultation_href}
                            className="text-primary underline-offset-4 hover:underline"
                          >
                            Open consultation
                          </Link>
                        ) : (
                          <span className="truncate">{log.resource || "—"}</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono">
                        {log.ip_address || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DataTablePagination
            currentPage={page}
            totalPages={Math.ceil(totalCount / PAGE_SIZE)}
            totalItems={totalCount}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            className="mx-4 mb-4"
          />
        </CardContent>
      </Card>
    </div>
  )
}
