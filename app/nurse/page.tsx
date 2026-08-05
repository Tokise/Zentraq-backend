"use client"

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

import { useState, useEffect, useCallback, useMemo } from "react"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getDashboardDataAction, type DashboardConsultationDTO, type DashboardAppointmentDTO } from "@/actions/system/dashboard"
import {
  CalendarDays,
  Users,
  Pill,
  AlertTriangle,
  HeartPulse,
  Activity,
  Clock,
  Stethoscope,
} from "lucide-react"
import { EmptyState } from "@/components/empty-state"

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

export default function NurseDashboardPage() {
  const [consultations, setConsultations] = useState<DashboardConsultationDTO[]>([])
  const [appointments, setAppointments] = useState<DashboardAppointmentDTO[]>([])
  const [stats, setStats] = useState({
    patientsToday: 0,
    consultations: 0,
    emergencyCases: 0,
    lowStock: 0,
  })
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const result = await getDashboardDataAction()
      if (result.data) {
        setConsultations(result.data.consultations)
        setAppointments(result.data.appointments)
        setStats({
          patientsToday: result.data.stats.patientsToday,
          consultations: result.data.stats.consultations,
          emergencyCases: result.data.stats.emergencyCases,
          lowStock: 0,
        })
      }
    } catch (err) {
      console.error("Error fetching nurse dashboard data:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const todayAppointments = useMemo(() => {
    const today = new Date().toISOString().split("T")[0]
    return appointments.filter((a) => (a.appointment_date || "").startsWith(today))
  }, [appointments])

  const waitingPatients = useMemo(() => {
    return appointments.filter((a) => ["checked_in", "scheduled", "recommended", "reminded"].includes(a.status?.toLowerCase())).length
  }, [appointments])

  const inConsultation = useMemo(() => {
    return consultations.filter((c) => c.status?.toLowerCase() === "in-progress" || c.status?.toLowerCase() === "in_consultation").length
  }, [consultations])

  const followUpCount = useMemo(() => {
    return consultations.filter((c) => c.status?.toLowerCase() === "completed" && c.notes).length
  }, [consultations])

  const appointmentTrend = useMemo(() => {
    const map = new Map<string, number>()
    appointments.forEach((a) => {
      const date = (a.appointment_date || "").split("T")[0]
      if (!date) return
      map.set(date, (map.get(date) ?? 0) + 1)
    })
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7)
      .map(([date, count]) => ({
        date: new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        count,
      }))
  }, [appointments])

  const consultationDistribution = useMemo(() => {
    const map = new Map<string, number>()
    consultations.forEach((c) => {
      const key = formatStatus(c.status)
      map.set(key, (map.get(key) ?? 0) + 1)
    })
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [consultations])

  const maxApptTrend = Math.max(...appointmentTrend.map((d) => d.count), 1)

  const statCards = [
    {
      label: "Today's Appointments",
      value: loading ? "—" : todayAppointments.length,
      icon: CalendarDays,
      trend: 2.4,
      comparisonText: "scheduled today",
    },
    {
      label: "Waiting Patients",
      value: loading ? "—" : waitingPatients,
      icon: Users,
      trend: 1.2,
      comparisonText: "in queue",
    },
    {
      label: "In Consultation",
      value: loading ? "—" : inConsultation || stats.emergencyCases,
      icon: Stethoscope,
      trend: 0.8,
      comparisonText: "active cases",
    },
    {
      label: "Low Stock Medicines",
      value: loading ? "—" : stats.lowStock,
      icon: AlertTriangle,
      trend: 0,
      comparisonText: "need restock",
    },
    {
      label: "Follow-up Patients",
      value: loading ? "—" : followUpCount,
      icon: HeartPulse,
      trend: 3.1,
      comparisonText: "needs follow-up",
    },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description="Clinic operations and patient queue."
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

      {/* Analytics */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Activity className="size-4 text-primary" />
            Analytics
          </h2>
          <p className="text-xs text-muted-foreground">Real-time summary</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Appointment trends */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Appointment Trends</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex h-40 items-center justify-center">
                  <div className="h-6 w-40 animate-pulse bg-muted" />
                </div>
              ) : appointmentTrend.length === 0 ? (
                <EmptyState title="No appointment data" description="Appointment trends will appear here." />
              ) : (
                <div className="space-y-2">
                  {appointmentTrend.map((d) => (
                    <div key={d.date} className="flex items-center gap-3">
                      <span className="w-16 shrink-0 text-xs text-muted-foreground">{d.date}</span>
                      <div className="h-6 flex-1 bg-muted">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${Math.max((d.count / maxApptTrend) * 100, 4)}%` }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-right text-xs font-medium">{d.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Consultation status distribution */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Consultation Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-5 animate-pulse bg-muted" />
                  ))}
                </div>
              ) : consultationDistribution.length === 0 ? (
                <EmptyState title="No consultation data" description="Consultation status will appear here." />
              ) : (
                <div className="space-y-3">
                  {consultationDistribution.map(([status, count]) => {
                    const total = consultations.length || 1
                    const pct = Math.round((count / total) * 100)
                    return (
                      <div key={status} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <StatusBadge status={getStatusVariant(status)}>{status}</StatusBadge>
                          <span className="text-muted-foreground">
                            {count} · {pct}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-muted">
                          <div className="h-full bg-success" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Clock className="size-4 text-primary" />
            Recent Activities
          </h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Recent appointments */}
          <Card>
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <CalendarDays className="size-4 text-muted-foreground" />
                Recent Appointments
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-3 p-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 animate-pulse bg-muted" />
                  ))}
                </div>
              ) : appointments.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="No appointments" description="No recent appointments found." icon={CalendarDays} />
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {appointments.slice(0, 5).map((a) => (
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
                Recent Consultations
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
                  <EmptyState title="No consultations" description="No recent consultations found." icon={Stethoscope} />
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {consultations.slice(0, 5).map((c) => (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                      <div className="flex size-8 shrink-0 items-center justify-center border border-border bg-muted text-muted-foreground">
                        <Stethoscope className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.patient_name || "Patient"}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.student_complaint || "No complaint"} · {formatTime(c.created_at)}
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