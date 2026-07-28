"use client"
import Link from "next/link"
import { ArrowRight, CalendarDays, Sparkles } from "lucide-react"
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

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { HeartPulse, Loader2, Stethoscope } from "lucide-react"
import { createClient } from "@/utils/supabase/client"

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
  const supabase = createClient()
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // Separate in-flight guards + debounce timers per concern, so a burst of
  // events on one table can't block or pile onto fetches for another table.
  const consultInFlight = useRef(false)
  const apptInFlight = useRef(false)
  const statsInFlight = useRef(false)
  const consultDebounce = useRef<NodeJS.Timeout | null>(null)
  const apptDebounce = useRef<NodeJS.Timeout | null>(null)
  const statsDebounce = useRef<NodeJS.Timeout | null>(null)

  const fetchConsultations = useCallback(async () => {
    if (consultInFlight.current) return
    consultInFlight.current = true
    try {
      const { data } = await supabase
        .from("consultations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50)
      if (data) setDbConsultations(data)
    } catch (err) {
      console.error("fetchConsultations error:", err)
    } finally {
      consultInFlight.current = false
    }
  }, [supabase])

  const fetchAppointments = useCallback(async () => {
    if (apptInFlight.current) return
    apptInFlight.current = true
    try {
      const { data } = await supabase
        .from("student_appointments")
        .select("*, student_accounts(first_name, last_name, student_number, employee_number)")
        .order("appointment_date", { ascending: true })
        .limit(50)
      if (data) setDbAppointments(data)
    } catch (err) {
      console.error("fetchAppointments error:", err)
    } finally {
      apptInFlight.current = false
    }
  }, [supabase])

  // Stats now use filtered, head-only count queries — Postgres does the
  // counting, so we transfer almost no data instead of pulling every
  // consultation row just to filter it client-side.
  const fetchStats = useCallback(async () => {
    if (statsInFlight.current) return
    statsInFlight.current = true
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const [patientsToday, emergencyCases, visitLogsCount] = await Promise.all([
        supabase
          .from("consultations")
          .select("*", { count: "exact", head: true })
          .eq("status", "in_consultation")
          .gte("created_at", today.toISOString()),
        supabase
          .from("consultations")
          .select("*", { count: "exact", head: true })
          .eq("status", "in_emergency"),
        supabase
          .from("visit_logs")
          .select("*", { count: "exact", head: true }),
      ])

      setLiveStats({
        patientsToday: patientsToday.count ?? 0,
        consultations: visitLogsCount.count ?? 0,
        emergencyCases: emergencyCases.count ?? 0,
        lowStockAlerts: inventoryAlerts.length,
      })
    } catch (err) {
      console.error("fetchStats error:", err)
    } finally {
      statsInFlight.current = false
    }
  }, [supabase])

  // Fetch everything once, e.g. on initial mount or realtime reconnect.
  const fetchLiveQueue = useCallback(() => {
    fetchConsultations()
    fetchAppointments()
    fetchStats()
  }, [fetchConsultations, fetchAppointments, fetchStats])

  // Debounce helper — coalesces a burst of realtime events on the same
  // table into a single fetch instead of one per event.
  function makeScheduler(
    ref: { current: NodeJS.Timeout | null },
    fn: () => void
  ) {
    return () => {
      if (ref.current) clearTimeout(ref.current)
      ref.current = setTimeout(fn, REALTIME_DEBOUNCE)
    }
  }

  const scheduleConsultations = useCallback(
    makeScheduler(consultDebounce, () => {
      fetchConsultations()
      fetchStats() // consultation changes affect stats too
    }),
    [fetchConsultations, fetchStats]
  )
  const scheduleAppointments = useCallback(
    makeScheduler(apptDebounce, fetchAppointments),
    [fetchAppointments]
  )
  const scheduleStats = useCallback(
    makeScheduler(statsDebounce, fetchStats),
    [fetchStats]
  )

  useEffect(() => {
    fetchLiveQueue()

    // Start polling as fallback to ensure data stays in sync
    pollRef.current = setInterval(fetchLiveQueue, POLL_INTERVAL)

    const channel = supabase
      .channel("dashboard-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "consultations" },
        () => scheduleConsultations()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "student_appointments" },
        () => scheduleAppointments()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visit_logs" },
        () => scheduleStats()
      )
      .subscribe((status) => {
        // If the realtime channel drops and reconnects, catch up on
        // anything missed while it was down.
        if (status === "SUBSCRIBED") fetchLiveQueue()
      })

    return () => {
      supabase.removeChannel(channel)
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
      ;[consultDebounce, apptDebounce, statsDebounce].forEach((ref) => {
        if (ref.current) {
          clearTimeout(ref.current)
          ref.current = null
        }
      })
    }
  }, [fetchLiveQueue, scheduleConsultations, scheduleAppointments, scheduleStats, supabase])

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
            time: new Date(c.created_at).toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' }),
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <SectionHeader title="Today's Appointments" />
          </CardHeader>
          <CardContent>
            {paginatedAppointments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No appointments scheduled.
              </p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedAppointments.map((appt) => (
                      <TableRow
                        key={appt.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/appointments/calendar?date=${appt.appointment_date}`)}
                      >
                        <TableCell className="font-medium">{appt.patient_name}</TableCell>
                        <TableCell>{appt.time}</TableCell>
                        <TableCell className="max-w-[160px] truncate">{appt.reason}</TableCell>
                        <TableCell>
                          <StatusBadge status={appointmentStatusVariant(appt.status)}>
                            {appt.status.replace("_", " ")}
                          </StatusBadge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <Pagination
                  currentPage={apptSafePage}
                  totalPages={apptTotalPages}
                  totalItems={todaysAppointmentsList.length}
                  pageSize={APPT_PAGE_SIZE}
                  onPageChange={setApptPage}
                />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <SectionHeader title="Waiting Patients" />
          </CardHeader>
          <CardContent>
            {paginatedConsultations.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No patients waiting.
              </p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead>Complaint</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedConsultations.map((consult) => (
                      <TableRow
                        key={consult.id}
                        className="cursor-pointer"
                        onClick={() => router.push("/consultations")}
                      >
                        <TableCell className="font-medium">{consult.patient_name}</TableCell>
                        <TableCell className="max-w-[180px] truncate">{consult.student_complaint}</TableCell>
                        <TableCell>{consult.time}</TableCell>
                        <TableCell>
                          <StatusBadge status={consultationStatusVariant(consult.status)}>
                            {consult.status.replace("_", " ")}
                          </StatusBadge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <Pagination
                  currentPage={consultSafePage}
                  totalPages={consultTotalPages}
                  totalItems={waitingConsultations.length}
                  pageSize={CONSULT_PAGE_SIZE}
                  onPageChange={setConsultPage}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>

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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <SectionHeader
              title="Calendar"
              description="Upcoming clinic schedule"
            />
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-12">
              <CalendarDays className="mb-3 size-8 text-muted-foreground" />
              <p className="text-sm font-medium">
                {todaysAppointmentsList.length} appointment{todaysAppointmentsList.length === 1 ? "" : "s"} today
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {todaysAppointmentsList.filter(a => a.status === "pending" || a.status === "confirmed").length} remaining
              </p>
              <Link
                href="/appointments/calendar"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4")}
              >
                View Calendar
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <SectionHeader title="Consultation Trend" description="Last 7 days" />
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
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

    </div>
  )
}