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
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold">{totalRequests}</p>
              </div>
              <FileCheck className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-green-600">{totalApproved}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-amber-600">
                  {data.reduce((sum, d) => sum + d.pending + d.evaluating, 0)}
                </p>
              </div>
              <Clock className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approval Rate</p>
                <p className="text-2xl font-bold">{overallApprovalRate}%</p>
              </div>
              <XCircle className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
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
                    <span className="ml-2 font-medium text-green-600">{item.approved}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Pending:</span>
                    <span className="ml-2 font-medium text-amber-600">{item.pending + item.evaluating}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Rejected:</span>
                    <span className="ml-2 font-medium text-red-600">{item.rejected}</span>
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
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
