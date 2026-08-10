"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { PageHeader } from "@/components/common/page-header"
import { StatCard } from "@/components/common/stat-card"
import { StatusBadge } from "@/components/common/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  getDashboardDataAction,
  type DashboardActivityDTO,
  type DashboardAppointmentDTO,
  type DashboardConsultationDTO,
} from "@/actions/system/dashboard"
import {
  Users,
  CalendarDays,
  Stethoscope,
  CheckCircle2,
  FileCheck,
  Activity,
  ClipboardList,
} from "lucide-react"
import { EmptyState } from "@/components/common/empty-state"
import { ClinicalDashboardCharts } from "@/components/analytics/clinical-dashboard-charts"

function getStatusVariant(status: string): "success" | "warning" | "danger" | "info" | "default" {
  const s = status?.toLowerCase() ?? ""
  if (["completed", "approved", "healthy", "in stock", "fit"].includes(s)) return "success"
  if (["pending", "evaluating", "low stock", "ai_evaluated", "recommended", "reminded", "scheduled"].includes(s)) return "warning"
  if (["cancelled", "rejected", "no_show", "out of stock", "critical"].includes(s)) return "danger"
  if (["checked_in", "in_consultation", "active", "in-progress"].includes(s)) return "info"
  return "default"
}

function formatStatus(status: string): string {
  return status?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ?? "—"
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return "—"
  }
}

export default function DoctorDashboardPage() {
  const [consultations, setConsultations] = useState<DashboardConsultationDTO[]>([])
  const [appointments, setAppointments] = useState<DashboardAppointmentDTO[]>([])
  const [activity, setActivity] = useState<DashboardActivityDTO[]>([])
  const [stats, setStats] = useState({
    patientsToday: 0,
    consultations: 0,
    emergencyCases: 0,
  })
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const result = await getDashboardDataAction()
      if (result.data) {
        setConsultations(result.data.consultations)
        setAppointments(result.data.appointments)
        setActivity(result.data.activity)
        setStats({
          patientsToday: result.data.stats.patientsToday,
          consultations: result.data.stats.consultations,
          emergencyCases: result.data.stats.emergencyCases,
        })
      }
    } catch (err) {
      console.error("Error fetching doctor dashboard data:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void fetchData(), 0)
    return () => window.clearTimeout(initialLoad)
  }, [fetchData])

  const todayAppointments = useMemo(() => {
    const today = new Date().toISOString().split("T")[0]
    return appointments.filter((a) => (a.appointment_date || "").startsWith(today)).slice(0, 6)
  }, [appointments])

  const pendingConsultations = useMemo(() => {
    return consultations.filter((c) => ["pending", "ai_evaluated"].includes(c.status?.toLowerCase())).slice(0, 6)
  }, [consultations])

  const completedCount = useMemo(() => {
    return consultations.filter((c) => c.status?.toLowerCase() === "completed").length
  }, [consultations])

  const prescriptionsIssued = useMemo(() => {
    return completedCount
  }, [completedCount])

  const statCards = [
    {
      label: "Today's Patients",
      value: loading ? "—" : stats.patientsToday,
      icon: Users,
      trend: 3.4,
      comparisonText: "vs yesterday",
    },
    {
      label: "Today's Appointments",
      value: loading ? "—" : todayAppointments.length,
      icon: CalendarDays,
      trend: 1.8,
      comparisonText: "scheduled today",
    },
    {
      label: "Pending Consultations",
      value: loading ? "—" : pendingConsultations.length,
      icon: Stethoscope,
      trend: 0,
      comparisonText: "awaiting review",
    },
    {
      label: "Completed Consultations",
      value: loading ? "—" : completedCount,
      icon: CheckCircle2,
      trend: 5.2,
      comparisonText: "total completed",
    },
    {
      label: "Prescriptions Issued",
      value: loading ? "—" : prescriptionsIssued,
      icon: FileCheck,
      trend: 2.4,
      comparisonText: "total issued",
    },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description="Your medical consultations and patient overview."
        breadcrumb={[{ label: "Dashboard" }]}
      />

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {statCards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            icon={card.icon}
            trend={card.trend}
            comparisonText={card.comparisonText}
          />
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Activity className="size-4 text-primary" />
            Analytics
          </h2>
          <p className="text-xs text-muted-foreground">Assigned clinical activity</p>
        </div>
        <ClinicalDashboardCharts
          activity={activity}
          appointments={appointments}
          consultations={consultations}
          loading={loading}
        />
      </div>

      {/* Additional sections */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Today's schedule */}
        <Card>
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <CalendarDays className="size-4 text-muted-foreground" />
              Today&apos;s Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 animate-pulse bg-muted" />
                ))}
              </div>
            ) : todayAppointments.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No appointments today" description="Your schedule is clear." icon={CalendarDays} />
              </div>
            ) : (
              <div className="divide-y divide-border">
                {todayAppointments.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                    <div className="flex size-8 shrink-0 items-center justify-center border border-border bg-muted text-muted-foreground">
                      <CalendarDays className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.patient_name || "Patient"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {a.time_slot ? a.time_slot.slice(0, 5) : "Unscheduled"}
                      </p>
                    </div>
                    <StatusBadge status={getStatusVariant(a.status)}>{formatStatus(a.status)}</StatusBadge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending consultations */}
        <Card>
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <ClipboardList className="size-4 text-muted-foreground" />
              Pending Consultations
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 animate-pulse bg-muted" />
                ))}
              </div>
            ) : pendingConsultations.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No pending consultations" description="All caught up." icon={Stethoscope} />
              </div>
            ) : (
              <div className="divide-y divide-border">
                {pendingConsultations.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                    <div className="flex size-8 shrink-0 items-center justify-center border border-border bg-muted text-muted-foreground">
                      <Stethoscope className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.patient_name || "Patient"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.patient_complaint || "No visit reason"}
                      </p>
                    </div>
                    <StatusBadge status={getStatusVariant(c.status)}>{formatStatus(c.status)}</StatusBadge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent patients */}
        <Card>
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Users className="size-4 text-muted-foreground" />
              Recent Patients
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 animate-pulse bg-muted" />
                ))}
              </div>
            ) : consultations.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No recent patients" description="Patient activity will appear here." icon={Users} />
              </div>
            ) : (
              <div className="divide-y divide-border">
                {consultations.slice(0, 6).map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                    <div className="flex size-8 shrink-0 items-center justify-center border border-border bg-muted text-muted-foreground">
                      <Users className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.patient_name || "Patient"}</p>
                      <p className="truncate text-xs text-muted-foreground">{formatTime(c.created_at)}</p>
                    </div>
                    <StatusBadge status={getStatusVariant(c.status)}>{formatStatus(c.status)}</StatusBadge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
