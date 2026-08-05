"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Loader2, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { getAuditLogsAction } from "@/actions/admin/useraccess/activity_logs"

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
}

export default function AdminAuditTrailPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [actionFilter, setActionFilter] = useState("")

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAuditLogsAction({
        page: 1,
        pageSize: 50,
        actionFilter: actionFilter || undefined,
        searchQuery: search || undefined,
      })
      if (res.error) {
        toast.error(res.error)
        setLogs([])
      } else {
        setLogs(res.logs)
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load audit trail")
    } finally {
      setLoading(false)
    }
  }, [search, actionFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const actionLabel = (action: string) => ACTION_LABELS[action] || action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Trail Report"
        description="Read-only view of system activity for reporting."
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchData()}
            placeholder="Search by user or IP..."
            className="h-9 pl-3 text-sm"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none"
        >
          <option value="">All Actions</option>
          {Object.entries(ACTION_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
              <div className="py-16 text-center">
                <ShieldCheck className="size-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No audit records found.</p>
              </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Timestamp</TableHead>
                    <TableHead className="w-[140px]">Action</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead className="w-[120px]">IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="text-xs hover:bg-muted/50">
                      <TableCell className="font-mono whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                          {actionLabel(log.action)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate">{log.email || "—"}</TableCell>
                      <TableCell className="font-mono max-w-[100px] truncate">{log.resource || "—"}</TableCell>
                      <TableCell className="font-mono">{log.ip_address || "—"}</TableCell>
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