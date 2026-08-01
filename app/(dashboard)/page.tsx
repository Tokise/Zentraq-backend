"use client"
import Link from "next/link"
import { Sparkles } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { PageHeader } from "@/components/page-header"
import { SectionHeader } from "@/components/section-header"
import { StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { Pagination } from "@/components/pagination"
import {
  aiInsights,
  consultationTrend,
  emergencyCases,
  inventoryAlerts,
  notifications,
  recentActivities,
  recentConsultations,
} from "@/lib/data/mock-dashboard"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import { MonthCalendar, CalendarMarker } from "@/components/month-calendar"
import { getDashboardDataAction } from "./dashboard-actions"

const CONSULT_PAGE_SIZE = 5
const APPT_PAGE_SIZE = 5
const POLL_INTERVAL = 30000 // 30s fallback polling — realtime subscriptions handle instant sync
const REALTIME_DEBOUNCE = 500 // coalesce bursts of realtime events into a single fetch

function appointmentStatusVariant(status: string) {
  switch (status) {
    case "completed":
      return "success" as const
    case "in_progress":
      return "info" as const
    case "cancelled":
      return "danger" as const
    default:
      return "default" as const
  }
}

function consultationStatusVariant(status: string) {
  switch (status) {
    case "in_emergency":
      return "danger" as const
    case "in_consultation":
      return "info" as const
    case "waiting":
      return "warning" as const
    case "completed":
      return "success" as const
    case "dismissed":
      return "default" as const
    default:
      return "default" as const
  }
}

type ConsultRow = {
  id: string
  patient_name: string
  student_complaint: string
  time: string
  status: string
  created_at: string
  handled_at: string | null
  notes: string | null
}

type ApptRow = {
  id: string
  patient_name: string
  time: string
  reason: string
  status: string
  appointment_date: string
  time_slot: string
}

type LiveStats = {
  patientsToday: number
  consultations: number
  emergencyCases: number
  lowStockAlerts: number
}

export default function DashboardPage() {
  const router = useRouter()
  const [dbConsultations, setDbConsultations] = useState<any[]>([])
  const [dbAppointments, setDbAppointments] = useState<any[]>([])
  const [consultPage, setConsultPage] = useState(1)
  const [apptPage, setApptPage] = useState(1)
  const [liveStats, setLiveStats] = useState<LiveStats>({
    patientsToday: 0,
    consultations: 0,
    emergencyCases: 0,
    lowStockAlerts: 0,
  })
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // Separate in-flight guards + debounce timers per concern, so a burst of
  // events on one table can't block or pile onto fetches for another table.
  const consultInFlight = useRef(false)
  const apptInFlight = useRef(false)
  const statsInFlight = useRef(false)
  const consultDebounce = useRef<NodeJS.Timeout | null>(null)
  const apptDebounce = useRef<NodeJS.Timeout | null>(null)
  const statsDebounce = useRef<NodeJS.Timeout | null>(null)

  // Single authorized server action for all dashboard data (reduces round-trips and auth checks)
  const fetchDashboardData = useCallback(async () => {
    if (consultInFlight.current) return
    consultInFlight.current = true
    try {
      const result = await getDashboardDataAction()
      if (result.error) {
        console.error("fetchDashboardData error:", result.error)
        return
      }
      if (result.data) {
        const d = result.data
        // Map flat DTO consultations to the display shape
        setDbConsultations(d.consultations.map((c: any) => ({
          ...c,
          time: new Date(c.created_at).toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' }),
        })))
        // Map DTO appointments to the display shape
        setDbAppointments(d.appointments.map((a: any) => ({
          ...a,
          student_accounts: {
            first_name: a.patient_name?.split(" ")[0] || "",
            last_name: a.patient_name?.split(" ").slice(1).join(" ") || "",
            student_number: a.student_number,
            employee_number: a.employee_number,
          },
        })))
        setLiveStats({
          patientsToday: d.stats.patientsToday,
          consultations: d.stats.consultations,
          emergencyCases: d.stats.emergencyCases,
          lowStockAlerts: inventoryAlerts.length,
        })
      }
    } catch (err) {
      console.error("fetchDashboardData error:", err)
    } finally {
      consultInFlight.current = false
    }
  }, [])

  // Fetch everything once, then poll as lightweight fallback (server actions replace realtime)
  useEffect(() => {
    fetchDashboardData()

    // Start polling
    pollRef.current = setInterval(fetchDashboardData, POLL_INTERVAL)

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [fetchDashboardData])

  // Build display data for consultations — deduplicate by id using a Map
  const rawConsultations = dbConsultations.length > 0
    ? Array.from(
      new Map(
        dbConsultations.map((c: any) => [
          c.id,
          {
            id: c.id,
            patient_name: c.patient_name,
            student_complaint: c.student_complaint || "None",
            time: c.time || new Date(c.created_at).toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' }),
            status: c.status,
            created_at: c.created_at,
            handled_at: c.handled_at,
            notes: c.notes,
          },
        ])
      ).values()
    )
    : recentConsultations.map(c => ({
      ...c,
      created_at: "",
      handled_at: null,
      notes: null,
    }))

  // Filter to only show "waiting" consultations for the recent consultations table
  const waitingConsultations = rawConsultations.filter(
    (c) => c.status === "waiting"
  )

  function todayDateKey() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  }

  const rawAppointments: ApptRow[] = dbAppointments.length > 0
    ? Array.from(
      new Map(
        dbAppointments.map((a: any) => {
          const sa = a.student_accounts
          const name = sa ? `${sa.first_name} ${sa.last_name}` : "Unknown"
          return [
            a.id,
            {
              id: a.id,
              patient_name: name,
              time: a.time_slot,
              reason: a.reason || "—",
              status: a.status,
              appointment_date: a.appointment_date,
              time_slot: a.time_slot,
            },
          ]
        })
      ).values()
    )
    : []

  // "Today's Appointments" card only shows today's date
  const todaysAppointmentsList = rawAppointments.filter(
    (a) => a.appointment_date === todayDateKey()
  )

  // Pagination for consultations (only waiting)
  const consultTotalPages = Math.max(1, Math.ceil(waitingConsultations.length / CONSULT_PAGE_SIZE))
  const consultSafePage = Math.min(consultPage, consultTotalPages)
  const paginatedConsultations = waitingConsultations.slice(
    (consultSafePage - 1) * CONSULT_PAGE_SIZE,
    consultSafePage * CONSULT_PAGE_SIZE
  )

  // Build calendar markers from all appointments
  const markersByDate = useMemo(() => {
    const map: Record<string, CalendarMarker[]> = {}
    for (const apt of dbAppointments) {
      const key = apt.appointment_date
      if (!map[key]) map[key] = []
      map[key].push({ status: apt.status })
    }
    return map
  }, [dbAppointments])

  // Pagination for today's appointments
  const apptTotalPages = Math.max(1, Math.ceil(todaysAppointmentsList.length / APPT_PAGE_SIZE))
  const apptSafePage = Math.min(apptPage, apptTotalPages)
  const paginatedAppointments = todaysAppointmentsList.slice(
    (apptSafePage - 1) * APPT_PAGE_SIZE,
    apptSafePage * APPT_PAGE_SIZE
  )

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description={`Welcome back. Here's your clinic overview for ${today}.`}
      >

      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="In Consultation Today"
          value={liveStats.patientsToday}
        />
        <StatCard
          label="Total Consultations"
          value={liveStats.consultations}
        />
        <StatCard
          label="In Emergency Today"
          value={liveStats.emergencyCases}
        />
        <StatCard
          label="Low Stock Alerts"
          value={liveStats.lowStockAlerts}
        />
      </div>
      {/* 1. Full-Width Appointment Calendar Section */}
      <Card className="shadow-sm border-zinc-200/80 w-full">
        <CardHeader>
          <SectionHeader title="Appointment Calendar" description="Upcoming clinic schedule" />
        </CardHeader>
        <CardContent className="space-y-4">
          <MonthCalendar
            selectedDate={todayDateKey()}
            onSelectDate={(dateKey) => router.push(`/appointments/calendar?date=${dateKey}`)}
            markersByDate={markersByDate}
          />
          <div className="flex items-center justify-between gap-3 pt-2 flex-wrap px-1 border-t border-border/50">
            <div className="flex items-center gap-4 flex-wrap">
              {Object.entries({
                pending: "bg-amber-400",
                confirmed: "bg-blue-500",
                completed: "bg-emerald-500",
                cancelled: "bg-zinc-300",
              }).map(([status, dot]) => (
                <span key={status} className="flex items-center gap-1.5 text-xs capitalize text-muted-foreground">
                  <span className={`size-2 rounded-full ${dot}`} /> {status}
                </span>
              ))}
            </div>
            <Link
              href="/appointments/calendar"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              View Full Calendar
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* 2. Side-by-Side: Waiting Patients & Today's Appointments */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Waiting Patients Card with Pagination */}
        <Card className="shadow-sm flex flex-col justify-between overflow-hidden">
          <div>
            <CardHeader>
              <SectionHeader title="Waiting Patients" description="Live patient queue" />
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              {paginatedConsultations.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No patients waiting.
                </p>
              ) : (
                <div className="w-full overflow-hidden">
                  <Table className="w-full table-fixed text-xs sm:text-sm">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[30%] px-2">Patient</TableHead>
                        <TableHead className="w-[36%] px-2">Complaint</TableHead>
                        <TableHead className="w-[18%] px-1 text-center">Time</TableHead>
                        <TableHead className="w-[16%] px-1 text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedConsultations.map((consult) => (
                        <TableRow
                          key={consult.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => router.push("/consultations")}
                        >
                          <TableCell className="font-medium truncate px-2 py-2.5" title={consult.patient_name}>
                            {consult.patient_name}
                          </TableCell>
                          <TableCell className="truncate px-2 py-2.5 text-muted-foreground" title={consult.student_complaint}>
                            {consult.student_complaint}
                          </TableCell>
                          <TableCell className="text-center px-1 py-2.5 text-xs text-muted-foreground">
                            {consult.time}
                          </TableCell>
                          <TableCell className="text-right px-1 py-2.5">
                            <StatusBadge status={consultationStatusVariant(consult.status)} className="text-[10px] px-1.5 py-0.5">
                              {consult.status.replace("_", " ")}
                            </StatusBadge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </div>
          {paginatedConsultations.length > 0 && (
            <div className="p-4 pt-2 border-t border-border/40">
              <Pagination
                currentPage={consultSafePage}
                totalPages={consultTotalPages}
                totalItems={waitingConsultations.length}
                pageSize={CONSULT_PAGE_SIZE}
                onPageChange={setConsultPage}
              />
            </div>
          )}
        </Card>

        {/* Today's Appointments Card with Pagination */}
        <Card className="shadow-sm flex flex-col justify-between overflow-hidden">
          <div>
            <CardHeader>
              <SectionHeader title="Today's Appointments" description="Scheduled visits for today" />
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              {paginatedAppointments.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No appointments scheduled.
                </p>
              ) : (
                <div className="w-full overflow-hidden">
                  <Table className="w-full table-fixed text-xs sm:text-sm">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[30%] px-2">Patient</TableHead>
                        <TableHead className="w-[18%] px-1 text-center">Time</TableHead>
                        <TableHead className="w-[36%] px-2">Reason</TableHead>
                        <TableHead className="w-[16%] px-1 text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedAppointments.map((appt) => (
                        <TableRow
                          key={appt.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => router.push(`/appointments/calendar?date=${appt.appointment_date}`)}
                        >
                          <TableCell className="font-medium truncate px-2 py-2.5" title={appt.patient_name}>
                            {appt.patient_name}
                          </TableCell>
                          <TableCell className="text-center px-1 py-2.5 text-xs text-muted-foreground">
                            {appt.time}
                          </TableCell>
                          <TableCell className="truncate px-2 py-2.5 text-muted-foreground" title={appt.reason}>
                            {appt.reason}
                          </TableCell>
                          <TableCell className="text-right px-1 py-2.5">
                            <StatusBadge status={appointmentStatusVariant(appt.status)} className="text-[10px] px-1.5 py-0.5">
                              {appt.status.replace("_", " ")}
                            </StatusBadge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </div>
          {paginatedAppointments.length > 0 && (
            <div className="p-4 pt-2 border-t border-border/40">
              <Pagination
                currentPage={apptSafePage}
                totalPages={apptTotalPages}
                totalItems={todaysAppointmentsList.length}
                pageSize={APPT_PAGE_SIZE}
                onPageChange={setApptPage}
              />
            </div>
          )}
        </Card>
      </div>

      {/* 3. Alerts, Emergency, Notifications */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader>
            <SectionHeader title="Medicine Inventory Alerts" />
          </CardHeader>
          <CardContent className="space-y-3">
            {inventoryAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between rounded-md border border-border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{alert.medicine_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {alert.current_stock} / {alert.minimum_stock} units
                  </p>
                </div>
                <StatusBadge status={alert.severity === "critical" ? "danger" : "warning"}>
                  {alert.severity}
                </StatusBadge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <SectionHeader title="Emergency Cases" />
          </CardHeader>
          <CardContent className="space-y-3">
            {emergencyCases.map((emergency) => (
              <div
                key={emergency.id}
                className="rounded-md border border-destructive/20 bg-destructive/5 p-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{emergency.patient_name}</p>
                  <StatusBadge status={emergency.priority === "critical" ? "danger" : "warning"}>
                    {emergency.priority}
                  </StatusBadge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{emergency.complaint}</p>
                <p className="mt-1 text-xs text-muted-foreground">{emergency.time}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <SectionHeader title="Notifications" />
          </CardHeader>
          <CardContent className="space-y-3">
            {notifications.map((notif) => (
              <div key={notif.id} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{notif.title}</p>
                  <StatusBadge status={notif.type}>{notif.type}</StatusBadge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{notif.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{notif.time}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* 4. Recent Activities & AI Insights */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <SectionHeader title="Recent Activities" />
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                <div className="mt-1 size-2 shrink-0 rounded-full bg-muted-foreground" />
                <div>
                  <p className="text-sm">{activity.action}</p>
                  <p className="text-xs text-muted-foreground">
                    {activity.user} · {activity.time}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <Sparkles className="size-4 text-muted-foreground" />
              AI Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {aiInsights.map((insight, i) => (
              <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                {insight}
              </p>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* 5. Full-Width Consultation Trend Section at the Very Bottom */}
      <Card className="shadow-sm w-full">
        <CardHeader>
          <SectionHeader title="Consultation Trend" description="Last 7 days overview" />
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={consultationTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
              <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="count" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}