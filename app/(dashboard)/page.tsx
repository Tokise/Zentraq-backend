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
import {
  aiInsights,
  consultationTrend,
  dashboardStats,
  emergencyCases,
  inventoryAlerts,
  notifications,
  recentActivities,
  recentConsultations,
  todaysAppointments,
} from "@/lib/data/mock-dashboard"

import { useState, useEffect } from "react"
import { createClient } from "@/utils/supabase/client"

function appointmentStatus(status: string) {
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

function consultationStatus(status: string) {
  switch (status) {
    case "emergency":
      return "danger" as const
    case "active":
      return "info" as const
    case "completed":
      return "success" as const
    default:
      return "default" as const
  }
}

export default function DashboardPage() {
  const [dbConsultations, setDbConsultations] = useState<any[]>([])
  const [dbAppointments, setDbAppointments] = useState<any[]>([])
  const supabase = createClient()

  const fetchLiveQueue = async () => {
    try {
      const { data: consults } = await supabase
        .from("consultations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(6)
        
      const { data: appts } = await supabase
        .from("appointments")
        .select("*")
        .order("appointment_time", { ascending: true })
        .limit(6)

      if (consults) setDbConsultations(consults)
      if (appts) setDbAppointments(appts)
    } catch (err) {
      console.error("Error fetching live dashboard queue:", err)
    }
  }

  useEffect(() => {
    fetchLiveQueue()
    const interval = setInterval(fetchLiveQueue, 3000)
    return () => clearInterval(interval)
  }, [])

  const displayConsultations = dbConsultations.length > 0
    ? dbConsultations.map(c => ({
        id: c.id,
        patient_name: c.patient_name,
        chief_complaint: c.chief_complaint || "None",
        time: new Date(c.created_at).toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' }),
        status: c.status
      }))
    : recentConsultations

  const displayAppointments = dbAppointments.length > 0
    ? dbAppointments.map(a => ({
        id: a.id,
        patient_name: a.patient_name,
        time: new Date(a.appointment_time).toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' }),
        type: a.appointment_type,
        status: a.status
      }))
    : todaysAppointments

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
        <Link href="/consultations" className={buttonVariants()}>
          New Consultation
          <ArrowRight className="size-4" />
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Patients Today"
          value={dashboardStats.patientsToday}
          change={dashboardStats.patientsTodayChange}
        />
        <StatCard
          label="Consultations"
          value={dashboardStats.consultations}
          change={dashboardStats.consultationsChange}
        />
        <StatCard
          label="Emergency Cases"
          value={dashboardStats.emergencyCases}
          change={dashboardStats.emergencyCasesChange}
        />
        <StatCard
          label="Low Stock Alerts"
          value={dashboardStats.lowStockAlerts}
          change={dashboardStats.lowStockAlertsChange}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <SectionHeader title="Today's Appointments" />
          </CardHeader>
          <CardContent>
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
                {displayAppointments.map((appt) => (
                  <TableRow key={appt.id}>
                    <TableCell className="font-medium">{appt.patient_name}</TableCell>
                    <TableCell>{appt.time}</TableCell>
                    <TableCell>{appt.type}</TableCell>
                    <TableCell>
                      <StatusBadge status={appointmentStatus(appt.status)}>
                        {appt.status.replace("_", " ")}
                      </StatusBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <SectionHeader title="Recent Consultations" />
          </CardHeader>
          <CardContent>
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
                {displayConsultations.map((consult) => (
                  <TableRow key={consult.id}>
                    <TableCell className="font-medium">{consult.patient_name}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{consult.chief_complaint}</TableCell>
                    <TableCell>{consult.time}</TableCell>
                    <TableCell>
                      <StatusBadge status={consultationStatus(consult.status)}>
                        {consult.status}
                      </StatusBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
    </div>
  )
}
