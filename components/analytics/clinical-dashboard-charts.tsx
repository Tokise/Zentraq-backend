"use client"

import * as React from "react"

import type {
  DashboardAppointmentDTO,
  DashboardConsultationDTO,
} from "@/actions/system/dashboard"
import { ChartAreaInteractive } from "@/components/ui/chart-area-interactive"
import { ChartBarDefault } from "@/components/ui/chart-bar-default"
import { ChartPieDonutText } from "@/components/ui/chart-pie-donut-text"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface ClinicalDashboardChartsProps {
  appointments: DashboardAppointmentDTO[]
  consultations: DashboardConsultationDTO[]
  loading: boolean
}

// Renders the shared role-safe analytics section for clinic dashboards.
export function ClinicalDashboardCharts({
  appointments,
  consultations,
  loading,
}: ClinicalDashboardChartsProps) {
  const activity = React.useMemo(
    () => buildActivitySeries(appointments, consultations),
    [appointments, consultations],
  )
  const consultationStatuses = React.useMemo(
    () => buildStatusSeries(consultations.map((item) => item.status)),
    [consultations],
  )
  const appointmentStatuses = React.useMemo(
    () => buildStatusSeries(appointments.map((item) => item.status)),
    [appointments],
  )

  if (loading) {
    return (
      <div className="space-y-4">
        <ChartPanelSkeleton className="h-[360px]" />
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartPanelSkeleton />
          <ChartPanelSkeleton />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ChartAreaInteractive
        data={activity}
        description="Authorized appointments and consultations over time."
        primaryLabel="Consultations"
        secondaryLabel="Appointments"
        title="Clinical Activity"
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartBarDefault
          data={consultationStatuses}
          description="Current consultation workload grouped by status."
          title="Consultation Status"
          valueLabel="Consultations"
        />
        <ChartPieDonutText
          data={appointmentStatuses.map((item) => ({
            name: item.label,
            value: item.value,
          }))}
          description="Current appointment workload grouped by status."
          title="Appointment Status"
          totalLabel="Appointments"
        />
      </div>
    </div>
  )
}

// Combines appointment and consultation dates into one deterministic series.
function buildActivitySeries(
  appointments: DashboardAppointmentDTO[],
  consultations: DashboardConsultationDTO[],
) {
  const days = new Map<
    string,
    { date: string; primary: number; secondary: number }
  >()

  consultations.forEach((item) => {
    const date = item.created_at.slice(0, 10)
    if (!date) return
    const point = days.get(date) ?? { date, primary: 0, secondary: 0 }
    point.primary += 1
    days.set(date, point)
  })
  appointments.forEach((item) => {
    const date = item.appointment_date.slice(0, 10)
    if (!date) return
    const point = days.get(date) ?? { date, primary: 0, secondary: 0 }
    point.secondary += 1
    days.set(date, point)
  })

  return Array.from(days.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  )
}

// Counts normalized workflow statuses for categorical charts.
function buildStatusSeries(statuses: string[]) {
  const counts = new Map<string, number>()
  statuses.forEach((status) => {
    const label = formatStatus(status)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  })
  return Array.from(counts, ([label, value]) => ({ label, value })).sort(
    (a, b) => b.value - a.value || a.label.localeCompare(b.label),
  )
}

// Formats workflow status values for chart labels.
function formatStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

// Displays a theme-consistent loading surface for dashboard charts.
function ChartPanelSkeleton({ className = "h-[340px]" }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[240px] w-full" />
      </CardContent>
    </Card>
  )
}
