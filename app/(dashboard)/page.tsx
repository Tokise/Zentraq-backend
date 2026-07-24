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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  todaysAppointments,
} from "@/lib/data/mock-dashboard"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { HeartPulse, Loader2, Stethoscope } from "lucide-react"
import { createClient } from "@/utils/supabase/client"

const CONSULT_PAGE_SIZE = 5
const APPT_PAGE_SIZE = 5

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
    case "emergency":
      return "danger" as const
    case "in_progress":
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
  chief_complaint: string
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
  type: string
  status: string
  appointment_time: string
}

type LiveStats = {
  patientsToday: number
  consultations: number
  emergencyCases: number
  lowStockAlerts: number
}

export default function DashboardPage() {
  const [dbConsultations, setDbConsultations] = useState<any[]>([])
  const [dbAppointments, setDbAppointments] = useState<any[]>([])
  const [selectedConsult, setSelectedConsult] = useState<ConsultRow | null>(null)
  const [selectedAppt, setSelectedAppt] = useState<ApptRow | null>(null)
  const [consultPage, setConsultPage] = useState(1)
  const [apptPage, setApptPage] = useState(1)
  const [liveStats, setLiveStats] = useState<LiveStats>({
    patientsToday: 0,
    consultations: 0,
    emergencyCases: 0,
    lowStockAlerts: 0,
  })
  const supabase = createClient()

  const fetchLiveQueue = useCallback(async () => {
    try {
      const { data: consults } = await supabase
        .from("consultations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50)

      const { data: appts } = await supabase
        .from("appointments")
        .select("*")
        .order("appointment_time", { ascending: true })
        .limit(50)

      if (consults) setDbConsultations(consults)
      if (appts) setDbAppointments(appts)

      // Fetch live stats
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const { data: allConsults } = await supabase
        .from("consultations")
        .select("id, status, created_at")

      if (allConsults) {
        const todayRecords = allConsults.filter(
          (c: any) => new Date(c.created_at) >= today
        )
        setLiveStats({
          patientsToday: todayRecords.length,
          consultations: allConsults.length,
          emergencyCases: allConsults.filter((c: any) => c.status === "emergency").length,
          lowStockAlerts: inventoryAlerts.length,
        })
      }
    } catch (err) {
      console.error("fetchLiveQueue error:", err)
    }
  }, [supabase])

  useEffect(() => {
    fetchLiveQueue()

    const channel = supabase
      .channel("dashboard-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "consultations" },
        () => fetchLiveQueue()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => fetchLiveQueue()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchLiveQueue, supabase])

  // Build display data for consultations
  const rawConsultations = dbConsultations.length > 0
    ? dbConsultations.map(c => ({
      id: c.id,
      patient_name: c.patient_name,
      chief_complaint: c.chief_complaint || "None",
      time: new Date(c.created_at).toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' }),
      status: c.status,
      created_at: c.created_at,
      handled_at: c.handled_at,
      notes: c.notes,
    }))
    : recentConsultations.map(c => ({
      ...c,
      created_at: "",
      handled_at: null,
      notes: null,
    }))

  const rawAppointments = dbAppointments.length > 0
    ? dbAppointments.map(a => ({
      id: a.id,
      patient_name: a.patient_name,
      time: new Date(a.appointment_time).toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' }),
      type: a.appointment_type,
      status: a.status,
      appointment_time: a.appointment_time,
    }))
    : todaysAppointments.map(a => ({
      ...a,
      appointment_time: "",
    }))

  // Pagination for consultations
  const consultTotalPages = Math.max(1, Math.ceil(rawConsultations.length / CONSULT_PAGE_SIZE))
  const consultSafePage = Math.min(consultPage, consultTotalPages)
  const paginatedConsultations = rawConsultations.slice(
    (consultSafePage - 1) * CONSULT_PAGE_SIZE,
    consultSafePage * CONSULT_PAGE_SIZE
  )

  // Pagination for appointments
  const apptTotalPages = Math.max(1, Math.ceil(rawAppointments.length / APPT_PAGE_SIZE))
  const apptSafePage = Math.min(apptPage, apptTotalPages)
  const paginatedAppointments = rawAppointments.slice(
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
          label="Patients Today"
          value={liveStats.patientsToday}
        />
        <StatCard
          label="Total Consultations"
          value={liveStats.consultations}
        />
        <StatCard
          label="Emergency Cases"
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
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedAppointments.map((appt) => (
                      <TableRow
                        key={appt.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedAppt(appt)}
                      >
                        <TableCell className="font-medium">{appt.patient_name}</TableCell>
                        <TableCell>{appt.time}</TableCell>
                        <TableCell>{appt.type}</TableCell>
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
                  totalItems={rawAppointments.length}
                  pageSize={APPT_PAGE_SIZE}
                  onPageChange={setApptPage}
                />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <SectionHeader title="Recent Consultations" />
          </CardHeader>
          <CardContent>
            {paginatedConsultations.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No consultations yet.
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
                        onClick={() => setSelectedConsult(consult)}
                      >
                        <TableCell className="font-medium">{consult.patient_name}</TableCell>
                        <TableCell className="max-w-[180px] truncate">{consult.chief_complaint}</TableCell>
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
                  totalItems={rawConsultations.length}
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
              <p className="text-sm font-medium">5 appointments today</p>
              <p className="mt-1 text-xs text-muted-foreground">3 remaining this afternoon</p>
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

      {/* Consultation Detail Modal */}
      <Dialog
        open={selectedConsult !== null}
        onOpenChange={(open) => { if (!open) setSelectedConsult(null) }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Consultation Details</DialogTitle>
          </DialogHeader>
          {selectedConsult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Patient</p>
                  <p className="text-sm font-medium">{selectedConsult.patient_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <StatusBadge status={consultationStatusVariant(selectedConsult.status)} className="mt-0.5">
                    {selectedConsult.status.replace("_", " ")}
                  </StatusBadge>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Chief Complaint</p>
                <p className="text-sm">{selectedConsult.chief_complaint}</p>
              </div>
              {selectedConsult.created_at && (
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-sm">
                    {new Date(selectedConsult.created_at).toLocaleString("en-US", {
                      dateStyle: "medium", timeStyle: "short",
                    })}
                  </p>
                </div>
              )}
              {selectedConsult.handled_at && (
                <div>
                  <p className="text-xs text-muted-foreground">Handled At</p>
                  <p className="text-sm">
                    {new Date(selectedConsult.handled_at).toLocaleString("en-US", {
                      dateStyle: "medium", timeStyle: "short",
                    })}
                  </p>
                </div>
              )}
              {selectedConsult.notes && (
                <div>
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="text-sm">{selectedConsult.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Appointment Detail Modal */}
      <Dialog
        open={selectedAppt !== null}
        onOpenChange={(open) => { if (!open) setSelectedAppt(null) }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
          </DialogHeader>
          {selectedAppt && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Patient</p>
                  <p className="text-sm font-medium">{selectedAppt.patient_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <StatusBadge status={appointmentStatusVariant(selectedAppt.status)} className="mt-0.5">
                    {selectedAppt.status.replace("_", " ")}
                  </StatusBadge>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Type</p>
                <p className="text-sm">{selectedAppt.type}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Time</p>
                <p className="text-sm">{selectedAppt.time}</p>
              </div>
              {selectedAppt.appointment_time && (
                <div>
                  <p className="text-xs text-muted-foreground">Scheduled</p>
                  <p className="text-sm">
                    {new Date(selectedAppt.appointment_time).toLocaleString("en-US", {
                      dateStyle: "medium", timeStyle: "short",
                    })}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}