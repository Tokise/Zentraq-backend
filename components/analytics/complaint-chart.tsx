"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import type { ComplaintFrequency } from "@/app/actions/analytics"

interface ComplaintChartProps {
  data: ComplaintFrequency[]
}

export function ComplaintChart({ data }: ComplaintChartProps) {
  const chartData = data.slice(0, 10).map((d) => ({
    complaint: d.complaint.length > 20 ? d.complaint.substring(0, 20) + "..." : d.complaint,
    fullComplaint: d.complaint,
    frequency: d.frequency
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Complaints</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="complaint" type="category" width={150} />
            <Tooltip />
            <Bar dataKey="frequency" fill="#000" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
