"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { SectionHeader } from "@/components/section-header"
import { StatCard } from "@/components/stat-card"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { getDashboardDataAction } from "@/lib/data/dashboard-actions"
import { Stethoscope, Users, AlertTriangle, Pill, CreditCard } from "lucide-react"

export default function NurseDashboardPage() {
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
                setStats({
                    patientsToday: result.data.stats.patientsToday,
                    consultations: result.data.stats.consultations,
                    emergencyCases: result.data.stats.emergencyCases,
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

    return (
        <div className="space-y-8">
            <PageHeader
                title="Nurse Dashboard"
                description="Clinic operations and patient queue."
            />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="In Consultation Today" value={loading ? "—" : stats.patientsToday} />
                <StatCard label="Total Consultations" value={loading ? "—" : stats.consultations} />
                <StatCard label="In Emergency Today" value={loading ? "—" : stats.emergencyCases} />
                <StatCard label="Low Stock Alerts" value="—" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader>
                        <SectionHeader title="Consultations" description="Triage and active cases" />
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <p className="flex items-center gap-2 text-muted-foreground">
                            <Stethoscope className="size-4" /> New walk-in
                        </p>
                        <p className="flex items-center gap-2 text-muted-foreground">
                            <Stethoscope className="size-4" /> Triage queue
                        </p>
                        <p className="flex items-center gap-2 text-muted-foreground">
                            <Stethoscope className="size-4" /> Active consultations
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <SectionHeader title="Pharmacy" description="Dispensing and stock" />
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <p className="flex items-center gap-2 text-muted-foreground">
                            <Pill className="size-4" /> Dispense medicine
                        </p>
                        <p className="flex items-center gap-2 text-muted-foreground">
                            <Pill className="size-4" /> Inventory status
                        </p>
                        <p className="flex items-center gap-2 text-muted-foreground">
                            <AlertTriangle className="size-4" /> Low stock alerts
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <SectionHeader title="RFID Check-in" description="Kiosk and patient arrival" />
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <p className="flex items-center gap-2 text-muted-foreground">
                            <CreditCard className="size-4" /> Kiosk status
                        </p>
                        <p className="flex items-center gap-2 text-muted-foreground">
                            <Users className="size-4" /> Check-in log
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}