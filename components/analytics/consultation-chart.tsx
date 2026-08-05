"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import type { DailyConsultation } from "@/actions/reports/analytics"

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
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
            <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
            <Tooltip
              contentStyle={{ borderRadius: 0, border: "1px solid #e5e7eb", fontSize: 12 }}
              itemStyle={{ color: "#111827" }}
            />
            <Line type="monotone" dataKey="total" stroke="#157f5a" strokeWidth={2} name="Total" />
            <Line type="monotone" dataKey="students" stroke="#2563eb" strokeWidth={2} name="Students" />
            <Line type="monotone" dataKey="faculty" stroke="#16803c" strokeWidth={2} name="Faculty" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}