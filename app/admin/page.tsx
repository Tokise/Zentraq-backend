"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { PageHeader } from "@/components/common/page-header"
import { StatCard } from "@/components/common/stat-card"
import { StatusBadge } from "@/components/common/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  getDashboardDataAction,
  type DashboardActivityScope,
  type DashboardActivityDTO,
  type DashboardAppointmentDTO,
  type DashboardConsultationDTO,
} from "@/actions/dashboard/queries"
import {
  Users,
  CalendarDays,
  Stethoscope,
  ShieldAlert,
  Activity,
  Clock,
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

export default function AdminDashboardPage() {
  const [consultations, setConsultations] = useState<DashboardConsultationDTO[]>([])
  const [appointments, setAppointments] = useState<DashboardAppointmentDTO[]>([])
  const [activity, setActivity] = useState<DashboardActivityDTO[]>([])
  const [activityScope, setActivityScope] =
    useState<DashboardActivityScope>("admin")
  const [stats, setStats] = useState({
    patientsToday: 0,
    consultations: 0,
  })
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const result = await getDashboardDataAction()
      if (result.data) {
        setConsultations(result.data.consultations)
        setAppointments(result.data.appointments)
        setActivity(result.data.activity)
        setActivityScope(result.data.activityScope)
        setStats({
          patientsToday: result.data.stats.patientsToday,
          consultations: result.data.stats.consultations,
        })
      }
    } catch (err) {
      console.error("Error fetching admin dashboard data:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void fetchData(), 0)
    return () => window.clearTimeout(initialLoad)
  }, [fetchData])

  const totalPatients = useMemo(() => {
    const names = new Set(consultations.map((c) => c.patient_name).filter(Boolean))
    const apptNames = new Set(appointments.map((a) => a.patient_name).filter(Boolean))
    return new Set([...names, ...apptNames]).size
  }, [consultations, appointments])

  const pendingCount = useMemo(() => {
    const pendingConsultations = consultations.filter((c) =>
      ["pending", "ai_evaluated"].includes(c.status?.toLowerCase())
    ).length
    const pendingAppointments = appointments.filter((a) =>
      ["pending", "ai_evaluated", "recommended"].includes(a.status?.toLowerCase())
    ).length
    return pendingConsultations + pendingAppointments
  }, [consultations, appointments])

  const recentAppointments = useMemo(() => {
    return [...appointments]
      .sort((a, b) => new Date(b.appointment_date || b.appointment_date).getTime() - new Date(a.appointment_date || a.appointment_date).getTime())
      .slice(0, 5)
  }, [appointments])

  const recentConsultations = useMemo(() => {
    return [...consultations]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
  }, [consultations])

  const statCards = [
    {
      label: "Assigned Patients",
      value: loading ? "—" : totalPatients,
      icon: Users,
      comparisonText: `${stats.patientsToday} assigned today`,
    },
    {
      label: "Assigned Appointments",
      value: loading ? "—" : appointments.length,
      icon: CalendarDays,
      comparisonText: "Visible only when assigned to you",
    },
    {
      label: "Assigned Consultations",
      value: loading ? "—" : stats.consultations,
      icon: Stethoscope,
      comparisonText: "Your clinical workload",
    },
    {
      label: "Pending Requests",
      value: loading ? "—" : pendingCount,
      icon: ShieldAlert,
      comparisonText: "awaiting action",
    },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Admin Workload"
        description={
          "Appointments and clinical work assigned to your Admin account. " +
          "Clinic-wide analytics remain in Reports & Analytics."
        }
        breadcrumb={[{ label: "Dashboard" }]}
      />

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            icon={card.icon}
            comparisonText={card.comparisonText}
          />
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Activity className="size-4 text-primary" />
            Assigned Workload
          </h2>
          <p className="text-xs text-muted-foreground">Your assignments only</p>
        </div>
        <ClinicalDashboardCharts
          activity={activity}
          activityScope={activityScope}
          appointments={appointments}
          consultations={consultations}
          loading={loading}
        />
      </div>

      {/* Recent Activity */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Clock className="size-4 text-primary" />
            Recent Activity
          </h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Recent appointments */}
          <Card>
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <CalendarDays className="size-4 text-muted-foreground" />
                My Recent Appointments
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-3 p-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 animate-pulse bg-muted" />
                  ))}
                </div>
              ) : recentAppointments.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    description={
                      "Appointments assigned to your Admin account will " +
                      "appear here."
                    }
                    icon={CalendarDays}
                    title="No assigned appointments"
                  />
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentAppointments.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                      <div className="flex size-8 shrink-0 items-center justify-center border border-border bg-muted text-muted-foreground">
                        <CalendarDays className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{a.patient_name || "Patient"}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {a.time_slot ? a.time_slot.slice(0, 5) : "Unscheduled"} · {formatTime(a.appointment_date)}
                        </p>
                      </div>
                      <StatusBadge status={getStatusVariant(a.status)}>{formatStatus(a.status)}</StatusBadge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent consultations */}
          <Card>
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Stethoscope className="size-4 text-muted-foreground" />
                My Recent Consultations
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-3 p-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 animate-pulse bg-muted" />
                  ))}
                </div>
              ) : recentConsultations.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    description={
                      "Consultations you claim or receive will appear here."
                    }
                    icon={Stethoscope}
                    title="No assigned consultations"
                  />
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentConsultations.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                      <div className="flex size-8 shrink-0 items-center justify-center border border-border bg-muted text-muted-foreground">
                        <Stethoscope className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.patient_name || "Patient"}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.patient_complaint || "No visit reason"} · {formatTime(c.created_at)}
                        </p>
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
    </div>
  )
}
