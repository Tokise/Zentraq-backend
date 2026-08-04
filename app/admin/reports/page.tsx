"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { getAnalyticsOverview } from "@/app/actions/analytics"
import { toast } from "sonner"
import { Activity, Users, FileText, Calendar } from "lucide-react"

interface AnalyticsDTO {
  total_consultations: number
  student_consultations: number
  faculty_consultations: number
  active_incidents: number
  pending_clearances: number
  low_stock_medicines: number
  period_start: string
  period_end: string
}

const StatCard = ({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: any; color: string }) => (
  <Card className="border-zinc-200/80 shadow-sm bg-white">
    <CardContent className="pt-6">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-xs text-zinc-500">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </div>
    </CardContent>
  </Card>
)

export default function AdminReportsPage() {
  const [data, setData] = useState<AnalyticsDTO | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const result = await getAnalyticsOverview()
        if (result.error) {
          toast.error(result.error)
        } else {
          setData(result.overview || null)
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to load reports")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Clinic Reports" description="View clinic-wide analytics and insights." />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-zinc-200/80 shadow-sm bg-white">
              <CardContent className="pt-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-10 w-10 bg-zinc-100 rounded-lg" />
                  <div className="h-4 w-24 bg-zinc-100 rounded" />
                  <div className="h-8 w-16 bg-zinc-100 rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Clinic Reports" description="View clinic-wide analytics and insights." />
        <Card className="border-zinc-200/80 shadow-sm bg-white">
          <CardContent className="py-12 text-center text-muted-foreground">
            No reports data available.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Clinic Reports" description="View clinic-wide analytics and insights." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Consultations" value={data.total_consultations} icon={Activity} color="bg-emerald-50 text-emerald-600" />
        <StatCard label="Student Consultations" value={data.student_consultations} icon={Users} color="bg-blue-50 text-blue-600" />
        <StatCard label="Faculty Consultations" value={data.faculty_consultations} icon={Users} color="bg-purple-50 text-purple-600" />
        <StatCard label="Active Incidents" value={data.active_incidents} icon={FileText} color="bg-red-50 text-red-600" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-zinc-200/80 shadow-sm bg-white">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-4">Clinic Operations</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-600">Pending Clearances</span>
                <span className="font-medium">{data.pending_clearances}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">Low Stock Medicines</span>
                <span className="font-medium">{data.low_stock_medicines}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">Period</span>
                <span className="font-medium">
                  {new Date(data.period_start).toLocaleDateString()} - {new Date(data.period_end).toLocaleDateString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200/80 shadow-sm bg-white">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-2 text-sm text-zinc-600">
              <p>Review pending clearances</p>
              <p>Check low stock alerts</p>
              <p>View incident reports</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}