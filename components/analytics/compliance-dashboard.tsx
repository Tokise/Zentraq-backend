"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileCheck, Clock, XCircle, TrendingUp } from "lucide-react"
import type { ClearanceCompletion } from "@/actions/reports/analytics"

interface ComplianceDashboardProps {
  data: ClearanceCompletion[]
}

export function ComplianceDashboard({ data }: ComplianceDashboardProps) {
  const totalRequests = data.reduce((sum, d) => sum + d.total_requests, 0)
  const totalApproved = data.reduce((sum, d) => sum + d.approved, 0)
  const overallApprovalRate = totalRequests > 0 ? (totalApproved / totalRequests * 100).toFixed(1) : "0"

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Requests</p>
              <p className="mt-1 text-2xl font-semibold">{totalRequests}</p>
            </div>
            <div className="flex size-9 items-center justify-center border border-border bg-muted text-muted-foreground">
              <FileCheck className="size-4" />
            </div>
          </div>
        </div>
        <div className="border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Approved</p>
              <p className="mt-1 text-2xl font-semibold text-success">{totalApproved}</p>
            </div>
            <div className="flex size-9 items-center justify-center border border-success/20 bg-success/10 text-success">
              <TrendingUp className="size-4" />
            </div>
          </div>
        </div>
        <div className="border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pending</p>
              <p className="mt-1 text-2xl font-semibold text-warning">
                {data.reduce((sum, d) => sum + d.pending + d.evaluating, 0)}
              </p>
            </div>
            <div className="flex size-9 items-center justify-center border border-warning/20 bg-warning/10 text-warning">
              <Clock className="size-4" />
            </div>
          </div>
        </div>
        <div className="border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Approval Rate</p>
              <p className="mt-1 text-2xl font-semibold">{overallApprovalRate}%</p>
            </div>
            <div className="flex size-9 items-center justify-center border border-border bg-muted text-muted-foreground">
              <XCircle className="size-4" />
            </div>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clearance Completion by Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.map((item) => (
              <div key={item.requester_type} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium capitalize">{item.requester_type}</span>
                  <Badge variant="outline">{item.approval_rate}% approval rate</Badge>
                </div>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total:</span>
                    <span className="ml-2 font-medium">{item.total_requests}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Approved:</span>
                    <span className="ml-2 font-medium text-success">{item.approved}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Pending:</span>
                    <span className="ml-2 font-medium text-warning">{item.pending + item.evaluating}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Rejected:</span>
                    <span className="ml-2 font-medium text-destructive">{item.rejected}</span>
                  </div>
                </div>
                <div className="w-full bg-muted h-1.5">
                  <div
                    className="bg-success h-1.5"
                    style={{ width: `${item.approval_rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}