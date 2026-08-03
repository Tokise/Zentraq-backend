"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import type { DailyConsultation } from "@/app/actions/analytics"

interface ConsultationChartProps {
  data: DailyConsultation[]
}

export function ConsultationChart({ data }: ConsultationChartProps) {
  const chartData = data.map((d) => ({
    date: new Date(d.consultation_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    total: d.total_consultations,
    students: d.student_consultations,
    faculty: d.faculty_consultations
  })).reverse()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consultation Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="total" stroke="#000" strokeWidth={2} name="Total" />
            <Line type="monotone" dataKey="students" stroke="#3b82f6" strokeWidth={2} name="Students" />
            <Line type="monotone" dataKey="faculty" stroke="#10b981" strokeWidth={2} name="Faculty" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
