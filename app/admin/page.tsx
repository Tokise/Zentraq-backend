"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { SectionHeader } from "@/components/section-header"
import { StatCard } from "@/components/stat-card"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { getDashboardDataAction } from "@/lib/data/dashboard-actions"
import { Users, GraduationCap, Pill, FileCheck, ShieldAlert } from "lucide-react"

export default function AdminDashboardPage() {
    const [stats, setStats] = useState({
        patientsToday: 0,
        consultations: 0,
        emergencyCases: 0,
        lowStockAlerts: 0,
    })
    const [loading, setLoading] = useState(true)

    const fetchData = useCallback(async () => {
        try {
            const result = await getDashboardDataAction()
            if (result.data) {
                setStats({
                    patientsToday: result.data.stats.patientsToday,
                    consultations: result.data.stats.consultations,
                    emergencyCases: result.data.stats.emergencyCases,
                    lowStockAlerts: 0,
                })
            }
        } catch (err) {
            console.error("Error fetching admin dashboard data:", err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    return (
        <div className="space-y-8">
            <PageHeader
                title="Admin Dashboard"
                description="System overview and clinic management."
            />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="In Consultation Today" value={loading ? "—" : stats.patientsToday} />
                <StatCard label="Total Consultations" value={loading ? "—" : stats.consultations} />
                <StatCard label="In Emergency Today" value={loading ? "—" : stats.emergencyCases} />
                <StatCard label="Low Stock Alerts" value={loading ? "—" : stats.lowStockAlerts} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader>
                        <SectionHeader title="User Management" description="Manage students, faculty, and staff" />
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <p className="flex items-center gap-2 text-muted-foreground">
                            <GraduationCap className="size-4" /> Student accounts
                        </p>
                        <p className="flex items-center gap-2 text-muted-foreground">
                            <Users className="size-4" /> Faculty accounts
                        </p>
                        <p className="flex items-center gap-2 text-muted-foreground">
                            <ShieldAlert className="size-4" /> Staff accounts
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <SectionHeader title="Pharmacy" description="Inventory and dispensing" />
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <p className="flex items-center gap-2 text-muted-foreground">
                            <Pill className="size-4" /> Medicine inventory
                        </p>
                        <p className="flex items-center gap-2 text-muted-foreground">
                            <Pill className="size-4" /> Dispensing log
                        </p>
                        <p className="flex items-center gap-2 text-muted-foreground">
                            <Pill className="size-4" /> Restock requests
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <SectionHeader title="Health Clearances" description="Approvals and certificates" />
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <p className="flex items-center gap-2 text-muted-foreground">
                            <FileCheck className="size-4" /> Pending approvals
                        </p>
                        <p className="flex items-center gap-2 text-muted-foreground">
                            <FileCheck className="size-4" /> Issued certificates
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}