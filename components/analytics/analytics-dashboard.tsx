"use client"

import { StatCard } from "@/components/stat-card"
import { Stethoscope, HeartPulse, FileCheck, Pill } from "lucide-react"

interface AnalyticsOverview {
  total_consultations: number
  student_consultations: number
  faculty_consultations: number
  active_incidents: number
  pending_clearances: number
  low_stock_medicines: number
  period_start: string
  period_end: string
}

interface AnalyticsDashboardProps {
  overview: AnalyticsOverview
}

export function AnalyticsDashboard({ overview }: AnalyticsDashboardProps) {
  const stats = [
    {
      label: "Total Consultations",
      value: overview.total_consultations,
      icon: Stethoscope
    },
    {
      label: "Active Incidents",
      value: overview.active_incidents,
      icon: HeartPulse
    },
    {
      label: "Pending Clearances",
      value: overview.pending_clearances,
      icon: FileCheck
    },
    {
      label: "Low Stock Medicines",
      value: overview.low_stock_medicines,
      icon: Pill
    }
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h3 className="text-base font-semibold">Overview</h3>
        <div className="text-sm text-muted-foreground">
          {new Date(overview.period_start).toLocaleDateString()} - {new Date(overview.period_end).toLocaleDateString()}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
          />
        ))}
      </div>
    </div>
  )
}