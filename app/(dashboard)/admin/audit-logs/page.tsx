"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pagination } from "@/components/pagination"
import { EmptyState } from "@/components/empty-state"
import { Loader2, Shield, Search, RefreshCw, Filter } from "lucide-react"
import { toast } from "sonner"

import { getAuditLogsAction, type AuditLogDTO } from "./actions"

type AuditLogEntry = AuditLogDTO

const ACTION_VARIANTS: Record<string, string> = {
  AUTH_LOGIN_SUCCESS: "secondary",
  AUTH_LOGIN_FAILED: "destructive",
  AUTH_LOGOUT: "default",
  AUTH_PASSWORD_RESET: "secondary",
  ROLE_CHANGE: "secondary",
  MEDICAL_RECORD_ACCESS: "default",
  MEDICAL_RECORD_MODIFY: "secondary",
  INVENTORY_MODIFICATION: "default",
  RFID_SCAN: "default",
  APPOINTMENT_CHANGE: "default",
  OPERATOR_CREATED: "secondary",
  OPERATOR_REMOVED: "destructive",
  STUDENT_ACCOUNT_CREATED: "secondary",
}

const ACTION_LABELS: Record<string, string> = {
  AUTH_LOGIN_SUCCESS: "Login Success",
  AUTH_LOGIN_FAILED: "Login Failed",
  AUTH_LOGOUT: "Logout",
  AUTH_PASSWORD_RESET: "Password Reset",
  ROLE_CHANGE: "Role Change",
  MEDICAL_RECORD_ACCESS: "Medical Record Access",
  MEDICAL_RECORD_MODIFY: "Medical Record Modified",
  INVENTORY_MODIFICATION: "Inventory Modified",
  RFID_SCAN: "RFID Scan",
  APPOINTMENT_CHANGE: "Appointment Change",
  OPERATOR_CREATED: "Operator Created",
  OPERATOR_REMOVED: "Operator Removed",
  STUDENT_ACCOUNT_CREATED: "Student Profile Created",
  NOTIFICATION_SENT: "Notification Sent",
  NOTIFICATION_READ: "Notification Read",
  NOTIFICATION_UNREAD: "Notification Unread",
  NOTIFICATION_DELETED: "Notification Deleted",
  ROLE_CREATED: "Role Created",
  ROLE_UPDATED: "Role Updated",
  ROLE_DELETED: "Role Deleted",
  PERMISSION_ASSIGNED: "Permission Assigned",
  PERMISSION_REMOVED: "Permission Removed",
  SERVICE_CREATED: "Service Created",
  SERVICE_UPDATED: "Service Updated",
  SERVICE_ARCHIVED: "Service Archived",
  SERVICE_RESTORED: "Service Restored",
  SETTING_UPDATED: "Setting Updated",
  FACULTY_ACCOUNT_CREATED: "Faculty Account Created",
  FACULTY_ACCOUNT_UPDATED: "Faculty Account Updated",
  FACULTY_ACCOUNT_ARCHIVED: "Faculty Account Archived",
  FACULTY_PASSWORD_RESET: "Faculty Password Reset",
  RFID_LOOKUP: "RFID Lookup",
  RFID_NO_MATCH: "RFID No Match",
}

const PAGE_SIZE = 20

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function actionVariant(action: string) {
  return (ACTION_VARIANTS[action] || "default") as "default" | "secondary" | "destructive" | "outline" | "link" | "ghost"
}

function actionLabel(action: string) {
  return ACTION_LABELS[action] || action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [actionFilter, setActionFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAuditLogsAction({
        page,
        pageSize: PAGE_SIZE,
        actionFilter,
        searchQuery,
        dateFrom,
        dateTo,
      })

      if (res.error) {
        toast.error(res.error || "Failed to load audit logs. Ensure you have admin access.")
        setLogs([])
        setTotalCount(0)
      } else {
        setLogs(res.logs)
        setTotalCount(res.totalCount)
      }
    } catch (err: any) {
      console.error("Error fetching audit logs:", err)
      toast.error("Failed to load audit logs. Ensure you have admin access.")
    } finally {
      setLoading(false)
    }
  }, [page, actionFilter, searchQuery, dateFrom, dateTo])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        description="Review system activity, security events, and audit trails."
      />

      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-2.5 top-2.5 size-4 text-zinc-400" />
              <Input
                placeholder="Search by email, user, or IP..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
                className="pl-8 h-9 text-sm"
              />
            </div>

            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1) }}
              className="h-9 px-3 rounded-md border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            >
              <option value="">All Actions</option>
              {Object.entries(ACTION_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                className="h-9 text-sm w-[140px]"
                placeholder="From"
              />
              <span className="text-xs text-zinc-400">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                className="h-9 text-sm w-[140px]"
                placeholder="To"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => { setSearchQuery(""); setActionFilter(""); setDateFrom(""); setDateTo(""); setPage(1) }}
              className="h-9 cursor-pointer"
            >
              <Filter className="size-3.5 mr-1" /> Clear
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchLogs}
              disabled={loading}
              className="h-9 cursor-pointer"
            >
              <RefreshCw className={`size-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center min-h-[300px]">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <EmptyState
              title="No audit logs found"
              description="No security events match your current filters. Try adjusting the search criteria."
            />
          ) : (
            <>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[160px]">Timestamp</TableHead>
                      <TableHead className="w-[140px]">Action</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead className="w-[120px]">IP Address</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id} className="text-xs">
                        <TableCell className="font-mono whitespace-nowrap">
                          {formatTimestamp(log.timestamp)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={actionVariant(log.action)} className="text-[10px] whitespace-nowrap">
                            {actionLabel(log.action)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono max-w-[120px] truncate">
                          {log.user_id || "—"}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          {log.email || "—"}
                        </TableCell>
                        <TableCell className="font-mono max-w-[100px] truncate">
                          {log.resource || "—"}
                        </TableCell>
                        <TableCell className="font-mono">
                          {log.ip_address || "—"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-zinc-500">
                          {log.details ? JSON.stringify(log.details).slice(0, 80) + (JSON.stringify(log.details).length > 80 ? "..." : "") : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalCount}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}