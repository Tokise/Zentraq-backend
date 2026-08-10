"use client"

import * as React from "react"

import type {
  DashboardActivityDTO,
  DashboardAppointmentDTO,
  DashboardConsultationDTO,
} from "@/actions/system/dashboard"
import { clinicalActivitySeries } from "@/components/analytics/clinical-activity-series"
import { ChartAreaInteractive } from "@/components/ui/chart-area-interactive"
import { ChartBarDefault } from "@/components/ui/chart-bar-default"
import { ChartPieDonutText } from "@/components/ui/chart-pie-donut-text"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface ClinicalDashboardChartsProps {
  activity: DashboardActivityDTO[]
  appointments: DashboardAppointmentDTO[]
  consultations: DashboardConsultationDTO[]
  loading: boolean
}

// Renders the shared role-safe analytics section for clinic dashboards.
export function ClinicalDashboardCharts({
  activity,
  appointments,
  consultations,
  loading,
}: ClinicalDashboardChartsProps) {
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
        description="Authorized consultation volume, patient groups, and visit channels over time."
        series={clinicalActivitySeries}
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
