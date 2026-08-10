"use client"

import * as React from "react"
import { Activity, ClipboardList, FileCheck, Pill } from "lucide-react"
import { toast } from "sonner"

import {
  getAnalyticsOverview,
  getComplaintFrequency,
  getDailyConsultations,
  getDispensingSummary,
  type ComplaintFrequency,
  type DailyConsultation,
  type DispensingSummary,
} from "@/actions/reports/analytics"
import { clinicalActivitySeries } from "@/components/analytics/clinical-activity-series"
import { PageHeader } from "@/components/common/page-header"
import { StatCard } from "@/components/common/stat-card"
import { ChartAreaInteractive } from "@/components/ui/chart-area-interactive"
import { ChartBarDefault } from "@/components/ui/chart-bar-default"
import { ChartLineStep } from "@/components/ui/chart-line-step"
import { ChartPieDonutText } from "@/components/ui/chart-pie-donut-text"
import { ChartRadarDots } from "@/components/ui/chart-radar-dots"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type ClinicRole = "admin" | "doctor" | "nurse"

interface AnalyticsOverview {
  active_incidents: number
  faculty_consultations: number
  low_stock_medicines: number
  pending_clearances: number
  period_end: string
  period_start: string
  student_consultations: number
  total_consultations: number
}

// Renders aggregate clinic reports without exposing patient-level records.
export function ClinicalReportsWorkspace({ role }: { role: ClinicRole }) {
  const [overview, setOverview] = React.useState<AnalyticsOverview | null>(null)
  const [daily, setDaily] = React.useState<DailyConsultation[]>([])
  const [complaints, setComplaints] = React.useState<ComplaintFrequency[]>([])
  const [dispensing, setDispensing] = React.useState<DispensingSummary[]>([])
  const [loading, setLoading] = React.useState(true)

  // Loads authorized aggregate report DTOs from server actions.
  const loadReports = React.useCallback(async () => {
    setLoading(true)
    const [overviewResult, dailyResult, complaintResult, dispensingResult] =
      await Promise.all([
        getAnalyticsOverview(),
        getDailyConsultations(),
        getComplaintFrequency(),
        getDispensingSummary(),
      ])

    const error =
      overviewResult.error ??
      dailyResult.error ??
      complaintResult.error ??
      dispensingResult.error
    if (error) toast.error(error)

    setOverview((overviewResult.overview as AnalyticsOverview | null) ?? null)
    setDaily(dailyResult.data)
    setComplaints(complaintResult.data)
    setDispensing(dispensingResult.data)
    setLoading(false)
  }, [])

  React.useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadReports(), 0)
    return () => window.clearTimeout(initialLoad)
  }, [loadReports])

  const reportData = React.useMemo(
    () => buildReportChartData(daily, complaints, dispensing),
    [complaints, daily, dispensing],
  )

  if (loading) return <ReportsSkeleton />

  return (
    <div className="space-y-6">
      <PageHeader
        description={
          role === "admin"
            ? "Clinic-wide operational trends and workload summaries."
            : "Read-only clinic trends from aggregate, non-patient report data."
        }
        title="Reports & Analytics"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Activity}
          label="Total Consultations"
          value={overview?.total_consultations ?? 0}
        />
        <StatCard
          icon={ClipboardList}
          label="Active Incidents"
          value={overview?.active_incidents ?? 0}
        />
        <StatCard
          icon={FileCheck}
          label="Pending Clearances"
          value={overview?.pending_clearances ?? 0}
        />
        <StatCard
          icon={Pill}
          label="Low Stock Medicines"
          value={overview?.low_stock_medicines ?? 0}
        />
      </div>

      <ChartAreaInteractive
        data={reportData.activity}
        description="Daily consultation volume, patient groups, and visit channels."
        series={clinicalActivitySeries}
        title="Clinical Activity"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartLineStep
          data={reportData.trend}
          description="Total completed and active consultations by day."
          title="Consultation Trend"
          valueLabel="Consultations"
        />
        <ChartBarDefault
          data={reportData.complaints}
          description="Most frequently recorded visit reasons."
          title="Top Visit Reasons"
          valueLabel="Occurrences"
        />
        <ChartPieDonutText
          data={reportData.patientMix}
          description="Consultations grouped by patient population."
          title="Patient Mix"
          totalLabel="Consultations"
        />
        <ChartRadarDots
          data={reportData.channels}
          description="How patients entered the consultation workflow."
          title="Visit Channels"
          valueLabel="Visits"
        />
        <div className="lg:col-span-2">
          <ChartBarDefault
            data={reportData.dispensing}
            description="Highest medicine quantities dispensed in the report data."
            title="Medicine Dispensing"
            valueLabel="Quantity"
          />
        </div>
      </div>

      {overview && (
        <p className="text-xs text-muted-foreground">
          Reporting period: {overview.period_start} to {overview.period_end}
        </p>
      )}
    </div>
  )
}

// Converts aggregate report DTOs into the shared chart contracts.
function buildReportChartData(
  daily: DailyConsultation[],
  complaints: ComplaintFrequency[],
  dispensing: DispensingSummary[],
) {
  const chronological = [...daily].sort((a, b) =>
    a.consultation_date.localeCompare(b.consultation_date),
  )
  const studentTotal = daily.reduce(
    (sum, item) => sum + item.student_consultations,
    0,
  )
  const employeeTotal = daily.reduce(
    (sum, item) => sum + item.faculty_consultations,
    0,
  )

  return {
    activity: chronological.map((item) => ({
      date: item.consultation_date,
      total_consultations: item.total_consultations,
      student_consultations: item.student_consultations,
      faculty_consultations: item.faculty_consultations,
      walk_in_visits: item.walk_in_visits,
      appointment_visits: item.appointment_visits,
      rfid_visits: item.rfid_visits,
    })),
    trend: chronological.map((item) => ({
      label: formatShortDate(item.consultation_date),
      value: item.total_consultations,
    })),
    complaints: complaints.slice(0, 10).map((item) => ({
      label: truncateLabel(item.complaint),
      value: item.frequency,
    })),
    patientMix: [
      { name: "Students", value: studentTotal },
      { name: "Employees", value: employeeTotal },
    ].filter((item) => item.value > 0),
    channels: [
      {
        label: "Walk-in",
        value: daily.reduce((sum, item) => sum + item.walk_in_visits, 0),
      },
      {
        label: "Appointment",
        value: daily.reduce((sum, item) => sum + item.appointment_visits, 0),
      },
      {
        label: "RFID",
        value: daily.reduce((sum, item) => sum + item.rfid_visits, 0),
      },
    ],
    dispensing: dispensing.slice(0, 10).map((item) => ({
      label: truncateLabel(item.generic_name),
      value: item.total_quantity_dispensed,
    })),
  }
}

// Formats one ISO date for compact report axes.
function formatShortDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  })
}

// Keeps long medical labels readable inside chart axes.
function truncateLabel(value: string) {
  return value.length > 18 ? `${value.slice(0, 18)}…` : value
}

// Displays report cards and charts while aggregate actions are loading.
function ReportsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton className="h-28 w-full" key={index} />
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-44" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[280px] w-full" />
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[360px] w-full" />
        <Skeleton className="h-[360px] w-full" />
      </div>
    </div>
  )
}
